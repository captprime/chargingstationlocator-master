'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  DollarSign, 
  Users, 
  Zap, 
  Clock, 
  TrendingUp, 
  Calendar,
  Activity,
  ArrowLeft,
  Edit
} from 'lucide-react';
import { toast } from 'sonner';

interface StationStats {
  totalSessions: number;
  totalEnergyDelivered: number;
  averageSessionDuration: number;
  revenue: number;
  lastMaintenanceDate?: string;
  uptime: number;
}

export interface StationDetailsData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  pricePerKwh: number;
  queueLength: number;
  amenities: string[];
  operatingHours: {
    open: string;
    close: string;
  };
  adminId: string;
  stats: StationStats;
  createdAt: string;
  updatedAt: string;
}

interface StationDetailsProps {
  stationId: string;
  onBack: () => void;
  onEdit: (station: StationDetailsData) => void;
}

export function StationDetails({ stationId, onBack, onEdit }: StationDetailsProps) {
  const [station, setStation] = useState<StationDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStationDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/stations/${stationId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch station details');
      }

      setStation(data.station);
    } catch (error) {
      console.error('Error fetching station details:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch station details');
      toast.error('Failed to load station details');
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    fetchStationDetails();
  }, [stationId, fetchStationDetails]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Stations
          </Button>
        </div>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !station) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Stations
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error || 'Station not found'}</p>
              <Button onClick={fetchStationDetails}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Stations
          </Button>
        </div>
        <Button onClick={() => onEdit(station)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Station
        </Button>
      </div>

      {/* Station Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{station.name}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-2">
                <MapPin className="h-4 w-4" />
                {station.latitude.toFixed(6)}, {station.longitude.toFixed(6)}
              </CardDescription>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  Admin ID: {station.adminId}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Your Station
                </Badge>
              </div>
            </div>
            <Badge variant={station.queueLength > 5 ? 'destructive' : station.queueLength > 2 ? 'secondary' : 'default'}>
              Queue: {station.queueLength}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Price per kWh</p>
                <p className="font-semibold">{formatCurrency(station.pricePerKwh)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Operating Hours</p>
                <p className="font-semibold">{station.operatingHours.open} - {station.operatingHours.close}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Activity className={`h-5 w-5 ${getUptimeColor(station.stats?.uptime || 0)}`} />
              <div>
                <p className="text-sm text-muted-foreground">Uptime</p>
                <p className={`font-semibold ${getUptimeColor(station.stats?.uptime || 0)}`}>
                  {(station.stats?.uptime || 0).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {station.amenities.length > 0 && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Amenities</p>
                <div className="flex flex-wrap gap-2">
                  {station.amenities.map((amenity, index) => (
                    <Badge key={index} variant="outline">
                      {amenity}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(station.stats?.totalSessions || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Since {formatDate(station.createdAt)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Energy Delivered</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(station.stats?.totalEnergyDelivered || 0).toLocaleString()} kWh</div>
            <p className="text-xs text-muted-foreground">
              Total energy delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Session Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(station.stats?.averageSessionDuration || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Average charging time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(station.stats?.revenue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Total revenue generated
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Efficiency Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Revenue per Session</span>
              <span className="font-semibold">
                {formatCurrency((station.stats?.revenue || 0) / Math.max(station.stats?.totalSessions || 1, 1))}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Energy per Session</span>
              <span className="font-semibold">
                {((station.stats?.totalEnergyDelivered || 0) / Math.max(station.stats?.totalSessions || 1, 1)).toFixed(1)} kWh
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Revenue per kWh</span>
              <span className="font-semibold">
                {formatCurrency((station.stats?.revenue || 0) / Math.max(station.stats?.totalEnergyDelivered || 1, 1))}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Operational Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Current Queue</span>
              <Badge variant={station.queueLength > 5 ? 'destructive' : station.queueLength > 2 ? 'secondary' : 'default'}>
                {station.queueLength} vehicles
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Uptime Status</span>
              <Badge variant={station.stats?.uptime >= 95 ? 'default' : station.stats?.uptime >= 85 ? 'secondary' : 'destructive'}>
                {(station.stats?.uptime || 0).toFixed(1)}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Station Age</span>
              <span className="font-semibold">
                {Math.floor((new Date().getTime() - new Date(station.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Admin Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Managed By</span>
              <Badge variant="outline" className="font-mono text-xs">
                You
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Admin ID</span>
              <span className="font-mono text-xs text-muted-foreground">
                {station.adminId.slice(0, 8)}...
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Last Updated</span>
              <span className="text-sm">
                {formatDate(station.updatedAt)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Maintenance Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Maintenance Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Last Maintenance</p>
              <p className="font-semibold">
                {station.stats?.lastMaintenanceDate 
                  ? formatDate(station.stats.lastMaintenanceDate)
                  : 'No maintenance recorded'
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Station Created</p>
              <p className="font-semibold">{formatDate(station.createdAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}