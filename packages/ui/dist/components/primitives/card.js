import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
const cardVariants = cva('rounded-lg border bg-surface-raised text-text-primary transition-all', {
    variants: {
        elevation: {
            flat: 'border-border-subtle shadow-none',
            raised: 'border-border-subtle shadow-surface-raised hover:shadow-surface-overlay',
            overlay: 'border-border-strong shadow-surface-overlay',
        },
    },
    defaultVariants: {
        elevation: 'raised',
    },
});
const Card = React.forwardRef(({ className, elevation, ...props }, ref) => {
    return (_jsx("div", { ref: ref, className: cn(cardVariants({ elevation, className })), ...props }));
});
Card.displayName = 'Card';
const CardHeader = React.forwardRef(({ className, padding = 'default', ...props }, ref) => {
    const paddingClasses = {
        default: 'p-6',
        compact: 'p-4',
        none: 'p-0',
    };
    return (_jsx("div", { ref: ref, className: cn('flex flex-col space-y-1.5', paddingClasses[padding], className), ...props }));
});
CardHeader.displayName = 'CardHeader';
const CardTitle = React.forwardRef(({ className, ...props }, ref) => (_jsx("h3", { ref: ref, className: cn('text-lg font-semibold leading-snug tracking-tight', className), ...props })));
CardTitle.displayName = 'CardTitle';
const CardDescription = React.forwardRef(({ className, ...props }, ref) => (_jsx("p", { ref: ref, className: cn('text-sm text-text-muted leading-relaxed', className), ...props })));
CardDescription.displayName = 'CardDescription';
const CardContent = React.forwardRef(({ className, padding = 'default', ...props }, ref) => {
    const paddingClasses = {
        default: 'p-6 pt-0',
        compact: 'p-4 pt-0',
        none: 'p-0',
    };
    return (_jsx("div", { ref: ref, className: cn(paddingClasses[padding], className), ...props }));
});
CardContent.displayName = 'CardContent';
const CardFooter = React.forwardRef(({ className, padding = 'default', ...props }, ref) => {
    const paddingClasses = {
        default: 'p-6 pt-0',
        compact: 'p-4 pt-0',
        none: 'p-0',
    };
    return (_jsx("div", { ref: ref, className: cn('flex items-center gap-2', paddingClasses[padding], className), ...props }));
});
CardFooter.displayName = 'CardFooter';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
//# sourceMappingURL=card.js.map