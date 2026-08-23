import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CardZone } from "../../packages/web-client/src/components/card-zone";

describe("CardZone", () => {
  test("renders safe backs without hidden face identity", () => {
    const secret = "jade-rank-four";
    const html = renderToStaticMarkup(<CardZone
      label="Your packets"
      arrangement="fan"
      cards={[{
        slotKey: "opaque-slot-a",
        face: null,
        back: <span>Unknown packet</span>,
        ariaLabel: "Hidden packet, channel unknown, rank unknown"
      }]}
    />);

    expect(html).toContain("Unknown packet");
    expect(html).toContain('data-slot-key="opaque-slot-a"');
    expect(html).toContain('role="img"');
    expect(html).not.toContain("<button");
    expect(html).not.toContain("aria-pressed");
    expect(html).not.toContain(secret);
  });

  test("renders row cards with selection and disabled semantics", () => {
    const html = renderToStaticMarkup(<CardZone
      label="Tile market"
      arrangement="row"
      selectedKey="tile-a"
      onCardPress={() => {}}
      cards={[
        { slotKey: "tile-a", face: <span>Forest village</span>, back: null, ariaLabel: "Forest village" },
        { slotKey: "tile-b", face: <span>Water shrine</span>, back: null, ariaLabel: "Water shrine", disabled: true }
      ]}
    />);

    expect(html).toContain("card-zone--row");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-disabled="true"');
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
  });
});
