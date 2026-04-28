'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { LocationPicker } from './location-picker';
import { Plus, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

// Validation schema
const StationFormSchema = z.object({
  name: z.string().min(1, 'Station name is required').trim(),
  latitude: z.number().min(-90, 'Invalid latitude').max(90, 'Invalid latitude'),
  longitude: z.number().min(-180, 'Invalid longitude').max(180, 'Invalid longitude'),
  pricePerKwh: z.number().positive('Price must be positive'),
  queueLength: z.number().int().min(0, 'Queue length cannot be negative'),
  amenities: z.array(z.string()).optional().default([]),
  fastCharging: z.boolean().optional().default(false),
  rating: z.number().min(0).max(5).optional().default(0),
  operatingHours: z.object({
    open: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
    close: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format')
  })
});

interface AddStationFormProps {
  onStationAdded?: () => void;
  onCancel?: () => void;
}

export function AddStationForm({ onStationAdded, onCancel }: AddStationFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    latitude: 28.6139, // Default to Delhi coordinates
    longitude: 77.2090,
    pricePerKwh: 0,
    queueLength: 0,
    amenities: '',
    fastCharging: false,
    rating: 0,
    operatingHours: {
      open: '06:00',
      close: '22:00'
    }
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Handle form input changes
  const handleInputChange = (field: string, value: string | number | { open: string; close: string }) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Handle location change from LocationPicker
  const handleLocationChange = (lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng
    }));

    // Clear location errors
    setErrors(prev => ({
      ...prev,
      latitude: '',
      longitude: ''
    }));
  };

  // Validate form
  const validateForm = () => {
    try {
      const amenitiesArray = formData.amenities
        .split(',')
        .map(a => a.trim())
        .filter(a => a.length > 0);

      const validatedData = StationFormSchema.parse({
        name: formData.name,
        latitude: formData.latitude,
        longitude: formData.longitude,
        pricePerKwh: formData.pricePerKwh,
        queueLength: formData.queueLength,
        amenities: amenitiesArray,
        fastCharging: formData.fastCharging,
        rating: formData.rating,
        operatingHours: formData.operatingHours
      });

      setErrors({});
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach(err => {
          if (err.path.length > 0) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return null;
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validatedData = validateForm();
    if (!validatedData) {
      toast.error('Please fix the form errors');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/stations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validatedData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Charging station added successfully!');

        // Reset form
        setFormData({
          name: '',
          latitude: 28.6139,
          longitude: 77.2090,
          pricePerKwh: 0,
          queueLength: 0,
          amenities: '',
          fastCharging: false,
          rating: 0,
          operatingHours: {
            open: '06:00',
            close: '22:00'
          }
        });

        // Call callback if provided, otherwise navigate back to dashboard
        if (onStationAdded) {
          onStationAdded();
        } else {
          // Navigate back to admin dashboard after a short delay
          setTimeout(() => {
            router.push('/admin/dashboard');
          }, 1500);
        }
      } else {
        toast.error(data.error || 'Failed to add station');
        if (data.details) {
          console.error('Validation details:', data.details);
        }
      }
    } catch (error) {
      console.error('Error adding station:', error);
      toast.error('Failed to add station');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Charging Station
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Station Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter station name"
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Price per kWh *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.pricePerKwh}
                    onChange={(e) => handleInputChange('pricePerKwh', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className={errors.pricePerKwh ? 'border-destructive' : ''}
                  />
                  {errors.pricePerKwh && (
                    <p className="text-sm text-destructive">{errors.pricePerKwh}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="queue">Current Queue Length</Label>
                  <Input
                    id="queue"
                    type="number"
                    min="0"
                    value={formData.queueLength}
                    onChange={(e) => handleInputChange('queueLength', parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className={errors.queueLength ? 'border-destructive' : ''}
                  />
                  {errors.queueLength && (
                    <p className="text-sm text-destructive">{errors.queueLength}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rating">Rating (0–5)</Label>
                  <Input
                    id="rating"
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={formData.rating}
                    onChange={(e) => handleInputChange('rating', parseFloat(e.target.value) || 0)}
                    placeholder="4.5"
                  />
                </div>

                <div className="space-y-2 flex flex-col justify-end">
                  <div className="flex items-center gap-3 pb-1">
                    <input
                      id="fastCharging"
                      type="checkbox"
                      checked={formData.fastCharging}
                      onChange={(e) => handleInputChange('fastCharging', e.target.checked as unknown as string)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="fastCharging">Fast Charging (DC)</Label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="open">Opening Time</Label>
                  <Input
                    id="open"
                    type="time"
                    value={formData.operatingHours.open}
                    onChange={(e) => handleInputChange('operatingHours', {
                      ...formData.operatingHours,
                      open: e.target.value
                    })}
                    className={errors.operatingHours ? 'border-destructive' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="close">Closing Time</Label>
                  <Input
                    id="close"
                    type="time"
                    value={formData.operatingHours.close}
                    onChange={(e) => handleInputChange('operatingHours', {
                      ...formData.operatingHours,
                      close: e.target.value
                    })}
                    className={errors.operatingHours ? 'border-destructive' : ''}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amenities">Amenities (comma-separated)</Label>
                <Textarea
                  id="amenities"
                  value={formData.amenities}
                  onChange={(e) => handleInputChange('amenities', e.target.value)}
                  placeholder="WiFi, Restroom, Cafe, Food Court, Parking"
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  Enter amenities separated by commas (e.g., WiFi, Restroom, Cafe)
                </p>
              </div>
            </div>

            {/* Location Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location
              </h3>

              <LocationPicker
                latitude={formData.latitude}
                longitude={formData.longitude}
                onLocationChange={handleLocationChange}
              />

              {(errors.latitude || errors.longitude) && (
                <div className="text-sm text-destructive">
                  {errors.latitude && <p>{errors.latitude}</p>}
                  {errors.longitude && <p>{errors.longitude}</p>}
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <LoadingSpinner className="mr-2 h-4 w-4" />
                    Adding Station...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Station
                  </>
                )}
              </Button>

              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}