'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, Zap, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CurrentData {
  current: number;
  power: number;
  voltage: number;
  currentStatus: 'charging' | 'discharging' | 'idle';
  timestamp: string;
  deviceName: string;
}

interface CurrentMonitorProps {
  vehicleId?: string;
  className?: string;
  compact?: boolean;
}

export function CurrentMonitor({ vehicleId, className, compact = false }: CurrentMonitorProps) {
  const [currentData, setCurrentData] = useState<CurrentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ current: number; timestamp: number }>>([]);

  useEffect(() => {
    const fetchCurrentData = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = vehicleId 
          ? `/api/battery?vehicleId=${encodeURIComponent(vehicleId)}`
          : '/api/battery';
        
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch current data');
        }

        if (data.success) {
          const newData = {
            current: data.current || 0,
            power: data.power || 0,
            voltage: data.voltage || 0,
            currentStatus: data.currentStatus || 'idle',
            timestamp: data.timestamp,
            deviceName: data.deviceName
          };
          
          setCurrentData(newData);
          
          // Update history for trend calculation
          setHistory(prev => {
            const newHistory = [...prev, { current: newData.current, timestamp: Date.now() }];
            // Keep only last 10 readings for trend
            return newHistory.slice(-10);
          });
        } else {
          throw new Error(data.error || 'Failed to fetch current data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentData();
    
    // Set up frequent polling for real-time current monitoring
    const interval = setInterval(fetchCurrentData, 5000); // Poll every 5 seconds
    
    return () => clearInterval(interval);
  }, [vehicleId]);

  const getCurrentIcon = (currentStatus: string, current: number) => {
    if (Math.abs(current) < 0.1) {
      return <Minus className="h-5 w-5 text-gray-600" />;
    }
    
    switch (currentStatus) {
      case 'charging':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'discharging':
        return <TrendingDown className="h-5 w-5 text-red-600" />;
      default:
        return <Minus className="h-5 w-5 text-gray-600" />;
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

  const getCurrentTrend = () => {
    if (history.length < 3) return null;
    
    const recent = history.slice(-3);
    const trend = recent[2].current - recent[0].current;
    
    if (Math.abs(trend) < 0.1) return 'stable';
    return trend > 0 ? 'increasing' : 'decreasing';
  };

  const getEfficiency = () => {
    if (!currentData || currentData.voltage === 0) return null;
    
    // Simple efficiency calculation based on power factor
    const efficiency = Math.min((currentData.power / (currentData.voltage * Math.abs(currentData.current))) * 100, 100);
    return isNaN(efficiency) ? null : efficiency;
  };

  if (loading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader className={compact ? 'pb-2' : undefined}>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'pt-2' : 'space-y-4'}>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
          {!compact && (
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('w-full border-red-200', className)}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentData) {
    return null;
  }

  const trend = getCurrentTrend();
  const efficiency = getEfficiency();

  if (compact) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getCurrentIcon(currentData.currentStatus, currentData.current)}
              <div>
                <div className={cn(
                  'text-lg font-semibold',
                  currentData.current > 0 ? 'text-green-600' : 
                  currentData.current < 0 ? 'text-red-600' : 'text-gray-600'
                )}>
                  {currentData.current > 0 ? '+' : ''}{currentData.current.toFixed(1)}A
                </div>
                <div className="text-xs text-muted-foreground">
                  {currentData.power.toFixed(1)}W
                </div>
              </div>
            </div>
            <Badge 
              variant="outline" 
              className={cn('text-xs', getCurrentStatusColor(currentData.currentStatus))}
            >
              {getCurrentStatusText(currentData.currentStatus)}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          Current Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main current display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getCurrentIcon(currentData.currentStatus, currentData.current)}
            <div>
              <div className={cn(
                'text-3xl font-bold',
                currentData.current > 0 ? 'text-green-600' : 
                currentData.current < 0 ? 'text-red-600' : 'text-gray-600'
              )}>
                {currentData.current > 0 ? '+' : ''}{currentData.current.toFixed(1)}A
              </div>
              <div className="text-sm text-muted-foreground">
                Real-time Current
              </div>
            </div>
          </div>
          <div className="text-right space-y-1">
            <Badge 
              variant="outline" 
              className={cn('text-xs', getCurrentStatusColor(currentData.currentStatus))}
            >
              {getCurrentStatusText(currentData.currentStatus)}
            </Badge>
            {trend && (
              <div className="text-xs text-muted-foreground">
                Trend: {trend}
              </div>
            )}
          </div>
        </div>

        {/* Power and efficiency metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-xl font-semibold text-purple-600">
              {currentData.power.toFixed(1)}W
            </div>
            <div className="text-xs text-muted-foreground">Power</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-xl font-semibold text-blue-600">
              {efficiency ? `${efficiency.toFixed(1)}%` : 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground">Efficiency</div>
          </div>
        </div>

        {/* Current flow indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Current Flow</span>
            <span>{Math.abs(currentData.current).toFixed(1)}A</span>
          </div>
          <div className="relative w-full bg-gray-200 rounded-full h-3">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-xs font-medium text-gray-700">
                {currentData.currentStatus === 'charging' ? '→ Charging' : 
                 currentData.currentStatus === 'discharging' ? '← Discharging' : 
                 '○ Idle'}
              </div>
            </div>
            <div
              className={cn(
                'h-3 rounded-full transition-all duration-300',
                currentData.currentStatus === 'charging' ? 'bg-green-500' :
                currentData.currentStatus === 'discharging' ? 'bg-red-500' :
                'bg-gray-400'
              )}
              style={{ 
                width: `${Math.min(Math.abs(currentData.current) * 10, 100)}%`,
                ...(currentData.currentStatus === 'discharging' && {
                  marginLeft: 'auto',
                  marginRight: 0
                })
              }}
            />
          </div>
        </div>

        {/* Last updated */}
        <div className="text-xs text-muted-foreground text-center">
          Last updated: {new Date(currentData.timestamp).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}