'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LowBatteryAlertProps {
  voltage: number;
  percentage: number;
  status: 'normal' | 'low' | 'critical';
  className?: string;
  onDismiss?: () => void;
}

export function LowBatteryAlert({ 
  voltage, 
  percentage, 
  status, 
  className,
  onDismiss 
}: LowBatteryAlertProps) {
  const router = useRouter();

  // Only show alert for low or critical battery status
  if (status === 'normal') {
    return null;
  }

  const handleFindStations = () => {
    router.push('/stations');
  };

  const getAlertVariant = () => {
    return status === 'critical' ? 'destructive' : 'default';
  };

  const getAlertMessage = () => {
    if (status === 'critical') {
      return `⚠️ Critical battery level! ${voltage.toFixed(1)}V (${percentage}%) - Find charging stations immediately`;
    } else {
      return `⚠️ Battery low! ${voltage.toFixed(1)}V (${percentage}%) - Find charging stations`;
    }
  };

  const getButtonText = () => {
    return status === 'critical' ? 'Find Charging Stations Now' : 'Find Charging Stations';
  };

  const getButtonVariant = () => {
    return status === 'critical' ? 'destructive' : 'default';
  };

  return (
    <Alert 
      variant={getAlertVariant()}
      className={cn(
        'border-l-4',
        status === 'critical' 
          ? 'border-l-red-500 bg-red-50 dark:bg-red-950/20' 
          : 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20',
        className
      )}
    >
      <AlertTriangle className={cn(
        'h-4 w-4',
        status === 'critical' ? 'text-red-600' : 'text-yellow-600'
      )} />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className={cn(
            'font-medium',
            status === 'critical' ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200'
          )}>
            {getAlertMessage()}
          </div>
          <div className={cn(
            'text-sm mt-1',
            status === 'critical' ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'
          )}>
            {status === 'critical' 
              ? 'Your battery is critically low. Please charge immediately to avoid being stranded.'
              : 'Your battery is running low. Consider charging soon to avoid inconvenience.'
            }
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleFindStations}
            variant={getButtonVariant()}
            size="sm"
            className={cn(
              'whitespace-nowrap',
              status === 'critical' 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
            )}
          >
            <MapPin className="h-4 w-4 mr-2" />
            {getButtonText()}
          </Button>
          {onDismiss && (
            <Button
              onClick={onDismiss}
              variant="ghost"
              size="sm"
              className={cn(
                'text-xs',
                status === 'critical' ? 'text-red-600 hover:text-red-700' : 'text-yellow-600 hover:text-yellow-700'
              )}
            >
              Dismiss
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

// Hook to determine if battery alert should be shown
export function useBatteryAlert(voltage: number, status: 'normal' | 'low' | 'critical') {
  const shouldShowAlert = status === 'low' || status === 'critical';
  const isUrgent = status === 'critical';
  
  return {
    shouldShowAlert,
    isUrgent,
    alertLevel: status
  };
}