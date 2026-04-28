'use client';

import { ReactNode, useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent } from './card';
import { LoadingSpinner } from './loading-spinner';
import { cn } from '@/lib/utils';

// Enhanced Button with loading state
interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children: ReactNode;
}

export function LoadingButton({ 
  loading = false, 
  loadingText = 'Loading...', 
  children, 
  disabled,
  className,
  ...props 
}: LoadingButtonProps) {
  return (
    <Button 
      disabled={loading || disabled} 
      className={cn(className)}
      {...props}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <LoadingSpinner size="sm" />
          {loadingText}
        </div>
      ) : (
        children
      )}
    </Button>
  );
}

// Alert variants
type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const alertStyles = {
  info: {
    container: 'border-blue-200 bg-blue-50 text-blue-800',
    icon: Info,
    iconColor: 'text-blue-600',
  },
  success: {
    container: 'border-green-200 bg-green-50 text-green-800',
    icon: CheckCircle,
    iconColor: 'text-green-600',
  },
  warning: {
    container: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    icon: AlertTriangle,
    iconColor: 'text-yellow-600',
  },
  error: {
    container: 'border-red-200 bg-red-50 text-red-800',
    icon: AlertCircle,
    iconColor: 'text-red-600',
  },
};

export function Alert({ 
  variant, 
  title, 
  children, 
  dismissible = false, 
  onDismiss,
  className 
}: AlertProps) {
  const [isVisible, setIsVisible] = useState(true);
  const style = alertStyles[variant];
  const Icon = style.icon;

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  return (
    <div className={cn(
      'relative rounded-lg border p-4',
      style.container,
      className
    )}>
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', style.iconColor)} />
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="font-medium mb-1">{title}</h4>
          )}
          <div className="text-sm">{children}</div>
        </div>
        {dismissible && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mt-1 -mr-1 hover:bg-black/10"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Empty state component
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action, 
  className 
}: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-4 text-center',
      className
    )}>
      {icon && (
        <div className="mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground mb-6 max-w-md">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Loading overlay
interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  children: ReactNode;
  className?: string;
}

export function LoadingOverlay({ 
  isLoading, 
  text = 'Loading...', 
  children, 
  className 
}: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Card>
            <CardContent className="p-6">
              <LoadingSpinner size="lg" text={text} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Staggered animation for lists
interface StaggeredListProps {
  children: ReactNode[];
  delay?: number;
  className?: string;
}

export function StaggeredList({ children, delay = 100, className }: StaggeredListProps) {
  const [visibleItems, setVisibleItems] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleItems(prev => {
        if (prev < children.length) {
          return prev + 1;
        }
        clearInterval(timer);
        return prev;
      });
    }, delay);

    return () => clearInterval(timer);
  }, [children.length, delay]);

  return (
    <div className={className}>
      {children.map((child, index) => (
        <div
          key={index}
          className={cn(
            'transition-all duration-300 ease-out',
            index < visibleItems 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-4'
          )}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

// Progress indicator
interface ProgressIndicatorProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export function ProgressIndicator({ steps, currentStep, className }: ProgressIndicatorProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      {steps.map((step, index) => (
        <div key={index} className="flex items-center">
          <div className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
            index < currentStep 
              ? 'bg-primary text-primary-foreground' 
              : index === currentStep
              ? 'bg-primary/20 text-primary border-2 border-primary'
              : 'bg-muted text-muted-foreground'
          )}>
            {index + 1}
          </div>
          <span className={cn(
            'ml-2 text-sm',
            index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
          )}>
            {step}
          </span>
          {index < steps.length - 1 && (
            <div className={cn(
              'w-12 h-0.5 mx-4',
              index < currentStep ? 'bg-primary' : 'bg-muted'
            )} />
          )}
        </div>
      ))}
    </div>
  );
}