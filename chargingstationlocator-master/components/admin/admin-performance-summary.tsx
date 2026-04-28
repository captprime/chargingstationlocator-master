'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Zap, 
  Users, 
  DollarSign, 
  Activity,
  MapPin,
  Clock,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { StationDetailsData } from './station-details';
import { toast } from 'sonner';

interface AdminPerformanceData {
  stationCount: number;
  totalSessions: number;
  totalRevenue: number;
  totalEnergyDelivered: number;
  averageUptime: number;
  averageSessionDuration: number;
  revenuePerSession: number;
  energyPerSession: number;
  revenuePerKwh: number;
  topPerformingStation: {
    name: string;
    revenue: number;
    sessions: number;
  } | null;
}

export function AdminPerformanceSummary() {
  const { data: session } = useSession();
  const [performance, setPerformance] = useState<AdminPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchPerformanceData();
    }
  }, [session]);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/admin/stations');
      const data = await response.json();
      
      if (data.success) {
        const stations = data.stations;
        
        // Calculate performance metrics
        const totalSessions = stations.reduce((sum: number, station: StationDetailsData) => sum + (station.stats?.totalSessions || 0), 0);
        const totalRevenue = stations.reduce((sum: number, station: StationDetailsData) => sum + (station.stats?.revenue || 0), 0);
        const totalEnergyDelivered = stations.reduce((sum: number, station: StationDetailsData) => sum + (station.stats?.totalEnergyDelivered || 0), 0);
        const averageUptime = stations.length > 0 ? stations.reduce((sum: number, station: StationDetailsData) => sum + (station.stats?.uptime || 0), 0) / stations.length : 0;
        const averageSessionDuration = stations.length > 0 ? stations.reduce((sum: number, station: StationDetailsData) => sum + (station.stats?.averageSessionDuration || 0), 0) / stations.length : 0;
        
        // Find top performing station
        const topStation = stations.reduce((top: StationDetailsData | null, station: StationDetailsData) => {
          const stationRevenue = station.stats?.revenue || 0;
          const topRevenue = top?.stats?.revenue || 0;
          return stationRevenue > topRevenue ? station : top;
        }, null);

        const performanceData: AdminPerformanceData = {
          stationCount: stations.length,
          totalSessions,
          totalRevenue,
          totalEnergyDelivered,
          averageUptime,
          averageSessionDuration,
          revenuePerSession: totalSessions > 0 ? totalRevenue / totalSessions : 0,
          energyPerSession: totalSessions > 0 ? totalEnergyDelivered / totalSessions : 0,
          revenuePerKwh: totalEnergyDelivered > 0 ? totalRevenue / totalEnergyDelivered : 0,
          topPerformingStation: topStation ? {
            name: topStation.name,
            revenue: topStation.stats?.revenue || 0,
            sessions: topStation.stats?.totalSessions || 0
          } : null
        };
        
        setPerformance(performanceData);
      } else {
        toast.error('Failed to fetch performance data');
      }
    } catch (error) {
      console.error('Error fetching performance data:', error);
      toast.error('Failed to fetch performance data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 95) return 'text-green-600';
    if (uptime >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getUptimeBadgeVariant = (uptime: number) => {
    if (uptime >= 95) return 'default';
    if (uptime >= 85) return 'secondary';
    return 'destructive';
  };

  if (loading || !performance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Your Performance Summary
            </CardTitle>
            <CardDescription>
              Comprehensive overview of your charging station network
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPerformanceData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <MapPin className="h-6 w-6 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-600">{performance.stationCount}</div>
            <div className="text-sm text-muted-foreground">Stations</div>
          </div>
          <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-600">{formatCurrency(performance.totalRevenue)}</div>
            <div className="text-sm text-muted-foreground">Total Revenue</div>
          </div>
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
            <Users className="h-6 w-6 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-600">{performance.totalSessions.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Sessions</div>
          </div>
          <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
            <Zap className="h-6 w-6 text-orange-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-orange-600">{performance.totalEnergyDelivered.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">kWh Delivered</div>
          </div>
        </div>

        {/* Efficiency Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue per Session</p>
                  <p className="text-xl font-bold">{formatCurrency(performance.revenuePerSession)}</p>
                </div>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Energy per Session</p>
                  <p className="text-xl font-bold">{performance.energyPerSession.toFixed(1)} kWh</p>
                </div>
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue per kWh</p>
                  <p className="text-xl font-bold">{formatCurrency(performance.revenuePerKwh)}</p>
                </div>
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Operational Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Network Uptime</p>
                <Activity className={`h-4 w-4 ${getUptimeColor(performance.averageUptime)}`} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold">{performance.averageUptime.toFixed(1)}%</p>
                <Badge variant={getUptimeBadgeVariant(performance.averageUptime)}>
                  {performance.averageUptime >= 95 ? 'Excellent' : performance.averageUptime >= 85 ? 'Good' : 'Needs Attention'}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Avg Session Duration</p>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold">{formatDuration(performance.averageSessionDuration)}</p>
                <Badge variant="outline">
                  {performance.averageSessionDuration > 60 ? 'Long Sessions' : 'Quick Charges'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Performing Station */}
        {performance.topPerformingStation && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Top Performing Station</p>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{performance.topPerformingStation.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {performance.topPerformingStation.sessions.toLocaleString()} sessions
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(performance.topPerformingStation.revenue)}
                  </p>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin Ownership Notice */}
        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Multi-Admin System Active
            </p>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            These statistics are specific to your stations only. Other admins have their own separate station networks and performance data.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}