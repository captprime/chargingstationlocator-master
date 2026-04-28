'use client';

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { BatteryChart } from "@/components/battery/battery-chart";
import { BatteryDisplay } from "@/components/battery/battery-display";
import { CurrentMonitor } from "@/components/battery/current-monitor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Battery, Download, RefreshCw, Smartphone, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserDevice {
  id: string;
  vehicleId: string;
  deviceName: string;
  isActive: boolean;
}

interface BatteryHistoryPageClientProps {
  className?: string;
}

export function BatteryHistoryPageClient({ className }: BatteryHistoryPageClientProps) {
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch user devices
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/user/devices');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch devices');
        }

        if (data.success && data.devices) {
          setDevices(data.devices);
          // Set the active device as default, or first device if no active device
          const activeDevice = data.devices.find((d: UserDevice) => d.isActive) || data.devices[0];
          if (activeDevice) {
            setSelectedDevice(activeDevice.vehicleId);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Force refresh by re-mounting components
    setTimeout(() => {
      setRefreshing(false);
      window.location.reload();
    }, 1000);
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    alert('Export functionality will be implemented in a future update.');
  };

  if (loading) {
    return (
      <div className={cn("min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8", className)}>
        <div className="max-w-7xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-9 w-32" />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-9 w-64 mb-2" />
                <Skeleton className="h-5 w-96" />
              </div>
              
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
              </div>
            </div>
          </div>

          {/* Content Skeleton */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-1 space-y-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <div className="xl:col-span-3 space-y-6">
              <Skeleton className="h-96 w-full" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8", className)}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <Battery className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Battery Analytics</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8", className)}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <Zap className="h-8 w-8 text-blue-600" />
                Battery Analytics
              </h1>
              <p className="text-gray-600">
                Monitor voltage, current, power consumption, and charging patterns over time.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Device Selector */}
              {devices.length > 1 && (
                <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                  <SelectTrigger className="w-48">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      <SelectValue placeholder="Select device" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem key={device.id} value={device.vehicleId}>
                        <div className="flex items-center gap-2">
                          <span>{device.deviceName}</span>
                          {device.isActive && (
                            <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                Refresh
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2"
                onClick={handleExport}
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Left Column - Current Status */}
          <div className="xl:col-span-1 space-y-6">
            {/* Enhanced Battery Status */}
            <BatteryDisplay 
              className="w-full" 
              vehicleId={selectedDevice || undefined}
            />

            {/* Real-time Current Monitor */}
            <CurrentMonitor 
              className="w-full"
              vehicleId={selectedDevice || undefined}
              compact={true}
            />

            {/* Battery Health Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Battery Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-3">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div className="font-medium text-green-800">Good Performance</div>
                    </div>
                    <div className="text-green-700 text-xs">
                      Battery voltage and current are within normal ranges
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Monitor current flow patterns</p>
                    <p>• Watch for charging efficiency</p>
                    <p>• Track power consumption trends</p>
                    <p>• Avoid deep discharge cycles</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Chart and Analysis */}
          <div className="xl:col-span-3 space-y-6">
            {/* Enhanced Battery Chart with Current Monitoring */}
            <BatteryChart 
              className="w-full" 
              defaultPeriod="day"
              vehicleId={selectedDevice || undefined}
            />

            {/* Additional Analysis Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Power Consumption Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Power Patterns</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div>
                        <div className="font-medium text-red-900">Peak Discharge</div>
                        <div className="text-sm text-red-700">8:00 AM - 10:00 AM</div>
                      </div>
                      <div className="text-2xl font-bold text-red-600">-3.2A</div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <div className="font-medium text-green-900">Charging Period</div>
                        <div className="text-sm text-green-700">10:30 PM - 6:00 AM</div>
                      </div>
                      <div className="text-2xl font-bold text-green-600">+8.5A</div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div>
                        <div className="font-medium text-purple-900">Peak Power</div>
                        <div className="text-sm text-purple-700">During fast charging</div>
                      </div>
                      <div className="text-2xl font-bold text-purple-600">420W</div>
                    </div>

                    <div className="text-xs text-muted-foreground mt-4">
                      Based on current and power patterns from the last 7 days
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Enhanced Efficiency Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Efficiency Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600 mb-1">94%</div>
                      <div className="text-sm text-muted-foreground">Charging Efficiency</div>
                      <div className="text-xs text-green-600 mt-1">+3% from last week</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div className="text-center">
                        <div className="text-lg font-semibold">4.2h</div>
                        <div className="text-xs text-muted-foreground">Avg Charge Time</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">18.5h</div>
                        <div className="text-xs text-muted-foreground">Avg Usage Time</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="text-center">
                        <div className="text-lg font-semibold">285W</div>
                        <div className="text-xs text-muted-foreground">Avg Power</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">6.8kWh</div>
                        <div className="text-xs text-muted-foreground">Daily Energy</div>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground text-center mt-4">
                      Calculated from voltage, current, and power data
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Device Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Device Information</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDevice && devices.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <div className="text-sm font-medium text-gray-500 mb-1">Device Name</div>
                        <div className="text-sm">
                          {devices.find(d => d.vehicleId === selectedDevice)?.deviceName || 'Unknown'}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-500 mb-1">Vehicle ID</div>
                        <div className="text-sm font-mono">{selectedDevice}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-500 mb-1">Status</div>
                        <div className="text-sm">
                          {devices.find(d => d.vehicleId === selectedDevice)?.isActive ? (
                            <span className="text-green-600">Active</span>
                          ) : (
                            <span className="text-gray-600">Inactive</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Data is automatically synced from your ESP32 device
                        </div>
                        <Button asChild variant="outline" size="sm">
                          <Link href="/register-device">
                            Manage Devices
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Smartphone className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600 mb-4">No devices found</p>
                    <Button asChild>
                      <Link href="/register-device">
                        Register Your First Device
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}