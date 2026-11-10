# API and Interface Design

## When to use

- Use this skill when you design new API endpoints.

- Use this skill when you define module boundaries or contracts between teams.

- Use this skill when you create component prop interfaces or establish a database schema that informs API shape.

- Use this skill when you change an existing public interface.

## Core principles

- Design stable, well-documented interfaces that are hard to misuse, so the right thing is easy and the wrong thing is hard.

- Define the contract first, since the contract is the spec and implementation follows it.

- Prefer addition over modification: add optional fields and never change existing field types or remove fields, since that breaks existing consumers.

- Avoid forcing consumers to choose between multiple versions of the same dependency or API, and extend rather than fork.

## Hyrum's law

- With enough users, every observable behavior of your system will be depended on by somebody, regardless of what you promise in the contract.

- Be intentional about what you expose and do not leak implementation details.

- Plan for deprecation at design time, since every public behavior is a potential commitment.

- Tests are not enough, since safe changes can break real users who depend on undocumented behavior.

## Consistent error semantics

- Pick one error strategy and use it everywhere, so the consumer can predict behavior.

- Use a single structured error shape with a machine-readable code, a human-readable message, and extra details when helpful.

- Map status codes consistently: 400 for invalid data, 401 for not authenticated, 403 for authenticated but not authorized, 404 for not found, 409 for conflict, 422 for validation failure, and 500 for server error without exposing internal details.

- Do not mix patterns where some endpoints throw, others return null, and others return an error object.

## Validate at boundaries

- Trust internal code and validate at system edges where external input enters.

- Validate in API route handlers, form submission handlers, external service response parsing, and environment variable loading.

- Treat third-party API responses as untrusted data and validate their shape and content before using them in logic, rendering, or decisions.

- Do not validate between internal functions that share type contracts, in utility functions called by already-validated code, or on data that just came from your own database.

## Idempotency

- Accepting an idempotency key is the contract, and honouring it is the implementation.

- Derive the key from the intent, not the attempt, so it is stable across retries of one intent and different across distinct intents.

- Claim the key atomically with a unique constraint, since a check followed by an act is a race.

- Guard the payload: the same key with a different body is a client bug and must fail loudly rather than serving the first response to a second request.

- Decide deliberately what an in-flight duplicate gets: reject with 409, wait bounded for the result, or return 202 with a status URL.

- Remember every call has three outcomes, not two: success, failure, and unknown. Record the intent before calling out, so a crash between the call and the response leaves evidence.

- Set key retention from the longest retry chain, including dead-letter replay and provider dispute windows, not from disk cost.

## Predictable naming

- Use plural nouns with no verbs for REST endpoints, such as GET /api/tasks.

- Use camelCase for query params and response fields.

- Prefix boolean fields with is, has, or can.

- Use UPPER_SNAKE for enum values.

## REST patterns

- Design resources as GET for list, POST for create, GET for one, PATCH for partial update, and DELETE for delete.

- Paginate list endpoints with page, page size, total items, and total pages.

- Use query parameters for filters, such as status and assignee.

- Accept partial objects on PATCH, so only the provided fields change.

## Type patterns

- Use discriminated unions for variants, so each variant is explicit and the consumer gets type narrowing.

- Separate input types from output types, since output includes server-generated fields such as id and timestamps.

- Use branded types for IDs, so a UserId cannot be passed where a TaskId is expected.

## Red flags

- Endpoints that return different shapes depending on conditions.

- Inconsistent error formats across endpoints.

- Validation scattered throughout internal code instead of at boundaries.

- Breaking changes to existing fields, such as type changes or removals.

- List endpoints without pagination.

- Verbs in REST URLs, such as /api/createTask.

- Third-party API responses used without validation.

- A SELECT for an idempotency key followed by an INSERT, since that is a race and not a guard.

- A key retention window shorter than the longest path that can re-deliver the request.

## Verification

- Confirm every endpoint has typed input and output schemas.

- Confirm error responses follow a single consistent format.

- Confirm validation happens at system boundaries only.

- Confirm list endpoints support pagination.

- Confirm new fields are additive and optional.

- Confirm naming follows consistent conventions across all endpoints.

- Confirm API documentation or types are committed alongside the implementation.

- Confirm state-changing endpoints either honour an idempotency key or are documented as unsafe to retry.

- Confirm a reused key with a different payload fails loudly rather than replaying the wrong response.

- Confirm the in-flight-duplicate response is a deliberate choice rather than whatever falls out.

## Source and limits

- Adapted from the api-and-interface-design skill in addyosmani/agent-skills by Addy Osmani, MIT licensed.

- Source repository is https://github.com/addyosmani/agent-skills

- The upstream skill is pure Markdown with no scripts, hooks, or plugins, and nothing was run to install it.

- This skill covers API and interface design for a backend expert, including REST patterns, error semantics, validation, and idempotency. It does not cover database schema design in depth, so design the schema to match the contract it serves.

- Use `muse.skill_search` to discover this skill and use the Muse tools in the current session to do the work.

## Available connectors

- Use `muse.connector_search` to find other connectors and `muse.skill_search` to find related skills.

- If nothing here fits, look on the web for a maintained API or MCP server and set it up with [Custom Connectors and MCPs](/opt/muse/skills/custom-connector-setup/SKILL.md), or build a custom connector.
