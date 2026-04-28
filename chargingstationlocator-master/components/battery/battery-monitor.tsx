'use client';

import React, { useEffect, useState } from 'react';
import { BatteryDisplay } from './battery-display';
import { BatteryChart } from './battery-chart';
import { LowBatteryAlert } from './low-battery-alert';

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

interface BatteryMonitorProps {
  vehicleId?: string;
  className?: string;
  showChart?: boolean;
}

export function BatteryMonitor({ vehicleId, className, showChart = true }: BatteryMonitorProps) {
  const [batteryData, setBatteryData] = useState<BatteryData | null>(null);
  const [_loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);

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
          // Reset alert dismissal when new data comes in
          setAlertDismissed(false);
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
    
    // Set up polling for real-time updates (more frequent for current monitoring)
    const interval = setInterval(fetchBatteryData, 10000); // Poll every 10 seconds
    
    return () => clearInterval(interval);
  }, [vehicleId]);

  const handleAlertDismiss = () => {
    setAlertDismissed(true);
  };

  const shouldShowAlert = batteryData && 
    (batteryData.status === 'low' || batteryData.status === 'critical') && 
    !alertDismissed;

  return (
    <div className={className}>
      {/* Low Battery Alert */}
      {shouldShowAlert && (
        <div className="mb-6">
          <LowBatteryAlert
            voltage={batteryData.voltage}
            percentage={batteryData.percentage}
            status={batteryData.status}
            onDismiss={handleAlertDismiss}
          />
        </div>
      )}

      {/* Battery Display */}
      <div className="space-y-6">
        <BatteryDisplay vehicleId={vehicleId} />
        
        {/* Battery Chart */}
        {showChart && (
          <BatteryChart vehicleId={vehicleId} />
        )}
      </div>
    </div>
  );
}