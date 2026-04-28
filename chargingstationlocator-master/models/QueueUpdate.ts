import mongoose, { Document, Schema } from 'mongoose';

export interface IQueueUpdate extends Document {
  _id: string;
  stationId: string;
  previousCount: number;
  newCount: number;
  updatedBy: string;
  timestamp: Date;
  reason: 'session_complete' | 'session_join' | 'session_cancel' | 'admin_adjustment';
  createdAt: Date;
  updatedAt: Date;
}

const QueueUpdateSchema = new Schema<IQueueUpdate>({
  stationId: {
    type: String,
    required: [true, 'Station ID is required'],
    ref: 'ChargingStation',
  },
  previousCount: {
    type: Number,
    required: [true, 'Previous count is required'],
    min: [0, 'Previous count cannot be negative'],
  },
  newCount: {
    type: Number,
    required: [true, 'New count is required'],
    min: [0, 'New count cannot be negative'],
  },
  updatedBy: {
    type: String,
    required: [true, 'Updated by user ID is required'],
    ref: 'User',
  },
  timestamp: {
    type: Date,
    required: [true, 'Timestamp is required'],
    default: Date.now,
  },
  reason: {
    type: String,
    enum: ['session_complete', 'session_join', 'session_cancel', 'admin_adjustment'],
    required: [true, 'Reason is required'],
  },
}, {
  timestamps: true,
});

// Indexes for audit trail queries and performance
QueueUpdateSchema.index({ stationId: 1, timestamp: -1 });
QueueUpdateSchema.index({ updatedBy: 1, timestamp: -1 });
QueueUpdateSchema.index({ reason: 1, timestamp: -1 });
QueueUpdateSchema.index({ timestamp: -1 });

export default mongoose.models.QueueUpdate || mongoose.model<IQueueUpdate>('QueueUpdate', QueueUpdateSchema);