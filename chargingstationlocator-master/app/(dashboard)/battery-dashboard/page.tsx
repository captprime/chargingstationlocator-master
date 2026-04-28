import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import UserDevice from '@/models/UserDevice';
import { BatteryDashboardClient } from '@/components/battery/battery-dashboard-client';

export const metadata: Metadata = {
  title: 'Battery',
  description: 'Real-time battery monitoring, analytics, and alert settings',
};

export default async function BatteryDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  await connectDB();
  const userDevice = await UserDevice.findOne({
    userId: new mongoose.Types.ObjectId(session.user.id),
  });
  const vehicleId = userDevice ? userDevice.vehicleId : null;

  return <BatteryDashboardClient vehicleId={vehicleId} />;
}
