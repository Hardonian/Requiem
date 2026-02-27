import * as React from 'react';
export interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: 'sm' | 'md' | 'lg';
}
declare const LoadingSpinner: React.ForwardRefExoticComponent<LoadingSpinnerProps & React.RefAttributes<HTMLDivElement>>;
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    circle?: boolean;
}
declare const Skeleton: React.ForwardRefExoticComponent<SkeletonProps & React.RefAttributes<HTMLDivElement>>;
export interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
    lines?: number;
}
declare const SkeletonCard: React.ForwardRefExoticComponent<SkeletonCardProps & React.RefAttributes<HTMLDivElement>>;
export { LoadingSpinner, Skeleton, SkeletonCard };
//# sourceMappingURL=loading-state.d.ts.map