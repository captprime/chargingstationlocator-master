'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { AddStationForm, StationTable } from "@/components/admin";
import { StationDetails } from "@/components/admin/station-details";
import type { StationDetailsData } from "@/components/admin/station-details";
import { AdminPerformanceSummary } from "@/components/admin/admin-performance-summary";
import { RevenueDashboard } from "@/components/admin/revenue-dashboard";
import { OccupancyMonitor } from "@/components/admin/occupancy-monitor";
import { DynamicPricing } from "@/components/admin/dynamic-pricing";
import { FranchiseAnalytics } from "@/components/admin/franchise-analytics";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ViewMode = 'dashboard' | 'station-details';

export default function AdminDashboardPage() {
    const { data: session } = useSession();
    const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
    const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
    const [editingStation, setEditingStation] = useState<StationDetailsData | null>(null);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [stationsReloadKey, setStationsReloadKey] = useState(0);
    
    if (!session) {
        return <div>Loading...</div>;
    }

    const handleViewStationDetails = (stationId: string) => {
        setSelectedStationId(stationId);
        setViewMode('station-details');
    };

    const handleBackToDashboard = () => {
        setViewMode('dashboard');
        setSelectedStationId(null);
        setEditingStation(null);
    };

    const handleEditStation = (station: StationDetailsData) => {
        setEditingStation(station);
        // You could open an edit modal here or navigate to edit page
    };

    if (viewMode === 'station-details' && selectedStationId) {
        return (
            <div className="container mx-auto py-8 px-4">
                <StationDetails 
                    stationId={selectedStationId}
                    onBack={handleBackToDashboard}
                    onEdit={handleEditStation}
                />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            Admin Dashboard
                        </h1>
                        <p className="text-muted-foreground">
                            Welcome back, {session.user.name}! Manage your charging stations and view performance stats.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                            <DialogTrigger asChild>
                                <Button>Add Station</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add New Charging Station</DialogTitle>
                                </DialogHeader>
                                <AddStationForm 
                                    onStationAdded={() => {
                                        setIsAddOpen(false);
                                        setStationsReloadKey((k) => k + 1);
                                    }}
                                    onCancel={() => setIsAddOpen(false)}
                                />
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Admin Info Card */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-card text-card-foreground rounded-lg border p-4">
                        <div className="flex items-center gap-2">
                            <Settings className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium">Admin Access</span>
                        </div>
                        <p className="text-2xl font-bold mt-2 text-green-600">Active</p>
                        <p className="text-xs text-muted-foreground mt-1">Multi-admin system</p>
                    </div>
                    <div className="bg-card text-card-foreground rounded-lg border p-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Admin Name</span>
                        </div>
                        <p className="text-sm font-semibold mt-2">{session.user.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{session.user.email}</p>
                    </div>
                    <div className="bg-card text-card-foreground rounded-lg border p-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Role</span>
                        </div>
                        <p className="text-sm font-semibold mt-2 capitalize">{session.user.role}</p>
                        <p className="text-xs text-muted-foreground mt-1">Station Manager</p>
                    </div>
                    <div className="bg-card text-card-foreground rounded-lg border p-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Admin ID</span>
                        </div>
                        <p className="text-xs font-mono text-muted-foreground mt-2">{session.user.id.slice(0, 12)}...</p>
                        <p className="text-xs text-muted-foreground mt-1">Your unique identifier</p>
                    </div>
                </div>

                {/* Performance Summary */}
                <AdminPerformanceSummary />

                {/* Advanced Admin Tabs */}
                <Tabs defaultValue="stations" className="mt-6">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="stations">Stations</TabsTrigger>
                    <TabsTrigger value="revenue">Revenue</TabsTrigger>
                    <TabsTrigger value="operations">Operations</TabsTrigger>
                    <TabsTrigger value="expansion">Expansion</TabsTrigger>
                  </TabsList>

                  <TabsContent value="stations" className="mt-4">
                    <StationTable key={stationsReloadKey} onViewDetails={handleViewStationDetails} />
                  </TabsContent>

                  <TabsContent value="revenue" className="mt-4">
                    <RevenueDashboard />
                  </TabsContent>

                  <TabsContent value="operations" className="mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <OccupancyMonitor />
                      <DynamicPricing />
                    </div>
                  </TabsContent>

                  <TabsContent value="expansion" className="mt-4">
                    <FranchiseAnalytics />
                  </TabsContent>
                </Tabs>
        </div>
    );
}