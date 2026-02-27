'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { cn } from '../../lib/utils';
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        this.props.onError?.(error, errorInfo);
        if (process.env.NODE_ENV === 'development') {
            console.error('ErrorBoundary caught an error:', error, errorInfo);
        }
    }
    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return _jsx(DefaultErrorFallback, { error: this.state.error });
        }
        return this.props.children;
    }
}
function DefaultErrorFallback({ error, onReset, className }) {
    return (_jsxs("div", { className: cn('flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-danger/50 bg-danger-muted p-8 text-center', className), role: "alert", children: [_jsx("div", { className: "mb-4 rounded-full bg-danger/10 p-3", children: _jsx("svg", { className: "h-6 w-6 text-danger", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", "aria-hidden": "true", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }) }), _jsx("h2", { className: "text-lg font-semibold text-text-primary", children: "Something went wrong" }), _jsx("p", { className: "mt-2 text-sm text-text-muted max-w-md", children: "An unexpected error occurred. Try refreshing the page or contact support if the problem persists." }), process.env.NODE_ENV === 'development' && error && (_jsxs("pre", { className: "mt-4 max-w-full overflow-auto rounded bg-surface-dark p-4 text-left text-xs text-text-inverse", children: [error.message, '\n', error.stack] })), onReset && (_jsx("button", { onClick: onReset, className: "mt-6 inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover", children: "Try again" }))] }));
}
export { ErrorBoundary, DefaultErrorFallback };
//# sourceMappingURL=error-boundary.js.map