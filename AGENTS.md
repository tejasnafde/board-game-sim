# Repository Collaboration Rules

This file defines non-negotiable standards for human and AI collaborators.

## Vision Guardrails

- Keep the server authoritative for all gameplay state changes.
- Clients submit intents, never direct state patches.
- Every session is pinned to a `gameId@version` pair.
- Preserve deterministic rule execution for replay and audits.
- Hidden information must be enforced in `getPlayerView`.

## Architecture Rules

- Static game data belongs in `definition.json`.
- Dynamic behavior belongs in per-game rule modules.
- Persist game history as append-only events plus snapshots.
- Any protocol or contract break requires corresponding documentation updates.

## Testing Rules

- New game modules must include contract and behavior tests.
- Illegal actions must be tested for safe rejection.
- Determinism checks are required for merge readiness.

## Change Management

- Prefer small PRs with explicit architectural intent.
- Keep docs in `documentation/` in sync with code changes.
- Do not merge breaking interface changes without versioning strategy updates.
