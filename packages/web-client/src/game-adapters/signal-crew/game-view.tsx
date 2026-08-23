import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { TableSummary } from "@board-game-sim/shared";
import type { AcceptedAction } from "../../realtime-state";
import { CardZone } from "../../components/card-zone";
import type {
  ConcealedPacketView,
  SignalChannel,
  SignalCrewView,
  SignalFace,
  SignalRank,
  VisiblePacketView
} from "./types";

type Mode = "idle" | "clue" | "transmit" | "recycle";

type ClueChoice = {
  key: string;
  targetPlayerId: string;
  attribute: "channel" | "rank";
  value: SignalChannel | SignalRank;
  matchingPacketIds: string[];
};

export type SignalCrewGameViewProps = {
  view: SignalCrewView;
  table?: TableSummary | null;
  mySeat: string;
  seatNames: Record<string, string>;
  acceptedActions: AcceptedAction[];
  pending: boolean;
  lastError: string | null;
  onGiveClue(targetPlayerId: string, attribute: "channel" | "rank", value: SignalChannel | SignalRank): void;
  onTransmit(packetId: string, socketId: string): void;
  onRecycle(packetId: string): void;
  onStandBy(): void;
  onRematch(): void;
};

const CHANNEL_LABEL: Record<SignalChannel, string> = {
  azure: "Azure Triangle",
  amber: "Amber Circle",
  magenta: "Magenta Square",
  jade: "Jade Diamond"
};

const CHANNEL_GLYPH: Record<SignalChannel, string> = {
  azure: "△",
  amber: "○",
  magenta: "□",
  jade: "◇"
};

function channelMark(channel: SignalChannel) {
  return <span className={`sc-channel sc-channel--${channel}`}>
    <span aria-hidden="true">{CHANNEL_GLYPH[channel]}</span>
    <span>{CHANNEL_LABEL[channel]}</span>
  </span>;
}

function faceLabel(face: SignalFace): string {
  return `${CHANNEL_LABEL[face.channel]}, rank ${face.rank}`;
}

function visiblePacket(packet: VisiblePacketView) {
  return <span className="sc-packet-face">
    {channelMark(packet.face.channel)}
    <strong className="sc-packet-rank">{packet.face.rank}</strong>
  </span>;
}

function concealedPacket(packet: ConcealedPacketView) {
  const channels = packet.possibleChannels.map((channel) => CHANNEL_LABEL[channel]).join(" · ");
  const ranks = packet.possibleRanks.join(" · ");
  return <span className="sc-packet-back">
    <span className="sc-packet-signal" aria-hidden="true"><i /><i /><i /></span>
    <strong>Unknown packet</strong>
    <span className="sc-knowledge"><span>{channels}</span><span>Ranks {ranks}</span></span>
  </span>;
}

function ownPacketLabel(packet: ConcealedPacketView): string {
  const clues = packet.clues.map((clue) => (
    `${clue.matches ? "matches" : "not"} ${String(clue.value)}`
  )).join(", ");
  return `Unknown packet; possible channels ${packet.possibleChannels.map((channel) => CHANNEL_LABEL[channel]).join(", ")}; possible ranks ${packet.possibleRanks.join(", ")}${clues ? `; clues ${clues}` : ""}`;
}

function validClueChoices(view: SignalCrewView, mySeat: string): ClueChoice[] {
  const choices: ClueChoice[] = [];
  for (const hand of view.hands) {
    if (hand.playerId === mySeat) continue;
    const packets = hand.packets.filter((packet): packet is VisiblePacketView => !packet.concealed);
    const candidates: Array<{ attribute: "channel" | "rank"; value: SignalChannel | SignalRank }> = [
      ...view.config.channels.map((channel) => ({ attribute: "channel" as const, value: channel.id })),
      ...view.config.ranks.map((rank) => ({ attribute: "rank" as const, value: rank }))
    ];
    for (const candidate of candidates) {
      const matching = packets.filter((packet) => packet.face[candidate.attribute] === candidate.value);
      if (matching.length === 0) continue;
      const changes = packets.some((packet) => {
        const possible = candidate.attribute === "channel" ? packet.possibleChannels : packet.possibleRanks;
        const matches = packet.face[candidate.attribute] === candidate.value;
        return matches ? possible.length > 1 : possible.includes(candidate.value as never);
      });
      if (changes) {
        choices.push({
          key: `${hand.playerId}:${candidate.attribute}:${candidate.value}`,
          targetPlayerId: hand.playerId,
          ...candidate,
          matchingPacketIds: matching.map((packet) => packet.packetId)
        });
      }
    }
  }
  return choices;
}

function activityText(actions: AcceptedAction[], nameOf: (playerId: string) => string): string[] {
  return actions.slice(-5).flatMap((action) => action.events.flatMap((raw) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];
    const event = raw as { eventType?: string; payload?: Record<string, unknown> };
    const actor = action.actorPlayerId ? nameOf(action.actorPlayerId) : "Crew";
    if (event.eventType === "clue.given") return [`${actor} sent a ${String(event.payload?.attribute)} clue.`];
    if (event.eventType === "packet.transmitted") return [`${actor} transmitted a packet — ${event.payload?.matched ? "relay matched" : "interference"}.`];
    if (event.eventType === "packet.recycled") return [`${actor} recycled a packet for bandwidth.`];
    if (event.eventType === "relay.completed") return ["Relay restored. Bandwidth recovered."];
    if (event.eventType === "final_orbit.started") return ["Final orbit has begun."];
    if (event.eventType === "crew.stood_by") return [`${actor} stood by.`];
    return [];
  }));
}

export function SignalCrewGameView(props: SignalCrewGameViewProps) {
  const { view } = props;
  const [mode, setMode] = useState<Mode>("idle");
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null);
  const [selectedSocketId, setSelectedSocketId] = useState<string | null>(null);
  const [selectedClueKey, setSelectedClueKey] = useState<string | null>(null);
  useEffect(() => {
    setMode("idle");
    setSelectedPacketId(null);
    setSelectedSocketId(null);
    setSelectedClueKey(null);
  }, [view.turnIndex]);

  const nameOf = (playerId: string) => props.seatNames[playerId] ?? playerId;
  const terminal = view.phase === "terminal";
  const tableReady = props.table?.ready !== false;
  const canAct = tableReady && view.canAct && !props.pending && !terminal;
  const ownHand = view.hands.find((hand) => hand.playerId === props.mySeat);
  const ownPackets = (ownHand?.packets ?? []).filter((packet): packet is ConcealedPacketView => packet.concealed);
  const clues = useMemo(() => validClueChoices(view, props.mySeat), [view, props.mySeat]);
  const selectedClue = clues.find((clue) => clue.key === selectedClueKey) ?? null;
  const activity = activityText(props.acceptedActions, nameOf);
  const repaired = view.relays.filter((relay) => relay.completed).length;
  const missingHumans = props.table ? props.table.humanSeats - props.table.claimedHumanSeats : 0;
  const status = !tableReady
    ? `Waiting for ${missingHumans} more crew member${missingHumans === 1 ? "" : "s"}`
    : terminal
      ? view.outcome === "won" ? "All relays restored" : "Mission ended"
      : view.currentPlayerId === props.mySeat ? "Your turn — choose one action" : `Waiting for ${nameOf(view.currentPlayerId)}`;

  const cancel = () => {
    setMode("idle");
    setSelectedPacketId(null);
    setSelectedSocketId(null);
    setSelectedClueKey(null);
  };

  return <section className="screen signal-crew-screen">
    <header className="sc-header">
      <div>
        <div className="sc-kicker">Signal Crew · rescue channel</div>
        <h1>Signal Crew</h1>
      </div>
      <div className={`sc-turn-status ${canAct ? "is-active" : ""}`} aria-live="polite">
        <span className="sc-sequence">{String(view.turnIndex + 1).padStart(2, "0")}</span>
        <span>{status}</span>
      </div>
    </header>

    {terminal && <div className={`status-banner terminal-banner sc-terminal ${view.outcome === "lost" ? "is-loss" : ""}`} role={view.outcome === "lost" ? "alert" : undefined}>
      <strong>{view.outcome === "won" ? "Crew rescued the relay network" : view.terminalReason === "interference_overload" ? "Mission lost — interference overload" : view.terminalReason === "required_packet_exhausted" ? "Mission lost — a required packet was exhausted" : "Mission lost — final orbit expired"}</strong>
      <span className="terminal-actions"><button className="btn btn-primary" onClick={props.onRematch}>Play Again</button><a className="btn btn-ghost" href="#/">Back to Hub</a></span>
    </div>}

    <div className="sc-mission-strip" aria-label="Mission tracks">
      <div className="sc-track"><span>Bandwidth</span><strong>{view.bandwidth} / {view.maxBandwidth}</strong><i style={{ "--sc-progress": `${(view.bandwidth / view.maxBandwidth) * 100}%` } as CSSProperties} /></div>
      <div className="sc-track"><span>Interference</span><strong>{view.interference} / {view.config.interferenceLimit}</strong><span className="sc-pips" aria-label={`${view.interference} of ${view.config.interferenceLimit} interference`}>{Array.from({ length: view.config.interferenceLimit }, (_, index) => <i className={index < view.interference ? "is-filled" : ""} key={index} />)}</span></div>
      <div className="sc-track"><span>{view.finalOrbitTurnsRemaining === null ? "Packets in reserve" : "Final orbit"}</span><strong>{view.finalOrbitTurnsRemaining ?? view.remainingPacketCount}</strong><small>{repaired} / 5 relays repaired</small></div>
    </div>

    <div className="sc-layout">
      <main className="sc-table">
        <section className="sc-relay-section" aria-labelledby="sc-relay-title">
          <div className="sc-section-label"><span id="sc-relay-title">Relay network</span><span>{repaired} online</span></div>
          <div className="sc-relay-rack">
            {view.relays.map((relay) => <article className={`sc-relay ${relay.completed ? "is-complete" : ""}`} key={relay.id}>
              <header><span>{relay.name}</span><small>{relay.completed ? "ONLINE" : "REPAIR"}</small></header>
              <div className="sc-sockets">
                {relay.sockets.map((socket, index) => <button
                  type="button"
                  className={`sc-socket ${socket.filledPacketId ? "is-filled" : ""} ${selectedSocketId === socket.id ? "is-selected" : ""}`}
                  key={socket.id}
                  aria-label={`${relay.name}, socket ${index + 1}, ${faceLabel(socket.required)}, ${socket.filledPacketId ? "filled" : "empty"}`}
                  aria-pressed={mode === "transmit" ? selectedSocketId === socket.id : undefined}
                  aria-disabled={Boolean(socket.filledPacketId) || mode !== "transmit" || !canAct}
                  onClick={!socket.filledPacketId && mode === "transmit" && canAct ? () => setSelectedSocketId(socket.id) : undefined}
                >
                  {channelMark(socket.required.channel)}
                  <strong>{socket.required.rank}</strong>
                  <small>{socket.filledPacketId ? "LOCKED" : "OPEN"}</small>
                </button>)}
              </div>
            </article>)}
          </div>
        </section>

        <section className="sc-crew-section" aria-labelledby="sc-crew-title">
          <div className="sc-section-label"><span id="sc-crew-title">Crew signals</span><span>Visible to you</span></div>
          <div className="sc-crew-hands">
            {view.hands.filter((hand) => hand.playerId !== props.mySeat).map((hand) => <article className={`sc-crew-hand ${hand.playerId === view.currentPlayerId ? "is-current" : ""}`} key={hand.playerId}>
              <header><strong>{nameOf(hand.playerId)}</strong><span>{hand.packets.length} packets</span></header>
              <CardZone
                label={`${nameOf(hand.playerId)} packets`}
                arrangement="row"
                cards={hand.packets.map((packet) => ({
                  slotKey: packet.packetId,
                  face: packet.concealed ? null : visiblePacket(packet),
                  back: packet.concealed ? concealedPacket(packet) : null,
                  ariaLabel: packet.concealed ? ownPacketLabel(packet) : faceLabel(packet.face),
                  className: `sc-packet ${packet.concealed ? "is-concealed" : `sc-packet--${packet.face.channel}`} ${selectedClue?.matchingPacketIds.includes(packet.packetId) ? "is-clue-match" : ""}`
                }))}
              />
            </article>)}
          </div>
        </section>

        <section className="sc-own-station" aria-labelledby="sc-own-title">
          <div className="sc-section-label"><span id="sc-own-title">Your encrypted packets · {nameOf(props.mySeat)}</span><span>Use crew clues</span></div>
          <CardZone
            label="Your encrypted packets"
            arrangement="row"
            selectedKey={selectedPacketId ?? undefined}
            onCardPress={canAct && (mode === "transmit" || mode === "recycle") ? setSelectedPacketId : undefined}
            cards={ownPackets.map((packet) => ({
              slotKey: packet.packetId,
              face: null,
              back: concealedPacket(packet),
              ariaLabel: ownPacketLabel(packet),
              className: "sc-packet sc-packet-own"
            }))}
          />
        </section>
      </main>

      <aside className="sc-rail">
        <section className="sc-action-dock" aria-busy={props.pending}>
          <div className="sc-section-label"><span>Action channel</span><span>{mode === "idle" ? "Select" : mode}</span></div>
          <div className="sc-action-tabs">
            <button className={mode === "clue" ? "is-active" : ""} disabled={!canAct || !view.legalActionTypes.includes("give_clue")} onClick={() => { cancel(); setMode("clue"); }}>Give clue</button>
            <button className={mode === "transmit" ? "is-active" : ""} disabled={!canAct || !view.legalActionTypes.includes("transmit_packet")} onClick={() => { cancel(); setMode("transmit"); }}>Transmit</button>
            <button className={mode === "recycle" ? "is-active" : ""} disabled={!canAct || !view.legalActionTypes.includes("recycle_packet")} onClick={() => { cancel(); setMode("recycle"); }}>Recycle</button>
          </div>
          {mode === "idle" && <p className="sc-action-help">Clue a teammate, route one encrypted packet, or recycle it for bandwidth.</p>}
          {mode === "clue" && <div className="sc-action-form">
            <p>Choose one truthful clue. Every match is highlighted; every other card gains negative information.</p>
            <div className="sc-clue-grid">{clues.map((choice) => <button className={selectedClueKey === choice.key ? "is-selected" : ""} key={choice.key} onClick={() => setSelectedClueKey(choice.key)}>{nameOf(choice.targetPlayerId)} · {choice.attribute === "channel" ? CHANNEL_LABEL[choice.value as SignalChannel] : `Rank ${choice.value}`}</button>)}</div>
            <button className="btn btn-primary" disabled={!selectedClue || props.pending} onClick={() => selectedClue && props.onGiveClue(selectedClue.targetPlayerId, selectedClue.attribute, selectedClue.value)}>Send clue · −1 bandwidth</button>
          </div>}
          {mode === "transmit" && <div className="sc-action-form"><p>Choose one unknown packet and any open relay socket. Only recorded certainty is safe.</p><button className="btn btn-primary" disabled={!selectedPacketId || !selectedSocketId || props.pending} onClick={() => selectedPacketId && selectedSocketId && props.onTransmit(selectedPacketId, selectedSocketId)}>Transmit packet</button></div>}
          {mode === "recycle" && <div className="sc-action-form"><p>Reveal and discard one packet to restore bandwidth. A required signal can be lost.</p><button className="btn btn-primary" disabled={!selectedPacketId || props.pending} onClick={() => selectedPacketId && props.onRecycle(selectedPacketId)}>Reveal & recycle · +1</button></div>}
          {mode !== "idle" && <button className="sc-cancel" onClick={cancel}>Cancel</button>}
          {view.legalActionTypes.includes("stand_by") && <button className="btn btn-primary sc-standby" disabled={!canAct} onClick={props.onStandBy}>Stand by · advance orbit</button>}
          {props.lastError && <p className="form-error" role="alert">{props.lastError.replaceAll("_", " ")}</p>}
        </section>

        <section className="sc-activity">
          <div className="sc-section-label"><span>Mission log</span><span>Public</span></div>
          {activity.length > 0 ? <ol>{activity.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol> : <p>Channel open. Awaiting the first crew action.</p>}
        </section>
      </aside>
    </div>
  </section>;
}
