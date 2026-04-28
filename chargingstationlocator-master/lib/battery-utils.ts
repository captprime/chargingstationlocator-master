import { BatteryVoltage, BatteryConfig } from '@/types/battery';

// Default battery configuration
export const defaultBatteryConfig: BatteryConfig = {
  minVoltage: 44.0,
  maxVoltage: 54.6,
  lowThreshold: 48.0,
  criticalThreshold: 45.0
};

// Battery calculation utilities
export function voltageToPercentage(voltage: number, config: BatteryConfig = defaultBatteryConfig): number {
  // Linear interpolation between min and max voltage
  const percentage = ((voltage - config.minVoltage) / (config.maxVoltage - config.minVoltage)) * 100;
  return Math.max(0, Math.min(100, Math.round(percentage)));
}

export function getBatteryStatus(voltage: number, config: BatteryConfig = defaultBatteryConfig): 'normal' | 'low' | 'critical' {
  if (voltage <= config.criticalThreshold) return 'critical';
  if (voltage <= config.lowThreshold) return 'low';
  return 'normal';
}

export function createBatteryReading(
  voltage: number, 
  vehicleId: string, 
  userId: string, 
  deviceId: string
): BatteryVoltage {
  return {
    id: `reading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    voltage,
    percentage: voltageToPercentage(voltage),
    timestamp: new Date(),
    status: getBatteryStatus(voltage),
    vehicleId,
    userId,
    deviceId
  };
}

// Battery status utilities
export function isBatteryLow(voltage: number, config: BatteryConfig = defaultBatteryConfig): boolean {
  return voltage <= config.lowThreshold;
}

export function isBatteryCritical(voltage: number, config: BatteryConfig = defaultBatteryConfig): boolean {
  return voltage <= config.criticalThreshold;
}

export function getBatteryStatusColor(status: 'normal' | 'low' | 'critical'): string {
  switch (status) {
    case 'critical':
      return 'text-red-600';
    case 'low':
      return 'text-yellow-600';
    case 'normal':
    default:
      return 'text-green-600';
  }
}

export function getBatteryStatusIcon(status: 'normal' | 'low' | 'critical'): string {
  switch (status) {
    case 'critical':
      return '🔴';
    case 'low':
      return '🟡';
    case 'normal':
    default:
      return '🟢';
  }
}

// Voltage validation
export function isValidVoltage(voltage: number): boolean {
  return voltage >= 30 && voltage <= 60 && !isNaN(voltage);
}

export function sanitizeVoltage(voltage: number): number {
  return Math.round(voltage * 10) / 10; // Round to 1 decimal place
}