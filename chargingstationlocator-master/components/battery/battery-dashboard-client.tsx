'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BatteryChart } from './battery-chart';
import { BatteryAlertSettings } from './battery-alert-settings';
import { LowBatteryNotificationBanner } from './low-battery-notification-banner';
import { BatteryAnalytics } from './battery-analytics';
import {
  Battery, Zap, Activity, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface BatteryData {
  voltage: number;
  current: number;
  power: number;
  percentage: number;
  timestamp: string;
  status: 'normal' | 'low' | 'critical';
  currentStatus: 'charging' | 'discharging' | 'idle';
  vehicleId: string;
  deviceName: string;
}

interface BatteryDashboardClientProps {
  vehicleId: string | null;
}

const STATUS_STYLES = {
  normal:   { badge: 'bg-green-100 text-green-800 border-green-200',   bar: 'bg-green-500',  ring: 'ring-green-200' },
  low:      { badge: 'bg-yellow-100 text-yellow-800 border-yellow-200', bar: 'bg-yellow-500', ring: 'ring-yellow-200' },
  critical: { badge: 'bg-red-100 text-red-800 border-red-200',         bar: 'bg-red-500',    ring: 'ring-red-200' },
};

const CURRENT_STYLES = {
  charging:    { badge: 'bg-green-100 text-green-800 border-green-200', text: 'text-green-600' },
  discharging: { badge: 'bg-red-100 text-red-800 border-red-200',       text: 'text-red-600' },
  idle:        { badge: 'bg-gray-100 text-gray-700 border-gray-200',    text: 'text-gray-600' },
};

function StatCard({
  label,
  value,
  unit,
  sub,
  color,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  unit: string;
  sub?: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-28" />
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
              <p className={cn('text-3xl font-bold', color)}>
                {value}<span className="text-lg font-medium ml-0.5">{unit}</span>
              </p>
              {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
            </div>
            <div className={cn('p-2 rounded-lg bg-opacity-10', color.replace('text-', 'bg-').replace('-600', '-100').replace('-500', '-100'))}>
              <Icon className={cn('h-5 w-5', color)} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BatteryDashboardClient({ vehicleId }: BatteryDashboardClientProps) {
  const [data, setData] = useState<BatteryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const url = vehicleId
        ? `/api/battery?vehicleId=${encodeURIComponent(vehicleId)}`
        : '/api/battery';
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json);
        setError(null);
      } else {
        setError(json.error || 'Failed to fetch battery data');
      }
    } catch {
      setError('Failed to fetch battery data');
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const isNoDevice =
    error?.includes('No registered devices') || error?.includes('Device not found');

  const statusStyle = data ? STATUS_STYLES[data.status] : STATUS_STYLES.normal;
  const currentStyle = data ? CURRENT_STYLES[data.currentStatus] : CURRENT_STYLES.idle;

  const CurrentIcon =
    data?.currentStatus === 'charging'
      ? TrendingUp
      : data?.currentStatus === 'discharging'
      ? TrendingDown
      : Minus;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Battery</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live monitoring, history &amp; analytics
          </p>
        </div>
        {data && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">Live · {data.deviceName}</span>
          </div>
        )}
      </div>

      <LowBatteryNotificationBanner />

      {/* No device */}
      {isNoDevice && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Battery className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">No Device Registered</h3>
              <p className="text-sm text-blue-700 max-w-sm">
                Register your ESP32 device to start monitoring your battery in real-time.
              </p>
            </div>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/register-device">Register Device</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {error && !isNoDevice && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {!isNoDevice && (
        <Tabs defaultValue="live">
          <TabsList className="grid w-full grid-cols-2 max-w-xs">
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* ── Live tab ── */}
          <TabsContent value="live" className="mt-6 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Battery Level"
                value={loading ? '—' : data?.percentage ?? '—'}
                unit="%"
                sub={data ? `Status: ${data.status}` : undefined}
                color={
                  data?.status === 'critical' ? 'text-red-600'
                  : data?.status === 'low' ? 'text-yellow-600'
                  : 'text-green-600'
                }
                icon={Battery}
                loading={loading}
              />
              <StatCard
                label="Voltage"
                value={loading ? '—' : data?.voltage.toFixed(1) ?? '—'}
                unit="V"
                sub="Pack voltage"
                color="text-blue-600"
                icon={Zap}
                loading={loading}
              />
              <StatCard
                label="Current"
                value={loading ? '—' : data ? `${data.current > 0 ? '+' : ''}${data.current.toFixed(1)}` : '—'}
                unit="A"
                sub={data?.currentStatus}
                color={currentStyle.text}
                icon={CurrentIcon}
                loading={loading}
              />
              <StatCard
                label="Power"
                value={loading ? '—' : data?.power.toFixed(1) ?? '—'}
                unit="W"
                sub="Instantaneous"
                color="text-purple-600"
                icon={Activity}
                loading={loading}
              />
            </div>

            {/* Battery bar */}
            {data && (
              <Card>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">Battery Level</span>
                      <Badge variant="outline" className={cn('text-xs', statusStyle.badge)}>
                        {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
                      </Badge>
                      <Badge variant="outline" className={cn('text-xs flex items-center gap-1', currentStyle.badge)}>
                        <CurrentIcon className="h-3 w-3" />
                        {data.currentStatus.charAt(0).toUpperCase() + data.currentStatus.slice(1)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      Updated {new Date(data.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={cn('h-3 rounded-full transition-all duration-700', statusStyle.bar)}
                      style={{ width: `${Math.max(data.percentage, 2)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span className="text-red-500">Critical ≤45V</span>
                    <span className="text-yellow-500">Low ≤48V</span>
                    <span>100%</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <BatteryAlertSettings />
          </TabsContent>

          {/* ── Analytics tab ── */}
          <TabsContent value="analytics" className="mt-6 space-y-6">
            <BatteryChart vehicleId={vehicleId ?? undefined} />
            <BatteryAnalytics />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
