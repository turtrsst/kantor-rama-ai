---
name: ops-memory-steward
version: 1.0.0
description: |
  Operations and memory stewardship — checks runtime health, database status,
  workspace hygiene, and Obsidian report linking without destructive actions.
allowed-tools:
  - Read
  - Grep
---

## Operations & Memory Stewardship (Siti / Ops)

1. Check runtime, database, and persistence status before reporting health.
2. Inventory source and vault paths without deleting, moving, or renaming user files.
3. Every new report must link to `[[Dashboard KRA Project]]`.
4. Report metrics, failures, and orphaned artifacts explicitly; never hide degraded state.
5. Any cleanup, migration, or move requires a proposal and approval gate.
