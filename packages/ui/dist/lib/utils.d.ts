import { type ClassValue } from 'clsx';
export declare function cn(...inputs: ClassValue[]): string;
export declare function formatNumber(num: number): string;
export declare function formatDate(date: Date | string | number): string;
export declare function formatRelativeTime(date: Date | string | number): string;
export declare function formatDuration(ms: number): string;
export declare function formatBytes(bytes: number): string;
export declare function debounce<T extends (...args: unknown[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void;
export declare function hashKey(input: string): string;
export declare function getStorageItem(key: string, defaultValue?: string | null): string | null;
export declare function setStorageItem(key: string, value: string): void;
export declare function uniqueId(prefix?: string): string;
//# sourceMappingURL=utils.d.ts.map