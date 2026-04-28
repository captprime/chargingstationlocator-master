'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { ChargingStation } from '@/types/station';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Clock, DollarSign, Users, Navigation, Wifi, Coffee, ShoppingBag, Fuel, Zap, Star } from 'lucide-react';
import { QueueStatusIndicator } from '@/components/stations/queue-status-indicator';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface StationListProps {
  stations: ChargingStation[];
  loading?: boolean;
  userLocation?: { latitude: number; longitude: number };
  onQueueUpdate?: (stationId: string, newQueueLength: number) => void;
  highlightedStationId?: string;
}

type SortOption = 'distance' | 'price' | 'queue';

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  'WiFi': <Wifi className="h-3 w-3" />,
  'Cafe': <Coffee className="h-3 w-3" />,
  'Food Court': <Coffee className="h-3 w-3" />,
  'Shopping': <ShoppingBag className="h-3 w-3" />,
  'Fuel Station': <Fuel className="h-3 w-3" />,
  'Solar Powered': <Zap className="h-3 w-3" />,
};

function QueueDot({ length }: { length: number }) {
  const color = length === 0 ? 'bg-green-500' : length <= 2 ? 'bg-yellow-500' : 'bg-red-500';
  return <span className={cn('inline-block w-2 h-2 rounded-full', color)} />;
}

export function StationList({ stations, loading = false, userLocation, onQueueUpdate, highlightedStationId }: StationListProps) {
  const [sortBy, setSortBy] = useState<SortOption>('distance');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const { data: session } = useSession();
  const highlightRef = useRef<HTMLDivElement>(null);

  // Persist queue state in sessionStorage so it survives re-renders
  const [userSessions, setUserSessions] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = sessionStorage.getItem('userQueueSessions');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  const updateUserSessions = (updater: (prev: Record<string, number>) => Record<string, number>) => {
    setUserSessions(prev => {
      const next = updater(prev);
      try { sessionStorage.setItem('userQueueSessions', JSON.stringify(next)); } catch { /* silent */ }
      return next;
    });
  };

  const sortedStations = useMemo(() => {
    const copy = [...stations];
    if (sortBy === 'distance') return copy.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
    if (sortBy === 'price') return copy.sort((a, b) => a.pricePerKwh - b.pricePerKwh);
    if (sortBy === 'queue') return copy.sort((a, b) => a.queueLength - b.queueLength);
    return copy;
  }, [stations, sortBy]);

  // Scroll to highlighted station
  useEffect(() => {
    if (highlightedStationId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedStationId]);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!session?.user) return;
      try {
        const res = await fetch('/api/sessions/active');
        if (!res.ok) return;
        const data = await res.json();
        // Handle both wrapped ({ data: { sessions } }) and flat ({ sessions }) shapes
        const sessions = data?.data?.sessions ?? data?.sessions;
        if (Array.isArray(sessions)) {
          const map: Record<string, number> = {};
          sessions.forEach((s: { stationId?: string; queuePosition?: number }) => {
            if (s.stationId && s.queuePosition) map[s.stationId] = s.queuePosition;
          });
          // Server is source of truth — replace local state entirely (clears stale sessionStorage too)
          updateUserSessions(() => map);
        }
      } catch { /* silent */ }
    };
    fetchSessions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  const handleNavigate = (station: ChargingStation) => {
    const dest = `${station.latitude},${station.longitude}`;
    const url = userLocation
      ? `https://www.google.com/maps/dir/${userLocation.latitude},${userLocation.longitude}/${dest}`
      : `https://www.google.com/maps/search/?api=1&query=${dest}`;
    window.open(url, '_blank');
  };

  const handleJoinQueue = async (station: ChargingStation) => {
    const stationId = station.id || station._id?.toString();
    if (!stationId) return;
    setJoiningId(stationId);
    try {
      const res = await fetch(`/api/stations/${stationId}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to join queue');
      }
      const data = await res.json();
      if (onQueueUpdate && data.station) onQueueUpdate(stationId, data.station.queueLength);
      if (data.session) updateUserSessions(prev => ({ ...prev, [stationId]: data.session.queuePosition }));
      toast.success(`Joined queue at ${station.name} — position #${data.station?.queueLength}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join queue');
    } finally {
      setJoiningId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="h-5 w-40 bg-muted animate-pulse rounded" />
          <div className="h-9 w-36 bg-muted animate-pulse rounded" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (stations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MapPin className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No charging stations found</p>
        <p className="text-sm mt-1">Try expanding your search radius or adjusting filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium text-muted-foreground">
          {stations.length} station{stations.length !== 1 ? 's' : ''} found
        </p>
        <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="distance">Nearest first</SelectItem>
            <SelectItem value="price">Cheapest first</SelectItem>
            <SelectItem value="queue">Shortest queue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Station cards */}
      <div className="space-y-2">
        {sortedStations.map((station) => {
          const sid = station.id || station._id?.toString() || '';
          const isHighlighted = sid === highlightedStationId;
          const inQueue = !!userSessions[sid];

          return (
            <div
              key={sid}
              ref={isHighlighted ? highlightRef : undefined}
              className={cn(
                'rounded-xl border bg-card p-4 transition-all duration-300',
                isHighlighted
                  ? 'border-emerald-400 ring-2 ring-emerald-200 shadow-md'
                  : 'border-border hover:border-muted-foreground/30 hover:shadow-sm'
              )}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-foreground truncate">{station.name}</h3>
                    {isHighlighted && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">
                        AI Pick
                      </Badge>
                    )}
                    {station.fastCharging && (
                      <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-[10px] px-1.5 py-0">
                        <Zap className="h-2.5 w-2.5 mr-0.5" />Fast
                      </Badge>
                    )}
                  </div>
                  {station.operatingHours && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {station.operatingHours.open === '24/7'
                        ? '24/7 Open'
                        : `${station.operatingHours.open} – ${station.operatingHours.close}`}
                    </p>
                  )}
                </div>
                <QueueStatusIndicator
                  stationId={sid}
                  initialQueueLength={station.queueLength}
                  userPosition={userSessions[sid]}
                />
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="flex flex-col items-center bg-muted/40 rounded-lg py-2 px-1">
                  <MapPin className="h-3.5 w-3.5 text-blue-500 mb-0.5" />
                  <span className="text-xs font-semibold text-foreground">
                    {station.distance != null ? `${station.distance} km` : '—'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">distance</span>
                </div>
                <div className="flex flex-col items-center bg-muted/40 rounded-lg py-2 px-1">
                  <DollarSign className="h-3.5 w-3.5 text-green-500 mb-0.5" />
                  <span className="text-xs font-semibold text-foreground">₹{station.pricePerKwh}</span>
                  <span className="text-[10px] text-muted-foreground">per kWh</span>
                </div>
                <div className="flex flex-col items-center bg-muted/40 rounded-lg py-2 px-1">
                  <div className="flex items-center gap-1 mb-0.5">
                    <QueueDot length={station.queueLength} />
                    <Users className="h-3 w-3 text-orange-500" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">
                    {station.queueLength === 0 ? 'Free' : station.queueLength}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {station.queueLength === 0 ? 'no wait' : 'waiting'}
                    {inQueue ? ` · #${userSessions[sid]}` : ''}
                  </span>
                </div>
              </div>

              {/* Rating + amenities */}
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {(station.rating ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] text-yellow-600 font-medium">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {(station.rating ?? 0).toFixed(1)}
                  </span>
                )}
                {station.amenities?.slice(0, 4).map(a => (
                  <Badge key={a} variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
                    {AMENITY_ICONS[a] ?? null}
                    {a}
                  </Badge>
                ))}
                {(station.amenities?.length ?? 0) > 4 && (
                  <span className="text-[10px] text-muted-foreground">+{(station.amenities?.length ?? 0) - 4} more</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => handleJoinQueue(station)}
                  disabled={inQueue || joiningId === sid}
                >
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  {inQueue ? `In Queue (#${userSessions[sid]})` : joiningId === sid ? 'Joining…' : 'Join Queue'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs"
                  onClick={() => handleNavigate(station)}
                >
                  <Navigation className="h-3.5 w-3.5 mr-1.5" />
                  Directions
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
