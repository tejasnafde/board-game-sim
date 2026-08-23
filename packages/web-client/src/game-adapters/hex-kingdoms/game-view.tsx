import {
  axialKey,
  coordinatesInRadius,
  type AxialCoord,
  type TableSummary
} from "@board-game-sim/shared";
import {
  scoreHexKingdomPlayer,
  type HexKingdomsView,
  type HexPlacement,
  type HexTile
} from "@board-game-sim/hex-kingdoms";
import { useState } from "react";
import { CardZone } from "../../components/card-zone";
import { HexBoard, type HexBoardCell } from "../../components/hex-board";

const TERRAIN_LABEL = {
  meadow: "Meadow",
  forest: "Forest",
  mountain: "Mountain",
  water: "Water"
} as const;

const FEATURE_LABEL = {
  plain: "Open land",
  village: "Village",
  keep: "Keep",
  shrine: "Shrine"
} as const;

const FEATURE_MARK = { plain: "", village: "V", keep: "K", shrine: "S" } as const;

type KingdomCell = HexBoardCell & {
  kind: "empty" | "capital" | "landmark" | "tile";
  placement?: HexPlacement;
  ownerPlayerId?: string;
  legal: boolean;
};

export type HexKingdomsGameViewProps = {
  view: HexKingdomsView;
  table?: TableSummary | null;
  mySeat: string;
  seatNames: Record<string, string>;
  selectedTileId: string | null;
  pending: boolean;
  onSelectTile(tileId: string): void;
  onPlace(tileId: string, coordinate: AxialCoord): void;
  onRematch(): void;
};

function tileFace(tile: HexTile) {
  return <span className={`hk-tile-face terrain-${tile.terrain}`}>
    <span className="hk-tile-terrain">{TERRAIN_LABEL[tile.terrain]}</span>
    <span className="hk-tile-feature">
      <span className="hk-feature-mark" aria-hidden="true">{FEATURE_MARK[tile.feature]}</span>
      {FEATURE_LABEL[tile.feature]}
    </span>
  </span>;
}

function scoreDelta(view: HexKingdomsView, tile: HexTile, coordinate: AxialCoord, playerId: string) {
  const before = view.scores[playerId]!;
  const after = scoreHexKingdomPlayer({
    players: view.players,
    capitals: view.capitals,
    landmarks: view.landmarks,
    placements: [...view.placements, {
      tileId: tile.id,
      ownerPlayerId: playerId,
      coordinate,
      terrain: tile.terrain,
      feature: tile.feature
    }],
    scoring: view.config.scoring
  }, playerId);
  return {
    total: after.total - before.total,
    crownlands: after.crownlands - before.crownlands,
    provinces: Object.values(after.provinces).reduce((sum, value) => sum + value, 0)
      - Object.values(before.provinces).reduce((sum, value) => sum + value, 0),
    diversity: after.diversity - before.diversity,
    features: Object.values(after.features).reduce((sum, value) => sum + value, 0)
      - Object.values(before.features).reduce((sum, value) => sum + value, 0),
    landmarks: after.landmarks - before.landmarks
  };
}

export function HexKingdomsGameView(props: HexKingdomsGameViewProps) {
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const view = props.view;
  const tableReady = props.table?.ready !== false;
  const terminal = view.phase === "terminal";
  const canAct = tableReady && view.canAct && !props.pending && !terminal;
  const selectedTile = view.market.find((tile) => tile.id === props.selectedTileId) ?? null;
  const legalKeys = new Set(view.legalCoordinates.map(axialKey));
  const placementByKey = new Map(view.placements.map((placement) => [axialKey(placement.coordinate), placement]));
  const capitalByKey = new Map(Object.entries(view.capitals).map(([playerId, coordinate]) => [axialKey(coordinate), playerId]));
  const landmarkKeys = new Set(view.landmarks.map(axialKey));
  const layout = view.config.layouts[view.players.length as 2 | 3 | 4];
  const nameOf = (playerId: string) => props.seatNames[playerId] ?? playerId;

  const cells: KingdomCell[] = coordinatesInRadius(layout.radius).map((coordinate) => {
    const key = axialKey(coordinate);
    const placement = placementByKey.get(key);
    const capitalOwner = capitalByKey.get(key);
    const landmark = landmarkKeys.has(key);
    const legal = canAct && Boolean(selectedTile) && legalKeys.has(key);
    const kind = placement ? "tile" : capitalOwner ? "capital" : landmark ? "landmark" : "empty";
    const label = placement
      ? `${TERRAIN_LABEL[placement.terrain]} ${FEATURE_LABEL[placement.feature]}, owned by ${nameOf(placement.ownerPlayerId)}, coordinates ${coordinate.q}, ${coordinate.r}`
      : capitalOwner
        ? `${nameOf(capitalOwner)} capital, coordinates ${coordinate.q}, ${coordinate.r}`
        : landmark
          ? `Neutral landmark, coordinates ${coordinate.q}, ${coordinate.r}`
          : `${legal ? "Legal frontier" : "Empty land"}, coordinates ${coordinate.q}, ${coordinate.r}`;
    return {
      key,
      coordinate,
      ariaLabel: label,
      kind,
      placement,
      ownerPlayerId: capitalOwner ?? placement?.ownerPlayerId,
      legal,
      disabled: !legal,
      className: [
        legal ? "is-legal" : "",
        `is-${kind}`,
        placement ? `terrain-${placement.terrain}` : "",
      ].filter(Boolean).join(" ")
    };
  });

  const previewCell = previewKey ? cells.find((cell) => cell.key === previewKey) : null;
  const preview = selectedTile && previewCell?.legal
    ? scoreDelta(view, selectedTile, previewCell.coordinate, props.mySeat)
    : null;
  const missingHumans = props.table
    ? props.table.humanSeats - props.table.claimedHumanSeats
    : 0;
  const currentName = nameOf(view.currentPlayerId);
  const status = !tableReady
    ? `Waiting for ${missingHumans} more player${missingHumans === 1 ? "" : "s"}`
    : terminal
      ? "Final scoring complete"
      : view.currentPlayerId !== props.mySeat
        ? `Waiting for ${currentName}`
        : selectedTile
          ? "Place on a highlighted frontier hex"
          : "Choose a tile from the market";

  return <section className="screen hex-kingdoms-screen">
    <header className="hk-header">
      <div>
        <div className="hk-kicker">Crownlands survey · round {view.round}</div>
        <h1>Hex Kingdoms</h1>
      </div>
      <div className={`hk-turn-status ${canAct ? "is-active" : ""}`} aria-live="polite">
        <span className="hk-turn-count">{Math.min(view.turnIndex + 1, view.turnsTotal)} / {view.turnsTotal}</span>
        <span>{status}</span>
      </div>
    </header>

    {terminal && <div className="status-banner terminal-banner hk-terminal">
      <strong>{view.winnerPlayerIds.length > 1
        ? `Shared victory — ${view.winnerPlayerIds.map(nameOf).join(" & ")}`
        : view.winnerPlayerId === props.mySeat
          ? "Your realm prevails"
          : `${nameOf(view.winnerPlayerId ?? "")} prevails`}</strong>
      <span className="terminal-actions">
        <button className="btn btn-primary" onClick={props.onRematch}>Play Again</button>
        <a className="btn btn-ghost" href="#/">Back to Hub</a>
      </span>
    </div>}

    <div className="hk-layout">
      <main className="hk-map-panel">
        <div className="hk-panel-label"><span>Territory map</span><span>{view.placements.length} placed</span></div>
        <HexBoard
          label="Kingdom map"
          cells={cells}
          onHexPreview={setPreviewKey}
          onHexPress={(key) => {
            const cell = cells.find((candidate) => candidate.key === key);
            if (selectedTile && cell?.legal) props.onPlace(selectedTile.id, cell.coordinate);
          }}
          renderHex={(cell) => cell.kind === "tile" && cell.placement
            ? <span className="hk-board-tile">
                <span className="hk-board-terrain">{TERRAIN_LABEL[cell.placement.terrain].slice(0, 1)}</span>
                {cell.placement.feature !== "plain" && <span className="hk-board-feature">{FEATURE_MARK[cell.placement.feature]}</span>}
              </span>
            : cell.kind === "capital"
              ? <span className="hk-capital" aria-hidden="true">C</span>
              : cell.kind === "landmark"
                ? <span className="hk-landmark" aria-hidden="true">◇</span>
                : <span className="hk-empty-coordinate" aria-hidden="true">{cell.coordinate.q}:{cell.coordinate.r}</span>}
        />
      </main>

      <aside className="hk-rail">
        <section className="hk-market-panel">
          <div className="hk-panel-label"><span>Open market</span><span>{view.remainingTileCount} in reserve</span></div>
          <CardZone
            label="Tile market"
            arrangement="row"
            selectedKey={selectedTile?.id}
            onCardPress={props.onSelectTile}
            cards={view.market.map((tile) => ({
              slotKey: tile.id,
              face: tileFace(tile),
              back: null,
              ariaLabel: `${TERRAIN_LABEL[tile.terrain]} ${FEATURE_LABEL[tile.feature]}`,
              disabled: !canAct,
              className: "hk-market-card"
            }))}
          />
          <div className="hk-preview" aria-live="polite">
            {preview
              ? <>
                  <strong>{preview.total >= 0 ? "+" : ""}{preview.total} projected</strong>
                  <span>Crown {preview.crownlands >= 0 ? "+" : ""}{preview.crownlands}</span>
                  <span>Province {preview.provinces >= 0 ? "+" : ""}{preview.provinces}</span>
                  <span>Diversity {preview.diversity >= 0 ? "+" : ""}{preview.diversity}</span>
                  <span>Features {preview.features >= 0 ? "+" : ""}{preview.features}</span>
                  <span>Landmarks {preview.landmarks >= 0 ? "+" : ""}{preview.landmarks}</span>
                </>
              : <span>{selectedTile ? "Focus a highlighted hex to inspect its score." : "Choose a tile, then survey the frontier."}</span>}
          </div>
        </section>

        <section className="hk-score-panel">
          <div className="hk-panel-label"><span>Kingdom ledger</span><span>Live score</span></div>
          {view.players.map((playerId) => {
            const score = view.scores[playerId]!;
            return <article className={`hk-score-row ${playerId === props.mySeat ? "is-you" : ""}`} key={playerId}>
              <div className="hk-score-name"><span>{nameOf(playerId)}{playerId === props.mySeat ? " (you)" : ""}</span><strong>{score.total}</strong></div>
              <div className="hk-score-breakdown">
                <span>Crownlands {score.crownlands}</span>
                <span>Provinces {Object.values(score.provinces).reduce((sum, value) => sum + value, 0)}</span>
                <span>Landmarks {score.landmarks}</span>
              </div>
            </article>;
          })}
        </section>
      </aside>
    </div>
  </section>;
}
