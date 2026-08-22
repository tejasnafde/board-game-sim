import { findPath, shiftBoard, shiftPosition, type Tile } from "@board-game-sim/labyrinth";
import type { TableSummary } from "@board-game-sim/shared";
import { useMemo, useState } from "react";
import { objectiveIcon } from "../../icons";
import type { AcceptedAction } from "../../realtime-state";
import { humanizeError } from "../../templates/lobby";
import type { LabyrinthView } from "./types";

type Edge = "top" | "bottom" | "left" | "right";
type Openings = Record<"N" | "E" | "S" | "W", boolean>;
type Coord = { row: number; col: number };

const PLAYER_COLORS = ["player-color-0", "player-color-1", "player-color-2", "player-color-3"];
const PLAYER_INITIALS = ["P1", "P2", "P3", "P4"];
const OPPOSITE_EDGE: Record<string, string> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left"
};
const ORDINALS = ["1st", "2nd", "3rd", "4th"];

export type LabyrinthGameViewProps = {
  view: LabyrinthView;
  table?: TableSummary | null;
  mySeat: string;
  seatNames: Record<string, string>;
  lastError?: string | null;
  acceptedActions: AcceptedAction[];
  logs: string[];
  pending: boolean;
  onRotate(rotationDeg: 0 | 90 | 180 | 270): void;
  onInsert(edge: Edge, index: number): void;
  onMove(row: number, col: number): void;
  onRematch(): void;
};

function ObjectiveIcon({ id, size = 15 }: { id: string; size?: number }) {
  return <span dangerouslySetInnerHTML={{ __html: objectiveIcon(id, size) }} />;
}

function TileCorridors({ openings }: { openings: Openings }) {
  const width = 28;
  const start = 50 - width / 2;
  const hasPath = openings.N || openings.E || openings.S || openings.W;
  return <svg className="tile-svg" viewBox="0 0 100 100" aria-hidden="true">
    <rect width="100" height="100" fill="#0e2010" />
    {hasPath && <rect x={start} y={start} width={width} height={width} fill="#4ade80" rx="2" />}
    {openings.N && <rect x={start} y="0" width={width} height="50" fill="#4ade80" />}
    {openings.S && <rect x={start} y="50" width={width} height="50" fill="#4ade80" />}
    {openings.W && <rect x="0" y={start} width="50" height={width} fill="#4ade80" />}
    {openings.E && <rect x="50" y={start} width="50" height={width} fill="#4ade80" />}
  </svg>;
}

function InsertControls(input: {
  edge: Edge;
  count: number;
  indexes: number[];
  enabled: boolean;
  lastInsertion?: { edge: string; index: number } | null;
  pending: boolean;
  onPreview(insertion: { edge: Edge; index: number } | null): void;
  onInsert(edge: Edge, index: number): void;
}) {
  const vertical = input.edge === "left" || input.edge === "right";
  const arrow = { top: "▼", bottom: "▲", left: "▶", right: "◀" }[input.edge];
  return <div
    className={vertical ? `insert-col-${input.edge}` : `insert-row-${input.edge}`}
    style={vertical
      ? { gridTemplateRows: `repeat(${input.count}, minmax(0, 1fr))` }
      : { gridTemplateColumns: `repeat(${input.count}, minmax(0, 1fr))` }}
  >
    {Array.from({ length: input.count }, (_, index) => {
      if (!input.indexes.includes(index)) return <div key={index} />;
      const reverse = !!input.lastInsertion
        && OPPOSITE_EDGE[input.lastInsertion.edge] === input.edge
        && input.lastInsertion.index === index;
      const axis = vertical ? "row" : "column";
      return <button
        aria-label={`Insert spare tile from ${input.edge} into ${axis} ${index + 1}`}
        className={`insert-btn labyrinth-insert-btn ${input.lastInsertion?.edge === input.edge && input.lastInsertion.index === index ? "just-used" : ""}`}
        data-edge={input.edge}
        data-index={index}
        disabled={!input.enabled || input.pending || reverse}
        key={index}
        onClick={() => input.onInsert(input.edge, index)}
        onBlur={() => input.onPreview(null)}
        onFocus={() => input.onPreview({ edge: input.edge, index })}
        onMouseEnter={() => input.onPreview({ edge: input.edge, index })}
        onMouseLeave={() => input.onPreview(null)}
      >{arrow}</button>;
    })}
  </div>;
}

function activityItems(
  actions: AcceptedAction[],
  view: LabyrinthView,
  mySeat: string,
  nameOf: (seat?: string | null) => string
): Array<{ key: string; text: string; danger?: boolean }> {
  const items: Array<{ key: string; text: string; danger?: boolean }> = [];
  for (const action of actions.slice(-6).reverse()) {
    for (const [eventIndex, raw] of action.events.entries()) {
      const event = raw as {
        eventType?: string;
        payload?: { playerId?: string; objectiveId?: string; rank?: number; edge?: Edge; index?: number };
      };
      const actor = event.payload?.playerId ?? action.actorPlayerId;
      const who = actor === mySeat ? "You" : nameOf(actor) || "Someone";
      if (event.eventType === "tile.inserted" && event.payload?.edge && event.payload.index !== undefined) {
        const direction = { top: "down", bottom: "up", left: "right", right: "left" }[event.payload.edge];
        const axis = event.payload.edge === "top" || event.payload.edge === "bottom" ? "column" : "row";
        items.push({ key: `${action.seq}-${eventIndex}`, text: `${who} shifted ${axis} ${event.payload.index + 1} ${direction}` });
      }
      if (event.eventType === "objective.collected" && event.payload?.objectiveId) {
        items.push({ key: `${action.seq}-${eventIndex}`, text: `${who} collected the ${event.payload.objectiveId}` });
      }
      if (event.eventType === "player.finished" && event.payload?.rank) {
        items.push({ key: `${action.seq}-${eventIndex}`, text: `${who} finished ${ORDINALS[event.payload.rank - 1] ?? `#${event.payload.rank}`}!` });
      }
    }
  }
  for (const player of view.players ?? []) {
    if (player.playerId !== mySeat && player.objectivesRemainingCount === 0 && !player.finishedRank && view.phase === "play") {
      items.push({
        key: `home-${player.playerId}`,
        text: `${nameOf(player.playerId)} has every objective - racing home!`,
        danger: true
      });
    }
  }
  return items;
}

export function LabyrinthGameView({
  view,
  table,
  mySeat,
  seatNames,
  lastError,
  acceptedActions,
  logs,
  pending,
  onRotate,
  onInsert,
  onMove,
  onRematch
}: LabyrinthGameViewProps) {
  const [hovered, setHovered] = useState<Coord | null>(null);
  const [previewInsertion, setPreviewInsertion] = useState<{ edge: Edge; index: number } | null>(null);
  const board = view.board ?? [];
  const players = view.players ?? [];
  const nameOf = (seat?: string | null) => seat ? seatNames[seat] ?? seat : "";
  const terminal = view.phase === "terminal";
  const tableReady = table?.ready !== false;
  const myTurn = tableReady && !terminal && view.currentPlayerId === mySeat;
  const insertStage = view.turnStage === "insert";
  const moveStage = view.turnStage === "move";
  const insertionIndexes = view.config?.insertionIndexes ?? [1, 3, 5];
  const currentObjective = view.myState?.currentObjective ?? null;
  const rows = board.length || view.config?.rows || 7;
  const cols = board[0]?.length || view.config?.cols || 7;
  const preview = useMemo(() => {
    if (!previewInsertion || !view.spareTile?.openings || board.length === 0) return null;
    const shifted = shiftBoard(board as Tile[][], view.spareTile as Tile, previewInsertion, { rows, cols });
    return {
      board: shifted.board,
      positions: new Map(players.map((player) => [
        player.playerId,
        shiftPosition(player.position, previewInsertion, { rows, cols })
      ]))
    };
  }, [board, cols, players, previewInsertion, rows, view.spareTile]);
  const displayBoard = preview?.board ?? board;
  const reachable = new Set<string>((view.myState?.reachableCells ?? []).map((cell) => `${cell.row}:${cell.col}`));
  const nextObjective = currentObjective?.id;
  const playerIndex = new Map(players.map((player, index) => [player.playerId, index]));
  const homeOwners = new Map<string, number>(players.flatMap((player, index) => player.home
    ? [[`${player.home.row}:${player.home.col}`, index] as const]
    : []));
  const previewPath = useMemo(() => {
    if (!hovered || !moveStage || !view.myState?.position || board.length === 0) return new Set<string>();
    const path = findPath(
      board as Tile[][],
      { rows, cols },
      view.myState.position,
      hovered
    );
    return new Set((path ?? []).map((cell) => `${cell.row}:${cell.col}`));
  }, [board, cols, hovered, moveStage, rows, view.myState?.position]);
  const items = activityItems(acceptedActions, view, mySeat, nameOf);

  if (board.length === 0) {
    return <section className="screen labyrinth-screen">
      <div className="section-head"><h1>Labyrinth</h1></div>
      <div className="card labyrinth-waiting-card">
        <div className="waiting-dot" />
        <h3>Waiting for the game to start…</h3>
        <p>The maze will appear once all players have joined.</p>
        <div className="labyrinth-waiting-players">
          <div className="label">Players joined</div>
          {players.length ? players.map((player) => <div key={player.playerId}>{nameOf(player.playerId)}</div>) : <div>Waiting for players…</div>}
        </div>
      </div>
    </section>;
  }

  const currentName = nameOf(view.currentPlayerId);
  const missingHumans = table ? table.humanSeats - table.claimedHumanSeats : 0;
  const status = !tableReady
    ? `Waiting for ${missingHumans} more player${missingHumans === 1 ? "" : "s"}`
    : myTurn && insertStage
      ? "Your turn - insert the spare tile using an arrow button"
      : myTurn && moveStage
      ? "Now move your pawn - click a highlighted cell"
      : currentName.startsWith("Computer")
        ? `${currentName} is thinking`
        : `Waiting for ${currentName || "other player"}`;

  return <section className="screen labyrinth-screen">
    <header className="labyrinth-play-header">
      <div className="labyrinth-title-block">
        <div className="labyrinth-kicker">Shifting maze · {players.length} player{players.length === 1 ? "" : "s"}</div>
        <h1>Labyrinth</h1>
      </div>
      {terminal
        ? <div className="status-banner terminal-banner">
            <span className="terminal-heading"><strong>{view.winnerPlayerId === mySeat
              ? "You conquered the maze!"
              : `${nameOf(view.winnerPlayerId)} conquered the maze!`}</strong></span>
            <span className="terminal-actions">
              <button className="btn btn-primary" id="rematch-btn" onClick={onRematch}>Play Again</button>
              <a className="btn btn-ghost" href="#/">Back to Hub</a>
            </span>
          </div>
        : <div className={`status-banner labyrinth-turn-status ${myTurn ? "your-turn" : "their-turn"}`} aria-live="polite">
            <span className="turn-index">{insertStage ? "01" : "02"}</span>
            <span>{status}</span>
          </div>}
      {lastError && <div className="error-text" role="alert">{humanizeError(lastError)}</div>}
      <div className="turn-progress" aria-label={`Turn progress: ${insertStage ? "Insert" : "Move"}`}>
        <span className={insertStage ? "active" : "complete"}>01 Insert</span>
        <span className={moveStage ? "active" : ""}>02 Move</span>
      </div>
    </header>
    <div className="gameplay-screen labyrinth-gameplay">
      <div className="card board-panel labyrinth-board-panel">
        <div id="labyrinth-insert-controls">
          <div className="labyrinth-insert-ring">
            <div className="spare-tile-wrap">
              <div className="spare-tile-box" key={view.spareTile?.rotationDeg ?? 0}>
                <TileCorridors openings={view.spareTile?.openings ?? { N: false, E: false, S: false, W: false }} />
                {view.spareTile?.objectiveId && <div className="objective-marker"><ObjectiveIcon id={view.spareTile.objectiveId} size={13} /></div>}
              </div>
              <div className="spare-tile-copy">
                <div className="label spare-tile-label">Spare Tile</div>
                <div className="spare-rotate-controls">
                  <button aria-label="Rotate spare tile counterclockwise" className="spare-rotate-btn" disabled={!myTurn || !insertStage || pending} onClick={() => onRotate((((view.spareTile?.rotationDeg ?? 0) + 270) % 360) as 0 | 90 | 180 | 270)}>↺</button>
                  <span className="spare-rotation-readout">{view.spareTile?.rotationDeg ?? 0}°</span>
                  <button aria-label="Rotate spare tile clockwise" className="spare-rotate-btn" disabled={!myTurn || !insertStage || pending} onClick={() => onRotate((((view.spareTile?.rotationDeg ?? 0) + 90) % 360) as 0 | 90 | 180 | 270)}>↻</button>
                </div>
              </div>
            </div>
            <InsertControls edge="top" count={cols} indexes={insertionIndexes} enabled={myTurn && insertStage} lastInsertion={view.lastInsertion} pending={pending} onPreview={setPreviewInsertion} onInsert={onInsert} />
            <InsertControls edge="left" count={rows} indexes={insertionIndexes} enabled={myTurn && insertStage} lastInsertion={view.lastInsertion} pending={pending} onPreview={setPreviewInsertion} onInsert={onInsert} />
            <div className="labyrinth-board-center" data-preview-edge={previewInsertion?.edge} id="labyrinth-board" role="group" aria-label="Maze board" onMouseLeave={() => setHovered(null)}>
              <div className="labyrinth-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {displayBoard.flatMap((row, rowIndex) => row.map((tile, colIndex) => {
                  const key = `${rowIndex}:${colIndex}`;
                  const playersHere = players.filter((player) => {
                    const position = preview?.positions.get(player.playerId) ?? player.position;
                    return position.row === rowIndex && position.col === colIndex;
                  });
                  const actionable = myTurn && moveStage && reachable.has(key) && !pending;
                  const next = tile.objectiveId === nextObjective;
                  const classes = ["labyrinth-cell"];
                  if (actionable) classes.push("reachable");
                  if (next) classes.push("next-objective");
                  if (previewInsertion && ((previewInsertion.edge === "top" || previewInsertion.edge === "bottom") ? previewInsertion.index === colIndex : previewInsertion.index === rowIndex)) classes.push("insertion-preview");
                  if (previewPath.has(key) && hovered) classes.push(key === `${hovered.row}:${hovered.col}` ? "path-target" : "path-step");
                  const label = [
                    `Row ${rowIndex + 1}, column ${colIndex + 1}`,
                    tile.objectiveId ? `objective ${tile.objectiveId}` : "",
                    playersHere.length ? `${playersHere.length} player${playersHere.length === 1 ? "" : "s"}` : "",
                    next ? "your next objective" : "",
                    actionable ? "reachable" : ""
                  ].filter(Boolean).join(", ");
                  return <button
                    aria-label={label}
                    className={classes.join(" ")}
                    data-c={colIndex}
                    data-lab-cell="1"
                    data-r={rowIndex}
                    disabled={!actionable}
                    key={key}
                    onClick={() => onMove(rowIndex, colIndex)}
                    onMouseEnter={() => actionable && setHovered({ row: rowIndex, col: colIndex })}
                  >
                    <TileCorridors openings={tile.openings} />
                    {tile.objectiveId && <div className={`objective-marker ${next ? "next" : ""}`} title={tile.objectiveId}><ObjectiveIcon id={tile.objectiveId} /></div>}
                    {homeOwners.has(key) && <div className={`home-marker owner-${homeOwners.get(key)}`} title={homeOwners.get(key) === playerIndex.get(mySeat) ? "your home" : "home corner"}>H</div>}
                    {playersHere.map((player) => {
                      const index = playerIndex.get(player.playerId) ?? 0;
                      return <div className={`player-token ${PLAYER_COLORS[index] ?? PLAYER_COLORS[0]}`} key={player.playerId}>{PLAYER_INITIALS[index] ?? player.playerId.slice(0, 2).toUpperCase()}</div>;
                    })}
                  </button>;
                }))}
              </div>
            </div>
            <InsertControls edge="right" count={rows} indexes={insertionIndexes} enabled={myTurn && insertStage} lastInsertion={view.lastInsertion} pending={pending} onPreview={setPreviewInsertion} onInsert={onInsert} />
            <InsertControls edge="bottom" count={cols} indexes={insertionIndexes} enabled={myTurn && insertStage} lastInsertion={view.lastInsertion} pending={pending} onPreview={setPreviewInsertion} onInsert={onInsert} />
          </div>
        </div>
      </div>
      <aside className="side-stack">
        <div className="card side-card">
          <h2>Your objective</h2>
          {currentObjective
            ? <div className="objectives-list"><div className="objective-item is-next"><ObjectiveIcon id={currentObjective.id} /><span>Find {currentObjective.id}{currentObjective.position ? <small>Row {currentObjective.position.row + 1} · Column {currentObjective.position.col + 1}</small> : null}</span></div></div>
            : <div className="objectives-complete">All collected! Return home!</div>}
        </div>
        <div className="card side-card">
          <h2>Players</h2>
          <div className="labyrinth-players">{players.map((player, index) => <div className={`labyrinth-player ${player.playerId === view.currentPlayerId ? "is-current" : ""} ${player.playerId === mySeat ? "is-me" : ""}`} key={player.playerId}>
            <div className={`player-token labyrinth-player-token ${PLAYER_COLORS[index] ?? PLAYER_COLORS[0]}`}>{PLAYER_INITIALS[index] ?? `P${index + 1}`}</div>
            <div className="labyrinth-player-copy">
              <div className="labyrinth-player-name">{nameOf(player.playerId)}{player.playerId === mySeat ? " (you)" : ""}</div>
              <div className="labyrinth-player-meta"><span className="num">{player.objectivesRemainingCount}</span> objective{player.objectivesRemainingCount === 1 ? "" : "s"} left</div>
              {!!player.collectedObjectiveIds?.length && <div className="labyrinth-player-trophies" aria-label={`${player.collectedObjectiveIds.length} collected treasure${player.collectedObjectiveIds.length === 1 ? "" : "s"}`}>
                {player.collectedObjectiveIds.map((objectiveId) => <span aria-label={`Collected ${objectiveId}`} className="labyrinth-player-trophy" key={objectiveId} title={objectiveId}><ObjectiveIcon id={objectiveId} size={12} /></span>)}
              </div>}
            </div>
          </div>)}</div>
        </div>
        <div className="card side-card activity-card">
          <h2>Recent activity</h2>
          <div className="activity-feed" role="log" aria-label="Recent activity" aria-live="polite">
            {items.map((item) => <div className={`activity-line ${item.danger ? "danger" : ""}`} key={item.key}>{item.text}</div>)}
          </div>
        </div>
        <details className="card debug-panel"><summary>Diagnostics</summary><pre>{logs.slice(0, 15).join("\n") || "No events yet"}</pre></details>
      </aside>
    </div>
  </section>;
}
