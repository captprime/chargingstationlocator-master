// Authentication types for NextAuth.js integration
export interface User {
    id: string;
    email: string;
    name: string;
    password: string; // Hashed password
    role: 'user' | 'admin';
    createdAt: Date;
    devices: UserDevice[];
}

export interface UserDevice {
    id: string;
    userId: string;
    vehicleId: string; // Unique ESP32 device ID
    deviceName: string; // User-friendly name
    isActive: boolean;
    registeredAt: Date;
}

// NextAuth.js Session Types (will be properly configured when NextAuth is set up)
export interface NextAuthSession {
    user: {
        id: string;
        email: string;
        name: string;
        role: 'user' | 'admin';
    };
    expires: string;
}

export interface NextAuthUser {
    id: string;
    email: string;
    name: string;
    role: 'user' | 'admin';
}

export interface NextAuthJWT {
    id: string;
    role: 'user' | 'admin';
    email: string;
    name: string;
}

export interface AuthSession {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
}

export interface AdminUser {
    id: string;
    username: string;
    role: 'admin';
}