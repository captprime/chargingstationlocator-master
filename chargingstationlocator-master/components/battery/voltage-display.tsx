'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Battery, Zap, AlertTriangle, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoltageData {
  voltage: number;
  percentage: number;
  timestamp: string;
  status: 'normal' | 'low' | 'critical';
  vehicleId: string;
  deviceName: string;
}

interface VoltageDisplayProps {
  vehicleId?: string;
  className?: string;
}

export function VoltageDisplay({ vehicleId, className }: VoltageDisplayProps) {
  const [voltageData, setVoltageData] = useState<VoltageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVoltageData = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = vehicleId 
          ? `/api/voltage?vehicleId=${encodeURIComponent(vehicleId)}`
          : '/api/voltage';
        
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch voltage data');
        }

        if (data.success) {
          setVoltageData(data);
        } else {
          throw new Error(data.error || 'Failed to fetch voltage data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchVoltageData();
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
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    // Check if the error is about no registered devices
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

  if (!voltageData) {
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
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          Battery Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main voltage and percentage display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getBatteryIcon(voltageData.status, voltageData.percentage)}
            <div>
              <div className="text-2xl font-bold">
                {voltageData.voltage.toFixed(1)}V
              </div>
              <div className="text-sm text-muted-foreground">
                {voltageData.deviceName}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold">
              {voltageData.percentage}%
            </div>
            <Badge 
              variant="outline" 
              className={cn('text-xs', getStatusColor(voltageData.status))}
            >
              {getStatusText(voltageData.status)}
            </Badge>
          </div>
        </div>

        {/* Battery percentage bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Battery Level</span>
            <span>{voltageData.percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                voltageData.status === 'critical' ? 'bg-red-500' :
                voltageData.status === 'low' ? 'bg-yellow-500' :
                'bg-green-500'
              )}
              style={{ width: `${Math.max(voltageData.percentage, 5)}%` }}
            />
          </div>
        </div>

        {/* Last updated */}
        <div className="text-xs text-muted-foreground">
          Last updated: {new Date(voltageData.timestamp).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}