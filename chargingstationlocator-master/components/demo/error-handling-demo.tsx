/**
 * Demo component to showcase the comprehensive error handling system
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { 
  ErrorCode, 
  createErrorResponse,
  isRetryableError 
} from '@/lib/error-handling';
import { AlertTriangle, Loader2 } from 'lucide-react';

export function ErrorHandlingDemo() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const { addToast } = useToast();

  // Simulate different types of API calls
  const simulateApiCall = async (scenario: string) => {
    setIsLoading(true);
    setLastResult(null);

    try {
      // Mock different error scenarios
      switch (scenario) {
        case 'success':
          await new Promise(resolve => setTimeout(resolve, 1000));
          setLastResult('✅ Success: Operation completed successfully!');
          addToast({
            type: 'success',
            title: 'Operation Successful',
            description: 'The API call completed without any issues.',
            duration: 3000
          });
          break;

        case 'network-error':
          throw createErrorResponse(
            ErrorCode.NETWORK_ERROR,
            'Network connection failed. Please check your internet connection.'
          );

        case 'validation-error':
          throw createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            'The provided data is invalid. Please check your input.'
          );

        case 'unauthorized':
          throw createErrorResponse(
            ErrorCode.UNAUTHORIZED,
            'You need to log in to perform this action.'
          );

        case 'rate-limit':
          throw createErrorResponse(
            ErrorCode.RATE_LIMIT_EXCEEDED,
            'Too many requests. Please wait before trying again.',
            undefined,
            30
          );

        case 'server-error':
          throw createErrorResponse(
            ErrorCode.INTERNAL_ERROR,
            'Something went wrong on our end. Please try again later.'
          );

        default:
          throw createErrorResponse(
            ErrorCode.UNKNOWN_ERROR,
            'An unexpected error occurred.'
          );
      }
    } catch (error: unknown) {
      const errorObj = error as { error?: string; message?: string };
      console.error('Demo error:', errorObj);
      setLastResult(`❌ Error: ${errorObj.error || errorObj.message}`);
      
      // Show appropriate toast based on error type
      addToast({
        type: 'error',
        title: 'Operation Failed',
        description: errorObj.error || errorObj.message,
        duration: 7000,
        action: isRetryableError(errorObj) ? {
          label: 'Retry',
          onClick: () => simulateApiCall(scenario)
        } : undefined
      });
    } finally {
      setIsLoading(false);
    }
  };

  const scenarios = [
    { id: 'success', label: 'Success', description: 'Successful API call' },
    { id: 'network-error', label: 'Network Error', description: 'Retryable network failure' },
    { id: 'validation-error', label: 'Validation Error', description: 'Non-retryable validation failure' },
    { id: 'unauthorized', label: 'Unauthorized', description: 'Authentication required' },
    { id: 'rate-limit', label: 'Rate Limited', description: 'Too many requests' },
    { id: 'server-error', label: 'Server Error', description: 'Internal server error' }
  ];

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Error Handling Demo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-sm text-muted-foreground">
          Click the buttons below to simulate different API scenarios and see how the error handling system responds:
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {scenarios.map((scenario) => (
            <Button
              key={scenario.id}
              variant="outline"
              onClick={() => simulateApiCall(scenario.id)}
              disabled={isLoading}
              className="h-auto p-4 flex flex-col items-start text-left"
            >
              <div className="font-medium">{scenario.label}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {scenario.description}
              </div>
            </Button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-4 border rounded-lg bg-blue-50">
            <Loader2 className="h-5 w-5 animate-spin mr-2 text-blue-600" />
            <span className="text-blue-600">Processing request...</span>
          </div>
        )}

        {lastResult && (
          <div className={`p-4 rounded-lg border ${
            lastResult.startsWith('✅') 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="font-medium text-sm">{lastResult}</div>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-2">
          <div className="font-medium">Features demonstrated:</div>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>User-friendly error messages</li>
            <li>Toast notifications with retry options</li>
            <li>Different error types and handling</li>
            <li>Loading states and feedback</li>
            <li>Retryable vs non-retryable errors</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}