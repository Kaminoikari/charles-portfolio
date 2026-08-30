import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  assetsInclude: ['**/*.vert', '**/*.frag'],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // scripts/ is in here so the avatar tooling's own tests actually run. A
    // guard nobody runs is not a guard, and measure-motions is the only thing
    // that answers "can this motion pack keep working on a different body".
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    // Two workers, not the eight this machine has. Three suites here are CPU
    // sweeps rather than waits — rigProbe replays every clip frame by frame,
    // measure-motions does it twice over a 5.5MB model — and running four of
    // them beside the jsdom suites saturated the box: tests timed out, a
    // different one each run, and vitest's own worker RPC ("Timeout calling
    // onTaskUpdate") started failing too, which exits non-zero on a run where
    // every test passed.
    //
    // Halving it again costs nothing: 84-94s per run at 2 workers against 97s
    // at 4, three runs each, because the sweeps were never waiting on anything
    // to parallelise. What it buys is 3/3 runs at exit 0 with no worker errors,
    // where 4 workers gave 2 of 4 non-zero exits.
    maxWorkers: 2,
    // 20s, not vitest's 5s default. The two heaviest suites are CPU sweeps, not
    // waits: rigProbe replays a clip frame by frame (1.2s per motion on an idle
    // machine) and ChatWidget lays out a wrapping composer in jsdom (1.0s). A 5s
    // budget is four times the measured cost, which this machine eats whenever
    // anything else is running — every failure it produced was a timeout, never
    // an assertion, and a different test each run. Nothing here asserts latency,
    // so the budget only needs to be far enough above the real cost to still
    // catch a hang; 20s is roughly sixteen times it.
    testTimeout: 20_000,
    css: false,
  },
})
