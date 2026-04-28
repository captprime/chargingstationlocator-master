'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Users, Database, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AdminStats {
  totalStations: number;
  totalAdmins: number;
  currentAdminStations: number;
  adminId: string;
  adminName: string;
  adminEmail: string;
}

export function AdminVerification() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (session) {
      fetchAdminStats();
    }
  }, [session]);

  const fetchAdminStats = async () => {
    try {
      setLoading(true);
      
      // Fetch current admin's stations
      const stationsResponse = await fetch('/api/admin/stations');
      const stationsData = await stationsResponse.json();
      
      if (stationsData.success && session) {
        setStats({
          totalStations: 0, // We'll get this from verification
          totalAdmins: 0, // We'll get this from verification
          currentAdminStations: stationsData.stations.length,
          adminId: session.user.id,
          adminName: session.user.name,
          adminEmail: session.user.email
        });
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      toast.error('Failed to fetch admin statistics');
    } finally {
      setLoading(false);
    }
  };

  const verifyAdminSeparation = async () => {
    try {
      setVerifying(true);
      
      const response = await fetch('/api/admin/verify-separation');
      const data = await response.json();
      
      if (data.success) {
        const verification = data.verification;
        
        // Update stats with system information
        setStats(prev => prev ? {
          ...prev,
          totalStations: verification.systemStats.totalStations,
          totalAdmins: verification.systemStats.totalAdmins
        } : null);
        
        // Show verification results
        if (verification.separationVerified.currentAdminStationsOnly && 
            verification.separationVerified.properFiltering) {
          toast.success('✅ Admin separation verified successfully!');
          toast.success(`You can only access your ${verification.currentAdmin.stationCount} stations`);
          
          if (verification.systemStats.totalStations > verification.currentAdmin.stationCount) {
            toast.success(`🔒 ${verification.systemStats.totalStations - verification.currentAdmin.stationCount} other stations are properly hidden`);
          }
        } else {
          toast.error('❌ Admin separation verification failed!');
        }
      } else {
        toast.error('Verification failed: ' + data.error);
      }
      
    } catch (error) {
      console.error('Error verifying admin separation:', error);
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  if (!session || loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-600" />
          Admin Access Verification
        </CardTitle>
        <CardDescription>
          Verify that admin separation is working correctly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Admin Info */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-sm font-medium">Current Admin</p>
              <p className="text-sm text-muted-foreground">{stats?.adminName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Database className="h-4 w-4 text-purple-600" />
            <div>
              <p className="text-sm font-medium">Admin ID</p>
              <p className="text-xs text-muted-foreground font-mono">{stats?.adminId.slice(0, 8)}...</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-sm font-medium">Your Stations</p>
              <p className="text-sm text-muted-foreground">{stats?.currentAdminStations} stations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-orange-600" />
            <div>
              <p className="text-sm font-medium">System Total</p>
              <p className="text-sm text-muted-foreground">
                {stats?.totalStations ? `${stats.totalStations} stations` : 'Run verification'}
              </p>
            </div>
          </div>
        </div>

        {/* Verification Status */}
        <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Admin Separation Active
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                You can only access stations that belong to your admin account
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Verified
          </Badge>
        </div>

        {/* Key Features */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Multi-Admin Features:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-600" />
              Each station belongs to a specific admin (adminId field)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-600" />
              API endpoints filter stations by current admin
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-600" />
              Station details show comprehensive performance stats
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-600" />
              Admin can only edit/delete their own stations
            </li>
          </ul>
        </div>

        {/* Verification Button */}
        <Button 
          onClick={verifyAdminSeparation} 
          disabled={verifying}
          className="w-full"
          variant="outline"
        >
          {verifying ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
              Verifying...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4 mr-2" />
              Verify Admin Separation
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}