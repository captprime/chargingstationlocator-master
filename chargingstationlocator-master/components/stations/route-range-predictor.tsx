'use client';

import { useState, useRef, useEffect } from 'react';
import { ChargingStation } from '@/types/station';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Navigation, CheckCircle2, AlertTriangle, MapPin, Search, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RouteRangePredictorProps {
  stations?: ChargingStation[];
  userLocation?: { latitude: number; longitude: number };
  batteryPercentage?: number;
}

interface GeoResult {
  display_name: string;
  lat: string;
  lon: string;
}

const KM_PER_PERCENT = 2.0;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function RouteRangePredictor({ stations = [], userLocation, batteryPercentage = 80 }: RouteRangePredictorProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [destination, setDestination] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [result, setResult] = useState<null | {
    canReach: boolean; distanceKm: number; rangeKm: number; stopStation?: ChargingStation;
  }>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Geocode via Nominatim
  const searchPlaces = async (q: string) => {
    if (q.trim().length < 3) { setSuggestions([]); return; }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=in`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data: GeoResult[] = await res.json();
      setSuggestions(data);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setDestination(null);
    setResult(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(val), 400);
  };

  const handleSelect = (place: GeoResult) => {
    setDestination({ name: place.display_name, lat: parseFloat(place.lat), lng: parseFloat(place.lon) });
    setQuery(place.display_name.split(',').slice(0, 2).join(', '));
    setSuggestions([]);
  };

  const handleCheck = () => {
    if (!destination) return;
    const origin = userLocation ?? { latitude: 28.6139, longitude: 77.209 };
    const distanceKm = haversineKm(origin.latitude, origin.longitude, destination.lat, destination.lng);
    const rangeKm = batteryPercentage * KM_PER_PERCENT;
    const canReach = rangeKm >= distanceKm;

    let stopStation: ChargingStation | undefined;
    if (!canReach) {
      stopStation = stations
        .filter(s => (s.distance ?? 0) <= rangeKm)
        .sort((a, b) => {
          const aDist = haversineKm(a.latitude, a.longitude, destination.lat, destination.lng);
          const bDist = haversineKm(b.latitude, b.longitude, destination.lat, destination.lng);
          return aDist - bDist;
        })[0];
    }
    setResult({ canReach, distanceKm, rangeKm, stopStation });
  };

  const handleClear = () => {
    setQuery('');
    setDestination(null);
    setSuggestions([]);
    setResult(null);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const rangeKm = Math.round(batteryPercentage * KM_PER_PERCENT);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-blue-600" />
          Route & Range Prediction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Range indicator */}
        <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
          <span className="text-sm text-blue-700">Current range</span>
          <span className="font-semibold text-blue-800">~{rangeKm} km <span className="font-normal text-blue-600 text-xs">({batteryPercentage}% battery)</span></span>
        </div>

        {/* Location search */}
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9 pr-9"
              placeholder="Search destination (e.g. Noida, Connaught Place…)"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
            )}
            {!searching && query && (
              <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg overflow-hidden">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className={cn(
                    'w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-start gap-2',
                    i !== suggestions.length - 1 && 'border-b border-border/50'
                  )}
                  onClick={() => handleSelect(s)}
                >
                  <MapPin className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2 text-gray-700">{s.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected destination chip */}
        {destination && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
            <MapPin className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
            <span className="text-blue-800 truncate flex-1">{destination.name.split(',').slice(0, 3).join(', ')}</span>
          </div>
        )}

        <Button onClick={handleCheck} className="w-full" disabled={!destination}>
          Check if I can reach
        </Button>

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Distance to destination</span>
              <span className="font-semibold">{result.distanceKm.toFixed(1)} km</span>
            </div>

            {result.canReach ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  You can reach <span className="font-medium">{destination?.name.split(',')[0]}</span>. ~{Math.round(result.rangeKm - result.distanceKm)} km range remaining.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-700">
                  Not enough range ({result.rangeKm} km available, need {result.distanceKm.toFixed(0)} km).
                  {result.stopStation ? (
                    <span className="block mt-1 font-medium">
                      Suggested stop: {result.stopStation.name} ({result.stopStation.distance?.toFixed(1)} km, ₹{result.stopStation.pricePerKwh}/kWh)
                    </span>
                  ) : (
                    <span className="block mt-1">No reachable charging stop found nearby.</span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {result.stopStation && !result.canReach && destination && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  const origin = userLocation ?? { latitude: 28.6139, longitude: 77.209 };
                  const url = `https://www.google.com/maps/dir/${origin.latitude},${origin.longitude}/${result.stopStation!.latitude},${result.stopStation!.longitude}/${destination.lat},${destination.lng}`;
                  window.open(url, '_blank');
                }}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Open route with charging stop
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
