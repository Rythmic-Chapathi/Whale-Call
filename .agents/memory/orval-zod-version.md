---
name: Orval Zod compatibility
description: The generated Zod client currently relies on Zod 4 helpers.
---

The workspace's Orval Zod output uses helpers such as `z.int()`, so the shared Zod catalog must stay on a Zod 4 release rather than Zod 3.

**Why:** Orval can finish code generation successfully while the follow-up library typecheck fails when the runtime Zod package is older than the generated API.

**How to apply:** If API codegen reports missing Zod helpers, check the shared catalog version before changing generated files or the OpenAPI contract.