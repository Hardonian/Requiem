// Type declarations for blake3 module
declare module 'blake3' {
  export function createHash(): {
    update(data: string | Uint8Array): void;
    digest(format?: 'hex' | 'binary'): string | Uint8Array;
  };
  export function hash(data: string | Uint8Array): Buffer;
  export default createHash;
}
