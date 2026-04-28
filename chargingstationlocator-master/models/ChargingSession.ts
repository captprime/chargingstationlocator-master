import mongoose, { Document, Schema } from 'mongoose';

export interface IChargingSession extends Document {
  _id: string;
  userId: string;
  stationId: string;
  joinedAt: Date;
  arrivedAt?: Date;
  chargingStartedAt?: Date;
  completedAt?: Date;
  status: 'active' | 'completed' | 'cancelled';
  trackingStatus: 'driving' | 'arrived' | 'charging' | 'completed';
  queuePosition: number;
  estimatedWaitTime?: number;
  energyConsumed?: number; // in kWh
  sessionRevenue?: number; // calculated revenue for this session
  createdAt: Date;
  updatedAt: Date;
}

const ChargingSessionSchema = new Schema<IChargingSession>({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    ref: 'User',
  },
  stationId: {
    type: String,
    required: [true, 'Station ID is required'],
    ref: 'ChargingStation',
  },
  joinedAt: {
    type: Date,
    required: [true, 'Join time is required'],
    default: Date.now,
  },
  arrivedAt: {
    type: Date,
  },
  chargingStartedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    required: [true, 'Status is required'],
    default: 'active',
  },
  trackingStatus: {
    type: String,
    enum: ['driving', 'arrived', 'charging', 'completed'],
    required: [true, 'Tracking status is required'],
    default: 'driving',
  },
  queuePosition: {
    type: Number,
    required: [true, 'Queue position is required'],
    min: [1, 'Queue position must be at least 1'],
  },
  estimatedWaitTime: {
    type: Number,
    min: [0, 'Estimated wait time cannot be negative'],
  },
  energyConsumed: {
    type: Number,
    min: [0, 'Energy consumed cannot be negative'],
  },
  sessionRevenue: {
    type: Number,
    min: [0, 'Session revenue cannot be negative'],
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
ChargingSessionSchema.index({ userId: 1, status: 1 });
ChargingSessionSchema.index({ stationId: 1, status: 1 });
ChargingSessionSchema.index({ stationId: 1, queuePosition: 1 });
ChargingSessionSchema.index({ status: 1, joinedAt: 1 });

export default mongoose.models.ChargingSession || mongoose.model<IChargingSession>('ChargingSession', ChargingSessionSchema);