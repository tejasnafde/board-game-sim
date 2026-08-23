import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { SignalCrewModule, type SignalCrewView } from "@board-game-sim/signal-crew";
import definition from "../../packages/games/signal-crew/definition.json";
import { SignalCrewGameView } from "../../packages/web-client/src/game-adapters/signal-crew/game-view";

function fixture(): { view: SignalCrewView; mySeat: string } {
  const module = new SignalCrewModule();
  const state = module.initGame({
    sessionId: "signal-ui",
    gameId: "signal-crew",
    gameVersion: "0.1.0",
    seed: "signal-ui",
    players: ["p1", "p2"],
    definition
  }).initialState;
  const mySeat = state.currentPlayerId;
  const ownPacket = state.hands[mySeat]![0]!;
  state.packetFaces[ownPacket] = { channel: "private-sentinel" as never, rank: 99 as never };
  const teammate = state.players.find((playerId) => playerId !== mySeat)!;
  const teammatePacket = state.hands[teammate]![0]!;
  state.packetFaces[teammatePacket] = { channel: "public-sentinel" as never, rank: 88 as never };
  const view = module.getPlayerView({ state, playerId: mySeat }).visibleState as unknown as SignalCrewView;
  return { view, mySeat };
}

function markup(input = fixture()) {
  return renderToStaticMarkup(<SignalCrewGameView
    view={input.view}
    table={{ humanSeats: 1, botSeats: 1, claimedHumanSeats: 1, ready: true }}
    mySeat={input.mySeat}
    seatNames={{ p1: "Pilot One", p2: "Pilot Two", [input.mySeat]: "A very long commander name that wraps" }}
    acceptedActions={[]}
    pending={false}
    lastError={null}
    onGiveClue={() => {}}
    onTransmit={() => {}}
    onRecycle={() => {}}
    onStandBy={() => {}}
    onRematch={() => {}}
  />);
}

describe("SignalCrewGameView", () => {
  test("never renders the requester's hidden face but renders teammate faces", () => {
    const html = markup();
    expect(html).not.toContain("private-sentinel");
    expect(html).toContain("public-sentinel");
    expect(html).toContain("88");
    expect(html).toContain("Unknown packet");
  });

  test("renders five relays, shared tracks, and focused action controls", () => {
    const input = fixture();
    const html = markup(input);
    expect(html.match(/class="sc-relay /g)).toHaveLength(5);
    expect(html).toContain("Bandwidth");
    expect(html).toContain("Interference");
    expect(html).toContain("Give clue");
    expect(html).toContain("Transmit");
    expect(html).toContain("Recycle");
    expect(html).toContain("A very long commander name that wraps");
  });

  test("unknown viewers receive no true packet faces in markup", () => {
    const module = new SignalCrewModule();
    const state = module.initGame({
      sessionId: "signal-spectator-ui",
      gameId: "signal-crew",
      gameVersion: "0.1.0",
      seed: "signal-spectator-ui",
      players: ["p1", "p2"],
      definition
    }).initialState;
    const packetId = state.hands.p1![0]!;
    state.packetFaces[packetId] = { channel: "spectator-secret" as never, rank: 77 as never };
    const view = module.getPlayerView({ state, playerId: "spectator" }).visibleState as unknown as SignalCrewView;
    const html = markup({ view, mySeat: "spectator" });
    expect(html).not.toContain("spectator-secret");
  });
});
