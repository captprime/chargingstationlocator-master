import { useState, useEffect } from 'react';
import { ChargingSession, SessionHistoryResponse } from '@/types/queue';
import { 
  apiCall, 
  getUserFriendlyErrorMessage, 
  ErrorCode 
} from '@/lib/error-handling';

interface UseSessionHistoryOptions {
  initialPage?: number;
  pageSize?: number;
}

export function useSessionHistory({ initialPage = 1, pageSize = 5 }: UseSessionHistoryOptions = {}) {
  const [sessions, setSessions] = useState<ChargingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: initialPage,
    limit: pageSize,
    total: 0,
  });

  // Fetch session history
  const fetchSessionHistory = async (page = pagination.page, limit = pagination.limit) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiCall<{ data: SessionHistoryResponse }>(
        `/api/sessions/history?page=${page}&limit=${limit}`,
        {},
        {
          maxAttempts: 3,
          retryableErrors: [ErrorCode.NETWORK_ERROR, ErrorCode.TIMEOUT_ERROR, ErrorCode.INTERNAL_ERROR]
        }
      );
      
      setSessions(response.data?.sessions || []);
      setPagination(response.data?.pagination || { page: 1, limit: 5, total: 0 });
    } catch (err: any) {
      console.error('Error fetching session history:', err);
      setError(getUserFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Change page
  const goToPage = (page: number) => {
    if (page < 1 || page > Math.ceil(pagination.total / pagination.limit)) {
      return;
    }
    
    fetchSessionHistory(page, pagination.limit);
  };

  // Fetch sessions on component mount
  useEffect(() => {
    fetchSessionHistory();
  }, []);

  return {
    sessions,
    isLoading,
    error,
    pagination,
    fetchSessionHistory,
    goToPage,
  };
}