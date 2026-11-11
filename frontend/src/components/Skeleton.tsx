import React from 'react';
import { cn } from '../lib/cn';

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded bg-[var(--anchor-border-subtle)]/70',
        className
      )}
    />
  );
};
