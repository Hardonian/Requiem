import { jsx as _jsx } from "react/jsx-runtime";
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
const badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ' +
    'transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2', {
    variants: {
        variant: {
            default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
            secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
            destructive: 'border-transparent bg-danger text-danger-foreground hover:bg-danger/80',
            outline: 'text-text-primary border-border-subtle hover:border-border-strong hover:bg-surface-hover',
            success: 'border-transparent bg-success text-success-foreground hover:bg-success/80',
            warning: 'border-transparent bg-warning text-warning-foreground hover:bg-warning/80',
            info: 'border-transparent bg-info text-info-foreground hover:bg-info/80',
        },
    },
    defaultVariants: {
        variant: 'default',
    },
});
function Badge({ className, variant, ...props }) {
    return (_jsx("span", { className: cn(badgeVariants({ variant }), className), ...props }));
}
export { Badge, badgeVariants };
//# sourceMappingURL=badge.js.map