---
name: clean-scaffolder
version: 1.0.0
description: |
  Clean architecture scaffolding — creates modular, zero-debt file trees,
  strict-typed boilerplates, and self-contained prototypes.
allowed-tools:
  - Read
  - Grep
---

## Clean Architecture Scaffolding (Budi / Creator)

1. **Strict Type Safety & Isolation:**
   - In PHP: use `declare(strict_types=1);` and typed parameters/returns.
   - In JS/Node: declare clean exported modules without polluting global scope.
   - Keep line lengths strictly under 120 characters for audit readability.

2. **Zero Hardcoded Secrets & Paths:**
   - Always load sensitive credentials via environment variables (`getenv()`) or secure config.
   - Use dynamic path resolvers (`__DIR__`, `realpath()`) instead of hardcoded Windows drive paths.

3. **Self-Documenting & Reversible:**
   - Structure code into single-responsibility classes or functions.
   - Every scaffolded proposal must state: target file path, intent, and rollback mechanism.
