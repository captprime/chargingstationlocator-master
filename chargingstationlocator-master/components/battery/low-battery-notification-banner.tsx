'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BatteryLow, MapPin, X, Navigation } from 'lucide-react';

interface NearbyStation {
  id: string;
  name: string;
  distance: number;
  lat: number;
  lng: number;
  queueLength: number;
  pricePerKwh: number;
}

interface LowBatteryNotification {
  _id: string;
  message: string;
  priority: 'medium' | 'high';
  createdAt: string;
  metadata?: {
    batteryPercentage?: number;
    nearbyStations?: NearbyStation[];
    userLat?: number;
    userLng?: number;
  };
}

export function LowBatteryNotificationBanner() {
  const { data: session } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<LowBatteryNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchAlerts = async () => {
      try {
        const res = await fetch(
          `/api/notifications?userId=${session.user.id}&unreadOnly=true&limit=5`
        );
        const data = await res.json();
        if (data.notifications) {
          const lowBattery = data.notifications.filter(
            (n: any) => n.type === 'low_battery'
          );
          setNotifications(lowBattery);
        }
      } catch {
        // silently fail
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  const dismiss = async (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
    // Mark as read
    if (session?.user?.id) {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [id], userId: session.user.id }),
      });
    }
  };

  const visible = notifications.filter((n) => !dismissed.has(n._id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((n) => {
        const isCritical = n.priority === 'high';
        const stations = n.metadata?.nearbyStations ?? [];
        const lat = n.metadata?.userLat;
        const lng = n.metadata?.userLng;
        const stationsHref = lat && lng ? `/stations?lat=${lat}&lng=${lng}` : '/stations';

        return (
          <Alert
            key={n._id}
            variant={isCritical ? 'destructive' : 'default'}
            className={
              isCritical
                ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
            }
          >
            <BatteryLow className={`h-4 w-4 ${isCritical ? 'text-red-600' : 'text-yellow-600'}`} />
            <AlertDescription>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <p className={`font-medium text-sm ${isCritical ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200'}`}>
                    {isCritical ? '🔴 Critical Battery' : '🟡 Low Battery'} — {n.metadata?.batteryPercentage}% remaining
                  </p>

                  {stations.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Nearby charging stations:</p>
                      {stations.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 text-xs">
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-medium">{s.name}</span>
                          <Badge variant="outline" className="text-xs py-0">{s.distance.toFixed(1)} km</Badge>
                          <Badge variant="outline" className="text-xs py-0">Queue: {s.queueLength}</Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant={isCritical ? 'destructive' : 'default'}
                    className="mt-1 h-7 text-xs"
                    onClick={() => router.push(stationsHref)}
                  >
                    <Navigation className="h-3 w-3 mr-1" />
                    Find Charging Stations
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => dismiss(n._id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
