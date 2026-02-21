export { inferBattleshipScreen } from "./selectors";
export {
  renderBattleshipLobby,
  renderBattleshipSetup,
  renderBattleshipGameplay,
  renderPlacementBoardMarkup
} from "./render";
export { bindBattleshipEvents, type BattleshipBindContext } from "./bind-events";
export {
  buildCellsFromAnchor,
  canPlaceWithoutCollision,
  clampDraftToBoard,
  createPlacementsFromDrafts,
  createRandomizedPlacements,
  isInBounds,
  placementsToDraftMap,
  rotateClockwise
} from "./placement-utils";
export type { BattleshipDefinition, ClientView, PlacementDraft, ShipSpec } from "./types";
