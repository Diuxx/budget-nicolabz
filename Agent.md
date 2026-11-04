
# AI Development Guidelines

## Core Principles
- Prioritize human readability and maintainability.
- Follow the existing project architecture and conventions.
- Prefer simple, explicit solutions over clever abstractions.
- Apply SOLID, KISS, DRY and YAGNI pragmatically.
- Avoid unnecessary dependencies and overengineering.

## Code Structure
- Give each method a clear, coherent responsibility.
- Extract complex business rules into well-named methods.
- Prefer guard clauses to deeply nested conditions.
- Keep business logic separate from I/O and persistence.
- Favor composition over inheritance when appropriate.
- Use descriptive names for classes, methods and variables.

## Changes
- Inspect existing code before modifying it.
- Make the smallest coherent change.
- Preserve existing behavior unless explicitly requested.
- Do not refactor unrelated code.
- Explain significant architectural decisions.

## Reliability
- Validate external inputs.
- Handle errors explicitly without hiding failures.
- Never hardcode secrets.
- Add proportionate tests for changed behavior.
- Never claim tests passed unless they were executed.

## Architecture

- Read `docs/ARCHITECTURE.md` before implementing structural changes.
- Follow the documented architecture and dependency rules.
- Inspect existing implementations before introducing new patterns.
- Do not create new architectural layers without a concrete need.
- If a requested change conflicts with the architecture, explain the conflict.
- Update `docs/ARCHITECTURE.md` when structural changes are made.
- Document significant decisions in `docs/adr/`.

## Before Completion
- Review the changes for unnecessary complexity.
- Remove dead code and redundant abstractions.
- Report what changed, what was tested and any limitations.
- reply in french
