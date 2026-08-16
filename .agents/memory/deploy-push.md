---
name: Deploy & push workflow
description: How this project ships to production and the prod-DB mirroring gotcha
---
- Production runs on Vercel, auto-deployed from GitHub `chimaicloud-dev/Smartledger-premium-` (main). Push with `git push https://x-access-token:${GITHUB_TOKEN_CHIMAICLOUD}@github.com/...` and always `git pull --rebase` from the same URL first (task-agent merges land often).
- **Why:** the Replit "publish" flow is not used; forgetting the rebase causes push rejections mid-session.
- **How to apply:** after any feature, commit + rebase + push, then tell the user Vercel redeploys automatically.
- Dev DB (Replit Postgres) and prod DB (Vercel env DATABASE_URL) are separate. `drizzle-kit push` here only migrates dev; new tables must also be created in prod or the deployed API crashes with "relation does not exist".
- `drizzle-kit push` prompts interactively (create vs rename) and can't be answered via pipe — create new tables with raw SQL via `pg` instead.
- The generated `lib/api-zod` / `lib/api-client-react` code comes from `lib/api-spec/openapi.yaml` via `pnpm --dir lib/api-spec run codegen`; never hand-edit generated files. After codegen, run `npx tsc -b lib/db lib/api-zod lib/api-client-react` or stale .d.ts causes phantom "no exported member" errors.
- Emails on Vercel: fire-and-forget sends must be kept alive with `waitUntil` from `@vercel/functions` (already wired in api-server `lib/email.ts` dispatch()).
