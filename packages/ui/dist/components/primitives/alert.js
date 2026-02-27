import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
const alertVariants = cva('relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground', {
    variants: {
        variant: {
            default: 'bg-surface-muted text-text-primary border-border',
            destructive: 'border-danger/50 text-danger-foreground dark:border-danger [&>svg]:text-danger',
            success: 'border-success/50 text-success dark:border-success [&>svg]:text-success',
            warning: 'border-warning/50 text-warning dark:border-warning [&>svg]:text-warning',
            info: 'border-info/50 text-info dark:border-info [&>svg]:text-info',
        },
    },
    defaultVariants: {
        variant: 'default',
    },
});
const Alert = React.forwardRef(({ className, variant, ...props }, ref) => (_jsx("div", { ref: ref, role: "alert", className: cn(alertVariants({ variant }), className), ...props })));
Alert.displayName = 'Alert';
const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (_jsx("h5", { ref: ref, className: cn('mb-1 font-medium leading-none tracking-tight', className), ...props })));
AlertTitle.displayName = 'AlertTitle';
const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (_jsx("div", { ref: ref, className: cn('text-sm [&_p]:leading-relaxed', className), ...props })));
AlertDescription.displayName = 'AlertDescription';
export { Alert, AlertTitle, AlertDescription };
//# sourceMappingURL=alert.js.map