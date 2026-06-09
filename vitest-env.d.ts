// Adds the vitest `test` key to vite's UserConfig so tsc -b accepts
// vite.config.ts. Vitest 3 ships a vendored vite 7 (rollup-based) that is
// structurally incompatible with vite 8 (rolldown-based), so we cannot use
// /// <reference types="vitest/config" /> or import from "vitest/config".
// This minimal shim is the standard workaround.
declare module 'vite' {
  interface UserConfig {
    test?: Record<string, unknown>
  }
}
export {}
