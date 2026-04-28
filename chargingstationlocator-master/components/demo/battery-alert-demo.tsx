'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, BatteryLow, BatteryWarning, Battery, Loader2, CheckCircle, MapPin } from 'lucide-react';
import { toast } from 'sonner';

type Status = 'normal' | 'low' | 'critical';

function getBatteryStatus(pct: number): Status {
  if (pct <= 15) return 'critical';
  if (pct <= 30) return 'low';
  return 'normal';
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: ReactNode }> = {
  normal:   { label: 'Normal',   color: 'bg-green-100 text-green-800 border-green-300',  icon: <Battery className="h-4 w-4 text-green-600" /> },
  low:      { label: 'Low',      color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: <BatteryWarning className="h-4 w-4 text-yellow-600" /> },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-800 border-red-300',        icon: <BatteryLow className="h-4 w-4 text-red-600" /> },
};

export function BatteryAlertDemo() {
  const [percentage, setPercentage] = useState(25);
  const [useLocation, setUseLocation] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ voltage: number; status: string } | null>(null);

  const status = getBatteryStatus(percentage);
  const cfg = STATUS_CONFIG[status];

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUseLocation(true);
        toast.success('Location captured');
      },
      () => toast.error('Could not get location')
    );
  };

  const simulate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/demo/trigger-battery-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          percentage,
          ...(useLocation && coords ? coords : {}),
        }),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || 'Simulation failed');
        return;
      }

      setResult(data.simulated);

      if (status === 'normal') {
        toast.info('Battery is normal — no alert triggered (above threshold)');
      } else {
        toast.success(
          status === 'critical'
            ? '🔴 Critical alert triggered! Check the notification bell.'
            : '🟡 Low battery alert triggered! Check the notification bell.'
        );
      }
    } catch {
      toast.error('Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-dashed border-2 border-muted-foreground/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-purple-500" />
          Demo: Simulate Low Battery Alert
        </CardTitle>
        <CardDescription>
          Trigger a battery alert without a real device. Adjust the percentage and fire — the in-app notification and (if configured) SMS will both trigger.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Percentage slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Battery level: {percentage}%</span>
            <Badge variant="outline" className={`flex items-center gap-1 ${cfg.color}`}>
              {cfg.icon}
              {cfg.label}
            </Badge>
          </div>
          <Slider
            min={1}
            max={100}
            step={1}
            value={[percentage]}
            onValueChange={([v]) => { setPercentage(v); setResult(null); }}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1% — Critical (≤15%)</span>
            <span>Low (≤30%)</span>
            <span>Normal (&gt;30%)</span>
          </div>
        </div>

        {/* Location toggle */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={getLocation} className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {coords ? 'Location captured ✓' : 'Use my location'}
          </Button>
          {coords && (
            <span className="text-xs text-muted-foreground">
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </span>
          )}
          {useLocation && coords && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setUseLocation(false); setCoords(null); }}>
              Clear
            </Button>
          )}
        </div>

        {/* Fire button */}
        <Button
          onClick={simulate}
          disabled={loading}
          className="w-full"
          variant={status === 'critical' ? 'destructive' : status === 'low' ? 'default' : 'secondary'}
        >
          {loading
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Simulating...</>
            : `Simulate ${percentage}% Battery Reading`}
        </Button>

        {/* Result */}
        {result && (
          <div className="rounded-md bg-muted p-3 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Reading saved
            </div>
            <div className="text-muted-foreground">
              Voltage: {result.voltage}V · Status: <span className="font-medium capitalize">{result.status}</span>
            </div>
            {status !== 'normal' && (
              <div className="text-muted-foreground">
                Alert notification created — check the 🔔 bell in the nav bar.
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Demo mode only — disabled in production.
        </p>
      </CardContent>
    </Card>
  );
}
