'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { DollarSign, TrendingUp, Zap, Users } from 'lucide-react';

interface StationData {
  name: string;
  stats: {
    totalSessions: number;
    totalEnergyDelivered: number;
    revenue: number;
    averageSessionDuration: number;
    uptime: number;
  };
  pricePerKwh: number;
  queueLength: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// Simulate daily revenue breakdown from total (for demo purposes)
function generateDailyRevenue(totalRevenue: number) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weights = [0.12, 0.13, 0.14, 0.15, 0.16, 0.18, 0.12];
  return days.map((day, i) => ({
    day,
    revenue: parseFloat((totalRevenue * weights[i]).toFixed(2)),
    sessions: Math.round(10 * weights[i] * 10),
  }));
}

function generatePeakHours(stations: StationData[]) {
  const totalSessions = stations.reduce((s, st) => s + st.stats.totalSessions, 0);
  const peakWeights = [0.02, 0.01, 0.01, 0.01, 0.02, 0.04, 0.06, 0.08, 0.07, 0.06, 0.05, 0.06, 0.07, 0.06, 0.05, 0.06, 0.07, 0.08, 0.07, 0.05, 0.04, 0.03, 0.02, 0.02];
  return peakWeights.map((w, h) => ({
    hour: `${h}:00`,
    sessions: Math.round(totalSessions * w),
  }));
}

export function RevenueDashboard() {
  const { data: session } = useSession();
  const [stations, setStations] = useState<StationData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetch('/api/admin/stations')
      .then(r => r.json())
      .then(data => {
        if (data.success) setStations(data.stations);
      })
      .finally(() => setLoading(false));
  }, [session]);

  if (loading) {
    return <div className="h-48 animate-pulse bg-gray-100 rounded-lg" />;
  }

  const totalRevenue = stations.reduce((s, st) => s + st.stats.revenue, 0);
  const totalSessions = stations.reduce((s, st) => s + st.stats.totalSessions, 0);
  const totalEnergy = stations.reduce((s, st) => s + st.stats.totalEnergyDelivered, 0);

  const dailyRevenue = generateDailyRevenue(totalRevenue);
  const peakHours = generatePeakHours(stations);
  const stationRevenue = stations.map((s, i) => ({ name: s.name, revenue: s.stats.revenue, color: COLORS[i % COLORS.length] }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Revenue Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Financial performance across your station network</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Sessions', value: totalSessions.toLocaleString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Energy Delivered', value: `${totalEnergy.toFixed(0)} kWh`, icon: Zap, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Avg per Session', value: `₹${totalSessions > 0 ? (totalRevenue / totalSessions).toFixed(0) : 0}`, icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
                </div>
                <div className={`${bg} p-2 rounded-lg`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Revenue */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Daily Revenue (This Week)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`₹${v}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Peak Hours */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Peak Usage Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={peakHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="sessions" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Sessions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Station */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue by Station</CardTitle>
          </CardHeader>
          <CardContent>
            {stationRevenue.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stationRevenue} layout="vertical" margin={{ left: 8, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip formatter={(v: number) => [`₹${v}`, 'Revenue']} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {stationRevenue.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="flex flex-wrap gap-2">
                  {stationRevenue.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <span>{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No station data available</p>
            )}
          </CardContent>
        </Card>

        {/* Sessions completed */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sessions Completed (This Week)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="sessions" stroke="#8b5cf6" strokeWidth={2} dot name="Sessions" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
