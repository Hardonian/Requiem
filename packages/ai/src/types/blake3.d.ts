// Type declarations for blake3 module
declare module 'blake3' {
  export function createHash(): {
    update(data: string | Uint8Array): void;
    digest(format?: 'hex' | 'binary'): string | Uint8Array;
  };
}

// Also declare it as default export for compatibility
declare module 'blake3' {
  export function createHash(): {
    update(data: string | Uint8Array): void;
    digest(format?: 'hex' | 'binary'): string | Uint8Array;
  };
  export default createHash;
}
