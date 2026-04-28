'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as L from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Navigation, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  onLocationChange: (lat: number, lng: number) => void;
  className?: string;
}

export function LocationPicker({ 
  latitude, 
  longitude, 
  onLocationChange, 
  className 
}: LocationPickerProps) {
  const [mapLatitude, setMapLatitude] = useState(latitude);
  const [mapLongitude, setMapLongitude] = useState(longitude);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Memoize the location change callback
  const handleLocationChange = useCallback((lat: number, lng: number) => {
    setMapLatitude(lat);
    setMapLongitude(lng);
    onLocationChange(lat, lng);
  }, [onLocationChange]);

  // Initialize map
  useEffect(() => {
    const initializeMap = async () => {
      try {
        // Use Leaflet for the map implementation
        const L = (await import('leaflet')).default;
        
        // Import Leaflet CSS
        if (typeof window !== 'undefined') {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        if (mapRef.current && !mapInstanceRef.current) {
          // Initialize map
          const map = L.map(mapRef.current).setView([mapLatitude, mapLongitude], 13);

          // Add tile layer
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);

          // Create custom icon
          const customIcon = L.divIcon({
            html: `<div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                       <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                     </svg>
                   </div>`,
            className: 'custom-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 24]
          });

          // Add marker
          const marker = L.marker([mapLatitude, mapLongitude], { 
            icon: customIcon,
            draggable: true 
          }).addTo(map);

          // Handle marker drag
          marker.on('dragend', (e: L.DragEndEvent) => {
            const position = e.target.getLatLng();
            handleLocationChange(position.lat, position.lng);
          });

          // Handle map click
          map.on('click', (e: L.LeafletMouseEvent) => {
            const { lat, lng } = e.latlng;
            marker.setLatLng([lat, lng]);
            handleLocationChange(lat, lng);
          });

          mapInstanceRef.current = map;
          markerRef.current = marker;
        }
      } catch (error) {
        console.error('Error initializing map:', error);
        toast.error('Failed to load map. Please enter coordinates manually.');
      }
    };

    initializeMap();

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update map when coordinates change externally
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current) {
      if (Math.abs(latitude - mapLatitude) > 0.0001 || Math.abs(longitude - mapLongitude) > 0.0001) {
        setMapLatitude(latitude);
        setMapLongitude(longitude);
        mapInstanceRef.current.setView([latitude, longitude], 13);
        markerRef.current.setLatLng([latitude, longitude]);
      }
    }
  }, [latitude, longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }

    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        handleLocationChange(lat, lng);
        
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([lat, lng], 15);
          markerRef.current.setLatLng([lat, lng]);
        }
        
        setIsLoadingLocation(false);
        toast.success('Location updated to your current position');
      },
      (error) => {
        console.error('Error getting location:', error);
        setIsLoadingLocation(false);
        toast.error('Failed to get your current location');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  // Reset to default location (center of map)
  const resetLocation = () => {
    const defaultLat = 28.6139;
    const defaultLng = 77.2090;
    handleLocationChange(defaultLat, defaultLng);
    
    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([defaultLat, defaultLng], 13);
      markerRef.current.setLatLng([defaultLat, defaultLng]);
    }
  };

  // Handle manual coordinate input
  const handleLatitudeChange = (value: string) => {
    const lat = parseFloat(value);
    if (!isNaN(lat) && lat >= -90 && lat <= 90) {
      handleLocationChange(lat, mapLongitude);
      
      if (mapInstanceRef.current && markerRef.current) {
        mapInstanceRef.current.setView([lat, mapLongitude], mapInstanceRef.current.getZoom());
        markerRef.current.setLatLng([lat, mapLongitude]);
      }
    }
  };

  const handleLongitudeChange = (value: string) => {
    const lng = parseFloat(value);
    if (!isNaN(lng) && lng >= -180 && lng <= 180) {
      handleLocationChange(mapLatitude, lng);
      
      if (mapInstanceRef.current && markerRef.current) {
        mapInstanceRef.current.setView([mapLatitude, lng], mapInstanceRef.current.getZoom());
        markerRef.current.setLatLng([mapLatitude, lng]);
      }
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Picker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Manual coordinate input */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="latitude">Latitude</Label>
            <Input
              id="latitude"
              type="number"
              step="0.000001"
              value={mapLatitude}
              onChange={(e) => handleLatitudeChange(e.target.value)}
              placeholder="0.000000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="longitude">Longitude</Label>
            <Input
              id="longitude"
              type="number"
              step="0.000001"
              value={mapLongitude}
              onChange={(e) => handleLongitudeChange(e.target.value)}
              placeholder="0.000000"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={getCurrentLocation}
            disabled={isLoadingLocation}
          >
            <Navigation className="h-4 w-4 mr-2" />
            {isLoadingLocation ? 'Getting Location...' : 'Use Current Location'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetLocation}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        {/* Map container */}
        <div className="space-y-2">
          <Label>Interactive Map</Label>
          <div 
            ref={mapRef} 
            className="w-full h-64 rounded-md border bg-muted"
            style={{ minHeight: '256px' }}
          />
          <p className="text-sm text-muted-foreground">
            Click on the map or drag the marker to set the location. You can also enter coordinates manually above.
          </p>
        </div>

        {/* Current coordinates display */}
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm font-medium">Selected Location:</p>
          <p className="text-sm text-muted-foreground">
            {mapLatitude.toFixed(6)}, {mapLongitude.toFixed(6)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}