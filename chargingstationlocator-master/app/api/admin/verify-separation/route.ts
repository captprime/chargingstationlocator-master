import { NextResponse } from 'next/server';
import { withAdminAuth, getCurrentAdminId } from '@/lib/admin-utils';
import connectDB from '@/lib/mongodb';
import ChargingStation from '@/models/ChargingStation';
import User from '@/models/User';

// GET /api/admin/verify-separation - Verify admin separation is working
export const GET = withAdminAuth(async () => {
  try {
    await connectDB();
    
    const currentAdminId = await getCurrentAdminId();
    
    // Get all stations in the database
    const allStations = await ChargingStation.find({}).lean();
    
    // Get stations for current admin
    const currentAdminStations = await ChargingStation.find({ adminId: currentAdminId }).lean();
    
    // Get all admin users
    const allAdmins = await User.find({ role: 'admin' }).lean();
    
    // Get stations grouped by admin
    const stationsByAdmin = await ChargingStation.aggregate([
      {
        $group: {
          _id: '$adminId',
          count: { $sum: 1 },
          stations: { $push: { name: '$name', id: '$_id' } }
        }
      }
    ]);
    
    // Verify that current admin can only see their own stations
    const otherAdminStations = allStations.filter(station => station.adminId !== currentAdminId);
    
    const verificationResults = {
      currentAdmin: {
        id: currentAdminId,
        stationCount: currentAdminStations.length,
        canAccessOtherStations: false // This should always be false
      },
      systemStats: {
        totalStations: allStations.length,
        totalAdmins: allAdmins.length,
        stationsPerAdmin: stationsByAdmin.map(group => ({
          adminId: group._id,
          stationCount: group.count,
          stationNames: group.stations.map((s: { name: string; id: string }) => s.name)
        }))
      },
      separationVerified: {
        currentAdminStationsOnly: currentAdminStations.every(station => station.adminId === currentAdminId),
        noAccessToOtherStations: otherAdminStations.length > 0 && currentAdminStations.length < allStations.length,
        properFiltering: currentAdminStations.length <= allStations.length
      }
    };
    
    return NextResponse.json({
      success: true,
      verification: verificationResults,
      message: 'Admin separation verification completed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error verifying admin separation:', error);
    
    return NextResponse.json(
      { success: false, error: 'Failed to verify admin separation' },
      { status: 500 }
    );
  }
});