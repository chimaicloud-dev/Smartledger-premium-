---
name: Withdrawal destinations
description: Durable security rule for remembering and replacing user withdrawal addresses
---

- Save the first successfully submitted withdrawal address separately for each canonical network. Reuse it as read-only until that user explicitly deletes it, after which the next successful withdrawal claims the replacement.
- **Why:** persistent destinations reduce repeated entry mistakes, while immutable-until-delete behavior makes silent address substitution harder. Canonical method IDs prevent aliases from bypassing the lock.
- **How to apply:** validate method and network-specific address format before any debit; scope list/delete by authenticated user; claim the address, conditionally debit funds, and create the withdrawal ledger row in one database transaction.