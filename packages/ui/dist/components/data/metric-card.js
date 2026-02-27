import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { cn, formatNumber } from '../../lib/utils';
const MetricCard = React.forwardRef(({ className, label, value, format = 'raw', trend, icon, loading = false, ...props }, ref) => {
    const formatValue = (val) => {
        if (typeof val === 'string')
            return val;
        switch (format) {
            case 'number':
                return formatNumber(val);
            case 'percentage':
                return `${val.toFixed(1)}%`;
            case 'bytes':
                return formatBytes(val);
            case 'duration':
                return formatDuration(val);
            default:
                return String(val);
        }
    };
    if (loading) {
        return (_jsxs("div", { ref: ref, className: cn('rounded-lg border border-border bg-surface-raised p-6 animate-pulse', className), ...props, children: [_jsx("div", { className: "h-4 w-20 bg-surface-muted rounded" }), _jsx("div", { className: "mt-2 h-8 w-32 bg-surface-muted rounded" })] }));
    }
    return (_jsxs("div", { ref: ref, className: cn('rounded-lg border border-border bg-surface-raised p-6', className), ...props, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-sm font-medium text-text-muted", children: label }), icon && _jsx("div", { className: "text-text-muted", children: icon })] }), _jsxs("div", { className: "mt-2 flex items-baseline gap-2", children: [_jsx("p", { className: "text-3xl font-semibold text-text-primary", children: formatValue(value) }), trend && (_jsxs("span", { className: cn('text-sm font-medium', trend.direction === 'up' && 'text-success', trend.direction === 'down' && 'text-danger', trend.direction === 'neutral' && 'text-text-muted'), children: [trend.direction === 'up' && '↑', trend.direction === 'down' && '↓', trend.direction === 'neutral' && '→', Math.abs(trend.value), "%", trend.label && ` ${trend.label}`] }))] })] }));
});
MetricCard.displayName = 'MetricCard';
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000)
        return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}
export { MetricCard };
//# sourceMappingURL=metric-card.js.map