'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { ChargingStation } from '@/types/station';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Navigation, MapPin, DollarSign, Users, Clock,
  X, Zap, Star, List
} from 'lucide-react';
import L from 'leaflet';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import 'leaflet/dist/leaflet.css';

// Force Leaflet container to fill properly
const MAP_STYLE: React.CSSProperties = { height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 };

// ─── Animated dashed route line style ────────────────────────────────────────
const ROUTE_STYLE = {
  color: '#10b981',
  weight: 3,
  opacity: 0.85,
  dashArray: '10 8',
  lineCap: 'round' as const,
  lineJoin: 'round' as const,
};

// ─── Custom SVG marker factory ────────────────────────────────────────────────
function makeIcon(fill: string, ring: string, size = 36) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="16" fill="${ring}" opacity="0.2"/>
    <circle cx="18" cy="18" r="11" fill="${fill}" stroke="white" stroke-width="2.5"/>
    <circle cx="18" cy="18" r="4" fill="white"/>
  </svg>`;
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function makeSelectedIcon(fill: string, size = 44) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 44 44">
    <circle cx="22" cy="22" r="20" fill="${fill}" opacity="0.18"/>
    <circle cx="22" cy="22" r="14" fill="${fill}" stroke="white" stroke-width="3"/>
    <circle cx="22" cy="22" r="5" fill="white"/>
  </svg>`;
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function makeUserIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
    <circle cx="22" cy="22" r="20" fill="#8b5cf6" opacity="0.15"/>
    <circle cx="22" cy="22" r="12" fill="#8b5cf6" stroke="white" stroke-width="3"/>
    <circle cx="22" cy="22" r="5" fill="white"/>
  </svg>`;
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

const ICONS = {
  free: makeIcon('#22c55e', '#22c55e'),
  low: makeIcon('#f59e0b', '#f59e0b'),
  busy: makeIcon('#ef4444', '#ef4444'),
  selectedFree: makeSelectedIcon('#22c55e'),
  selectedLow: makeSelectedIcon('#f59e0b'),
  selectedBusy: makeSelectedIcon('#ef4444'),
  user: makeUserIcon(),
};

function getIcon(queueLength: number, selected = false) {
  if (selected) {
    if (queueLength === 0) return ICONS.selectedFree;
    if (queueLength <= 2) return ICONS.selectedLow;
    return ICONS.selectedBusy;
  }
  if (queueLength === 0) return ICONS.free;
  if (queueLength <= 2) return ICONS.low;
  return ICONS.busy;
}

// ─── Map auto-fit ─────────────────────────────────────────────────────────────
function MapFitter({ stations, userLocation }: {
  stations: ChargingStation[];
  userLocation?: { latitude: number; longitude: number };
}) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = stations.map(s => [s.latitude, s.longitude]);
    if (userLocation) points.push([userLocation.latitude, userLocation.longitude]);
    if (points.length === 0) return;
    // Invalidate size first so Leaflet knows the real container dimensions
    map.invalidateSize();
    if (points.length === 1) { map.setView(points[0], 14); return; }
    const bounds = L.latLngBounds(points);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [map, stations, userLocation]);
  return null;
}

// ─── Close panel on map click ─────────────────────────────────────────────────
function MapClickHandler({ onClose }: { onClose: () => void }) {
  useMapEvents({ click: onClose });
  return null;
}

// ─── Force size recalculation on mount ───────────────────────────────────────
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    // Small delay ensures the tab/container is fully visible before measuring
    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

// ─── Animated route line ──────────────────────────────────────────────────────
function AnimatedRoute({ from, to }: { from: [number, number]; to: [number, number] }) {
  const map = useMap();
  const polyRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    // Inject dash-offset animation CSS once
    const styleId = 'route-anim-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes dashMove {
          to { stroke-dashoffset: -36; }
        }
        .route-animated path {
          animation: dashMove 0.8s linear infinite;
        }
      `;
      document.head.appendChild(style);
    }

    // Draw polyline
    const poly = L.polyline([from, to], {
      ...ROUTE_STYLE,
      className: 'route-animated',
    }).addTo(map);
    polyRef.current = poly;

    // Pan map to show both points
    const bounds = L.latLngBounds([from, to]);
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15, animate: true, duration: 0.6 });

    return () => { poly.remove(); };
  }, [map, from, to]);

  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface StationMapProps {
  stations: ChargingStation[];
  userLocation?: { latitude: number; longitude: number };
  loading?: boolean;
  onStationSelect?: (station: ChargingStation) => void;
  onQueueUpdate?: (stationId: string, newQueueLength: number) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function StationMapClient({ stations, userLocation, loading = false, onStationSelect, onQueueUpdate }: StationMapProps) {
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<ChargingStation | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [userSessions, setUserSessions] = useState<Record<string, number>>({});
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const { data: session } = useSession();

  useEffect(() => { setReady(true); }, []);

  useEffect(() => {
    const fetch_ = async () => {
      if (!session?.user) return;
      try {
        const res = await fetch('/api/sessions/active');
        if (!res.ok) return;
        const data = await res.json();
        const map: Record<string, number> = {};
        if (data?.sessions && Array.isArray(data.sessions)) {
          data.sessions.forEach((s: { stationId?: string; queuePosition?: number }) => {
            if (s.stationId && s.queuePosition) map[s.stationId] = s.queuePosition;
          });
        }
        setUserSessions(map);
      } catch { /* silent */ }
    };
    fetch_();
  }, [session]);

  const handleMarkerClick = useCallback((station: ChargingStation) => {
    const sid = station.id || station._id?.toString();
    const selectedSid = selected ? (selected.id || selected._id?.toString()) : null;

    if (selectedSid === sid) {
      // Second click on same station → go to list view
      onStationSelect?.(station);
      setSelected(null);
      setShowRoute(false);
    } else {
      // First click → show panel + route animation
      setSelected(station);
      setShowRoute(!!userLocation);
    }
  }, [selected, userLocation, onStationSelect]);

  const handleViewInList = useCallback((station: ChargingStation) => {
    onStationSelect?.(station);
    setSelected(null);
    setShowRoute(false);
  }, [onStationSelect]);

  const handleClose = useCallback(() => {
    setSelected(null);
    setShowRoute(false);
  }, []);

  const handleNavigate = (station: ChargingStation) => {
    const dest = `${station.latitude},${station.longitude}`;
    const url = userLocation
      ? `https://www.google.com/maps/dir/${userLocation.latitude},${userLocation.longitude}/${dest}`
      : `https://www.google.com/maps/search/?api=1&query=${dest}`;
    window.open(url, '_blank');
  };

  const handleJoinQueue = async (station: ChargingStation) => {
    const sid = station.id || station._id?.toString();
    if (!sid) return;
    setJoiningId(sid);
    try {
      const res = await fetch(`/api/stations/${sid}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const data = await res.json();
      if (onQueueUpdate && data.station) onQueueUpdate(sid, data.station.queueLength);
      if (data.session) {
        setUserSessions(prev => ({ ...prev, [sid]: data.session.queuePosition }));
        setSelected(prev => prev ? { ...prev, queueLength: data.station.queueLength } : prev);
      }
      toast.success(`Joined queue at ${station.name} — position #${data.station?.queueLength}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join queue');
    } finally {
      setJoiningId(null);
    }
  };

  const defaultCenter: [number, number] = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : stations.length > 0 ? [stations[0].latitude, stations[0].longitude]
    : [28.6139, 77.209];

  if (loading) {
    return (
      <div className="w-full h-[520px] rounded-xl bg-muted flex items-center justify-center border border-border">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading map…</p>
        </div>
      </div>
    );
  }

  const selectedSid = selected ? (selected.id || selected._id?.toString() || '') : '';

  return (
    <div className="relative w-full rounded-xl border border-border shadow-sm bg-muted" style={{ height: '520px' }}>
      {ready && (
        <MapContainer
          center={defaultCenter}
          zoom={13}
          style={MAP_STYLE}
          attributionControl={false}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />

          <MapFitter stations={stations} userLocation={userLocation} />
          <MapResizer />
          <MapClickHandler onClose={handleClose} />

          {/* Animated route line */}
          {showRoute && selected && userLocation && (
            <AnimatedRoute
              from={[userLocation.latitude, userLocation.longitude]}
              to={[selected.latitude, selected.longitude]}
            />
          )}

          {/* User location marker */}
          {userLocation && (
            <Marker
              position={[userLocation.latitude, userLocation.longitude]}
              icon={ICONS.user}
              zIndexOffset={1000}
            />
          )}

          {/* Station markers */}
          {stations.map(station => {
            const sid = station.id || station._id?.toString() || '';
            const isSelected = sid === selectedSid;
            return (
              <Marker
                key={sid}
                position={[station.latitude, station.longitude]}
                icon={getIcon(station.queueLength, isSelected)}
                zIndexOffset={isSelected ? 500 : 0}
                eventHandlers={{ click: (e) => { e.originalEvent.stopPropagation(); handleMarkerClick(station); } }}
              />
            );
          })}
        </MapContainer>
      )}

      {/* ── Floating legend ── */}
      <div className="absolute top-3 left-3 z-[800] bg-white/90 backdrop-blur-sm rounded-lg shadow border border-border px-3 py-2 space-y-1.5">
        {[
          { color: 'bg-green-500', label: 'Free' },
          { color: 'bg-amber-500', label: '1–2 waiting' },
          { color: 'bg-red-500', label: '3+ waiting' },
          { color: 'bg-violet-500', label: 'You' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2 text-xs text-gray-700">
            <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', color)} />
            {label}
          </div>
        ))}
        {selected && userLocation && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 border-t border-border pt-1.5 mt-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
            Route preview
          </div>
        )}
      </div>

      {/* ── Station count + hint ── */}
      <div className="absolute top-3 right-3 z-[800] flex flex-col items-end gap-1.5">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow border border-border px-3 py-1.5">
          <span className="text-xs font-medium text-gray-700">{stations.length} station{stations.length !== 1 ? 's' : ''}</span>
        </div>
        {!selected && (
          <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow border border-border px-2.5 py-1">
            <span className="text-[10px] text-muted-foreground">Tap marker to preview</span>
          </div>
        )}
        {selected && (
          <div className="bg-emerald-50/90 backdrop-blur-sm rounded-lg shadow border border-emerald-200 px-2.5 py-1">
            <span className="text-[10px] text-emerald-700">Tap again → go to list</span>
          </div>
        )}
      </div>

      {/* ── Slide-up station detail panel ── */}
      {selected && (() => {        const sid = selected.id || selected._id?.toString() || '';
        const inQueue = !!userSessions[sid];
        const queueColor = selected.queueLength === 0 ? 'text-green-600' : selected.queueLength <= 2 ? 'text-amber-600' : 'text-red-600';
        const distKm = selected.distance != null ? `${selected.distance} km` : '—';

        return (
          <div className="absolute bottom-0 left-0 right-0 z-[900] animate-in slide-in-from-bottom-4 duration-200">
            <div className="bg-white border-t border-border shadow-2xl rounded-t-2xl px-4 pt-4 pb-5">

              {/* Drag handle */}
              <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-3" />

              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base text-gray-900 truncate">{selected.name}</h3>
                    {selected.fastCharging && (
                      <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-[10px] px-1.5 py-0">
                        <Zap className="h-2.5 w-2.5 mr-0.5" />Fast
                      </Badge>
                    )}
                  </div>
                  {selected.operatingHours && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {selected.operatingHours.open === '24/7'
                        ? '24/7 Open'
                        : `${selected.operatingHours.open} – ${selected.operatingHours.close}`}
                    </p>
                  )}
                </div>
                <button onClick={handleClose} className="p-1 rounded-full hover:bg-muted transition-colors">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* Route hint */}
              {userLocation && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5 mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                  Route preview active — tap marker again to view in list
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="flex flex-col items-center bg-muted/40 rounded-lg py-2">
                  <MapPin className="h-3.5 w-3.5 text-blue-500 mb-0.5" />
                  <span className="text-xs font-semibold">{distKm}</span>
                  <span className="text-[10px] text-muted-foreground">away</span>
                </div>
                <div className="flex flex-col items-center bg-muted/40 rounded-lg py-2">
                  <DollarSign className="h-3.5 w-3.5 text-green-500 mb-0.5" />
                  <span className="text-xs font-semibold">₹{selected.pricePerKwh}</span>
                  <span className="text-[10px] text-muted-foreground">per kWh</span>
                </div>
                <div className="flex flex-col items-center bg-muted/40 rounded-lg py-2">
                  <Users className={cn('h-3.5 w-3.5 mb-0.5', queueColor)} />
                  <span className={cn('text-xs font-semibold', queueColor)}>
                    {selected.queueLength === 0 ? 'Free' : selected.queueLength}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {selected.queueLength === 0 ? 'no wait' : 'waiting'}
                  </span>
                </div>
              </div>

              {/* Rating + amenities */}
              {((selected.rating ?? 0) > 0 || (selected.amenities?.length ?? 0) > 0) && (
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {(selected.rating ?? 0) > 0 && (
                    <span className="flex items-center gap-0.5 text-[11px] text-yellow-600 font-medium">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {(selected.rating ?? 0).toFixed(1)}
                    </span>
                  )}
                  {selected.amenities?.slice(0, 4).map(a => (
                    <Badge key={a} variant="outline" className="text-[10px] px-1.5 py-0 h-5">{a}</Badge>
                  ))}
                  {(selected.amenities?.length ?? 0) > 4 && (
                    <span className="text-[10px] text-muted-foreground">+{(selected.amenities?.length ?? 0) - 4}</span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-9 text-xs"
                  onClick={() => handleJoinQueue(selected)}
                  disabled={inQueue || joiningId === sid}
                >
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  {inQueue ? `In Queue (#${userSessions[sid]})` : joiningId === sid ? 'Joining…' : 'Join Queue'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-9 text-xs"
                  onClick={() => handleNavigate(selected)}
                >
                  <Navigation className="h-3.5 w-3.5 mr-1.5" />
                  Directions
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 px-3 text-xs text-emerald-700 hover:bg-emerald-50"
                  onClick={() => handleViewInList(selected)}
                  title="View in list"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
