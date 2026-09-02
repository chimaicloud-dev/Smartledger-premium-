---
name: Admin email delivery
description: Reliability rules for custom admin email broadcasts on serverless production.
---

Custom admin broadcasts must persist both the job and each recipient outcome. Process them in bounded serverless invocations that securely self-chain while work remains, with a scheduled recovery sweep.

**Why:** Synchronous broadcasts can exceed function limits, browser-driven polling can stop, and separately maintained summary counters can briefly report false terminal results.

**How to apply:** Claim recipients atomically, bound SMTP and invocation time, derive displayed sent/failed totals from recipient states, and preserve a server-authorized recovery trigger.