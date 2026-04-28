'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Battery, Zap, TrendingDown, TrendingUp, Minus,
  RefreshCw, Activity, Users, Square, Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DeviceInfo {
  deviceId: string;
  vehicleId: string;
  deviceName: string;
  isActive: boolean;
  userId: string;
  userName: string;
  userEmail: string;
  latest: {
    percentage: number;
    voltage: number;
    current: number;
    power: number;
    status: 'normal' | 'low' | 'critical';
    currentStatus: 'charging' | 'discharging' | 'idle';
    timestamp: string;
  } | null;
}

interface SimState {
  percentage: number;
  voltage: number;
  current: number;
  power: number;
  mode: 'charging' | 'discharging' | 'idle';
  running: boolean;
  drainRate: number;
  manualVoltage: string;
  manualCurrent: string;
}

function pctToVoltage(pct: number) {
  return parseFloat((44 + (pct / 100) * 10.6).toFixed(2));
}

function getStatus(pct: number): 'normal' | 'low' | 'critical' {
  if (pct <= 15) return 'critical';
  if (pct <= 30) return 'low';
  return 'normal';
}

const STATUS_COLORS = {
  normal: { bar: 'bg-green-500', badge: 'bg-green-100 text-green-700 border-green-200' },
  low: { bar: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  critical: { bar: 'bg-red-500', badge: 'bg-red-100 text-red-700 border-red-200' },
};

function DeviceCard({ device, onRefresh }: { device: DeviceInfo; onRefresh: () => void }) {
  const [sim, setSim] = useState<SimState>({
    percentage: device.latest?.percentage ?? 75,
    voltage: device.latest?.voltage ?? pctToVoltage(75),
    current: device.latest?.current ?? 0,
    power: device.latest?.power ?? 0,
    mode: 'idle',
    running: false,
    drainRate: 1,
    manualVoltage: '',
    manualCurrent: '',
  });
  const [syncing, setSyncing] = useState(false);
  const tickRef = useRef(0);
  const simRef = useRef(sim);
  simRef.current = sim;

  const postReading = useCallback(async (pct: number, voltage: number, current: number) => {
    setSyncing(true);
    try {
      await fetch('/api/battery/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: device.vehicleId,
          voltage,
          current,
          percentage: parseFloat(pct.toFixed(1)),
        }),
      });
    } catch { /* silent */ } finally {
      setSyncing(false);
    }
  }, [device.vehicleId]);

  useEffect(() => {
    if (!sim.running) return;

    // UI tick: update display every 500ms
    const uiInterval = setInterval(() => {
      const prev = simRef.current;
      if (!prev.running) return;

      let pct = prev.percentage;
      let current = 0;

      if (prev.mode === 'discharging') {
        pct = Math.max(0, pct - prev.drainRate * 0.1);
        current = -(prev.drainRate * 2);
      } else if (prev.mode === 'charging') {
        pct = Math.min(100, pct + 0.2);
        current = 8;
      }

      pct = parseFloat(pct.toFixed(1));
      const voltage = pctToVoltage(pct);
      const power = parseFloat((voltage * Math.abs(current)).toFixed(1));

      if (pct <= 0 || pct >= 100) {
        setSim(p => ({ ...p, percentage: pct, voltage, current: 0, power: 0, running: false, mode: 'idle' }));
        postReading(pct, voltage, 0);
        return;
      }

      setSim(p => ({ ...p, percentage: pct, voltage, current, power }));
    }, 500);

    // DB sync: post every 2s independently
    const dbInterval = setInterval(() => {
      const s = simRef.current;
      if (!s.running) return;
      const current = s.mode === 'discharging' ? -(s.drainRate * 2) : s.mode === 'charging' ? 8 : 0;
      console.log('[Simulator] DB sync:', { mode: s.mode, current, percentage: s.percentage, voltage: s.voltage });
      postReading(s.percentage, s.voltage, current);
    }, 2000);

    return () => {
      clearInterval(uiInterval);
      clearInterval(dbInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.running, postReading]);

  const start = (mode: 'charging' | 'discharging') => {
    tickRef.current = 0;
    setSim(prev => ({ ...prev, mode, running: true }));
    // Post immediately after state update — use current sim values + new mode
    const s = simRef.current;
    const current = mode === 'discharging' ? -(s.drainRate * 2) : 8;
    const voltage = pctToVoltage(s.percentage);
    postReading(s.percentage, voltage, current);
  };

  const stop = () => {
    setSim(prev => {
      postReading(prev.percentage, prev.voltage, 0);
      return { ...prev, running: false, mode: 'idle', current: 0, power: 0 };
    });
    setTimeout(onRefresh, 800);
  };

  const applyManual = async () => {
    const v = parseFloat(sim.manualVoltage);
    const c = parseFloat(sim.manualCurrent);
    if (isNaN(v) || isNaN(c)) { toast.error('Enter valid voltage and current'); return; }
    const pct = Math.max(0, Math.min(100, parseFloat(((v - 44) / 10.6 * 100).toFixed(1))));
    const power = parseFloat((v * Math.abs(c)).toFixed(1));
    setSim(prev => ({ ...prev, voltage: v, current: c, power, percentage: pct, manualVoltage: '', manualCurrent: '' }));
    await postReading(pct, v, c);
    toast.success(`Manual reading posted for ${device.vehicleId}`);
    setTimeout(onRefresh, 500);
  };

  const status = getStatus(sim.percentage);
  const colors = STATUS_COLORS[status];

  return (
    <Card className={cn('border-2 transition-colors', sim.running ? 'border-blue-300' : 'border-border')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Battery className="h-4 w-4 text-blue-600" />
              {device.deviceName}
              {sim.running && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />}
              {syncing && <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping inline-block" />}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{device.vehicleId} · {device.userName}</p>
          </div>
          <Badge variant="outline" className={cn('text-[10px]', colors.badge)}>
            {status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Battery bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium">
            <span>{sim.percentage.toFixed(1)}%</span>
            <span className="text-muted-foreground">{sim.voltage.toFixed(2)} V</span>
          </div>
          <div className="relative w-full bg-muted rounded-full h-5 overflow-hidden">
            <div
              className={cn('h-5 rounded-full transition-all duration-300', colors.bar)}
              style={{ width: `${Math.max(sim.percentage, 2)}%` }}
            />
            {sim.mode === 'charging' && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            )}
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">
              {sim.percentage.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Live stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Current', value: `${sim.current > 0 ? '+' : ''}${sim.current.toFixed(1)} A`, sublabel: sim.current < 0 ? 'discharging' : sim.current > 0 ? 'charging' : 'idle', icon: Activity, color: sim.current > 0 ? 'text-green-600' : sim.current < 0 ? 'text-red-500' : 'text-muted-foreground' },
            { label: 'Voltage', value: `${sim.voltage.toFixed(2)} V`, sublabel: 'pack', icon: Zap, color: 'text-blue-600' },
            { label: 'Power', value: `${sim.power.toFixed(1)} W`, sublabel: 'instantaneous', icon: TrendingUp, color: 'text-purple-600' },
          ].map(({ label, value, sublabel, icon: Icon, color }) => (
            <div key={label} className="bg-muted/40 rounded-lg py-2 px-1">
              <Icon className={cn('h-3.5 w-3.5 mx-auto mb-0.5', color)} />
              <p className={cn('text-xs font-semibold', color)}>{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="text-[9px] text-muted-foreground/70">{sublabel}</p>
            </div>
          ))}
        </div>

        {/* Mode controls */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Drain speed</span><span>{sim.drainRate}x</span>
          </div>
          <Slider min={1} max={20} step={1} value={[sim.drainRate]}
            onValueChange={v => setSim(p => ({ ...p, drainRate: v[0] }))}
            disabled={sim.running} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" className="text-xs"
            variant={sim.mode === 'discharging' && sim.running ? 'default' : 'outline'}
            onClick={() => start('discharging')}
            disabled={sim.running && sim.mode !== 'discharging'}>
            <TrendingDown className="h-3 w-3 mr-1" />Drain
          </Button>
          <Button size="sm" className="text-xs"
            variant={sim.mode === 'charging' && sim.running ? 'default' : 'outline'}
            onClick={() => start('charging')}
            disabled={sim.running && sim.mode !== 'charging'}>
            <Zap className="h-3 w-3 mr-1" />Charge
          </Button>
          <Button size="sm" variant="outline" className="text-xs"
            onClick={stop} disabled={!sim.running}>
            <Square className="h-3 w-3 mr-1" />Stop
          </Button>
        </div>

        {/* Manual override */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Manual override</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Voltage (V)</Label>
              <Input className="h-7 text-xs" placeholder="e.g. 50.4"
                value={sim.manualVoltage}
                onChange={e => setSim(p => ({ ...p, manualVoltage: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Current (A)</Label>
              <Input className="h-7 text-xs" placeholder="e.g. -5 or +8"
                value={sim.manualCurrent}
                onChange={e => setSim(p => ({ ...p, manualCurrent: e.target.value }))} />
            </div>
          </div>
          <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={applyManual}>
            <Play className="h-3 w-3 mr-1" />Post Manual Reading
          </Button>
        </div>

        {device.latest && (
          <p className="text-[10px] text-muted-foreground text-center">
            Last DB reading: {new Date(device.latest.timestamp).toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function DeviceSimulatorClient() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDevices = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/devices');
      const data = await res.json();
      if (data.success) setDevices(data.devices);
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 15000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Battery Device Simulator</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and simulate battery data for all registered EV devices
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {devices.length} device{devices.length !== 1 ? 's' : ''}
          </div>
          <Button variant="outline" size="sm" onClick={fetchDevices} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      {devices.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Normal', count: devices.filter(d => d.latest?.status === 'normal').length, color: 'text-green-600 bg-green-50 border-green-200' },
            { label: 'Low', count: devices.filter(d => d.latest?.status === 'low').length, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
            { label: 'Critical', count: devices.filter(d => d.latest?.status === 'critical').length, color: 'text-red-600 bg-red-50 border-red-200' },
          ].map(({ label, count, color }) => (
            <div key={label} className={cn('rounded-lg border px-4 py-3 text-center', color)}>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs font-medium">{label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-80 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Battery className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No registered devices found</p>
          <p className="text-sm mt-1">Users need to register their ESP32 devices first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {devices.map(device => (
            <DeviceCard key={device.deviceId} device={device} onRefresh={fetchDevices} />
          ))}
        </div>
      )}
    </div>
  );
}
