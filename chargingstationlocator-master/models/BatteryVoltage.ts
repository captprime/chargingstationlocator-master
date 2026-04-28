import mongoose, { Document, Schema } from 'mongoose';

export interface IBatteryData extends Document {
  _id: string;
  voltage: number;
  current: number;
  percentage: number;
  power: number; // calculated field: voltage * current
  timestamp: Date;
  status: 'normal' | 'low' | 'critical';
  currentStatus: 'charging' | 'discharging' | 'idle';
  vehicleId: string;
  userId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Keep the old interface for backward compatibility
export interface IBatteryVoltage extends IBatteryData {}

const BatteryDataSchema = new Schema<IBatteryData>({
  voltage: {
    type: Number,
    required: [true, 'Voltage is required'],
    min: [0, 'Voltage must be positive'],
  },
  current: {
    type: Number,
    required: [true, 'Current is required'],
    // Current can be negative (discharging) or positive (charging)
  },
  percentage: {
    type: Number,
    required: [true, 'Percentage is required'],
    min: [0, 'Percentage must be at least 0'],
    max: [100, 'Percentage must be at most 100'],
  },
  power: {
    type: Number,
    required: false, // Will be calculated automatically
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['normal', 'low', 'critical'],
    required: [true, 'Status is required'],
  },
  currentStatus: {
    type: String,
    enum: ['charging', 'discharging', 'idle'],
    required: [true, 'Current status is required'],
  },
  vehicleId: {
    type: String,
    required: [true, 'Vehicle ID is required'],
    trim: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  deviceId: {
    type: Schema.Types.ObjectId,
    ref: 'UserDevice',
    required: [true, 'Device ID is required'],
  },
}, {
  timestamps: true,
});

// Pre-save middleware to calculate power and current status
BatteryDataSchema.pre('save', function(next) {
  // Calculate power (P = V * I)
  this.power = this.voltage * Math.abs(this.current);
  
  // Determine current status based on current value
  if (Math.abs(this.current) < 0.1) {
    this.currentStatus = 'idle';
  } else if (this.current > 0) {
    this.currentStatus = 'charging';
  } else {
    this.currentStatus = 'discharging';
  }
  
  next();
});

// Create indexes for better query performance
BatteryDataSchema.index({ deviceId: 1, timestamp: -1 });
BatteryDataSchema.index({ userId: 1, timestamp: -1 });
BatteryDataSchema.index({ vehicleId: 1, timestamp: -1 });

export default mongoose.models.BatteryVoltage || mongoose.model<IBatteryData>('BatteryVoltage', BatteryDataSchema);