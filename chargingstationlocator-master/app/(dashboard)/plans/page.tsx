import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { SubscriptionPlans } from '@/components/user/subscription-plans';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Subscription Plans | ChargeSense',
  description: 'Upgrade your plan for priority charging, discounts, and reserved slots',
};

export default async function PlansPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div className="max-w-5xl mx-auto">
      <SubscriptionPlans />
    </div>
  );
}
