import * as React from 'react';
export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
    label: string;
    value: number | string;
    format?: 'number' | 'percentage' | 'bytes' | 'duration' | 'raw';
    trend?: {
        value: number;
        direction: 'up' | 'down' | 'neutral';
        label?: string;
    };
    icon?: React.ReactNode;
    loading?: boolean;
}
declare const MetricCard: React.ForwardRefExoticComponent<MetricCardProps & React.RefAttributes<HTMLDivElement>>;
export { MetricCard };
//# sourceMappingURL=metric-card.d.ts.map