'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primary' | 'secondary';
  className?: string;
  text?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8'
};

const variantClasses = {
  default: 'text-muted-foreground',
  primary: 'text-primary',
  secondary: 'text-secondary-foreground'
};

export function LoadingSpinner({ 
  size = 'md', 
  variant = 'default', 
  className, 
  text 
}: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <Loader2 className={cn('animate-spin', sizeClasses[size], variantClasses[variant])} />
      {text && (
        <span className={cn('text-sm', variantClasses[variant])}>
          {text}
        </span>
      )}
    </div>
  );
}

// Centered loading spinner for full sections
export function LoadingSection({ 
  text = 'Loading...', 
  className 
}: { 
  text?: string; 
  className?: string; 
}) {
  return (
    <div className={cn('flex items-center justify-center py-8', className)}>
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

// Inline loading spinner for buttons
export function LoadingButton({ 
  text = 'Loading...', 
  size = 'sm' 
}: { 
  text?: string; 
  size?: 'sm' | 'md' | 'lg'; 
}) {
  return (
    <div className="flex items-center gap-2">
      <Loader2 className={cn('animate-spin', sizeClasses[size])} />
      <span>{text}</span>
    </div>
  );
}