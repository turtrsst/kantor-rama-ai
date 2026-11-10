# Superpowers

## When to use

- Use this skill when you build a feature or fix a bug or refactor code or change behavior in a codebase.

- Use this skill when the user asks for brainstorming or a plan or test driven development or systematic debugging or a code review.

- Use this skill when the user asks for Superpowers by name.

- Use this skill before any response or action when a relevant section below might apply.

- Treat the sections below as mandatory workflows and not as suggestions.

- Follow the user instructions first when they conflict with this skill.

## Check skills first

- Check for a relevant skill before you explore code or ask a clarifying question or gather information.

- Announce the skill you are using and the purpose in one line and then follow it exactly.

- Stop and check for a skill when you think this is just a simple question or when you think you need more context first or when you think the skill is overkill.

- Treat those thoughts as rationalizations and not as reasons to skip the skill.

- Read the current skill text in this file and do not rely on memory of an older version.

- Put process skills first and implementation skills second.

- Start with brainstorming when the user asks to build something and start with systematic debugging when the user asks to fix a bug.

## Brainstorming

- Start with what the user already said and do not ask for what is already answered.

- Ask one open question in the user own terms when something non trivial is missing.

- Explore what kind of thing this is and what makes it special and why now and what success looks like.

- Explore goals and non goals and anti goals that would make the work a failure even if it shipped.

- Explore prior art and the current state and the details the user cares about.

- Explore something the user will look at and a layout or a flow or options that would look different from each other.

- Lay out the approaches in a message of their own and have the user choose or correct them.

- Play the understanding back in short sections so the user can correct it.

- Write the design doc only after the conversation and keep it short or full as the work size needs.

- Include intent and the why and goals and non goals and anti goals and constraints and approaches in the design doc.

- Include the parts of the how that were decided and leave the rest to the builder.

- Get approval of the design doc before you write code.

- Move to writing plans after approval.

- Refuse to code before design approval when the work is more than a trivial change.

- End the conversation cleanly when the user did not ask for a conversation.

## Writing plans

- Break approved work into tasks that take two to five minutes each.

- Give every task exact files and exact interfaces and exact verification steps.

- Design units with clear boundaries and well defined interfaces.

- Give each file one clear responsibility and prefer smaller focused files over large files that do too much.

- Keep files that change together living together and split by responsibility and not by technical layer.

- Follow established patterns in an existing codebase.

- Include a split in the plan when a file you must modify has grown unwieldy.

- Write the plan document with a header that names the feature and the global constraints and the review focus.

- Give every task a structure that names what to create and what to modify and what to test.

- Name the exact path for a file to create and the exact path and line range for a file to modify.

- Name what each task consumes from earlier tasks and what it produces for later tasks with exact function names and parameter types and return types.

- Make a step contain a test step or a code step or a verification step or a reference to another task.

- Write a test step with the test name and its assertions as code and the command to run it.

- Write a code step with the exact signature and the file and the behavior.

- Write a verification step with the command to run and the output that means it passed.

- Review the plan yourself for missing interfaces and for steps that are too large and for steps that depend on unstated work.

- Hand the plan to the user for approval before execution.

- Choose an execution mode with the user and record it in the plan.

- Use subagent driven development for the most thorough review and use executing plans for the cheapest and fastest run.

## Test driven development

- Write no production code without a failing test first.

- Delete code that was written before its test and start over with the test.

- Follow red green refactor for every behavior.

- Write one test for one behavior with a clear name.

- Use real code in the test and use a mock only when it is unavoidable.

- Run the test and watch it fail before you implement.

- Check that the test fails because the feature is missing and not because of a typo.

- Check that the failure message is the expected message.

- Implement the minimal code that makes the test pass.

- Run the tests again and check that the new test passes and that other tests still pass.

- Check that output is pristine with no errors and no warnings.

- Refactor only after green and remove duplication and improve names and extract helpers.

- Name the production change that would make the test fail before you write the test.

- Assert on real behavior and never on mock behavior.

- Keep test only code in test utilities and out of production classes.

- Understand a dependency side effects before you mock it.

- Stop and start over when you catch yourself writing code before a test or adding tests later or rationalizing just this once.

- Treat a test that passes immediately as a red flag.

- Treat manual testing as no substitute for a failing test first.

- Apply the same rule to bug fixes and refactoring and behavior changes and generated code and configuration files.

- Skip the rule only for a throwaway prototype and say plainly that you skipped it.

## Systematic debugging

- Use this section for test failures and bugs in production and unexpected behavior and performance problems and build failures and integration issues.

- Use this section when you are under time pressure and when a quick fix seems obvious and when you have already tried multiple fixes.

- Read error messages carefully before you propose any fix.

- Reproduce the issue consistently before you change code.

- Check recent changes that could have introduced the issue.

- Gather evidence in multi component systems before you form a hypothesis.

- Trace data flow through the system and find working examples to compare against.

- Compare the failing case against a reference and identify the differences.

- Understand dependencies before you change them.

- Form one single hypothesis at a time.

- Test that hypothesis with the smallest possible change.

- Verify the result before you continue to the next hypothesis.

- Create a failing test case for the bug when you can.

- Implement one single fix at a time and verify the fix.

- Question the architecture when three or more fixes have failed.

- Document what you investigated when the process reveals no root cause.

- Stop when you catch yourself proposing a fix without understanding or adding multiple changes and running tests or skipping the test or saying it is probably a certain cause.

- Treat each fix that reveals a new problem in a different place as a sign to stop guessing and return to evidence gathering.

## Subagent driven development

- Use this section when a plan has several tasks and each task deserves a fresh context and a review.

- Give each plan a workspace and a progress ledger in that workspace.

- Create the ledger with the plan identity as its first line when no ledger exists.

- Treat the ledger as your recovery map and record commits and findings in it.

- Dispatch one implementer subagent per task and never dispatch multiple implementation subagents in parallel.

- Use `subagent.spawn` to dispatch an implementer in Muse.

- Give the implementer one task and not the session history.

- Carry a parked finding into the next task when it touches the same area.

- Record the implementer identity from the dispatch result in the ledger.

- Hand the reviewer the task brief and the implementer diff as a file.

- Give the reviewer the same brief and the diff and the global constraints block as its attention focus.

- Ask the reviewer to check spec compliance and code quality and do not pre judge its findings.

- Do not ask a reviewer to re run tests the implementer already ran on the same code.

- Record a task as complete in the ledger only after its review is clean.

- Park a finding in the ledger when it is out of scope for the current task and record how many findings were parked.

- Run a whole branch review at the end after every task review is clean.

- Choose a cheap model for a task that touches one or two files with a complete spec.

- Choose a standard model for a task with multiple files and integration concerns.

- Choose the most capable model for a task that needs design judgment or broad codebase understanding.

## Executing plans

- Use this section when you have an approved plan and you will implement every task yourself in this session.

- Give each plan a workspace and a progress ledger in that workspace.

- Create the ledger with the plan identity as its first line when no ledger exists.

- Mark a task todo in progress before you start it.

- Run the tests the brief names and read their output in full.

- Compare every expected line in the brief against real output.

- Record every deviation from the brief with a ruling line in the ledger.

- Use systematic debugging when the code is wrong.

- Stop and revise the plan when a step contradicts the spec or when an interface from an earlier task is wrong.

- Treat the final test run for a task as the task done signal.

- Run a final review after the last task and send critical and important findings into a fix pass.

- Record minor findings in the ledger as deferred with a one line summary.

- Finish only after the final review and the fix pass are done.

## Verification before completion

- Verify before you claim success or completion or correctness.

- Identify the command that proves a claim before you make the claim.

- Run the full command fresh and complete and read the full output and check the exit code and count failures.

- Make the claim only when the output confirms it.

- Never use wording such as should or probably or seems to in place of verification.

- Never express satisfaction before verification with words such as great or perfect or done.

- Never commit or push or open a pull request without verification.

- Never trust an agent success report without running the verification yourself.

- Never rely on partial verification.

- Apply this gate to any claim of success and any expression of satisfaction and any positive statement about work state and any move to the next task and any delegation to another agent.

## Code review and worktrees

- Request a code review when a branch is ready and give the reviewer the diff and the plan and the constraints.

- Receive a code review by reading each finding and deciding whether to fix it now or park it in the ledger.

- Use a git worktree for parallel development only when the user asks for it or when the plan calls for it.

- Create an isolated branch and workspace after design approval when you use a worktree.

- Clean up the worktree when the work is done.

- Finish a development branch only after tests pass and verification is clean and the final review is clean.

- Offer to merge or open a pull request only after that finish check.

## Source and limits

- Adapted from Superpowers by Jesse Vincent under the MIT License.

- Source repository is https://github.com/obra/superpowers

- The upstream system ships fourteen skills and a bootstrap skill and hooks and scripts and a plugin marketplace.

- This Muse skill keeps the core methodology and seven key workflows as sections in one file.

- The seven workflows are brainstorming and writing plans and test driven development and systematic debugging and subagent driven development and executing plans and verification before completion.

- The upstream skills for diagnosing Superpowers and for writing skills and for requesting and receiving code review and for using git worktrees and for finishing a development branch are summarized only where they touch the workflows above.

- The upstream hooks and scripts were not copied and were not run in Muse.

- The upstream plugin marketplace and the upstream Muse plugin install commands were not run.

- Install this skill as a custom skill in Muse and discover it with `muse.skill_search`.

- Use `subagent.spawn` for subagents in Muse and do not use Claude Code or Codex subagent tool names from the upstream text.

- Keep plans and ledgers in the workspace and use git only when the user project already uses git.

- Treat upstream claims about autonomous work for hours at a time as upstream claims and not as a promise in Muse.

## Available connectors

- Use `muse.connector_search` to find other connectors and `muse.skill_search` to find related skills.

- If nothing here fits, look on the web for a maintained API or MCP server and set it up with [Custom Connectors and MCPs](/opt/muse/skills/custom-connector-setup/SKILL.md), or build a custom connector.
