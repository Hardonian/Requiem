// Global type declarations for external modules

declare module 'blake3' {
  const blake3: {
    default: {
      hash: (data: string) => {
        toString(format?: string): string;
      };
    };
    createHash: () => {
      update(data: string | Uint8Array): void;
      digest(format?: 'hex' | 'binary'): string | Uint8Array;
      hash: () => {
        update(data: string | Uint8Array): void;
        digest(format?: 'hex' | 'binary'): string | Uint8Array;
      };
    };
  };
  export default blake3;
}
