import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { cn } from '../../lib/utils';
const LoadingSpinner = React.forwardRef(({ className, size = 'md', ...props }, ref) => {
    const sizeClasses = {
        sm: 'h-4 w-4 border-2',
        md: 'h-8 w-8 border-2',
        lg: 'h-12 w-12 border-3',
    };
    return (_jsx("div", { ref: ref, className: cn('flex items-center justify-center', className), ...props, children: _jsx("div", { className: cn('animate-spin rounded-full border-solid border-current border-t-transparent text-accent', sizeClasses[size]) }) }));
});
LoadingSpinner.displayName = 'LoadingSpinner';
const Skeleton = React.forwardRef(({ className, circle = false, ...props }, ref) => {
    return (_jsx("div", { ref: ref, className: cn('animate-pulse bg-surface-muted', circle ? 'rounded-full' : 'rounded-md', className), ...props }));
});
Skeleton.displayName = 'Skeleton';
const SkeletonCard = React.forwardRef(({ className, lines = 3, ...props }, ref) => {
    return (_jsxs("div", { ref: ref, className: cn('rounded-lg border border-border p-6 space-y-4', className), ...props, children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx(Skeleton, { className: "h-12 w-12 rounded-full" }), _jsxs("div", { className: "space-y-2 flex-1", children: [_jsx(Skeleton, { className: "h-4 w-1/3" }), _jsx(Skeleton, { className: "h-3 w-1/4" })] })] }), _jsx("div", { className: "space-y-2", children: Array.from({ length: lines }).map((_, i) => (_jsx(Skeleton, { className: "h-3 w-full" }, i))) })] }));
});
SkeletonCard.displayName = 'SkeletonCard';
export { LoadingSpinner, Skeleton, SkeletonCard };
//# sourceMappingURL=loading-state.js.map