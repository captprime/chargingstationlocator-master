'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Square, Zap, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatterySimulatorProps {
  /** Called after each successful DB write so the dashboard can re-fetch */
  onUpdate?: () => void;
  /** Seed the simulator from the live reading */
  initialPercentage?: number;
}

function pctToVoltage(pct: number): number {
  return 44 + (pct / 100) * 10.6; // 44V → 54.6V
}

function getStatus(pct: number): 'normal' | 'low' | 'critical' {
  if (pct <= 15) return 'critical';
  if (pct <= 30) return 'low';
  return 'normal';
}

const STATUS_BAR = { normal: 'bg-green-500', low: 'bg-yellow-500', critical: 'bg-red-500' };

export function BatterySimulator({ onUpdate, initialPercentage }: BatterySimulatorProps) {
  const [percentage, setPercentage] = useState(initialPercentage ?? 75);
  const [mode, setMode] = useState<'charging' | 'discharging' | 'idle'>('idle');
  const [running, setRunning] = useState(false);
  const [drainRate, setDrainRate] = useState(1);
  const [syncing, setSyncing] = useState(false);

  // Seed from live data when it arrives
  useEffect(() => {
    if (initialPercentage !== undefined && !running) {
      setPercentage(initialPercentage);
    }
  }, [initialPercentage, running]);

  const pctRef = useRef(percentage);
  pctRef.current = percentage;

  const postReading = useCallback(async (pct: number, current: number) => {
    setSyncing(true);
    try {
      await fetch('/api/battery/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voltage: parseFloat(pctToVoltage(pct).toFixed(2)),
          current,
          percentage: parseFloat(pct.toFixed(1)),
        }),
      });
      onUpdate?.();
    } catch {
      // silent — don't break the UI
    } finally {
      setSyncing(false);
    }
  }, [onUpdate]);

  useEffect(() => {
    if (!running) return;

    // POST every 2 seconds (not every 500ms tick to avoid hammering the DB)
    let tickCount = 0;
    const interval = setInterval(() => {
      setPercentage(prev => {
        let next = prev;
        let current = 0;

        if (mode === 'discharging') {
          next = Math.max(0, prev - drainRate * 0.1);
          current = -(drainRate * 2);
        } else if (mode === 'charging') {
          next = Math.min(100, prev + 0.2);
          current = 8;
        }

        next = parseFloat(next.toFixed(1));

        // Write to DB every 4 ticks (~2s) to keep it responsive without spamming
        tickCount++;
        if (tickCount % 4 === 0) {
          postReading(next, current);
        }

        // Auto-stop at limits
        if (next <= 0 || next >= 100) {
          setRunning(false);
          setMode('idle');
        }

        return next;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [running, mode, drainRate, postReading]);

  const start = (m: 'charging' | 'discharging') => {
    setMode(m);
    setRunning(true);
  };

  const stop = () => {
    setRunning(false);
    setMode('idle');
    // Write final value immediately on stop
    postReading(pctRef.current, 0);
  };

  const status = getStatus(percentage);
  const voltage = pctToVoltage(percentage);
  const current = mode === 'charging' ? 8 : mode === 'discharging' ? -(drainRate * 2) : 0;
  const ModeIcon = mode === 'charging' ? Zap : mode === 'discharging' ? TrendingDown : Minus;

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5 text-blue-600" />
            Battery Simulator
          </span>
          <div className="flex items-center gap-2">
            {running && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
            {syncing && <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />}
            <Badge variant="outline" className={cn(
              'text-xs',
              mode === 'charging' ? 'border-green-300 text-green-700' :
              mode === 'discharging' ? 'border-red-300 text-red-700' :
              'border-gray-300 text-gray-600'
            )}>
              <ModeIcon className="h-3 w-3 mr-1" />
              {mode}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Battery bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-semibold">{percentage.toFixed(1)}%</span>
            <span className="text-muted-foreground">{voltage.toFixed(2)} V</span>
          </div>
          <div className="relative w-full bg-gray-100 rounded-full h-6 overflow-hidden border border-gray-200">
            <div
              className={cn('h-6 rounded-full transition-all duration-300', STATUS_BAR[status])}
              style={{ width: `${Math.max(percentage, 2)}%` }}
            />
            {mode === 'charging' && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            )}
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
              {percentage.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className={cn(status === 'critical' ? 'text-red-500 font-medium' : status === 'low' ? 'text-yellow-600' : '')}>
              {status === 'critical' ? '⚠ Critical' : status === 'low' ? '⚡ Low' : '✓ Normal'}
            </span>
            <span>Current: {current > 0 ? '+' : ''}{current.toFixed(1)} A</span>
          </div>
        </div>

        {/* Drain speed */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Drain speed</span>
            <span>{drainRate}x</span>
          </div>
          <Slider
            min={1} max={10} step={1}
            value={[drainRate]}
            onValueChange={v => setDrainRate(v[0])}
            disabled={running}
          />
        </div>

        {/* Controls */}
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm"
            variant={mode === 'discharging' && running ? 'default' : 'outline'}
            onClick={() => start('discharging')}
            disabled={running && mode !== 'discharging'}
            className="text-xs"
          >
            <TrendingDown className="h-3 w-3 mr-1" />Drain
          </Button>
          <Button size="sm"
            variant={mode === 'charging' && running ? 'default' : 'outline'}
            onClick={() => start('charging')}
            disabled={running && mode !== 'charging'}
            className="text-xs"
          >
            <Zap className="h-3 w-3 mr-1" />Charge
          </Button>
          <Button size="sm" variant="outline"
            onClick={stop} disabled={!running}
            className="text-xs"
          >
            <Square className="h-3 w-3 mr-1" />Stop
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {syncing ? '⟳ Syncing to database…' : 'Changes sync to live dashboard every ~2s'}
        </p>
      </CardContent>
    </Card>
  );
}
