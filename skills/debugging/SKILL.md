# Debugging

## When to use

- Use this skill when you investigate a bug report or unexpected behavior.

- Use this skill when you analyze an error message or a stack trace.

- Use this skill when you trace a code path to understand why something happens.

- Use this skill when you diagnose a performance problem.

- Use this skill before you change code to fix a bug, so the fix targets the root cause and not a symptom.

## Scientific method

- Treat debugging as hypothesis testing and not as guessing.

- Observe first and gather information about the bug.

- Form one theory about the cause.

- Predict what you would expect if the theory is true.

- Test the prediction and refine the theory from the result.

- Test one hypothesis at a time and verify the result before you move to the next.

## Reproduce first

- Reproduce the bug reliably before you debug it.

- Record the exact steps, the environment, and the input that triggers it.

- Note whether the bug is consistent or intermittent.

- If you cannot reproduce it, you cannot fix it, so say so and gather more information instead of changing code.

## Gather information

- Collect the error message and the full stack trace.

- Read the log files around the time of failure.

- Check recent code changes with git log and git blame.

- Note the system state such as memory, CPU, and disk.

- Ask what changed recently, since a new bug usually follows a recent change.

## Isolate the problem

- Narrow the scope with binary search and disable half the code to see if the bug persists.

- Build a minimal reproduction and strip away unrelated code.

- Reduce the input to the smallest case that still triggers the bug.

- Test in isolation by environment and ask whether it happens in dev, staging, or only prod.

- Use git bisect to find the commit that introduced the bug, by marking a bad commit and a good commit and testing the middle commit until the culprit is found.

## Understand before fixing

- Resist the urge to change code immediately.

- Read the code carefully and trace the execution path.

- Understand why the current behavior happens and identify the root cause.

- Make the smallest change that fixes the issue.

- Write a test that catches the bug and verify the fix against the reproduction case.

- Check for similar bugs elsewhere in the codebase.

## Debugging techniques

- Use structured logging for production and simple print debugging for quick checks.

- Use breakpoints with the debugger of the language, such as Python `breakpoint()`, JavaScript `debugger;`, Delve for Go, or rust-lldb for Rust.

- Explain the problem out loud or in writing, line by line, as rubber duck debugging, since describing what the code should do against what it does often reveals the bug.

- Measure performance with a profiler before you optimize, find the hotspot, understand why it is slow, and optimize the bottleneck only.

## Common bug patterns

- Off-by-one errors in array indexes and loops.

- Null or undefined references and unhandled empty arrays.

- Race conditions from shared mutable state and async operations completing in an unexpected order.

- Stale state after updates, wrong initial state, and state not reset between operations.

- Implicit type coercion such as string versus number comparisons and truthy or falsy edge cases.

## Error message analysis

- Read the error message carefully, since it usually holds the error type, the message, the stack trace, and the context.

- Read a stack trace bottom-up, since your code is usually at the bottom.

- Ignore framework internals at first and look for your file names and line numbers.

- The actual bug is often a few frames before the crash.

## When you are stuck

- Take a break, since fresh eyes help.

- Search for the exact error message.

- Question your assumptions and check what changed.

- Sleep on it when nothing else works.

## Source and limits

- Adapted from the debugging skill in econf/claude-config, licensed MIT OR Apache-2.0.

- Source repository is https://github.com/econf/claude-config

- The upstream skill is pure Markdown with no scripts, hooks, or plugins, and nothing was run to install it.

- Superpowers already covers the systematic-debugging workflow, so this skill does not repeat that workflow and instead supplies the technique catalog: reproduce first, isolate, read stack traces, use git bisect, and recognize common bug patterns.

- Use `muse.skill_search` to discover this skill and use the Muse tools in the current session to do the work.

## Available connectors

- Use `muse.connector_search` to find other connectors and `muse.skill_search` to find related skills.

- If nothing here fits, look on the web for a maintained API or MCP server and set it up with [Custom Connectors and MCPs](/opt/muse/skills/custom-connector-setup/SKILL.md), or build a custom connector.
