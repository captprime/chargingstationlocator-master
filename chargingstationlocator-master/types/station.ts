// Charging station types
export interface ChargingStation {
  id?: string;
  _id?: string | { toString(): string };
  name: string;
  latitude: number;
  longitude: number;
  pricePerKwh: number;
  queueLength: number;
  distance?: number;
  amenities?: string[];
  fastCharging?: boolean;
  rating?: number;
  operatingHours?: {
    open: string;
    close: string;
  };
  adminId?: string; // Reference to the admin who owns this station
  stats?: {
    totalSessions: number;
    totalEnergyDelivered: number; // in kWh
    averageSessionDuration: number; // in minutes
    revenue: number; // total revenue generated
    lastMaintenanceDate?: Date;
    uptime: number; // percentage uptime
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StationSearchParams {
  latitude: number;
  longitude: number;
  radius?: number; // in kilometers
  maxResults?: number;
}

export interface StationFormData {
  name: string;
  latitude: number;
  longitude: number;
  pricePerKwh: number;
  queueLength: number;
}