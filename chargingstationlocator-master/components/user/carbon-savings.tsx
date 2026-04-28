'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Leaf } from 'lucide-react';

// Average petrol car: ~2.31 kg CO2 per litre, ~15 km/litre → ~0.154 kg CO2/km
// Average EV grid: ~0.082 kg CO2/km (India grid mix)
// Savings per km: 0.154 - 0.082 = 0.072 kg CO2/km
const CO2_SAVED_PER_KWH = 0.5; // kg CO2 saved per kWh charged (vs petrol equivalent)

export function CarbonSavings() {
  const [totalKwh, setTotalKwh] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/sessions/history?limit=100');
        const data = await res.json();
        const sessions = data.sessions ?? data.data?.sessions;
        if (sessions) {
          const kwh = sessions.reduce((sum: number, s: { energyConsumed?: number }) => sum + (s.energyConsumed ?? 0), 0);
          setTotalKwh(kwh);
        }
      } catch {
        setTotalKwh(0);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const co2Saved = totalKwh !== null ? totalKwh * CO2_SAVED_PER_KWH : 0;
  const treesEquivalent = Math.round(co2Saved / 21); // avg tree absorbs ~21 kg CO2/year

  return (
    <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-green-800">
          <Leaf className="h-5 w-5 text-green-600" />
          Carbon Emission Savings
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-16 animate-pulse bg-green-100 rounded-lg" />
        ) : (
          <div className="space-y-4">
            <div className="text-center py-4 bg-white rounded-lg border border-green-200">
              <p className="text-4xl font-bold text-green-700">{co2Saved.toFixed(1)} kg</p>
              <p className="text-sm text-green-600 mt-1">CO₂ saved vs petrol</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center text-sm">
              <div className="bg-white rounded-lg border border-green-100 p-3">
                <p className="text-xl font-bold text-green-700">{totalKwh?.toFixed(1)} kWh</p>
                <p className="text-xs text-muted-foreground">Total energy charged</p>
              </div>
              <div className="bg-white rounded-lg border border-green-100 p-3">
                <p className="text-xl font-bold text-green-700">{treesEquivalent}</p>
                <p className="text-xs text-muted-foreground">Trees equivalent / year</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Based on your charging sessions vs equivalent petrol vehicle
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
