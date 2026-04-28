'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useIsBrowser } from '@/hooks/use-is-browser';
import { StationMap } from '@/components/stations/station-map';
import { StationList } from '@/components/stations/station-list';
import { ChargingStation } from '@/types/station';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, AlertCircle, RefreshCw, Sliders } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AIRecommendation } from '@/components/stations/ai-recommendation';
import { ChargingCostCalculator } from '@/components/stations/charging-cost-calculator';
import { EVChatbot } from '@/components/user/ev-chatbot';

export default function StationsPage() {
  const isBrowser = useIsBrowser();
  const [stations, setStations] = useState<ChargingStation[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('list');
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  // Filter settings
  const [radius, setRadius] = useState(100); // Increased default radius
  const [limit, setLimit] = useState(20);
  const [refreshing, setRefreshing] = useState(false);
  const [fastChargingOnly, setFastChargingOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [highlightedStationId, setHighlightedStationId] = useState<string | undefined>();

  // Load stations with user location
  const fetchStations = useCallback(async (location: { latitude: number; longitude: number }) => {
    try {
      setRefreshing(true);
      setError(null); // Clear previous errors

      console.log('Fetching stations for location:', location, 'radius:', radius, 'limit:', limit);

      // Fetch nearby stations from API
      const response = await fetch(
        `/api/stations/nearby?lat=${location.latitude}&lng=${location.longitude}&radius=${radius}&limit=${limit}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API error response:', errorData);
        throw new Error(`API error: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('API response:', data);

      setStations(data.stations || []);
      setUserLocation(data.userLocation);
      setLoading(false);
      setRefreshing(false);

      if (data.stations && data.stations.length === 0) {
        setError(`No charging stations found within ${radius}km of your location. Try increasing the search radius.`);
      }
    } catch (err) {
      console.error('Error fetching stations:', err);
      setError(`Failed to fetch nearby stations: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false);
      setRefreshing(false);
    }
  }, [radius, limit]);

  // Default location (Delhi, India - Connaught Place)
  const defaultLocation = useMemo(() => ({
    latitude: 28.6139,
    longitude: 77.2090
  }), []);

  // Get user location
  const getUserLocation = useCallback(() => {
    // Set initial loading state
    setLoading(true);
    
    if (!isBrowser) {
      // If we're on the server, use default location
      setUserLocation(defaultLocation);
      return;
    }
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLoc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setUserLocation(userLoc);
          setLocationPermission('granted');
          setError(null);
          fetchStations(userLoc);
        },
        (err) => {
          console.error('Error getting location:', err);
          setError('Could not get your location. Using default location (Delhi, India).');
          setLocationPermission('denied');
          setUserLocation(defaultLocation);
          fetchStations(defaultLocation);
        },
        {
          timeout: 10000,
          enableHighAccuracy: false,
          maximumAge: 300000
        }
      );
    } else {
      setError('Geolocation is not supported by your browser. Using default location (Delhi, India).');
      setLocationPermission('denied');
      setUserLocation(defaultLocation);
      fetchStations(defaultLocation);
    }
  }, [isBrowser, defaultLocation, fetchStations]);

  // Initial load - only run on client side
  useEffect(() => {
    // Set initial loading state
    setLoading(true);
    
    if (isBrowser) {
      getUserLocation();
    } else {
      // If we're on the server, use default location
      setUserLocation(defaultLocation);
    }
  }, [isBrowser, getUserLocation, defaultLocation]);

  // Handle refresh
  const handleRefresh = () => {
    if (userLocation) {
      fetchStations(userLocation);
    } else {
      // Use default location if no user location is available
      setUserLocation(defaultLocation);
      fetchStations(defaultLocation);
    }
  };

  // Handle filter apply
  const handleApplyFilters = () => {
    const locationToUse = userLocation || defaultLocation;
    if (!userLocation) {
      setUserLocation(defaultLocation);
    }
    fetchStations(locationToUse);
  };

  const handleStationSelect = (station: ChargingStation) => {
    const sid = station.id || station._id?.toString();
    setHighlightedStationId(sid);
    setActiveTab('list'); // switch to list so the card is visible
  };

  const handleQueueUpdate = (stationId: string, newQueueLength: number) => {
    // Update the stations array with the new queue length
    setStations(prevStations =>
      prevStations.map(station => {
        const currentStationId = station.id || station._id?.toString();
        if (currentStationId === stationId) {
          return { ...station, queueLength: newQueueLength };
        }
        return station;
      })
    );
  };

  // Apply client-side filters
  const filteredStations = stations.filter(s => {
    if (fastChargingOnly && !s.fastCharging) return false;
    if (minRating > 0 && (s.rating ?? 0) < minRating) return false;
    return true;
  });

  // Show a loading state if we're not in a browser environment yet
  if (!isBrowser) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Charging Stations</h1>
          <p className="text-sm text-muted-foreground mt-1">Find nearby EV charging points</p>
        </div>
        <div className="w-full h-[400px] flex items-center justify-center bg-muted rounded-xl border border-border">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading stations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Charging Stations</h1>
          <p className="text-sm text-muted-foreground mt-1">Find nearby EV charging points</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Sliders className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent className="z-[9999]">
              <SheetHeader>
                <SheetTitle>Search Filters</SheetTitle>
                <SheetDescription>
                  Adjust your search parameters for charging stations
                </SheetDescription>
              </SheetHeader>

              <div className="py-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="radius">Search Radius: {radius} km</Label>
                  <Slider
                    id="radius"
                    min={5}
                    max={100}
                    step={5}
                    value={[radius]}
                    onValueChange={(value) => setRadius(value[0])}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="limit">Maximum Results</Label>
                  <Input
                    id="limit"
                    type="number"
                    min={5}
                    max={50}
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value) || 20)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minRating">Minimum Rating: {minRating > 0 ? `${minRating}★` : 'Any'}</Label>
                  <Slider
                    id="minRating"
                    min={0}
                    max={5}
                    step={0.5}
                    value={[minRating]}
                    onValueChange={(value) => setMinRating(value[0])}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    id="fastChargingOnly"
                    type="checkbox"
                    checked={fastChargingOnly}
                    onChange={e => setFastChargingOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="fastChargingOnly">Fast Charging only (DC)</Label>
                </div>

                {locationPermission === 'denied' && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Location Access Denied</AlertTitle>
                    <AlertDescription>
                      Please enable location access in your browser settings to get the most accurate results.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <SheetFooter>
                <Button onClick={handleApplyFilters}>Apply Filters</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {userLocation && !loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>
            Using location: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
          </span>
          {(fastChargingOnly || minRating > 0) && (
            <span className="ml-2 text-blue-600 text-xs">
              {filteredStations.length}/{stations.length} stations shown
            </span>
          )}
        </div>
      )}

      {/* AI Recommendation — top of page */}
      {!loading && filteredStations.length > 0 && (
        <AIRecommendation
          stations={filteredStations}
          onStationSelect={handleStationSelect}
        />
      )}

      <Tabs defaultValue="list" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="map">Map View</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <StationList
            stations={filteredStations}
            userLocation={userLocation}
            loading={loading || refreshing}
            onQueueUpdate={handleQueueUpdate}
            highlightedStationId={highlightedStationId}
          />
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          <StationMap
            stations={filteredStations}
            userLocation={userLocation}
            loading={loading || refreshing}
            onStationSelect={handleStationSelect}
            onQueueUpdate={handleQueueUpdate}
          />
        </TabsContent>
      </Tabs>

      {/* Cost Calculator + Chatbot */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChargingCostCalculator stations={filteredStations} />
          <EVChatbot stations={filteredStations} userLocation={userLocation} />
        </div>
      )}
    </div>
  );
}