import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { cn } from '../../lib/utils';
const EmptyState = React.forwardRef(({ className, icon, title, description, action, ...props }, ref) => {
    return (_jsxs("div", { ref: ref, className: cn('flex flex-col items-center justify-center text-center p-8 rounded-lg border border-dashed border-border', className), ...props, children: [icon && (_jsx("div", { className: "mb-4 text-text-muted", children: icon })), _jsx("h3", { className: "text-lg font-semibold text-text-primary", children: title }), description && (_jsx("p", { className: "mt-2 text-sm text-text-muted max-w-sm", children: description })), action && _jsx("div", { className: "mt-6", children: action })] }));
});
EmptyState.displayName = 'EmptyState';
export { EmptyState };
//# sourceMappingURL=empty-state.js.map