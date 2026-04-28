// Battery monitoring types
export interface BatteryVoltage {
  id: string;        // Unique reading ID
  voltage: number;   // Current voltage reading
  percentage: number; // Calculated battery percentage (0-100)
  timestamp: Date;   // When reading was taken
  status: 'normal' | 'low' | 'critical';
  vehicleId: string; // Links to UserDevice.vehicleId
  userId: string;    // Links to User.id for quick filtering
  deviceId: string;  // Links to UserDevice.id
}

export interface VoltageHistory {
  readings: BatteryVoltage[];
  period: 'day' | 'week' | 'month';
  vehicleId: string;
  deviceInfo: {
    deviceName: string;
    vehicleId: string;
  };
}

export interface BatteryConfig {
  minVoltage: number;    // Minimum safe voltage (e.g., 44V)
  maxVoltage: number;    // Maximum voltage when fully charged (e.g., 54.6V)
  lowThreshold: number;  // Low battery warning threshold (e.g., 48V)
  criticalThreshold: number; // Critical battery threshold (e.g., 45V)
}