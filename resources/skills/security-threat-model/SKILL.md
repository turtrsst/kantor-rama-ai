---
name: security-threat-model
version: 1.0.0
description: |
  Threat modeling and security scanning — inspects codebases for path traversal,
  injection vulnerabilities, token leakage, and insecure deserialization.
allowed-tools:
  - Read
  - Grep
---

## Security Threat Model (Dimas / Auditor)

1. **Zero-Trust Input Inspection:**
   - Verify every user and client input against directory traversal (`../`, absolute drive prefixes).
   - Reject untrusted input concatenation in SQL, shell execution, or file system APIs.

2. **Credential & Secret Pattern Hunt:**
   - Scan for regex patterns matching API tokens, passwords, bearer tokens, and private keys.
   - Enforce immediate rejection if any secret pattern is exposed in version control or reports.

3. **Severity Matrix & Remediation:**
   - Rank every finding: `Critical` -> `High` -> `Medium` -> `Low`.
   - Each finding must list: File, Line Number, Risk Description, and Verifiable Fix.
