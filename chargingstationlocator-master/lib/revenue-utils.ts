import ChargingStation from '@/models/ChargingStation';
import ChargingSession from '@/models/ChargingSession';
import { ClientSession } from 'mongoose';

/**
 * Calculates energy consumption based on charging duration
 * This is a simplified calculation - in a real system, this would come from actual meter readings
 */
export function calculateEnergyConsumption(
  chargingStartedAt: Date | undefined,
  completedAt: Date,
  estimatedPowerRate: number = 50 // kW - typical fast charging rate
): number {
  if (!chargingStartedAt) {
    // If no charging start time, assume minimal energy for connection/setup
    return 0.5; // 0.5 kWh minimum
  }

  const chargingDurationMs = completedAt.getTime() - chargingStartedAt.getTime();
  const chargingDurationHours = chargingDurationMs / (1000 * 60 * 60);
  
  // Calculate energy based on duration and power rate
  // Add some randomness to simulate real-world variation (±20%)
  const baseEnergy = chargingDurationHours * estimatedPowerRate;
  const variation = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2 multiplier
  const energyConsumed = baseEnergy * variation;
  
  // Ensure reasonable bounds (0.5 to 100 kWh)
  return Math.max(0.5, Math.min(100, energyConsumed));
}

/**
 * Calculates session revenue based on energy consumed and station price
 */
export function calculateSessionRevenue(
  energyConsumed: number,
  pricePerKwh: number
): number {
  return energyConsumed * pricePerKwh;
}

/**
 * Updates station statistics after a session completion
 */
export async function updateStationStats(
  stationId: string,
  energyConsumed: number,
  sessionRevenue: number,
  sessionDurationMinutes: number,
  mongoSession?: ClientSession
): Promise<void> {
  const station = await ChargingStation.findById(stationId).session(mongoSession || null);
  
  if (!station) {
    throw new Error('Station not found');
  }

  // Update statistics
  const currentStats = station.stats || {
    totalSessions: 0,
    totalEnergyDelivered: 0,
    averageSessionDuration: 0,
    revenue: 0,
    uptime: 100
  };

  const newTotalSessions = currentStats.totalSessions + 1;
  const newTotalEnergyDelivered = currentStats.totalEnergyDelivered + energyConsumed;
  const newTotalRevenue = currentStats.revenue + sessionRevenue;
  
  // Calculate new average session duration
  const totalPreviousDuration = currentStats.averageSessionDuration * currentStats.totalSessions;
  const newAverageSessionDuration = (totalPreviousDuration + sessionDurationMinutes) / newTotalSessions;

  station.stats = {
    ...currentStats,
    totalSessions: newTotalSessions,
    totalEnergyDelivered: newTotalEnergyDelivered,
    averageSessionDuration: Math.round(newAverageSessionDuration),
    revenue: newTotalRevenue
  };

  await station.save({ session: mongoSession || undefined });
}

/**
 * Processes a completed charging session to calculate energy, revenue, and update stats
 */
export async function processSessionCompletion(
  sessionId: string,
  mongoSession?: ClientSession
): Promise<{
  energyConsumed: number;
  sessionRevenue: number;
  sessionDurationMinutes: number;
}> {
  const session = await ChargingSession.findById(sessionId).session(mongoSession || null);
  
  if (!session) {
    throw new Error('Session not found');
  }

  const station = await ChargingStation.findById(session.stationId).session(mongoSession || null);
  
  if (!station) {
    throw new Error('Station not found');
  }

  // Calculate energy consumption
  const energyConsumed = calculateEnergyConsumption(
    session.chargingStartedAt,
    session.completedAt!
  );

  // Calculate revenue
  const sessionRevenue = calculateSessionRevenue(energyConsumed, station.pricePerKwh);

  // Calculate session duration in minutes
  const sessionDurationMs = session.completedAt!.getTime() - session.joinedAt.getTime();
  const sessionDurationMinutes = Math.round(sessionDurationMs / (1000 * 60));

  // Update session with calculated values
  session.energyConsumed = energyConsumed;
  session.sessionRevenue = sessionRevenue;
  await session.save({ session: mongoSession || undefined });

  // Update station statistics
  await updateStationStats(
    session.stationId,
    energyConsumed,
    sessionRevenue,
    sessionDurationMinutes,
    mongoSession
  );

  return {
    energyConsumed,
    sessionRevenue,
    sessionDurationMinutes
  };
}