import { humanizeError } from "../../templates/lobby";
import type { Connect4View } from "./types";

const DISC_CLASSES = ["c4-p1", "c4-p2"];

export type Connect4GameViewProps = {
  view: Connect4View;
  mySeat: string;
  seatNames: Record<string, string>;
  lastError?: string | null;
  pending: boolean;
  onDrop(col: number): void;
  onRematch(): void;
};

export function Connect4GameView({
  view,
  mySeat,
  seatNames,
  lastError,
  pending,
  onDrop,
  onRematch
}: Connect4GameViewProps) {
  const players = view.players ?? [];
  const grid = view.grid ?? [];
  const cols = view.config?.cols ?? 7;
  const terminal = view.phase === "terminal";
  const myTurn = !terminal && view.currentPlayerId === mySeat;
  const winning = new Set((view.winningCells ?? []).map((cell) => `${cell.row},${cell.col}`));
  const nameOf = (seat: string | null | undefined) => seat ? seatNames[seat] ?? seat : "";
  const discClassOf = (seat: string | null) => seat === null
    ? ""
    : DISC_CLASSES[players.indexOf(seat)] ?? "c4-p1";
  const result = view.winnerPlayerId
    ? view.winnerPlayerId === mySeat
      ? "You win!"
      : `${nameOf(view.winnerPlayerId)} wins!`
    : "It's a draw!";
  const currentName = nameOf(view.currentPlayerId);

  return <section className="screen connect4-screen connect4-gameplay">
    <div className="section-head">
      <h1><span className="c4-disc-mini c4-p1 c4-title-disc" /> Connect Four</h1>
      {terminal
        ? <div className="status-banner terminal-banner">
            <span className="terminal-heading"><strong>{result}</strong></span>
            <span className="terminal-actions">
              <button className="btn btn-primary" id="rematch-btn" onClick={onRematch}>Play Again</button>
              <a className="btn btn-ghost" href="#/">Back to Hub</a>
            </span>
          </div>
        : <div className={`status-banner ${myTurn ? "your-turn" : "their-turn"}`}>
            <span>{myTurn
              ? "Your turn - click a column to drop your disc"
              : currentName.startsWith("Computer")
                ? <><strong>{currentName}</strong> is thinking<span className="thinking-dots" /></>
                : <>Waiting for <strong>{currentName || "opponent"}</strong></>}
            </span>
          </div>}
      {lastError && <div className="error-text" role="alert">{humanizeError(lastError)}</div>}
    </div>
    <div className="connect4-board-frame">
      <div className="c4-seats">
        {players.map((seat, index) => <span
          className={`c4-seat ${seat === view.currentPlayerId ? "current" : ""}`}
          key={seat}
        >
          <span className={`c4-disc-mini ${DISC_CLASSES[index] ?? "c4-p1"}`} />
          {nameOf(seat)}{seat === mySeat ? " (you)" : ""}
        </span>)}
      </div>
      <div
        className="c4-drop-row"
        id="connect4-drop-row"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {Array.from({ length: cols }, (_, col) => <button
          aria-label={`Drop in column ${col + 1}`}
          className="c4-drop-btn"
          disabled={!myTurn || pending || grid[0]?.[col] !== null}
          key={col}
          onClick={() => onDrop(col)}
        >▼</button>)}
      </div>
      <div className="c4-board" id="connect4-board">
        {grid.map((row, rowIndex) => <div
          className="c4-row"
          key={rowIndex}
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {row.map((seat, colIndex) => {
            const lastDrop = view.lastDrop?.row === rowIndex && view.lastDrop.col === colIndex;
            return <div
              className={`c4-cell ${winning.has(`${rowIndex},${colIndex}`) ? "winning" : ""}`}
              data-col={colIndex}
              key={colIndex}
            >
              {seat !== null && <div className={`c4-disc ${discClassOf(seat)} ${lastDrop ? "last-drop" : ""}`} />}
            </div>;
          })}
        </div>)}
      </div>
    </div>
  </section>;
}
