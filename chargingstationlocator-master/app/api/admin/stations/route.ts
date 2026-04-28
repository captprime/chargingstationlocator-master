import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, getCurrentAdminId } from '@/lib/admin-utils';
import connectDB from '@/lib/mongodb';
import ChargingStation from '@/models/ChargingStation';
import { z } from 'zod';

// Validation schema for station data
const StationSchema = z.object({
  name: z.string().min(1, 'Station name is required').trim(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  pricePerKwh: z.number().positive('Price must be positive'),
  queueLength: z.number().int().min(0, 'Queue length cannot be negative'),
  amenities: z.array(z.string()).optional().default([]),
  fastCharging: z.boolean().optional().default(false),
  rating: z.number().min(0).max(5).optional().default(0),
  operatingHours: z.object({
    open: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
    close: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format')
  }).optional().default({ open: '06:00', close: '22:00' })
});

// GET /api/admin/stations - Get stations for current admin
export const GET = withAdminAuth(async () => {
  try {
    await connectDB();
    
    const adminId = await getCurrentAdminId();
    const stations = await ChargingStation.find({ adminId }).sort({ createdAt: -1 });
    
    return NextResponse.json({
      success: true,
      stations: stations.map(station => ({
        id: station._id.toString(),
        _id: station._id.toString(),
        name: station.name,
        latitude: station.latitude,
        longitude: station.longitude,
        pricePerKwh: station.pricePerKwh,
        queueLength: station.queueLength,
        amenities: station.amenities,
        fastCharging: (station as any).fastCharging ?? false,
        rating: (station as any).rating ?? 0,
        operatingHours: station.operatingHours,
        adminId: station.adminId,
        stats: station.stats,
        createdAt: station.createdAt,
        updatedAt: station.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching stations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stations' },
      { status: 500 }
    );
  }
});

// POST /api/admin/stations - Add new station for current admin
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    await connectDB();
    
    const body = await req.json();
    const adminId = await getCurrentAdminId();
    
    // Validate request data
    const validatedData = StationSchema.parse(body);
    
    // Create new station with admin ID and default stats
    const stationData = {
      ...validatedData,
      adminId,
      stats: {
        totalSessions: 0,
        totalEnergyDelivered: 0,
        averageSessionDuration: 0,
        revenue: 0,
        lastMaintenanceDate: null,
        uptime: 100
      }
    };
    
    const station = new ChargingStation(stationData);
    await station.save();
    
    return NextResponse.json({
      success: true,
      station: {
        id: station._id.toString(),
        name: station.name,
        latitude: station.latitude,
        longitude: station.longitude,
        pricePerKwh: station.pricePerKwh,
        queueLength: station.queueLength,
        amenities: station.amenities,
        operatingHours: station.operatingHours,
        adminId: station.adminId,
        stats: station.stats,
        createdAt: station.createdAt,
        updatedAt: station.updatedAt
      }
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error creating station:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation error',
          details: error.message
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to create station' },
      { status: 500 }
    );
  }
});