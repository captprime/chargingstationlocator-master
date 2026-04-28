'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, Clock, MapPin, ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Loader2, Zap, DollarSign } from 'lucide-react';
import { ChargingSession } from '@/types/queue';
import { formatDate, formatDuration } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { isRetryableError } from '@/lib/error-handling';

interface SessionHistoryCardProps {
  className?: string;
}

export function SessionHistoryCard({ className }: SessionHistoryCardProps) {
  const [sessions, setSessions] = useState<ChargingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 5,
    total: 0
  });
  const { addToast } = useToast();

  // Fetch session history
  const fetchSessionHistory = useCallback(async (page = 1, showToast = false) => {
    try {
      setIsLoading(page === 1);
      setError(null);

      const response = await fetch(`/api/sessions/history?page=${page}&limit=${pagination.limit}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch session history');
      }

      const data = await response.json();
      
      if (data.success) {
        setSessions(data.data?.sessions || []);
        setPagination(data.data?.pagination || { page: 1, limit: 5, total: 0 });

        if (showToast) {
          addToast({
            type: 'success',
            title: 'History Updated',
            description: 'Session history has been refreshed.',
            duration: 3000
          });
        }
      } else {
        throw new Error(data.error || 'Failed to fetch session history');
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      console.error('Error fetching session history:', errorObj);
      const errorMessage = errorObj.message || 'Failed to fetch session history';
      setError(errorMessage);

      if (showToast) {
        addToast({
          type: 'error',
          title: 'Failed to Load History',
          description: errorMessage,
          duration: 5000,
          action: isRetryableError(errorObj) ? {
            label: 'Retry',
            onClick: () => fetchSessionHistory(page, false)
          } : undefined
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [pagination.limit, addToast]);

  // Handle manual refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchSessionHistory(pagination.page, true);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Calculate session duration
  const calculateDuration = (joinedAt: Date, completedAt: Date | undefined) => {
    if (!completedAt) return 'N/A';

    const start = new Date(joinedAt);
    const end = new Date(completedAt);
    const durationMs = end.getTime() - start.getTime();

    return formatDuration(durationMs);
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(pagination.total / pagination.limit)) return;
    fetchSessionHistory(newPage);
  };

  // Fetch sessions on component mount
  useEffect(() => {
    fetchSessionHistory();
  }, [fetchSessionHistory]);

  if (isLoading && sessions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Charging Session History
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
              Error Loading History
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
            Unable to load your session history. This might be due to a network issue or temporary server problem.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Charging Session History
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
            <History className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
            <p>No charging history found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div 
                key={session.id} 
                className="border rounded-lg p-4 space-y-2"
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-medium">{session.stationName || `Station ${session.stationId.substring(0, 8)}...`}</h3>
                  <Badge variant="outline">Completed</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Duration: {calculateDuration(session.joinedAt, session.completedAt)}</span>
                  </div>
                  
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>Completed: {session.completedAt ? formatDate(new Date(session.completedAt)) : 'N/A'}</span>
                  </div>

                  {session.energyConsumed && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Zap className="h-3 w-3" />
                      <span>Energy: {session.energyConsumed.toFixed(2)} kWh</span>
                    </div>
                  )}

                  {session.sessionRevenue && (
                    <div className="flex items-center gap-1 text-green-600">
                      <DollarSign className="h-3 w-3" />
                      <span>Revenue: ₹{session.sessionRevenue.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      
      {sessions.length > 0 && (
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit) || isLoading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}