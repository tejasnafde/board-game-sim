import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { mountPlayableClient } from "./browser-app";
import type { SocketLike } from "./realtime-client";

export type BrowserAppProps = {
  websocketFactory: () => SocketLike;
};

export function BrowserApp({ websocketFactory }: BrowserAppProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }
    return mountPlayableClient(hostRef.current, { websocketFactory }).dispose;
  }, [websocketFactory]);

  return <div ref={hostRef} data-game-client-host="react" />;
}

export function mountReactBrowserApp(
  element: HTMLElement,
  websocketFactory: () => SocketLike
): { dispose: () => void } {
  const root: Root = createRoot(element);
  root.render(<BrowserApp websocketFactory={websocketFactory} />);
  return { dispose: () => root.unmount() };
}
