'use client';

import { RouteRangePredictor } from '@/components/stations/route-range-predictor';
import { CarbonSavings } from '@/components/user/carbon-savings';

export function DashboardTools() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <RouteRangePredictor />
      <CarbonSavings />
    </div>
  );
}
