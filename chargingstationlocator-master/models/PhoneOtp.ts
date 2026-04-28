import mongoose, { Document, Schema } from 'mongoose';

export interface IPhoneOtp extends Document {
  userId: string;
  phone: string;
  code: string;
  expiresAt: Date;
  attempts: number;
}

const PhoneOtpSchema = new Schema<IPhoneOtp>({
  userId: { type: String, required: true, index: true },
  phone:  { type: String, required: true },
  code:   { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
});

// Auto-delete expired documents
PhoneOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.PhoneOtp ||
  mongoose.model<IPhoneOtp>('PhoneOtp', PhoneOtpSchema);
