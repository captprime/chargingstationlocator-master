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
import { TrendingUp, TrendingDown, Minus, Battery, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoltageReading {
  id: string;
  voltage: number;
  percentage: number;
  timestamp: string;
  status: 'normal' | 'low' | 'critical';
  vehicleId: string;
}

interface VoltageHistoryData {
  success: boolean;
  readings: VoltageReading[];
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
}

interface ChartDataPoint {
  timestamp: string;
  voltage: number;
  percentage: number;
  status: string;
  formattedTime: string;
  formattedDate: string;
}

interface VoltageChartProps {
  vehicleId?: string;
  className?: string;
  defaultPeriod?: 'day' | 'week' | 'month';
}

export function VoltageChart({ vehicleId, className, defaultPeriod = 'day' }: VoltageChartProps) {
  const [historyData, setHistoryData] = useState<VoltageHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>(defaultPeriod);

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

        const response = await fetch(`/api/voltage-history?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch voltage history');
        }

        if (data.success) {
          setHistoryData(data);
        } else {
          throw new Error(data.error || 'Failed to fetch voltage history');
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
          percentage: reading.percentage,
          status: reading.status,
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

  // Calculate trend
  const trend = React.useMemo(() => {
    if (chartData.length < 2) return null;

    const first = chartData[0].voltage;
    const last = chartData[chartData.length - 1].voltage;
    const change = last - first;
    const percentChange = ((change / first) * 100);

    return {
      direction: change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'stable',
      change: Math.abs(change),
      percentChange: Math.abs(percentChange),
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
              <span className="font-medium">Battery:</span> {data.percentage}%
            </p>
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
          </div>
        </div>
      );
    }
    return null;
  };

  // Get line color based on overall status
  const getLineColor = () => {
    if (!chartData.length) return '#3b82f6';

    const criticalCount = chartData.filter(d => d.status === 'critical').length;
    const lowCount = chartData.filter(d => d.status === 'low').length;

    if (criticalCount > chartData.length * 0.3) return '#dc2626'; // Red
    if (lowCount > chartData.length * 0.3) return '#f59e0b'; // Yellow
    return '#10b981'; // Green
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
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
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
              Voltage History
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
            <p>No voltage data available for the selected period.</p>
            <p className="text-sm mt-1">Data will appear here once your device starts reporting.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Battery className="h-5 w-5 text-blue-600" />
            Voltage History
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

        {/* Device info and trend */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{historyData.deviceInfo.deviceName}</span>
          {trend && (
            <div className="flex items-center gap-1">
              {trend.direction === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
              {trend.direction === 'down' && <TrendingDown className="h-4 w-4 text-red-600" />}
              {trend.direction === 'stable' && <Minus className="h-4 w-4 text-gray-600" />}
              <span className={cn(
                'text-xs',
                trend.direction === 'up' ? 'text-green-600' :
                  trend.direction === 'down' ? 'text-red-600' :
                    'text-gray-600'
              )}>
                {trend.direction === 'stable' ? 'Stable' : `${trend.change.toFixed(1)}V`}
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Chart stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {Math.max(...chartData.map(d => d.voltage)).toFixed(1)}V
              </div>
              <div className="text-xs text-muted-foreground">Peak</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {(chartData.reduce((sum, d) => sum + d.voltage, 0) / chartData.length).toFixed(1)}V
              </div>
              <div className="text-xs text-muted-foreground">Average</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {Math.min(...chartData.map(d => d.voltage)).toFixed(1)}V
              </div>
              <div className="text-xs text-muted-foreground">Lowest</div>
            </div>
          </div>

          {/* Chart */}
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

                {/* Reference lines for thresholds */}
                <ReferenceLine y={48} stroke="#f59e0b" strokeDasharray="5 5" opacity={0.7} />
                <ReferenceLine y={45} stroke="#dc2626" strokeDasharray="5 5" opacity={0.7} />

                <Line
                  type="monotone"
                  dataKey="voltage"
                  stroke={getLineColor()}
                  strokeWidth={2}
                  dot={{ fill: getLineColor(), strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 5, stroke: getLineColor(), strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-yellow-500"></div>
              <span>Low (48V)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-red-500"></div>
              <span>Critical (45V)</span>
            </div>
          </div>

          {/* Data summary */}
          <div className="text-xs text-muted-foreground text-center">
            Showing {historyData.totalReadings} readings from {new Date(historyData.dateRange.start).toLocaleDateString()} to {new Date(historyData.dateRange.end).toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}