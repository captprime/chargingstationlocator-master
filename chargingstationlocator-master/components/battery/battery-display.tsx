'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Battery, Zap, AlertTriangle, Plus, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface BatteryDisplayProps {
  vehicleId?: string;
  className?: string;
}

export function BatteryDisplay({ vehicleId, className }: BatteryDisplayProps) {
  const [batteryData, setBatteryData] = useState<BatteryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBatteryData = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = vehicleId 
          ? `/api/battery?vehicleId=${encodeURIComponent(vehicleId)}`
          : '/api/battery';
        
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch battery data');
        }

        if (data.success) {
          setBatteryData(data);
        } else {
          throw new Error(data.error || 'Failed to fetch battery data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchBatteryData();
    
    // Set up polling for real-time updates
    const interval = setInterval(fetchBatteryData, 10000); // Poll every 10 seconds for current monitoring
    
    return () => clearInterval(interval);
  }, [vehicleId]);

  const getBatteryIcon = (status: string, percentage: number) => {
    if (status === 'critical') {
      return <AlertTriangle className="h-6 w-6 text-red-600" />;
    }
    
    if (percentage >= 75) {
      return <Battery className="h-6 w-6 text-green-600 fill-current" />;
    } else if (percentage >= 50) {
      return <Battery className="h-6 w-6 text-yellow-600 fill-current" />;
    } else if (percentage >= 25) {
      return <Battery className="h-6 w-6 text-orange-600 fill-current" />;
    } else {
      return <Battery className="h-6 w-6 text-red-600" />;
    }
  };

  const getCurrentIcon = (currentStatus: string) => {
    switch (currentStatus) {
      case 'charging':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'discharging':
        return <TrendingDown className="h-5 w-5 text-red-600" />;
      case 'idle':
      default:
        return <Minus className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'low':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'normal':
      default:
        return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getCurrentStatusColor = (currentStatus: string) => {
    switch (currentStatus) {
      case 'charging':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'discharging':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'idle':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'critical':
        return 'Critical';
      case 'low':
        return 'Low';
      case 'normal':
      default:
        return 'Normal';
    }
  };

  const getCurrentStatusText = (currentStatus: string) => {
    switch (currentStatus) {
      case 'charging':
        return 'Charging';
      case 'discharging':
        return 'Discharging';
      case 'idle':
      default:
        return 'Idle';
    }
  };

  if (loading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-32" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const isNoDeviceError = error.includes('No registered devices found') || error.includes('Device not found');
    
    if (isNoDeviceError) {
      return (
        <Card className={cn('w-full border-blue-200 bg-blue-50', className)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Battery className="h-5 w-5" />
              Battery Monitor
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Plus className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-blue-900 mb-1">No Device Registered</h3>
                <p className="text-sm text-blue-700 mb-4">
                  Please register your ESP32 device first to start monitoring your battery status.
                </p>
              </div>
            </div>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/register-device">
                <Plus className="h-4 w-4 mr-2" />
                Register Device
              </Link>
            </Button>
          </CardContent>
        </Card>
      );
    }
    
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

  if (!batteryData) {
    return null;
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          Battery Management System
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main battery status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getBatteryIcon(batteryData.status, batteryData.percentage)}
            <div>
              <div className="text-2xl font-bold">
                {batteryData.percentage}%
              </div>
              <div className="text-sm text-muted-foreground">
                {batteryData.deviceName}
              </div>
            </div>
          </div>
          <div className="text-right space-y-1">
            <Badge 
              variant="outline" 
              className={cn('text-xs', getStatusColor(batteryData.status))}
            >
              {getStatusText(batteryData.status)}
            </Badge>
            <Badge 
              variant="outline" 
              className={cn('text-xs flex items-center gap-1', getCurrentStatusColor(batteryData.currentStatus))}
            >
              {getCurrentIcon(batteryData.currentStatus)}
              {getCurrentStatusText(batteryData.currentStatus)}
            </Badge>
          </div>
        </div>

        {/* Battery level bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Battery Level</span>
            <span>{batteryData.percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                batteryData.status === 'critical' ? 'bg-red-500' :
                batteryData.status === 'low' ? 'bg-yellow-500' :
                'bg-green-500'
              )}
              style={{ width: `${Math.max(batteryData.percentage, 5)}%` }}
            />
          </div>
        </div>

        {/* Detailed metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-600">
              {batteryData.voltage.toFixed(1)}V
            </div>
            <div className="text-xs text-muted-foreground">Voltage</div>
          </div>
          <div className="text-center">
            <div className={cn(
              'text-lg font-semibold',
              batteryData.current > 0 ? 'text-green-600' : 
              batteryData.current < 0 ? 'text-red-600' : 'text-gray-600'
            )}>
              {batteryData.current > 0 ? '+' : ''}{batteryData.current.toFixed(1)}A
            </div>
            <div className="text-xs text-muted-foreground">Current</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-purple-600">
              {batteryData.power.toFixed(1)}W
            </div>
            <div className="text-xs text-muted-foreground">Power</div>
          </div>
        </div>

        {/* Last updated */}
        <div className="text-xs text-muted-foreground text-center">
          Last updated: {new Date(batteryData.timestamp).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}