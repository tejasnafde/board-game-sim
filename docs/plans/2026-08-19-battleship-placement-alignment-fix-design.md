# Battleship Placement Alignment Fix

## Problem

Battleship ship artwork aligns with highlighted cells at 0 and 90 degrees, but
drifts to the opposite side of the anchor at 180 and 270 degrees. The rules
correctly build those footprints leftward and upward; the presentation layer
always places its overlay rightward and downward.

## Design

Keep `PlacementDraft` and `buildCellsFromAnchor` unchanged. For every placed
ship, derive the overlay rectangle from the cells returned by
`buildCellsFromAnchor`: its grid start is the minimum row and column, and its
span is the footprint width and height. The highlighted cells and artwork then
share the same source of truth for all four rotations.

The image remains centered inside that overlay. Placement, collision checks,
submission, and server contracts do not change.

## Alternatives Rejected

- Rewriting anchors during rotation would change interaction semantics and
  could affect placement validation.
- Rotation-specific CSS calculations would duplicate rule logic in styling and
  remain harder to verify.

## Verification

- Unit coverage asserts overlay grid starts and spans at 180 and 270 degrees.
- Browser coverage compares each selected overlay rectangle with the union of
  its highlighted cells for all four rotations.
- The full unit, typecheck, build, and browser suites remain green before push.
