import React from 'react';
import { Clock, AlertCircle } from 'lucide-react';

interface EstimatedWaitTimeProps {
  minutes: number;
  queuePosition: number;
  className?: string;
  showDetails?: boolean;
  isNext?: boolean;
}

export function EstimatedWaitTime({ 
  minutes, 
  queuePosition,
  className = '',
  showDetails = true,
  isNext = false
}: EstimatedWaitTimeProps) {
  // Format the wait time in a human-readable format
  const formatWaitTime = (minutes: number): string => {
    if (minutes === 0) {
      return 'Available now';
    }
    
    if (minutes < 60) {
      return `${minutes} min`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    
    return `${hours}h ${remainingMinutes}m`;
  };
  
  // Determine the appropriate color based on wait time
  const getWaitTimeColor = (minutes: number): string => {
    if (minutes === 0) {
      return 'text-green-600 dark:text-green-400';
    } else if (minutes <= 15) {
      return 'text-green-600 dark:text-green-400';
    } else if (minutes <= 45) {
      return 'text-amber-600 dark:text-amber-400';
    } else {
      return 'text-red-600 dark:text-red-400';
    }
  };
  
  const waitTimeColor = getWaitTimeColor(minutes);
  const formattedTime = formatWaitTime(minutes);
  
  // Show special indicator for next in line
  if (isNext || queuePosition === 1) {
    return (
      <div className={`flex items-center ${className}`}>
        <AlertCircle className="h-4 w-4 mr-1 text-green-600 dark:text-green-400" />
        <span className="text-sm font-medium text-green-600 dark:text-green-400">
          You&apos;re next!
          {showDetails && (
            <span className="text-gray-500 dark:text-gray-400 ml-1 font-normal">
              (Position: 1)
            </span>
          )}
        </span>
      </div>
    );
  }
  
  return (
    <div className={`flex items-center ${className}`}>
      <Clock className={`h-4 w-4 mr-1 ${waitTimeColor}`} />
      <span className={`text-sm font-medium ${waitTimeColor}`}>
        {formattedTime}
        {showDetails && queuePosition > 0 && (
          <span className="text-gray-500 dark:text-gray-400 ml-1 font-normal">
            (Position: {queuePosition})
          </span>
        )}
      </span>
    </div>
  );
}