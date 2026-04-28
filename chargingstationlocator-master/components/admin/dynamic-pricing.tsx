'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface Station {
  _id: string;
  name: string;
  pricePerKwh: number;
  queueLength: number;
}

// Peak hours: 8-10am, 5-8pm
const PEAK_HOURS = [8, 9, 17, 18, 19];
const PEAK_MULTIPLIER = 1.3;
const LOW_DEMAND_MULTIPLIER = 0.85;

function getCurrentMultiplier(): { multiplier: number; label: string; isPeak: boolean } {
  const hour = new Date().getHours();
  if (PEAK_HOURS.includes(hour)) {
    return { multiplier: PEAK_MULTIPLIER, label: 'Peak Hours', isPeak: true };
  }
  if (hour >= 0 && hour <= 5) {
    return { multiplier: LOW_DEMAND_MULTIPLIER, label: 'Low Demand', isPeak: false };
  }
  return { multiplier: 1.0, label: 'Normal', isPeak: false };
}

export function DynamicPricing() {
  const { data: session } = useSession();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [dynamicEnabled, setDynamicEnabled] = useState(false);
  const [applying, setApplying] = useState(false);

  const { multiplier, label, isPeak } = getCurrentMultiplier();

  useEffect(() => {
    if (!session) return;
    fetch('/api/admin/stations')
      .then(r => r.json())
      .then(data => { if (data.success) setStations(data.stations); })
      .finally(() => setLoading(false));
  }, [session]);

  const applyDynamicPricing = async () => {
    setApplying(true);
    let successCount = 0;
    for (const station of stations) {
      const newPrice = parseFloat((station.pricePerKwh * multiplier).toFixed(2));
      try {
        const res = await fetch(`/api/admin/stations/${station._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pricePerKwh: newPrice }),
        });
        if (res.ok) successCount++;
      } catch {
        // continue
      }
    }
    setApplying(false);
    toast.success(`Dynamic pricing applied to ${successCount} stations (${label} × ${multiplier})`);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-600" />
          Dynamic Pricing Engine
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Current status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Current Period</p>
            <p className="text-xs text-muted-foreground">{new Date().toLocaleTimeString()}</p>
          </div>
          <div className="text-right">
            <Badge className={isPeak ? 'bg-red-100 text-red-700 border-red-200' : multiplier < 1 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700'}>
              {isPeak ? <TrendingUp className="h-3 w-3 mr-1 inline" /> : <TrendingDown className="h-3 w-3 mr-1 inline" />}
              {label}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">×{multiplier} multiplier</p>
          </div>
        </div>

        {/* Rules */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pricing Rules</p>
          {[
            { time: '8–10 AM, 5–8 PM', rule: 'Peak hours', mult: `×${PEAK_MULTIPLIER}`, color: 'text-red-600' },
            { time: '6 AM – 5 PM', rule: 'Normal hours', mult: '×1.0', color: 'text-gray-600' },
            { time: '12 AM – 6 AM', rule: 'Low demand', mult: `×${LOW_DEMAND_MULTIPLIER}`, color: 'text-green-600' },
          ].map(r => (
            <div key={r.time} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
              <div>
                <span className="font-medium">{r.rule}</span>
                <span className="text-xs text-muted-foreground ml-2">{r.time}</span>
              </div>
              <span className={`font-semibold ${r.color}`}>{r.mult}</span>
            </div>
          ))}
        </div>

        {/* Station preview */}
        {!loading && stations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Price Preview</p>
            {stations.slice(0, 4).map(s => (
              <div key={s._id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate max-w-[60%]">{s.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">₹{s.pricePerKwh}</span>
                  <span className="text-gray-400">→</span>
                  <span className={`font-medium ${isPeak ? 'text-red-600' : multiplier < 1 ? 'text-green-600' : 'text-gray-700'}`}>
                    ₹{(s.pricePerKwh * multiplier).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Switch id="dynamic" checked={dynamicEnabled} onCheckedChange={setDynamicEnabled} />
          <Label htmlFor="dynamic" className="text-sm">Enable auto dynamic pricing</Label>
        </div>

        <Button
          className="w-full"
          onClick={applyDynamicPricing}
          disabled={applying || loading || stations.length === 0}
        >
          {applying ? 'Applying...' : `Apply ${label} Pricing Now`}
        </Button>
      </CardContent>
    </Card>
  );
}
