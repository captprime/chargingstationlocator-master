import mongoose, { Document, Schema } from 'mongoose';

export interface IUserNotification extends Document {
  _id: string;
  userId: string;
  sessionId: string | null;
  type: 'position_update' | 'next_in_line' | 'station_available' | 'low_battery';
  metadata?: {
    batteryPercentage?: number;
    nearbyStations?: Array<{ id: string; name: string; distance: number; lat: number; lng: number }>;
    userLat?: number;
    userLng?: number;
  };
  message: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

const UserNotificationSchema = new Schema<IUserNotification>({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    ref: 'User',
  },
  sessionId: {
    type: String,
    required: false,
    ref: 'ChargingSession',
    default: null,
  },
  type: {
    type: String,
    enum: ['position_update', 'next_in_line', 'station_available', 'low_battery'],
    required: [true, 'Notification type is required'],
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: null,
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
  },
  read: {
    type: Boolean,
    required: [true, 'Read status is required'],
    default: false,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: [true, 'Priority is required'],
    default: 'medium',
  },
}, {
  timestamps: true,
});

// Indexes for efficient notification queries
UserNotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
UserNotificationSchema.index({ sessionId: 1, createdAt: -1 });
UserNotificationSchema.index({ userId: 1, type: 1 });
UserNotificationSchema.index({ createdAt: -1 });

export default mongoose.models.UserNotification || mongoose.model<IUserNotification>('UserNotification', UserNotificationSchema);