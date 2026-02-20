# Contributing Vision

## Non-Negotiable Rules

- Server-authoritative only.
- No direct client-side state mutation.
- All games implement contract tests.
- Sessions are pinned to `gameId@version`.
- Protocol and contract changes must update docs in the same PR.

## Collaboration Workflow

1. Propose scope with architecture impact.
2. Implement smallest coherent slice.
3. Add/extend tests before merge.
4. Document any contract/protocol adjustments.

## Review Focus

- Safety against illegal actions.
- Hidden information leakage risks.
- Determinism and replay integrity.
