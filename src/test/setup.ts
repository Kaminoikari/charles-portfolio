import '@testing-library/jest-dom'

// Let the worker's event loop turn over between tests. vitest runs a file's
// tests back to back with only microtask awaits in between, so a file of
// synchronous tests never reaches the poll phase: rigProbe's sweep held the
// loop for 190s on CI. The worker's "onTaskUpdate" RPC reply then sits unread
// past its 60s timer, the timer fires first when the loop finally turns, and
// the run exits 1 with every test passing ("Timeout calling onTaskUpdate").
// setImmediate runs after the poll phase, so each turn reads any reply that
// arrived during the test. Captured here so a test that fakes timers cannot
// leave this hook waiting on a fake.
const realSetImmediate = setImmediate
afterEach(() => new Promise<void>((resolve) => realSetImmediate(resolve)))
