import mongoose, { Document, Schema } from 'mongoose';

export interface IUserDevice extends Document {
  _id: string;
  userId: mongoose.Types.ObjectId;
  vehicleId: string;
  deviceName: string;
  isActive: boolean;
  registeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserDeviceSchema = new Schema<IUserDevice>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  vehicleId: {
    type: String,
    required: [true, 'Vehicle ID is required'],
    unique: true,
    trim: true,
  },
  deviceName: {
    type: String,
    required: [true, 'Device name is required'],
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  registeredAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

export default mongoose.models.UserDevice || mongoose.model<IUserDevice>('UserDevice', UserDeviceSchema);