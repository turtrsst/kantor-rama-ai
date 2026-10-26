---
name: kra-hive-sync
version: 1.0.0
description: |
  KRA hive synchronization skill — runs the start-of-task and end-of-task memory lifecycle.
  Reads Dashboard KRA Project.md and memory records at task start; logs decisions, reports,
  and state transitions into the Obsidian memory vault at task end.
allowed-tools:
  - Read
  - Propose
---

## KRA Hive Synchronization

Run the mandatory KRA lifecycle steps:

1. **Read Memory at Start**
   - Read the master dashboard: `Dashboard KRA Project.md`.
   - Read relevant agent files and prior reports under `reports/`.
   - Verify active project state and supervisor directives from Rama.

2. **Propose Before Modifying**
   - Any code, config, or filesystem change must use the Propose-then-Approve gate.
   - Do not write, overwrite, or delete project files without explicit user approval.

3. **Link Generated Reports**
   - Every diagnostic, audit, or milestone report must be written to `reports/` in the vault.
   - Every report must include a backlink to `[[Dashboard KRA Project]]`.
   - Register the report in the dashboard's Reports Log table.

4. **Record Decisions at End**
   - Before completing a task, append durable decisions, milestones, and status changes
     to the Decisions & Milestones section of `Dashboard KRA Project.md`.
