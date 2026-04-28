import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import BatteryVoltage from '@/models/BatteryVoltage';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const docs = await BatteryVoltage.find({}).sort({ timestamp: -1 }).limit(5).lean();
  return NextResponse.json(docs.map(d => ({
    current: d.current,
    power: d.power,
    currentStatus: d.currentStatus,
    voltage: d.voltage,
    percentage: d.percentage,
    timestamp: d.timestamp,
    deviceId: d.deviceId?.toString(),
  })));
}
