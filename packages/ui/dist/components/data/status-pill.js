import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
const statusPillVariants = cva('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors', {
    variants: {
        status: {
            success: 'bg-success-muted text-success border border-success/20',
            warning: 'bg-warning-muted text-warning border border-warning/20',
            danger: 'bg-danger-muted text-danger border border-danger/20',
            info: 'bg-info-muted text-info border border-info/20',
            neutral: 'bg-surface-muted text-text-muted border border-border',
            pending: 'bg-surface-muted text-text-muted border border-border animate-pulse',
            running: 'bg-info-muted text-info border border-info/20',
            completed: 'bg-success-muted text-success border border-success/20',
            failed: 'bg-danger-muted text-danger border border-danger/20',
            cancelled: 'bg-surface-muted text-text-muted border border-border',
        },
    },
    defaultVariants: {
        status: 'neutral',
    },
});
const StatusPill = React.forwardRef(({ className, status, icon, animate = false, children, ...props }, ref) => {
    return (_jsxs("span", { ref: ref, className: cn(statusPillVariants({ status }), animate && status === 'running' && 'animate-pulse', className), ...props, children: [icon && _jsx("span", { className: "flex-shrink-0", children: icon }), children] }));
});
StatusPill.displayName = 'StatusPill';
const DeterminismPill = ({ confidence, className }) => {
    const variants = {
        high: { status: 'success', label: 'High Confidence' },
        medium: { status: 'info', label: 'Medium Confidence' },
        low: { status: 'warning', label: 'Low Confidence' },
        best_effort: { status: 'neutral', label: 'Best Effort' },
    };
    const variant = variants[confidence] ?? variants.best_effort;
    return (_jsx(StatusPill, { status: variant.status, className: className, children: variant.label }));
};
export { StatusPill, DeterminismPill, statusPillVariants };
//# sourceMappingURL=status-pill.js.map