import { z } from 'zod';

// Authentication validation schemas
export const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const DeviceRegistrationSchema = z.object({
  vehicleId: z.string()
    .min(6, 'Vehicle ID must be at least 6 characters')
    .regex(/^ESP32-[A-Z0-9]+$/, 'Invalid vehicle ID format'),
  deviceName: z.string().min(1, 'Device name is required')
});

// Battery validation schemas
export const VoltageReportSchema = z.object({
  vehicleId: z.string()
    .min(6, 'Vehicle ID must be at least 6 characters')
    .regex(/^ESP32-[A-Z0-9]+$/, 'Invalid vehicle ID format'),
  voltage: z.number()
    .positive('Voltage must be positive')
    .min(30, 'Voltage too low - check sensor')
    .max(60, 'Voltage too high - check sensor'),
  timestamp: z.string().datetime().optional()
});

export const VoltageSchema = z.object({
  id: z.string(),
  voltage: z.number().positive(),
  percentage: z.number().min(0).max(100),
  timestamp: z.date(),
  status: z.enum(['normal', 'low', 'critical']),
  vehicleId: z.string(),
  userId: z.string(),
  deviceId: z.string()
});

// Station validation schemas
export const StationSchema = z.object({
  name: z.string().min(1, 'Station name is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  pricePerKwh: z.number().positive('Price must be positive'),
  queueLength: z.number().int().min(0, 'Queue length cannot be negative')
});

export const StationSearchSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().positive().optional(),
  maxResults: z.number().int().positive().optional()
});

// Form data types
export type RegisterFormData = z.infer<typeof RegisterSchema>;
export type LoginFormData = z.infer<typeof LoginSchema>;
export type DeviceRegistrationFormData = z.infer<typeof DeviceRegistrationSchema>;
export type VoltageReportData = z.infer<typeof VoltageReportSchema>;
export type StationFormData = z.infer<typeof StationSchema>;
export type StationSearchData = z.infer<typeof StationSearchSchema>;