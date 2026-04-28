'use client';

import { useState, useEffect } from 'react';
import { StationMap } from './station-map';
import { ChargingStation } from '@/types/station';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button'; // Unused for now

export default function MapTest() {
  const [stations, setStations] = useState<ChargingStation[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load stations with user location
  useEffect(() => {
    // Default location (Delhi, India)
    const defaultLocation = {
      latitude: 28.6139,
      longitude: 77.2090
    };

    // Get user location and fetch nearby stations
    const getUserLocationAndStations = async (location: { latitude: number; longitude: number }) => {
      try {
        // Fetch nearby stations from API
        const response = await fetch(
          `/api/stations/nearby?lat=${location.latitude}&lng=${location.longitude}&radius=50&limit=10`
        );
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        setStations(data.stations);
        setUserLocation(data.userLocation);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching stations:', err);
        setError('Failed to fetch nearby stations. Please try again.');
        setLoading(false);
      }
    };

    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLoc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setUserLocation(userLoc);
          getUserLocationAndStations(userLoc);
        },
        (err) => {
          console.error('Error getting location:', err);
          setError('Could not get your location. Using default location.');
          
          // Fallback to default location
          setUserLocation(defaultLocation);
          getUserLocationAndStations(defaultLocation);
        }
      );
    } else {
      setError('Geolocation is not supported by your browser. Using default location.');
      
      // Fallback to default location
      setUserLocation(defaultLocation);
      getUserLocationAndStations(defaultLocation);
    }
  }, []);

  const handleStationSelect = (station: ChargingStation) => {
    console.log('Selected station:', station);
    // You could show additional details or highlight the station in a list
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Station Map Test</CardTitle>
        {error && <p className="text-red-500">{error}</p>}
      </CardHeader>
      <CardContent>
        <StationMap 
          stations={stations} 
          userLocation={userLocation}
          loading={loading}
          onStationSelect={handleStationSelect}
        />
      </CardContent>
    </Card>
  );
}