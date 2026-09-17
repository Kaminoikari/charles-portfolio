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
    // `scripts/**/*.test.ts` used to be here for the avatar pipeline's own
    // suites. The pipeline moved to the vtuber-kit repo on 2026-09-17 and took
    // those 48 tests with it; what is left under scripts/ is Python.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Two workers, not the eight this machine has. rigProbe is a CPU sweep
    // rather than a wait (it replays every clip frame by frame), and running
    // four of those beside the jsdom suites saturated the box: tests timed out,
    // a different one each run, and vitest's own worker RPC ("Timeout calling
    // onTaskUpdate") started failing too, which exits non-zero on a run where
    // every test passed.
    //
    // The timings behind this were measured in 2026-09 while the avatar
    // pipeline still lived here, so they cover a heavier run than today's:
    // 84-94s at 2 workers against 97s at 4, three runs each, because the sweeps
    // were never waiting on anything to parallelise. What it bought was 3/3
    // runs at exit 0 with no worker errors, where 4 workers gave 2 of 4
    // non-zero exits. The suite is lighter now; the setting is kept because
    // rigProbe alone still reproduces the saturation, and nothing here is
    // waiting on parallelism.
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
