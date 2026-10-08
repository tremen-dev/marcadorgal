import { guardFetch } from "./fetch-guard.ts";

// setupFiles of vitest.db.config.mts (SPEC-022 CA-5).
globalThis.fetch = guardFetch(globalThis.fetch);
