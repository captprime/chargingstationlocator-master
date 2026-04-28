'use client';

import { ChargingStation } from '@/types/station';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, DollarSign, Users, Navigation, Wifi, Coffee, Car, ShoppingBag, Fuel, Zap } from 'lucide-react';

interface StationCardProps {
  station: ChargingStation;
  userLocation?: {
    latitude: number;
    longitude: number;
  };
  onNavigate?: (station: ChargingStation) => void;
}

export function StationCard({ station, userLocation, onNavigate }: StationCardProps) {
  // Ensure we have an id for the station (handle MongoDB _id)
  const stationId = station.id || station._id?.toString();
  console.debug('Station ID:', stationId); // Prevent unused variable warning
  // Get amenity icon
  const getAmenityIcon = (amenity: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'WiFi': <Wifi className="h-3 w-3" />,
      'Cafe': <Coffee className="h-3 w-3" />,
      'Restroom': <Car className="h-3 w-3" />,
      'Parking': <Car className="h-3 w-3" />,
      'Shopping': <ShoppingBag className="h-3 w-3" />,
      'Fuel Station': <Fuel className="h-3 w-3" />,
      'Solar Powered': <Zap className="h-3 w-3" />,
      'ATM': <DollarSign className="h-3 w-3" />,
      'Metro Access': <Car className="h-3 w-3" />,
      'Food Court': <Coffee className="h-3 w-3" />,
      'Vending Machine': <ShoppingBag className="h-3 w-3" />
    };
    return iconMap[amenity] || <Car className="h-3 w-3" />;
  };

  // Handle navigation to Google Maps
  const handleNavigate = () => {
    if (onNavigate) {
      onNavigate(station);
      return;
    }

    if (!userLocation) {
      // Fallback to just the destination
      const url = `https://www.google.com/maps/search/?api=1&query=${station.latitude},${station.longitude}`;
      window.open(url, '_blank');
      return;
    }

    // Full navigation with origin and destination
    const url = `https://www.google.com/maps/dir/${userLocation.latitude},${userLocation.longitude}/${station.latitude},${station.longitude}`;
    window.open(url, '_blank');
  };

  // Get queue status color
  const getQueueStatusColor = (queueLength: number) => {
    if (queueLength === 0) return 'bg-green-100 text-green-800';
    if (queueLength <= 2) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{station.name}</CardTitle>
          <Badge 
            variant="secondary" 
            className={getQueueStatusColor(station.queueLength)}
          >
            {station.queueLength === 0 ? 'Available' : `${station.queueLength} in queue`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            <span className="font-medium">
              {station.distance ? `${station.distance} km` : 'Distance N/A'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="font-medium">₹{station.pricePerKwh}/kWh</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-orange-600" />
            <span className="font-medium">
              {station.queueLength === 0 ? 'No wait' : `${station.queueLength} waiting`}
            </span>
          </div>
        </div>

        {/* Operating hours */}
        {station.operatingHours && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>
              {station.operatingHours.open === '24/7' 
                ? '24/7 Open' 
                : `${station.operatingHours.open} - ${station.operatingHours.close}`
              }
            </span>
          </div>
        )}

        {/* Amenities */}
        {station.amenities && station.amenities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {station.amenities.map((amenity) => (
              <Badge key={amenity} variant="outline" className="text-xs">
                <span className="flex items-center gap-1">
                  {getAmenityIcon(amenity)}
                  {amenity}
                </span>
              </Badge>
            ))}
          </div>
        )}

        {/* Navigate button */}
        <div className="pt-2">
          <Button 
            onClick={handleNavigate}
            className="w-full"
            variant="default"
          >
            <Navigation className="h-4 w-4 mr-2" />
            Navigate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}