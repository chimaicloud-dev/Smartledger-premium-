---
name: Money-safety rules
description: Concurrency rules for any code that credits/debits user balances
---
- Every balance change must be an atomic conditional UPDATE (`amount = amount - X WHERE amount >= X`, check `.returning()`), and any multi-write money operation (debit + record, claim + credit) must run in one `db.transaction`.
- **Why:** a code review found the naive sequential writes could double-pay or burn funds if a serverless invocation dies mid-operation; admin approve/reject and investment accrual were reworked to claim state compare-and-set before applying balance effects.
- **How to apply:** any new endpoint touching holdings/investments/transactions follows the same pattern — claim the state transition first (WHERE on old state), then credit/debit inside the same transaction.
- Investment accrual is lazy (on portfolio/investments reads) plus the daily Vercel cron `/api/cron/cleanup` (guarded by CRON_SECRET); each 24h period pays at most once via the `days_accrued` compare-and-set.
