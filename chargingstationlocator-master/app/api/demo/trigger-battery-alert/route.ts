import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import UserDevice from '@/models/UserDevice';
import BatteryVoltage from '@/models/BatteryVoltage';
import { triggerLowBatteryAlert } from '@/lib/low-battery-alert-service';
import mongoose from 'mongoose';

// Demo-only route: simulates a battery reading without requiring a real device token.
// Should be disabled or removed in production.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Demo not available in production' }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const body = await request.json();
  const { percentage, lat, lng } = body;

  if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
    return NextResponse.json({ success: false, error: 'percentage must be 0–100' }, { status: 400 });
  }

  // Find user's active device
  const device = await UserDevice.findOne({ userId: new mongoose.Types.ObjectId(session.user.id) });
  if (!device) {
    return NextResponse.json(
      { success: false, error: 'No registered device found. Register a device first.' },
      { status: 404 }
    );
  }

  // Derive voltage from percentage (48V pack: 40V=0%, 54.6V=100%)
  const voltage = 40 + (percentage / 100) * 14.6;
  const current = -5; // simulated discharging

  let status: 'normal' | 'low' | 'critical';
  if (percentage <= 15) status = 'critical';
  else if (percentage <= 30) status = 'low';
  else status = 'normal';

  // Save a real battery reading so the dashboard reflects it
  const reading = new BatteryVoltage({
    voltage,
    current,
    percentage,
    status,
    vehicleId: device.vehicleId,
    userId: session.user.id,
    deviceId: device._id,
    timestamp: new Date(),
  });
  await reading.save();

  // Trigger the alert (bypasses throttle for demo by deleting recent alerts first)
  const UserNotification = (await import('@/models/UserNotification')).default;
  await UserNotification.deleteMany({ userId: session.user.id, type: 'low_battery' });

  console.log('[Demo] Triggering alert for userId:', session.user.id, 'vehicleId:', device.vehicleId, 'percentage:', percentage);

  await triggerLowBatteryAlert({
    userId: session.user.id,
    vehicleId: device.vehicleId,
    percentage,
    userLat: typeof lat === 'number' ? lat : undefined,
    userLng: typeof lng === 'number' ? lng : undefined,
  });

  console.log('[Demo] triggerLowBatteryAlert completed');

  return NextResponse.json({
    success: true,
    simulated: { voltage: +voltage.toFixed(2), current, percentage, status },
  });
}
