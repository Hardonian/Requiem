import * as React from 'react';
export interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}
export interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}
declare class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps);
    static getDerivedStateFromError(error: Error): ErrorBoundaryState;
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void;
    render(): string | number | bigint | boolean | import("react/jsx-runtime").JSX.Element | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined;
}
export interface ErrorFallbackProps {
    error?: Error;
    onReset?: () => void;
    className?: string;
}
declare function DefaultErrorFallback({ error, onReset, className }: ErrorFallbackProps): import("react/jsx-runtime").JSX.Element;
export { ErrorBoundary, DefaultErrorFallback };
//# sourceMappingURL=error-boundary.d.ts.map