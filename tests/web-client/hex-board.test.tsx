import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { HexBoard, hexNavigationOffset } from "../../packages/web-client/src/components/hex-board";

const cells = [
  { key: "-1:0", coordinate: { q: -1, r: 0 }, ariaLabel: "Forest at -1, 0" },
  { key: "0:0", coordinate: { q: 0, r: 0 }, ariaLabel: "Central landmark", disabled: true },
  { key: "1:0", coordinate: { q: 1, r: 0 }, ariaLabel: "Legal meadow at 1, 0" }
];

describe("HexBoard", () => {
  test("maps keyboard navigation to all six axial neighbors", () => {
    expect([
      "ArrowRight",
      "PageUp",
      "ArrowUp",
      "ArrowLeft",
      "PageDown",
      "ArrowDown"
    ].map(hexNavigationOffset)).toEqual([
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 }
    ]);
  });

  test("renders responsive geometry and one accessible target per cell", () => {
    const html = renderToStaticMarkup(<HexBoard
      label="Kingdom map"
      cells={cells}
      selectedKey="1:0"
      onHexPress={() => {}}
      renderHex={(cell) => <span>{cell.ariaLabel}</span>}
    />);

    expect(html).toContain('aria-label="Kingdom map"');
    expect(html).toContain("viewBox=");
    expect(html.match(/data-hex-key=/g)).toHaveLength(3);
    expect(html).toContain('aria-label="Forest at -1, 0"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('aria-pressed="true"');
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
  });

  test("does not expose a press handler for disabled cells", () => {
    const html = renderToStaticMarkup(<HexBoard
      label="Kingdom map"
      cells={cells}
      onHexPress={() => {}}
      renderHex={() => null}
    />);

    expect(html).toMatch(/data-hex-key="0:0"[^>]*disabled=""/);
  });
});
