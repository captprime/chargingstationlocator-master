'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { ChargingStation } from '@/types/station';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Edit, Trash2, MapPin, DollarSign, Users, Eye, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface StationTableProps {
  onStationUpdated?: () => void;
  onViewDetails?: (stationId: string) => void;
}

export function StationTable({ onStationUpdated, onViewDetails }: StationTableProps) {
  const { data: session } = useSession();
  const [stations, setStations] = useState<ChargingStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStation, setEditingStation] = useState<ChargingStation | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    latitude: 0,
    longitude: 0,
    pricePerKwh: 0,
    queueLength: 0,
    amenities: '',
    operatingHours: {
      open: '06:00',
      close: '22:00'
    }
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Fetch stations
  const fetchStations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/stations');
      const data = await response.json();
      
      if (data.success) {
        setStations(data.stations);
      } else {
        toast.error('Failed to fetch stations');
      }
    } catch (error) {
      console.error('Error fetching stations:', error);
      toast.error('Failed to fetch stations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  // Handle edit station
  const handleEditStation = (station: ChargingStation) => {
    setEditingStation(station);
    setEditFormData({
      name: station.name,
      latitude: station.latitude,
      longitude: station.longitude,
      pricePerKwh: station.pricePerKwh,
      queueLength: station.queueLength,
      amenities: station.amenities?.join(', ') || '',
      operatingHours: station.operatingHours || { open: '06:00', close: '22:00' }
    });
    setIsEditDialogOpen(true);
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editingStation) return;

    try {
      const amenitiesArray = editFormData.amenities
        .split(',')
        .map(a => a.trim())
        .filter(a => a.length > 0);

      const response = await fetch(`/api/admin/stations/${editingStation.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editFormData.name,
          latitude: editFormData.latitude,
          longitude: editFormData.longitude,
          pricePerKwh: editFormData.pricePerKwh,
          queueLength: editFormData.queueLength,
          amenities: amenitiesArray,
          operatingHours: editFormData.operatingHours
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Station updated successfully');
        setIsEditDialogOpen(false);
        setEditingStation(null);
        fetchStations();
        onStationUpdated?.();
      } else {
        toast.error(data.error || 'Failed to update station');
      }
    } catch (error) {
      console.error('Error updating station:', error);
      toast.error('Failed to update station');
    }
  };

  // Handle delete station
  const handleDeleteStation = async (stationId: string) => {
    try {
      setIsDeleting(stationId);
      const response = await fetch(`/api/admin/stations/${stationId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Station deleted successfully');
        fetchStations();
        onStationUpdated?.();
      } else {
        toast.error(data.error || 'Failed to delete station');
      }
    } catch (error) {
      console.error('Error deleting station:', error);
      toast.error('Failed to delete station');
    } finally {
      setIsDeleting(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Charging Stations</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          My Charging Stations ({stations.length})
        </CardTitle>
        {session && (
          <div className="text-sm text-muted-foreground">
            Stations managed by {session.user.name} ({session.user.email})
          </div>
        )}
      </CardHeader>
      <CardContent>
        {stations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No charging stations found. Add your first station to get started.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Queue</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Amenities</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stations.map((station) => (
                  <TableRow key={station.id}>
                    <TableCell className="font-medium">{station.name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {station.pricePerKwh}/kWh
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {station.queueLength}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        <span className="text-sm font-medium">
                          ${(station.stats?.revenue || 0).toFixed(0)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {(station.stats?.totalSessions || 0).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {station.amenities?.slice(0, 2).map((amenity, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {amenity}
                          </Badge>
                        ))}
                        {station.amenities && station.amenities.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{station.amenities.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {onViewDetails && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onViewDetails(station.id!)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditStation(station)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isDeleting === station.id}
                            >
                              {isDeleting === station.id ? (
                                <LoadingSpinner className="h-4 w-4" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Station</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete &quot;{station.name}&quot;? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteStation(station.id!)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Edit Station Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Station</DialogTitle>
              <DialogDescription>
                Update the charging station information.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Station Name</Label>
                  <Input
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter station name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-price">Price per kWh</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    value={editFormData.pricePerKwh}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, pricePerKwh: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-latitude">Latitude</Label>
                  <Input
                    id="edit-latitude"
                    type="number"
                    step="0.000001"
                    value={editFormData.latitude}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-longitude">Longitude</Label>
                  <Input
                    id="edit-longitude"
                    type="number"
                    step="0.000001"
                    value={editFormData.longitude}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.000000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-queue">Queue Length</Label>
                  <Input
                    id="edit-queue"
                    type="number"
                    min="0"
                    value={editFormData.queueLength}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, queueLength: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-open">Opening Time</Label>
                  <Input
                    id="edit-open"
                    type="time"
                    value={editFormData.operatingHours.open}
                    onChange={(e) => setEditFormData(prev => ({ 
                      ...prev, 
                      operatingHours: { ...prev.operatingHours, open: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-close">Closing Time</Label>
                  <Input
                    id="edit-close"
                    type="time"
                    value={editFormData.operatingHours.close}
                    onChange={(e) => setEditFormData(prev => ({ 
                      ...prev, 
                      operatingHours: { ...prev.operatingHours, close: e.target.value }
                    }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-amenities">Amenities (comma-separated)</Label>
                <Textarea
                  id="edit-amenities"
                  value={editFormData.amenities}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, amenities: e.target.value }))}
                  placeholder="WiFi, Restroom, Cafe, Food Court"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}