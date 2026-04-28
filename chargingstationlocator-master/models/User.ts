import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  _id: string;
  email: string;
  name: string;
  password: string;
  phone?: string;
  phoneVerified: boolean;
  role: 'user' | 'admin';
  batteryAlertThreshold: number; // percentage, default 20
  smsAlertsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
  },
  phone: {
    type: String,
    trim: true,
    default: null,
  },
  phoneVerified: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  batteryAlertThreshold: {
    type: Number,
    default: 20,
    min: [5, 'Threshold must be at least 5%'],
    max: [50, 'Threshold must be at most 50%'],
  },
  smsAlertsEnabled: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);