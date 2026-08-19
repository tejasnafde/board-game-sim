import type { CSSProperties, MouseEvent } from "react";
import { humanizeError } from "../../templates/lobby";
import { renderPlacementBoardMarkup, type ShipPreview } from "./render";
import type { BattleshipDefinition, ClientView, PlacementDraft } from "./types";

type BattleEvent = {
  eventType?: string;
  payload?: {
    at?: { row?: number; col?: number };
    shipId?: string;
  };
};

export type BattleshipGameViewProps = {
  view: ClientView;
  mySeat: string;
  seatNames: Record<string, string>;
  lastError?: string | null;
  lastEvents: unknown[];
  logs: string[];
  boardMarkup: string;
  pending: boolean;
  onFire(row: number, col: number): void;
  onRematch(): void;
};

export type BattleshipSetupViewProps = {
  definition: BattleshipDefinition;
  shipPreview: Record<string, ShipPreview | string>;
  placementDraftMap: Record<string, PlacementDraft>;
  selectedShipId: string;
  waiting: boolean;
  error?: string | null;
  onLoadTemplate(): void;
  onRandomize(): void;
  onRotate(): void;
  onClear(): void;
  onSelectShip(shipId: string): void;
  onPlace(row: number, col: number): void;
  onSubmit(): void;
  onRejoin(): void;
};

const SETUP_ERRORS: Record<string, string> = {
  illegal_action: "Action not allowed - the game may already be in progress. Try rejoining.",
  ship_out_of_bounds: "Ship extends outside the board. Try a different position.",
  ship_overlap_collision: "Ships can't overlap. Choose a clear area.",
  rotation_out_of_bounds: "Not enough space to rotate here.",
  rotation_collision: "Rotating would cause a collision.",
  setup_incomplete_or_invalid: "All ships must be placed before submitting.",
  session_not_found: "Session not found. Check the session ID and try rejoining."
};

function previewFor(input: ShipPreview | string | undefined): ShipPreview {
  return typeof input === "string" ? { url: input, nativeFacing: "north" } : (input ?? { url: "" });
}

function previewRotation(preview: ShipPreview): number {
  const angle = { north: 270, east: 0, south: 90, west: 180 }[preview.nativeFacing ?? "north"];
  return (360 - angle) % 360;
}

export function BattleshipSetupView({
  definition,
  shipPreview,
  placementDraftMap,
  selectedShipId,
  waiting,
  error,
  onLoadTemplate,
  onRandomize,
  onRotate,
  onClear,
  onSelectShip,
  onPlace,
  onSubmit,
  onRejoin
}: BattleshipSetupViewProps) {
  if (waiting) {
    return <section className="screen battleship-screen">
      <div className="section-head"><h1>Battleship Setup</h1></div>
      <div className="waiting-banner">
        <div className="waiting-dot" />
        <span>Fleet submitted! Waiting for opponent to complete their setup…</span>
      </div>
    </section>;
  }

  const allPlaced = definition.ships.every((ship) => placementDraftMap[ship.id]);
  const errorText = error ? SETUP_ERRORS[error] ?? humanizeError(error) : "";
  const boardMarkup = renderPlacementBoardMarkup(
    definition,
    definition.ships,
    placementDraftMap,
    selectedShipId,
    shipPreview
  );
  const boardClick = (event: MouseEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    const ship = target.closest<HTMLElement>(".placement-ship");
    if (ship?.dataset.shipId) {
      onSelectShip(ship.dataset.shipId);
      return;
    }
    const cell = target.closest<HTMLElement>(".placement-cell");
    const row = Number(cell?.dataset.r ?? "-1");
    const col = Number(cell?.dataset.c ?? "-1");
    if (row >= 0 && col >= 0) onPlace(row, col);
  };

  return <section className="screen battleship-screen">
    <div className="section-head">
      <h1>Fleet Deployment</h1>
      <p>Position your fleet before the battle begins. <strong>Click a ship to select it</strong>, then click a cell to place it. Right-click to rotate.</p>
    </div>
    <div className="setup-layout">
      <aside className="card fleet-panel">
        <h3>Fleet Manifest</h3>
        <div className="fleet-ships">
          {definition.ships.map((ship) => {
            const selected = selectedShipId === ship.id;
            const placed = !!placementDraftMap[ship.id];
            const preview = previewFor(shipPreview[ship.id]);
            const style: CSSProperties = {
              width: "auto",
              height: 20,
              transform: `rotate(${previewRotation(preview)}deg)`,
              opacity: selected ? 1 : 0.7
            };
            return <button
              className={`fleet-row fleet-button ${selected ? "active" : ""}`}
              data-ship-id={ship.id}
              key={ship.id}
              onClick={() => onSelectShip(ship.id)}
            >
              <div className="fleet-icons">{preview.url && <img src={preview.url} alt="" style={style} />}</div>
              <span className="ship-name">{ship.id}</span>
              <span className="ship-size num">x{ship.size}</span>
              <span className={`ship-status-dot ${placed ? "placed" : ""}`} role="img" aria-label={placed ? "placed" : "not placed"} />
            </button>;
          })}
        </div>
        <div className="fleet-actions">
          <button className="btn btn-secondary" id="load-template-btn" onClick={onLoadTemplate}>Load Valid Fleet</button>
          <button className="btn btn-ghost" id="random-template-btn" onClick={onRandomize}>Randomize</button>
        </div>
      </aside>
      <section className="card setup-editor">
        <h3>Placement Grid</h3>
        <div className="setup-controls">
          <button className="btn btn-ghost" id="rotate-btn" onClick={onRotate}>Rotate</button>
          <button className="btn btn-ghost" id="clear-ship-btn" onClick={onClear}>Clear</button>
          {errorText && <span className="error-text">{errorText}</span>}
        </div>
        <div
          className="placement-board"
          id="placement-board"
          onClick={boardClick}
          onContextMenu={(event) => { event.preventDefault(); onRotate(); }}
          dangerouslySetInnerHTML={{ __html: boardMarkup }}
        />
        <div className="row-actions setup-submit-actions">
          <button className="btn btn-primary" id="submit-setup-btn" disabled={!allPlaced} onClick={onSubmit}>
            {allPlaced ? "Submit Fleet" : "Place all ships to continue"}
          </button>
          <button className="btn btn-ghost" id="rejoin-btn" onClick={onRejoin}>Rejoin</button>
        </div>
      </section>
    </div>
  </section>;
}

function latestShot(events: unknown[]): { label: string; detail: string; chip: string } {
  let label = "No salvos recorded";
  let detail = "Select a coordinate on the targeting grid.";
  let chip = "";

  for (const raw of events) {
    const event = raw as BattleEvent;
    const at = event.payload?.at;
    const coordinate = at?.row !== undefined && at.col !== undefined
      ? `${String.fromCharCode(65 + at.col)}${at.row + 1}`
      : "";
    if (event.eventType === "shot.miss") {
      label = "Water only";
      detail = coordinate ? `${coordinate} was a miss.` : "The last salvo missed.";
      if (!chip) chip = "Miss";
    }
    if (event.eventType === "shot.hit") {
      label = "Hit confirmed";
      detail = `${coordinate ? `${coordinate} struck` : "Impact on"} ${event.payload?.shipId ?? "a ship"}.`;
      chip = "Hit!";
    }
    if (event.eventType === "ship.sunk") {
      label = "Vessel destroyed";
      detail = `${event.payload?.shipId ?? "Enemy ship"} is beneath the waves.`;
      chip = `Sunk their ${event.payload?.shipId ?? "ship"}!`;
    }
  }

  return { label, detail, chip };
}

export function BattleshipGameView({
  view,
  mySeat,
  seatNames,
  lastError,
  lastEvents,
  logs,
  boardMarkup,
  pending,
  onFire,
  onRematch
}: BattleshipGameViewProps) {
  const terminal = view.phase === "terminal";
  const canFire = !terminal && !pending && view.currentPlayerId === mySeat;
  const nameOf = (seat: string | null | undefined) => seat ? seatNames[seat] ?? seat : "";
  const currentName = nameOf(view.currentPlayerId);
  const opponentName = Object.entries(seatNames).find(([seat]) => seat !== mySeat)?.[1] ?? "Opponent";
  const ownShips = view.ownBoard?.ships ?? [];
  const totalHullCells = ownShips.reduce((count, ship) => count + ship.cells.length, 0);
  const hitsTaken = view.ownBoard?.hitsTaken?.length ?? 0;
  const intactHullCells = Math.max(0, totalHullCells - hitsTaken);
  const fleetPercent = totalHullCells > 0 ? Math.round((intactHullCells / totalHullCells) * 100) : 100;
  const shot = latestShot(lastEvents);

  const fire = (event: MouseEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLElement>(".opponent-cell");
    if (!cell || !canFire) return;
    const row = Number(cell.dataset.r ?? "-1");
    const col = Number(cell.dataset.c ?? "-1");
    if (row >= 0 && col >= 0) onFire(row, col);
  };

  return <section className="screen battleship-screen">
    <header className="battle-command-header">
      <div className="battle-title-block">
        <span className="battle-kicker">Naval command · {opponentName}</span>
        <h1>Live Battle</h1>
      </div>
      {terminal
        ? <div className="status-banner terminal-banner">
            <span className="terminal-heading"><strong>{view.winnerPlayerId === null
              ? "It's a draw!"
              : `${nameOf(view.winnerPlayerId)} wins the battle!`}</strong></span>
            <span className="terminal-detail">The enemy fleet is revealed on the opponent board.</span>
            <span className="terminal-actions">
              <button className="btn btn-primary" id="rematch-btn" onClick={onRematch}>Play Again</button>
              <a className="btn btn-ghost" href="#/">Back to Hub</a>
            </span>
          </div>
        : <div className={`status-banner battle-turn-status ${canFire ? "your-turn" : "their-turn"}`} aria-live="polite">
            <span>{canFire
              ? <>Your turn - click on the <strong>Opponent Board</strong> to fire</>
              : currentName.startsWith("Computer")
                ? <><strong>{currentName}</strong> is thinking<span className="thinking-dots" /></>
                : <>Waiting for <strong>{currentName || "opponent"}</strong></>}
            </span>
          </div>}
      {shot.chip && <div className="battle-result-chip last-result"><span>{shot.chip}</span></div>}
      {lastError && <div className="error-text" role="alert">{humanizeError(lastError)}</div>}
    </header>
    <div className="gameplay-screen battleship-gameplay">
      <div
        className="card board-panel battle-board-panel"
        id="render-view"
        onClick={fire}
        dangerouslySetInnerHTML={{ __html: boardMarkup }}
      />
      <aside className="side-stack battle-side-stack">
        <div className="card side-card fleet-integrity-card">
          <div className="side-card-heading">
            <h2>Fleet integrity</h2>
            <strong className="num">{fleetPercent}%</strong>
          </div>
          <div className="fleet-integrity-track"><span style={{ width: `${fleetPercent}%` }} /></div>
          <p><span className="num">{intactHullCells}</span> of <span className="num">{totalHullCells}</span> hull cells intact</p>
        </div>
        <div className="card side-card salvo-card">
          <h2>Recent salvo</h2>
          <div className="salvo-result"><strong>{shot.label}</strong><span>{shot.detail}</span></div>
        </div>
        <details className="card debug-panel">
          <summary>Diagnostics</summary>
          <pre className="log-pre">{logs.slice(0, 20).join("\n") || "No events yet"}</pre>
        </details>
      </aside>
    </div>
  </section>;
}
