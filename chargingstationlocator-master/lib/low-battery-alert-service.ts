import connectDB from './mongodb';
import UserNotification from '@/models/UserNotification';
import User from '@/models/User';
import ChargingStation from '@/models/ChargingStation';
import { calculateDistance } from './geo-utils';

interface NearbyStation {
  id: string;
  name: string;
  distance: number;
  lat: number;
  lng: number;
  queueLength: number;
  pricePerKwh: number;
}

interface LowBatteryAlertOptions {
  userId: string;
  vehicleId: string;
  percentage: number;
  userLat?: number;
  userLng?: number;
}

/**
 * Sends a Twilio SMS to the given phone number.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER env vars.
 */
async function sendSMS(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.warn('[SMS] Twilio credentials not configured. Skipping SMS.');
    return false;
  }

  console.log('[SMS] Attempting to send to:', to, '| from:', from);

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
      }
    );

    const result = await response.json();
    if (!response.ok) {
      console.error('[SMS] Twilio error:', JSON.stringify(result));
      return false;
    }

    console.log('[SMS] Sent successfully. SID:', result.sid);
    return true;
  } catch (error) {
    console.error('[SMS] Failed to send SMS:', error);
    return false;
  }
}

/**
 * Finds nearby charging stations given a lat/lng.
 */
async function getNearbyStations(lat: number, lng: number, radiusKm = 20, limit = 3): Promise<NearbyStation[]> {
  const allStations = await ChargingStation.find({}).lean();
  return allStations
    .map((s) => ({
      id: (s._id as { toString(): string }).toString(),
      name: s.name,
      distance: calculateDistance(lat, lng, s.latitude, s.longitude),
      lat: s.latitude,
      lng: s.longitude,
      queueLength: s.queueLength,
      pricePerKwh: s.pricePerKwh,
    }))
    .filter((s) => s.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

/**
 * Checks if a low-battery alert was already sent recently (within 1 hour)
 * to avoid spamming the user.
 */
async function wasAlertSentRecently(userId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await UserNotification.findOne({
    userId,
    type: 'low_battery',
    createdAt: { $gte: oneHourAgo },
  });
  return !!recent;
}

// In-memory lock to prevent concurrent calls racing past the DB throttle check
const alertLocks = new Set<string>();

/**
 * Main function: triggers a low-battery alert (in-app + optional SMS).
 */
export async function triggerLowBatteryAlert(opts: LowBatteryAlertOptions): Promise<void> {
  const { userId, vehicleId, percentage, userLat, userLng } = opts;

  await connectDB();

  // In-memory lock: if another call for this user is already in-flight, skip
  if (alertLocks.has(userId)) return;
  alertLocks.add(userId);

  try {
  // Throttle: don't send more than once per hour
  if (await wasAlertSentRecently(userId)) return;

  const user = await User.findById(userId);
  if (!user) return;

  // Check if battery is below user's threshold
  const threshold = user.batteryAlertThreshold ?? 20;
  if (percentage > threshold) return;

  const appBaseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Find nearby stations if location is available
  let nearbyStations: NearbyStation[] = [];
  if (userLat && userLng) {
    nearbyStations = await getNearbyStations(userLat, userLng);
  }

  // Build the tracking/stations link
  const stationsLink = userLat && userLng
    ? `${appBaseUrl}/stations?lat=${userLat}&lng=${userLng}`
    : `${appBaseUrl}/stations`;

  const isCritical = percentage <= 15;
  const alertLabel = isCritical ? '🔴 CRITICAL' : '🟡 LOW';

  // Build in-app notification message
  let message = `${alertLabel} Battery Alert: Your EV (${vehicleId}) battery is at ${percentage}%. `;
  if (nearbyStations.length > 0) {
    const stationList = nearbyStations
      .map((s) => `${s.name} (${s.distance.toFixed(1)}km)`)
      .join(', ');
    message += `Nearby stations: ${stationList}. `;
  }
  message += `Find stations: ${stationsLink}`;

  // Save in-app notification
  await UserNotification.create({
    userId,
    sessionId: null,
    type: 'low_battery',
    message,
    read: false,
    priority: isCritical ? 'high' : 'medium',
    metadata: {
      batteryPercentage: percentage,
      nearbyStations,
      userLat,
      userLng,
    },
  });

  // Send SMS if enabled, phone is set, and phone is verified
  console.log('[SMS Debug] smsAlertsEnabled:', user.smsAlertsEnabled, '| phone:', user.phone, '| phoneVerified:', user.phoneVerified);

  if (user.smsAlertsEnabled && user.phone && user.phoneVerified) {
    const smsBody = buildSmsMessage(vehicleId, percentage, nearbyStations, stationsLink, isCritical);
    console.log('[SMS Debug] Sending SMS to:', user.phone);
    const sent = await sendSMS(user.phone, smsBody);
    console.log('[SMS Debug] SMS sent:', sent);
  } else {
    if (!user.smsAlertsEnabled) console.warn('[SMS Debug] Skipped: SMS alerts not enabled for this user.');
    if (!user.phone) console.warn('[SMS Debug] Skipped: No phone number on user.');
    if (!user.phoneVerified) console.warn('[SMS Debug] Skipped: Phone not verified.');
  }
  } finally {
    alertLocks.delete(userId);
  }
}

function buildSmsMessage(
  vehicleId: string,
  percentage: number,
  stations: NearbyStation[],
  link: string,
  isCritical: boolean
): string {
  const label = isCritical ? 'CRITICAL' : 'LOW';
  let msg = `ChargeSense Alert: ${label} battery on ${vehicleId} - ${percentage}% remaining.\n`;

  if (stations.length > 0) {
    msg += `Nearest stations:\n`;
    stations.forEach((s, i) => {
      msg += `${i + 1}. ${s.name} - ${s.distance.toFixed(1)}km away\n`;
    });
  }

  msg += `Track & find stations: ${link}`;
  return msg;
}
