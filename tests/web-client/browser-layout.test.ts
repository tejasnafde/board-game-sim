import { describe, expect, test } from "vitest";
import { getGameplayPanelOrder } from "../../packages/web-client/src/browser-app";

describe("browser gameplay layout", () => {
  test("keeps debug panel before state panel", () => {
    expect(getGameplayPanelOrder()).toEqual(["debug", "state"]);
  });
});
