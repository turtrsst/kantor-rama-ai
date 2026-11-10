# Code Review and Quality

## When to use

- Use this skill before merging any change, with no exceptions.

- Use this skill after completing a feature implementation or a bug fix.

- Use this skill when you review code written by yourself, another agent, or a human.

- Use this skill when you review a diff or a pull request, even when the diff is pasted inline.

## Approval standard

- Approve a change when it definitely improves overall code health, even if it is not perfect.

- Do not block a change because it is not exactly how you would have written it.

- Do not rubber-stamp. A bare approval without evidence of review helps no one.

- Do not soften real issues. Quantify problems when you can, such as how much slower a query makes a list.

- Comment on code, not people, and accept override gracefully when the author has full context and disagrees.

## The five-axis review

- Review every change across five axes: correctness, readability, architecture, security, and performance.

- Correctness asks whether the code does what it claims, handles edge cases and error paths, and whether the tests actually test the right things.

- Readability asks whether another engineer can understand the code without the author explaining it, with descriptive names, straightforward control flow, and no clever tricks.

- Architecture asks whether the change follows existing patterns, keeps clean module boundaries, avoids circular dependencies, and reduces complexity instead of relocating it.

- Security asks whether user input is validated and sanitized, secrets stay out of code and logs, auth is checked where needed, and external data is treated as untrusted.

- Performance asks about N+1 query patterns, unbounded loops, missing pagination on list endpoints, and synchronous operations that should be async.

## Structural remedies

- When you flag a structural problem, propose the move and not just the problem.

- Replace a chain of conditionals with a typed model or an explicit dispatcher.

- Collapse duplicate branches into a single clearer flow.

- Separate orchestration from business logic so each reads on its own.

- Move feature-specific logic out of a shared module into the package that owns the concept.

- Reuse the canonical helper instead of a bespoke near-duplicate.

- Prefer the remedy that removes moving pieces over one that spreads the same complexity around.

## Change sizing

- Target about 100 lines changed for a reviewable change.

- About 300 lines is acceptable if it is a single logical change.

- About 1000 lines changed is too large, so ask the author to split it.

- Watch file size, not just diff size. Around 1000 total lines in a single file is a signal to extract helpers or modules first.

- Separate refactoring from feature work, since a change that refactors and adds behavior is two changes.

## Change descriptions

- Every change needs a description that stands alone in version control history.

- Write the first line short and imperative, such as "Delete the FizzBuzz RPC".

- Explain in the body what is changing and why, with context and decisions not visible in the code.

- Avoid vague descriptions such as "Fix bug" or "Add patch".

## Review process

- Understand the context first: what the change tries to accomplish and what spec it implements.

- Review the tests first, since tests reveal intent and coverage.

- Test the tests by experiment: invert one condition the change adds, run the suite, then restore the file. A mutation that stays green is a finding, so name the missing test case.

- Walk through the implementation file by file against the five axes.

- Check findings against the callers, guards, and tests that reach the changed code, and drop a finding if they rule it out.

- Label defects that already exist in the base separately from regressions this change introduces.

- Zero findings is a valid result, so do not invent one.

## Severity labels

- Label every comment with its severity so the author knows what is required.

- No prefix means a required change that must be addressed before merge.

- Critical means it blocks merge, such as a security vulnerability, data loss, or broken functionality.

- Nit means minor and optional, such as formatting or style preferences.

- Optional or Consider means a suggestion worth considering but not required.

- FYI means informational only with no action needed.

- Lead with what matters and order findings by leverage, with correctness and security first.

## Dead code hygiene

- After any refactoring or implementation change, check for orphaned code.

- List unused code explicitly and ask before deleting it, since you should not silently delete things you are not sure about.

## Dependency discipline

- Before adding a dependency, check whether the existing stack already solves the problem.

- Prefer standard library and existing utilities over new dependencies, since every dependency is a liability.

- Check that a dependency is actively maintained, check its license, and check for known vulnerabilities.

- Review dependency upgrades against the changelog, one dependency per change, and let a green test suite decide.

- Review the lockfile diff, not just the package manifest, and never hand-edit the lockfile.

## Review checklist

- Confirm you understand what the change does and why.

- Confirm edge cases and error paths are handled and tests cover the change adequately.

- Confirm names are clear, logic is straightforward, and the change follows existing patterns.

- Confirm no secrets are in code, input is validated at boundaries, and there are no injection vulnerabilities.

- Confirm there are no N+1 patterns, no unbounded operations, and pagination exists on list endpoints.

- Confirm tests pass, the build succeeds, and the verification story is documented.

- Give a verdict of Approve or Request changes.

## Red flags

- Pull requests merged without any review.

- Review that only checks whether tests pass.

- Security-sensitive changes without security-focused review.

- Large pull requests that are too big to review properly.

- No regression tests with bug fix pull requests.

- Review comments without severity labels.

- Accepting "I will fix it later", since deferred cleanup rarely happens.

## Source and limits

- Adapted from the code-review-and-quality skill in addyosmani/agent-skills by Addy Osmani, MIT licensed.

- Source repository is https://github.com/addyosmani/agent-skills

- The upstream skill is pure Markdown with no scripts, hooks, or plugins, and nothing was run to install it.

- References to other upstream skills for detailed security and performance guidance were dropped, since those skills are not installed in Muse. Use `muse.skill_search` to find a related skill when you need one.

- Superpowers already covers code review workflows, so this skill supplies the concrete five-axis method, severity labels, and checklists that a reviewer applies in a single review.

- Use `muse.skill_search` to discover this skill and use the Muse tools in the current session to do the work.

## Available connectors

- Use `muse.connector_search` to find other connectors and `muse.skill_search` to find related skills.

- If nothing here fits, look on the web for a maintained API or MCP server and set it up with [Custom Connectors and MCPs](/opt/muse/skills/custom-connector-setup/SKILL.md), or build a custom connector.
