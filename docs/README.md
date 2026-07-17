# Terminus Documentation

This directory contains the product contracts, technical designs, and research
used to guide Terminus. Documentation must distinguish current implementation
from approved future scope.

## Product

- [`../VISION.md`](../VISION.md) — primary user, product promise, principles,
  milestone model, and long-range roadmap.
- [`product/terminus-v0.1-product-brief.md`](product/terminus-v0.1-product-brief.md)
  — acceptance contract for the first public release.
- [`../STATUS.md`](../STATUS.md) — living implementation state and decisions.

## Technical designs

- [E0 Terminal Foundation technical design][e0-design]
  — E0 terminal-foundation architecture and acceptance boundary.

E0 is an internal engineering milestone. It is not synonymous with the v0.1
Public Preview.

## Research

- [`research/warp-terminal-notes.md`](research/warp-terminal-notes.md) — product
  and architecture lessons from Warp, with licensing boundaries.

## Testing

- [`testing/terminal-compatibility-smoke.md`](testing/terminal-compatibility-smoke.md)
  — automated PTY baseline, manual native-app matrix, and current E0 evidence.

## Documentation rules

1. State whether a capability exists, is in the active milestone, or is only a
   future possibility.
2. Link product requirements to the technical design that implements them.
3. Verify development commands against `package.json` and Cargo manifests.
4. Keep core-operation instructions compatible with the local-first,
   no-account product promise.
5. Update `STATUS.md` when implementation evidence changes.

[e0-design]: superpowers/specs/2026-06-22-terminus-e0-terminal-foundation-design.md
