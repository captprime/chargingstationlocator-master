'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { BarChart3, TrendingDown, Activity } from 'lucide-react';

interface Reading {
  timestamp: string;
  percentage: number;
  voltage: number;
  power: number;
  currentStatus: string;
}

function groupByDay(readings: Reading[]) {
  const map: Record<string, { total: number; count: number; charged: number }> = {};
  readings.forEach(r => {
    const day = new Date(r.timestamp).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
    if (!map[day]) map[day] = { total: 0, count: 0, charged: 0 };
    map[day].total += r.percentage;
    map[day].count += 1;
    if (r.currentStatus === 'charging') map[day].charged += 1;
  });
  return Object.entries(map).slice(-7).map(([day, v]) => ({
    day,
    avgBattery: Math.round(v.total / v.count),
    chargingSessions: v.charged,
  }));
}

function groupByHour(readings: Reading[]) {
  const map: Record<number, { total: number; count: number }> = {};
  readings.forEach(r => {
    const hour = new Date(r.timestamp).getHours();
    if (!map[hour]) map[hour] = { total: 0, count: 0 };
    map[hour].total += r.power;
    map[hour].count += 1;
  });
  return Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`,
    avgPower: map[h] ? Math.round(map[h].total / map[h].count) : 0,
  }));
}

function estimateDegradation(readings: Reading[]) {
  if (readings.length < 10) return [];
  const sorted = [...readings].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const chunkSize = Math.floor(sorted.length / 5);
  return Array.from({ length: 5 }, (_, i) => {
    const chunk = sorted.slice(i * chunkSize, (i + 1) * chunkSize);
    const avgVoltage = chunk.reduce((s, r) => s + r.voltage, 0) / chunk.length;
    const label = `Week ${i + 1}`;
    return { label, avgVoltage: parseFloat(avgVoltage.toFixed(2)) };
  });
}

export function BatteryAnalytics() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/battery-history?period=month&limit=500');
        const data = await res.json();
        if (data.success && data.readings) {
          setReadings(data.readings);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const dailyData = groupByDay(readings);
  const hourlyData = groupByHour(readings);
  const degradationData = estimateDegradation(readings);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading analytics...
        </CardContent>
      </Card>
    );
  }

  if (readings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No battery data available yet. Start monitoring to see analytics.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Battery Analytics</h2>
        <p className="text-sm text-muted-foreground mt-1">Usage patterns, charging habits, and health trends</p>
      </div>

      <Tabs defaultValue="daily">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="daily">Daily Usage</TabsTrigger>
          <TabsTrigger value="pattern">Charging Pattern</TabsTrigger>
          <TabsTrigger value="health">Health Trend</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                Daily Battery Usage (Last 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="avgBattery" stroke="#3b82f6" fill="#dbeafe" name="Avg Battery %" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pattern" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-violet-600" />
                Weekly Charging Pattern (by Hour)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="avgPower" fill="#8b5cf6" name="Avg Power (W)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-orange-600" />
                Estimated Battery Degradation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {degradationData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={degradationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="avgVoltage" stroke="#f97316" strokeWidth={2} dot name="Avg Voltage (V)" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Need more data to estimate degradation trend.</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Declining average voltage over time may indicate battery degradation.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
