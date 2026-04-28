'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Users, Clock, CheckCircle, AlertCircle, RefreshCw, Loader2, X, Navigation } from 'lucide-react';
import { ChargingSession } from '@/types/queue';
import { useActiveSessions } from '@/hooks/use-active-sessions';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { isRetryableError } from '@/lib/error-handling';

interface ActiveSessionsCardProps {
  className?: string;
}

export function ActiveSessionsCard({ className }: ActiveSessionsCardProps) {
  const { sessions, isLoading, error, completeSession, fetchActiveSessions } = useActiveSessions();

  // Debug logging
  console.log('Active Sessions Card - Sessions:', sessions);
  console.log('Active Sessions Card - Loading:', isLoading);
  console.log('Active Sessions Card - Error:', error);

  // Log session details
  if (sessions.length > 0) {
    sessions.forEach((session, index) => {
      console.log(`Session ${index}:`, {
        id: session.id,
        trackingStatus: session.trackingStatus,
        status: session.status,
        stationName: session.stationName,
        queuePosition: session.queuePosition
      });
    });
  }
  const [sessionToComplete, setSessionToComplete] = useState<ChargingSession | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [cancellingSession, setCancellingSession] = useState<string | null>(null);
  const { addToast } = useToast();

  // Handle tracking status update
  const updateTrackingStatus = async (sessionId: string, newStatus: string) => {
    try {
      console.log(`Updating tracking status for session ${sessionId} to ${newStatus}`);
      setUpdatingStatus(sessionId);

      const response = await fetch(`/api/sessions/${sessionId}/tracking`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trackingStatus: newStatus }),
      });

      console.log('Update response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Update failed with error:', errorData);
        throw new Error(errorData.error || 'Failed to update status');
      }

      const responseData = await response.json();
      console.log('Update response data:', responseData);

      // Refresh sessions to get updated data
      console.log('Refreshing sessions...');
      await fetchActiveSessions();

      const statusMessages = {
        arrived: 'Status updated to "Arrived at Station"',
        charging: 'Status updated to "Charging"',
      };

      addToast({
        type: 'success',
        title: 'Status Updated',
        description: statusMessages[newStatus as keyof typeof statusMessages] || 'Status updated successfully',
        duration: 3000
      });

    } catch (error: unknown) {
      const errorObj = error as { message?: string };
      console.error('Failed to update tracking status:', errorObj);
      addToast({
        type: 'error',
        title: 'Update Failed',
        description: errorObj.message || 'Failed to update status. Please try again.',
        duration: 5000
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Handle session cancellation
  const cancelSession = async (sessionId: string, stationId: string) => {
    try {
      console.log(`Cancelling session ${sessionId}`);
      setCancellingSession(sessionId);

      const response = await fetch(`/api/stations/${stationId}/queue`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel session');
      }

      // Refresh sessions to get updated data
      await fetchActiveSessions();

      addToast({
        type: 'success',
        title: 'Session Cancelled',
        description: 'You have successfully left the queue.',
        duration: 3000
      });

    } catch (error: unknown) {
      const errorObj = error as { message?: string };
      console.error('Failed to cancel session:', errorObj);
      addToast({
        type: 'error',
        title: 'Cancellation Failed',
        description: errorObj.message || 'Failed to cancel session. Please try again.',
        duration: 5000
      });
    } finally {
      setCancellingSession(null);
    }
  };

  // Handle navigation to Google Maps
  const handleNavigate = (session: ChargingSession) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${session.stationName || 'Charging Station'}`;
    window.open(url, '_blank');
  };

  // Handle session completion
  const handleCompleteSession = async () => {
    if (!sessionToComplete) return;

    try {
      setIsCompleting(true);
      await completeSession(sessionToComplete.id, sessionToComplete.stationId);

      // Show success message
      addToast({
        type: 'success',
        title: 'Session Completed',
        description: `Your charging session at ${sessionToComplete.stationName || 'the station'} has been completed successfully.`,
        duration: 5000
      });

      setIsDialogOpen(false);
    } catch (error: unknown) {
      const errorObj = error as { message?: string };
      console.error('Failed to complete session:', errorObj);

      // Show error message with retry option if applicable
      addToast({
        type: 'error',
        title: 'Failed to Complete Session',
        description: errorObj.message || 'An unexpected error occurred while completing your session.',
        duration: 7000,
        action: isRetryableError(errorObj) ? {
          label: 'Retry',
          onClick: () => handleCompleteSession()
        } : undefined
      });
    } finally {
      setIsCompleting(false);
      setSessionToComplete(null);
    }
  };

  // Handle manual refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchActiveSessions();

      addToast({
        type: 'success',
        title: 'Refreshed',
        description: 'Active sessions have been updated.',
        duration: 3000
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Refresh Failed',
        description: 'Failed to refresh active sessions. Please try again.',
        duration: 5000
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Open confirmation dialog
  const openConfirmDialog = (session: ChargingSession) => {
    setSessionToComplete(session);
    setIsDialogOpen(true);
  };

  // Get queue position badge variant
  const getPositionBadgeVariant = (position: number) => {
    if (position === 1) return 'default';
    if (position <= 3) return 'secondary';
    return 'outline';
  };

  // Get tracking status display info
  const getTrackingStatusInfo = (trackingStatus: string | undefined) => {
    switch (trackingStatus) {
      case 'driving':
        return {
          label: 'Driving to Station',
          color: 'bg-blue-100 text-blue-800',
          icon: '🚗'
        };
      case 'arrived':
        return {
          label: 'Arrived at Station',
          color: 'bg-yellow-100 text-yellow-800',
          icon: '📍'
        };
      case 'charging':
        return {
          label: 'Currently Charging',
          color: 'bg-green-100 text-green-800',
          icon: '⚡'
        };
      case 'completed':
        return {
          label: 'Charging Complete',
          color: 'bg-green-100 text-green-800',
          icon: '✅'
        };
      default:
        // Fallback for sessions without trackingStatus (legacy data)
        return {
          label: 'Driving to Station',
          color: 'bg-blue-100 text-blue-800',
          icon: '🚗'
        };
    }
  };

  // Get next action button for tracking status
  const getNextActionButton = (session: ChargingSession) => {
    const isUpdating = updatingStatus === session.id;
    const trackingStatus: 'driving' | 'arrived' | 'charging' | 'completed' = session.trackingStatus || 'driving'; // Default to 'driving' for legacy sessions

    switch (trackingStatus) {
      case 'driving':
        return (
          <Button
            onClick={() => updateTrackingStatus(session.id, 'arrived')}
            variant="outline"
            className="w-full"
            disabled={isUpdating}
          >
            {isUpdating ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </div>
            ) : (
              "📍 I've Arrived at Station"
            )}
          </Button>
        );
      case 'arrived':
        return (
          <Button
            onClick={() => updateTrackingStatus(session.id, 'charging')}
            variant="outline"
            className="w-full"
            disabled={isUpdating}
          >
            {isUpdating ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </div>
            ) : (
              '⚡ Start Charging'
            )}
          </Button>
        );
      case 'charging':
        return (
          <Button
            onClick={() => openConfirmDialog(session)}
            variant="default"
            className="w-full"
            disabled={isCompleting}
          >
            {isCompleting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Completing...
              </div>
            ) : (
              '✅ Complete Charging'
            )}
          </Button>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Active Charging Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Error Loading Sessions
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Retry
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 mb-4">{error}</div>
          <div className="text-sm text-muted-foreground">
            Unable to load your active charging sessions. This might be due to a network issue or temporary server problem.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              My Charging Sessions
              <Badge variant="secondary" className="ml-2">
                {sessions.length} Active
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="flex items-center gap-2"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
              <p>No active charging sessions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => {
                const trackingInfo = getTrackingStatusInfo(session.trackingStatus || 'driving');

                return (
                  <div
                    key={session.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{session.stationName || `Station ${session.stationId.substring(0, 8)}...`}</h3>
                        <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          <span>Joined {formatDate(new Date(session.joinedAt))}</span>
                        </div>
                      </div>
                      <Badge variant={getPositionBadgeVariant(session.queuePosition)}>
                        {session.queuePosition === 1 ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            You&apos;re next!
                          </span>
                        ) : (
                          `Position ${session.queuePosition}`
                        )}
                      </Badge>
                    </div>

                    {/* Tracking Status */}
                    <div className="flex items-center gap-2">
                      <Badge className={trackingInfo.color}>
                        <span className="flex items-center gap-1">
                          <span>{trackingInfo.icon}</span>
                          {trackingInfo.label}
                        </span>
                      </Badge>
                    </div>

                    {/* Detailed session timeline */}
                    <div className="space-y-1 text-sm text-muted-foreground bg-gray-50 p-3 rounded-md">
                      <div className="font-medium text-gray-700 mb-2">Session Timeline</div>

                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>Joined: {formatDate(new Date(session.joinedAt))}</span>
                      </div>

                      {session.arrivedAt && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <span>Arrived: {formatDate(new Date(session.arrivedAt))}</span>
                        </div>
                      )}

                      {session.chargingStartedAt && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Charging started: {formatDate(new Date(session.chargingStartedAt))}</span>
                        </div>
                      )}

                      {/* Show total time in session */}
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
                        <Clock className="h-3 w-3" />
                        <span>Total time: {Math.round((Date.now() - new Date(session.joinedAt).getTime()) / (1000 * 60))} minutes</span>
                      </div>
                    </div>

                    {session.estimatedWaitTime !== undefined && session.trackingStatus === 'driving' && (
                      <div className="text-sm flex items-center gap-1">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span>
                          Est. wait: {session.estimatedWaitTime} {session.estimatedWaitTime === 1 ? 'minute' : 'minutes'}
                        </span>
                      </div>
                    )}

                    {/* Action buttons section */}
                    <div className="space-y-3">
                      {/* Primary tracking status button */}
                      {getNextActionButton(session)}

                      {/* Quick status override buttons (for testing/manual control) */}
                      {(session.trackingStatus || 'driving') !== 'charging' && (
                        <div className="flex gap-1 flex-wrap">
                          <span className="text-xs text-gray-500 w-full mb-1">Quick actions:</span>
                          {(session.trackingStatus || 'driving') !== 'arrived' && (
                            <Button
                              onClick={() => updateTrackingStatus(session.id, 'arrived')}
                              variant="outline"
                              size="sm"
                              className="text-xs px-2 py-1 h-auto"
                              disabled={updatingStatus === session.id}
                            >
                              Mark Arrived
                            </Button>
                          )}
                          {(session.trackingStatus || 'driving') !== 'charging' && (
                            <Button
                              onClick={() => updateTrackingStatus(session.id, 'charging')}
                              variant="outline"
                              size="sm"
                              className="text-xs px-2 py-1 h-auto"
                              disabled={updatingStatus === session.id}
                            >
                              Start Charging
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Secondary action buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => handleNavigate(session)}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <Navigation className="h-3 w-3" />
                          Directions
                        </Button>

                        <Button
                          onClick={() => cancelSession(session.id, session.stationId)}
                          variant="outline"
                          size="sm"
                          disabled={cancellingSession === session.id}
                          className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {cancellingSession === session.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Charging Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to complete this charging session? This will remove you from the queue and update the queue count for other users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCompleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCompleteSession}
              disabled={isCompleting}
              className={isCompleting ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {isCompleting ? 'Completing...' : 'Complete Session'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}