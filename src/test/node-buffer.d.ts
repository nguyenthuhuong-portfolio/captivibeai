/**
 * `node:buffer` is imported by the test setup alone, to point the global `Blob`/`File` at the
 * implementations the environment's `structuredClone` understands. The project does not otherwise
 * depend on Node's types, so the two names it needs are declared here rather than by adding the
 * whole `@types/node` surface to a browser-only codebase.
 */
declare module 'node:buffer' {
  export const Blob: typeof globalThis.Blob
  export const File: typeof globalThis.File
}
