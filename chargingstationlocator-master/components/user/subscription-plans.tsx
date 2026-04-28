'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Crown, Zap, Star } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '₹0',
    period: '/month',
    icon: Zap,
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    badge: null,
    features: [
      'Battery monitoring',
      'Nearby station finder',
      'Basic notifications',
      'Session history (7 days)',
    ],
    cta: 'Current Plan',
    ctaVariant: 'outline' as const,
    disabled: true,
  },
  {
    name: 'Pro',
    price: '₹299',
    period: '/month',
    icon: Star,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    badge: 'Popular',
    features: [
      'Everything in Free',
      'Priority queue access',
      '10% discount on charging',
      'AI recommendations',
      'Route & range prediction',
      'Session history (90 days)',
      'SMS alerts',
    ],
    cta: 'Upgrade to Pro',
    ctaVariant: 'default' as const,
    disabled: false,
  },
  {
    name: 'Premium',
    price: '₹599',
    period: '/month',
    icon: Crown,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    badge: 'Best Value',
    features: [
      'Everything in Pro',
      'Reserved charging slots',
      '20% discount on charging',
      'Dedicated support',
      'Carbon offset certificate',
      'Unlimited session history',
      'Early access to new features',
    ],
    cta: 'Upgrade to Premium',
    ctaVariant: 'default' as const,
    disabled: false,
  },
];

export function SubscriptionPlans() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Subscription Plans</h2>
        <p className="text-sm text-muted-foreground mt-1">Unlock priority charging, discounts, and reserved slots</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map(plan => {
          const Icon = plan.icon;
          return (
            <Card key={plan.name} className={`relative border-2 ${plan.border}`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-blue-600 text-white text-xs px-3">{plan.badge}</Badge>
                </div>
              )}
              <CardHeader className="pb-3">
                <div className={`w-10 h-10 ${plan.bg} rounded-lg flex items-center justify-center mb-2`}>
                  <Icon className={`h-5 w-5 ${plan.color}`} />
                </div>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.ctaVariant}
                  className="w-full"
                  disabled={plan.disabled}
                  onClick={() => {
                    if (!plan.disabled) {
                      alert(`${plan.name} plan coming soon! Payment integration will be added.`);
                    }
                  }}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
