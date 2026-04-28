import bcrypt from 'bcryptjs';
import { User, UserDevice } from '@/types/auth';

// Password hashing utilities
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

// User utilities
export function createUser(data: {
  name: string;
  email: string;
  password: string;
  role?: 'user' | 'admin';
}): Omit<User, 'devices'> {
  return {
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    email: data.email.toLowerCase(),
    name: data.name,
    password: data.password, // Should be hashed before calling this
    role: data.role || 'user',
    createdAt: new Date()
  };
}

export function createUserDevice(data: {
  userId: string;
  vehicleId: string;
  deviceName: string;
}): UserDevice {
  return {
    id: `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId: data.userId,
    vehicleId: data.vehicleId.toUpperCase(),
    deviceName: data.deviceName,
    isActive: true,
    registeredAt: new Date()
  };
}

// Session utilities
export function generateSessionToken(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 16)}`;
}

export function isSessionExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

export function createSessionExpiry(hours: number = 24): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
}

// Role-based access utilities
export function isAdmin(user: { role: string }): boolean {
  return user.role === 'admin';
}

export function isUser(user: { role: string }): boolean {
  return user.role === 'user';
}

export function hasRole(user: { role: string }, requiredRole: 'user' | 'admin'): boolean {
  if (requiredRole === 'admin') {
    return user.role === 'admin';
  }
  return user.role === 'user' || user.role === 'admin';
}

// Email utilities
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Vehicle ID utilities
export function isValidVehicleId(vehicleId: string): boolean {
  const vehicleIdRegex = /^ESP32-[A-Z0-9]+$/;
  return vehicleIdRegex.test(vehicleId);
}

export function normalizeVehicleId(vehicleId: string): string {
  return vehicleId.toUpperCase().trim();
}