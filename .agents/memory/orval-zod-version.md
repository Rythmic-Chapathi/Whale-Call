---
name: Orval Zod compatibility
description: The generated Zod client currently relies on Zod 4 helpers.
---

The workspace's Orval Zod output uses helpers such as `z.int()`, so the shared Zod catalog must stay on a Zod 4 release rather than Zod 3. Client forms using the installed React Hook Form Zod resolver must import `zod/v3`; otherwise invalid submissions can throw a Zod 4 error into Vite instead of returning inline field errors.

**Why:** Orval can finish code generation successfully while the follow-up library typecheck fails when the runtime Zod package is older than the generated API. Conversely, the current form resolver does not correctly catch Zod 4 validation failures.

**How to apply:** Keep generated API validators on Zod 4. For React Hook Form schemas passed to `zodResolver`, use the package's `zod/v3` compatibility entrypoint until the resolver is upgraded and verified with Zod 4.