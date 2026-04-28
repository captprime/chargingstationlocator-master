import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import UserDevice from '@/models/UserDevice';
import BatteryVoltage from '@/models/BatteryVoltage';
import User from '@/models/User';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  // Admins see all devices; regular users see only their own
  const query = session.user.role === 'admin' ? {} : { userId: session.user.id };
  const devices = await UserDevice.find(query).lean();

  const results = await Promise.all(devices.map(async (device) => {
    const latest = await BatteryVoltage.findOne({ deviceId: device._id })
      .sort({ timestamp: -1 })
      .lean();

    const user = await User.findById(device.userId).select('name email').lean() as { name?: string; email?: string } | null;

    return {
      deviceId: (device._id as { toString(): string }).toString(),
      vehicleId: device.vehicleId,
      deviceName: device.deviceName,
      isActive: device.isActive,
      userId: device.userId.toString(),
      userName: user?.name ?? 'Unknown',
      userEmail: user?.email ?? '',
      latest: latest ? {
        percentage: latest.percentage,
        voltage: latest.voltage,
        current: latest.current,
        power: latest.power,
        status: latest.status,
        currentStatus: latest.currentStatus,
        timestamp: latest.timestamp,
      } : null,
    };
  }));

  return NextResponse.json({ success: true, devices: results });
}
