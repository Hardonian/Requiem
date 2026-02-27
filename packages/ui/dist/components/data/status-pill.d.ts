import * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
declare const statusPillVariants: (props?: ({
    status?: "success" | "warning" | "info" | "neutral" | "danger" | "pending" | "running" | "completed" | "failed" | "cancelled" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof statusPillVariants> {
    icon?: React.ReactNode;
    animate?: boolean;
}
declare const StatusPill: React.ForwardRefExoticComponent<StatusPillProps & React.RefAttributes<HTMLSpanElement>>;
declare const DeterminismPill: ({ confidence, className }: {
    confidence: "high" | "medium" | "low" | "best_effort";
    className?: string;
}) => import("react/jsx-runtime").JSX.Element;
export { StatusPill, DeterminismPill, statusPillVariants };
//# sourceMappingURL=status-pill.d.ts.map