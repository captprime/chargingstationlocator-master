import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import BatteryVoltage from '@/models/BatteryVoltage';
import UserDevice from '@/models/UserDevice';

// DELETE old zero-current readings (demo/legacy data with no real current values)
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  // Find user's devices
  const devices = await UserDevice.find({ userId: session.user.id });
  const deviceIds = devices.map(d => d._id);

  // Delete readings where current is 0 AND power is 0 (legacy demo data)
  const result = await BatteryVoltage.deleteMany({
    deviceId: { $in: deviceIds },
    current: 0,
    power: 0,
  });

  return NextResponse.json({ success: true, deleted: result.deletedCount });
}
