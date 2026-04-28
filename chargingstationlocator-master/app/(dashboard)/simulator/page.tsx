import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { DeviceSimulatorClient } from '@/components/admin/device-simulator-client';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Battery Simulator',
  description: 'Monitor and simulate battery data for all registered EV devices',
};

export default async function SimulatorPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <DeviceSimulatorClient />;
}
