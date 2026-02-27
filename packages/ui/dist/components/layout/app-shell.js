import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { cn } from '../../lib/utils';
const AppShell = React.forwardRef(({ className, header, sidebar, footer, children, ...props }, ref) => {
    return (_jsxs("div", { ref: ref, className: cn('min-h-screen bg-surface flex flex-col', className), ...props, children: [header && (_jsx("header", { className: "sticky top-0 z-40 w-full border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/60", children: header })), _jsxs("div", { className: "flex flex-1", children: [sidebar && (_jsx("aside", { className: "hidden md:flex w-64 flex-col border-r border-border bg-surface-muted", children: sidebar })), _jsxs("main", { className: "flex-1 flex flex-col", children: [_jsx("div", { className: "flex-1 p-6", children: children }), footer && (_jsx("footer", { className: "border-t border-border py-4 px-6", children: footer }))] })] })] }));
});
AppShell.displayName = 'AppShell';
const PageHeader = React.forwardRef(({ className, title, description, actions, ...props }, ref) => {
    return (_jsxs("div", { ref: ref, className: cn('flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-6', className), ...props, children: [_jsxs("div", { className: "space-y-1", children: [_jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: title }), description && (_jsx("p", { className: "text-text-muted", children: description }))] }), actions && _jsx("div", { className: "flex items-center gap-2", children: actions })] }));
});
PageHeader.displayName = 'PageHeader';
export { AppShell, PageHeader };
//# sourceMappingURL=app-shell.js.map