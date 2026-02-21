export function debugPanelMarkup(logs: string[], stateDump: string): string {
  return `
    <aside class="side-stack" aria-label="Debug and session diagnostics">
      <div class="card panel debug-panel">
        <h3>Debug Log</h3>
        <pre id="debug-view">${logs.join("\n") || "no_logs_yet"}</pre>
      </div>
      <div class="card panel log-panel">
        <h3>Session State</h3>
        <pre id="state-view">${stateDump}</pre>
      </div>
    </aside>
  `;
}
