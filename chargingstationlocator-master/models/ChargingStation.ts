import mongoose, { Document, Schema } from 'mongoose';

export interface IChargingStation extends Document {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
  pricePerKwh: number;
  queueLength: number;
  amenities: string[];
  fastCharging: boolean;
  rating: number; // 0-5
  operatingHours: {
    open: string;
    close: string;
  };
  adminId: string; // Reference to the admin who owns this station
  stats: {
    totalSessions: number;
    totalEnergyDelivered: number; // in kWh
    averageSessionDuration: number; // in minutes
    revenue: number; // total revenue generated
    lastMaintenanceDate?: Date;
    uptime: number; // percentage uptime
  };
  createdAt: Date;
  updatedAt: Date;
}

const ChargingStationSchema = new Schema<IChargingStation>({
  name: {
    type: String,
    required: [true, 'Station name is required'],
    trim: true,
  },
  latitude: {
    type: Number,
    required: [true, 'Latitude is required'],
    min: [-90, 'Latitude must be between -90 and 90'],
    max: [90, 'Latitude must be between -90 and 90'],
  },
  longitude: {
    type: Number,
    required: [true, 'Longitude is required'],
    min: [-180, 'Longitude must be between -180 and 180'],
    max: [180, 'Longitude must be between -180 and 180'],
  },
  pricePerKwh: {
    type: Number,
    required: [true, 'Price per kWh is required'],
    min: [0, 'Price must be positive'],
  },
  queueLength: {
    type: Number,
    required: [true, 'Queue length is required'],
    min: [0, 'Queue length cannot be negative'],
    default: 0,
  },
  amenities: [{
    type: String,
    trim: true,
  }],
  fastCharging: {
    type: Boolean,
    default: false,
  },
  rating: {
    type: Number,
    default: 0,
    min: [0, 'Rating must be at least 0'],
    max: [5, 'Rating must be at most 5'],
  },
  operatingHours: {
    open: {
      type: String,
      required: [true, 'Opening hours are required'],
    },
    close: {
      type: String,
      required: [true, 'Closing hours are required'],
    },
  },
  adminId: {
    type: String,
    required: [true, 'Admin ID is required'],
    ref: 'User',
  },
  stats: {
    totalSessions: {
      type: Number,
      default: 0,
      min: [0, 'Total sessions cannot be negative'],
    },
    totalEnergyDelivered: {
      type: Number,
      default: 0,
      min: [0, 'Total energy delivered cannot be negative'],
    },
    averageSessionDuration: {
      type: Number,
      default: 0,
      min: [0, 'Average session duration cannot be negative'],
    },
    revenue: {
      type: Number,
      default: 0,
      min: [0, 'Revenue cannot be negative'],
    },
    lastMaintenanceDate: {
      type: Date,
      default: null,
    },
    uptime: {
      type: Number,
      default: 100,
      min: [0, 'Uptime cannot be negative'],
      max: [100, 'Uptime cannot exceed 100%'],
    },
  },
}, {
  timestamps: true,
});

// Helpful index for admin-owned queries
ChargingStationSchema.index({ adminId: 1, createdAt: -1 });

export default mongoose.models.ChargingStation || mongoose.model<IChargingStation>('ChargingStation', ChargingStationSchema);