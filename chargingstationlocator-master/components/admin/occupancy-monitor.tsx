'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StationOccupancy {
  id: string;
  name: string;
  queueLength: number;
  capacity: number; // derived from amenities or default
  uptime: number;
}

function getOccupancyColor(pct: number) {
  if (pct >= 80) return 'bg-red-500';
  if (pct >= 50) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getOccupancyBadge(pct: number) {
  if (pct >= 80) return { label: 'High', className: 'bg-red-100 text-red-700 border-red-200' };
  if (pct >= 50) return { label: 'Medium', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  return { label: 'Low', className: 'bg-green-100 text-green-700 border-green-200' };
}

export function OccupancyMonitor() {
  const { data: session } = useSession();
  const [stations, setStations] = useState<StationOccupancy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStations = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stations');
      const data = await res.json();
      if (data.success) {
        setStations(data.stations.map((s: { _id: string; name: string; queueLength: number; amenities?: string[]; stats?: { uptime?: number } }) => ({
          id: s._id,
          name: s.name,
          queueLength: s.queueLength,
          capacity: s.amenities?.length ? Math.max(4, s.amenities.length * 2) : 10,
          uptime: s.stats?.uptime ?? 100,
        })));
      }
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { fetchStations(); }, [session, fetchStations]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Occupancy Monitor
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchStations} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse bg-gray-100 rounded-lg" />)}
          </div>
        ) : stations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No stations found.</p>
        ) : (
          stations.map(s => {
            const occupied = Math.min(s.queueLength, s.capacity);
            const pct = Math.round((occupied / s.capacity) * 100);
            const badge = getOccupancyBadge(pct);
            return (
              <div key={s.id} className="space-y-2 p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{s.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${badge.className}`}>{badge.label}</Badge>
                    <span className="text-xs text-muted-foreground">{occupied}/{s.capacity} occupied</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${getOccupancyColor(pct)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{pct}% occupied</span>
                  <span>Uptime: {s.uptime}%</span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
