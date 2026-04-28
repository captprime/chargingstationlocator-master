'use client';

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Minus, Battery, AlertTriangle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatteryReading {
  id: string;
  voltage: number;
  current: number;
  power: number;
  percentage: number;
  timestamp: string;
  status: 'normal' | 'low' | 'critical';
  currentStatus: 'charging' | 'discharging' | 'idle';
  vehicleId: string;
}

interface BatteryHistoryData {
  success: boolean;
  readings: BatteryReading[];
  period: 'day' | 'week' | 'month';
  deviceInfo: {
    deviceName: string;
    vehicleId: string;
  };
  totalReadings: number;
  dateRange: {
    start: string;
    end: string;
  };
  statistics: {
    voltage: { min: number; max: number; avg: number };
    current: { min: number; max: number; avg: number };
    power: { min: number; max: number; avg: number };
  };
}

interface ChartDataPoint {
  timestamp: string;
  voltage: number;
  current: number;
  power: number;
  percentage: number;
  status: string;
  currentStatus: string;
  formattedTime: string;
  formattedDate: string;
}

interface BatteryChartProps {
  vehicleId?: string;
  className?: string;
  defaultPeriod?: 'day' | 'week' | 'month';
}

export function BatteryChart({ vehicleId, className, defaultPeriod = 'day' }: BatteryChartProps) {
  const [historyData, setHistoryData] = useState<BatteryHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>(defaultPeriod);
  const [activeTab, setActiveTab] = useState('voltage');
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const fetchHistoryData = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          period: selectedPeriod,
        });

        if (vehicleId) {
          params.append('vehicleId', vehicleId);
        }

        const response = await fetch(`/api/battery-history?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch battery history');
        }

        if (data.success) {
          setHistoryData(data);
        } else {
          throw new Error(data.error || 'Failed to fetch battery history');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchHistoryData();
  }, [vehicleId, selectedPeriod]);

  // Transform data for the chart
  const chartData: ChartDataPoint[] = React.useMemo(() => {
    if (!historyData?.readings) return [];

    return historyData.readings
      .slice()
      .reverse() // Show oldest to newest for time series
      .map((reading) => {
        const date = new Date(reading.timestamp);
        return {
          timestamp: reading.timestamp,
          voltage: reading.voltage,
          current: reading.current,
          power: reading.power,
          percentage: reading.percentage,
          status: reading.status,
          currentStatus: reading.currentStatus,
          formattedTime: date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          formattedDate: date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            ...(selectedPeriod === 'month' && { year: '2-digit' })
          }),
        };
      });
  }, [historyData, selectedPeriod]);

  // Calculate trends
  const trends = React.useMemo(() => {
    if (chartData.length < 2) return null;

    const first = chartData[0];
    const last = chartData[chartData.length - 1];

    const voltageChange = last.voltage - first.voltage;
    const currentChange = last.current - first.current;
    const powerChange = last.power - first.power;

    return {
      voltage: {
        direction: voltageChange > 0.1 ? 'up' : voltageChange < -0.1 ? 'down' : 'stable',
        change: Math.abs(voltageChange),
      },
      current: {
        direction: currentChange > 0.1 ? 'up' : currentChange < -0.1 ? 'down' : 'stable',
        change: Math.abs(currentChange),
      },
      power: {
        direction: powerChange > 1 ? 'up' : powerChange < -1 ? 'down' : 'stable',
        change: Math.abs(powerChange),
      },
    };
  }, [chartData]);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint }>; label?: string }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const date = new Date(data.timestamp);

      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900">
            {date.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          <div className="mt-1 space-y-1">
            <p className="text-sm">
              <span className="font-medium">Voltage:</span> {data.voltage.toFixed(1)}V
            </p>
            <p className="text-sm">
              <span className="font-medium">Current:</span> {data.current > 0 ? '+' : ''}{data.current.toFixed(1)}A
            </p>
            <p className="text-sm">
              <span className="font-medium">Power:</span> {data.power.toFixed(1)}W
            </p>
            <p className="text-sm">
              <span className="font-medium">Battery:</span> {data.percentage}%
            </p>
            <div className="flex gap-2 mt-2">
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  data.status === 'critical' ? 'bg-red-100 text-red-800 border-red-200' :
                    data.status === 'low' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                      'bg-green-100 text-green-800 border-green-200'
                )}
              >
                {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  data.currentStatus === 'charging' ? 'bg-green-100 text-green-800 border-green-200' :
                    data.currentStatus === 'discharging' ? 'bg-red-100 text-red-800 border-red-200' :
                      'bg-gray-100 text-gray-800 border-gray-200'
                )}
              >
                {data.currentStatus.charAt(0).toUpperCase() + data.currentStatus.slice(1)}
              </Badge>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-6 w-32" />
            </CardTitle>
            <Skeleton className="h-10 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('w-full border-red-200', className)}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!historyData || chartData.length === 0) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Battery className="h-5 w-5 text-blue-600" />
              Battery History
            </CardTitle>
            <Select value={selectedPeriod} onValueChange={(value: 'day' | 'week' | 'month') => setSelectedPeriod(value)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Battery className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No battery data available for the selected period.</p>
            <p className="text-sm mt-1">Data will appear here once your device starts reporting.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const clearDemoData = async () => {
    if (!confirm('Delete all zero-current readings (old demo data)? This cannot be undone.')) return;
    setClearing(true);
    try {
      const res = await fetch('/api/battery/clear-demo', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert(`Deleted ${data.deleted} old readings. Refreshing...`);
        setHistoryData(null);
        setLoading(true);
        // re-fetch
        const params = new URLSearchParams({ period: selectedPeriod });
        if (vehicleId) params.append('vehicleId', vehicleId);
        const r = await fetch(`/api/battery-history?${params}`);
        const d = await r.json();
        if (d.success) setHistoryData(d);
      }
    } finally {
      setClearing(false);
      setLoading(false);
    }
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Battery Analytics
          </CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={clearDemoData}
              disabled={clearing}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded border border-transparent hover:border-destructive/30"
              title="Delete old zero-current demo readings"
            >
              {clearing ? 'Clearing…' : 'Clear old data'}
            </button>
            <Select value={selectedPeriod} onValueChange={(value: 'day' | 'week' | 'month') => setSelectedPeriod(value)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Device info and trends */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{historyData.deviceInfo.deviceName}</span>
          {trends && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                {getTrendIcon(trends.voltage.direction)}
                <span className="text-xs">V: {trends.voltage.change.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-1">
                {getTrendIcon(trends.current.direction)}
                <span className="text-xs">A: {trends.current.change.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-1">
                {getTrendIcon(trends.power.direction)}
                <span className="text-xs">W: {trends.power.change.toFixed(1)}</span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="voltage">Voltage</TabsTrigger>
            <TabsTrigger value="current">Current</TabsTrigger>
            <TabsTrigger value="power">Power</TabsTrigger>
          </TabsList>

          <TabsContent value="voltage" className="space-y-4">
            {/* Voltage stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {historyData.statistics.voltage.max.toFixed(1)}V
                </div>
                <div className="text-xs text-muted-foreground">Peak</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {historyData.statistics.voltage.avg.toFixed(1)}V
                </div>
                <div className="text-xs text-muted-foreground">Average</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {historyData.statistics.voltage.min.toFixed(1)}V
                </div>
                <div className="text-xs text-muted-foreground">Lowest</div>
              </div>
            </div>

            {/* Voltage chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey={selectedPeriod === 'day' ? 'formattedTime' : 'formattedDate'}
                    tick={{ fontSize: 12 }}
                    tickLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    domain={['dataMin - 1', 'dataMax + 1']}
                    tick={{ fontSize: 12 }}
                    tickLine={{ stroke: '#e5e7eb' }}
                    label={{ value: 'Voltage (V)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={48} stroke="#f59e0b" strokeDasharray="5 5" opacity={0.7} />
                  <ReferenceLine y={45} stroke="#dc2626" strokeDasharray="5 5" opacity={0.7} />
                  <Line
                    type="monotone"
                    dataKey="voltage"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="current" className="space-y-4">
            {/* Current stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {historyData.statistics.current.max.toFixed(1)}A
                </div>
                <div className="text-xs text-muted-foreground">Max Charge</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {historyData.statistics.current.avg.toFixed(1)}A
                </div>
                <div className="text-xs text-muted-foreground">Average</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {historyData.statistics.current.min.toFixed(1)}A
                </div>
                <div className="text-xs text-muted-foreground">Max Discharge</div>
              </div>
            </div>

            {/* Current chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey={selectedPeriod === 'day' ? 'formattedTime' : 'formattedDate'}
                    tick={{ fontSize: 12 }}
                    tickLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={{ stroke: '#e5e7eb' }}
                    label={{ value: 'Current (A)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="2 2" opacity={0.7} />
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5, stroke: '#10b981', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="power" className="space-y-4">
            {/* Power stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {historyData.statistics.power.max.toFixed(1)}W
                </div>
                <div className="text-xs text-muted-foreground">Peak</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {historyData.statistics.power.avg.toFixed(1)}W
                </div>
                <div className="text-xs text-muted-foreground">Average</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {historyData.statistics.power.min.toFixed(1)}W
                </div>
                <div className="text-xs text-muted-foreground">Minimum</div>
              </div>
            </div>

            {/* Power chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey={selectedPeriod === 'day' ? 'formattedTime' : 'formattedDate'}
                    tick={{ fontSize: 12 }}
                    tickLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    domain={[0, 'dataMax + 10']}
                    tick={{ fontSize: 12 }}
                    tickLine={{ stroke: '#e5e7eb' }}
                    label={{ value: 'Power (W)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="power"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5, stroke: '#8b5cf6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>

        {/* Data summary */}
        <div className="text-xs text-muted-foreground text-center mt-4">
          Showing {historyData.totalReadings} readings from {new Date(historyData.dateRange.start).toLocaleDateString()} to {new Date(historyData.dateRange.end).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
}