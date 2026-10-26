---
name: surgical-refactor
version: 1.0.0
description: |
  Surgical code refactoring — performs minimal, targeted fixes and refactoring
  without touching unaffected code, preserving indentation, comments, and structure.
allowed-tools:
  - Read
  - Grep
---

## Surgical Refactoring (Maya / Modifier)

1. **Root-Cause Analysis First:**
   - Diagnose why the code failed or needs refactoring before proposing an edit.
   - Summarize the defect in 1 sentence before providing the replacement.

2. **Minimal Diff Principle:**
   - Never rewrite an entire file when a 3-line patch suffices.
   - Preserve surrounding formatting, line breaks, indentation, and comments.

3. **Regression & Compatibility Shield:**
   - Check upstream callers and downstream dependencies.
   - State before/after behavior and verify zero breaking changes.
