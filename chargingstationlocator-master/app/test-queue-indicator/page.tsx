'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// Dynamically import components that use toast to avoid SSR issues
const QueueStatusIndicator = dynamic(
  () => import('@/components/stations/queue-status-indicator').then(mod => ({ default: mod.QueueStatusIndicator })),
  { ssr: false }
);

const ActiveSessionsCard = dynamic(
  () => import('@/components/sessions/active-sessions-card').then(mod => ({ default: mod.ActiveSessionsCard })),
  { ssr: false }
);

export default function TestQueueIndicatorPage() {
  const [stationId] = useState('test-station-1');
  const [queueLength, setQueueLength] = useState(3);
  const [userPosition, setUserPosition] = useState<number | undefined>(2);

  const handleDecreaseQueue = () => {
    setQueueLength(prev => Math.max(0, prev - 1));
    if (userPosition && userPosition > 1) {
      setUserPosition(prev => prev ? prev - 1 : undefined);
    }
  };

  const handleIncreaseQueue = () => {
    setQueueLength(prev => prev + 1);
  };

  const handleToggleUserInQueue = () => {
    setUserPosition(prev => prev ? undefined : queueLength);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Queue Indicator Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Queue Status Indicator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border rounded-md">
                <h3 className="font-medium mb-4">Test Station</h3>
                <QueueStatusIndicator 
                  stationId={stationId}
                  initialQueueLength={queueLength}
                  userPosition={userPosition}
                />
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Queue Length: {queueLength}</span>
                  <div className="space-x-2">
                    <Button 
                      onClick={handleDecreaseQueue} 
                      variant="outline" 
                      size="sm"
                      disabled={queueLength === 0}
                    >
                      Decrease
                    </Button>
                    <Button 
                      onClick={handleIncreaseQueue} 
                      variant="outline" 
                      size="sm"
                    >
                      Increase
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>User Position: {userPosition ?? 'Not in queue'}</span>
                  <Button 
                    onClick={handleToggleUserInQueue} 
                    variant="outline" 
                    size="sm"
                  >
                    {userPosition ? 'Remove from Queue' : 'Add to Queue'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div>
          <ActiveSessionsCard />
        </div>
      </div>
    </div>
  );
}