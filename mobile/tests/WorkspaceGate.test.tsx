// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { WorkspaceGate } from "@/features/connection/WorkspaceGate";

const state = vi.hoisted(() => ({
  restoring: true,
  pairing: null as object | null,
  selection: null as object | null,
}));
vi.mock("react-native", () => ({
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ActivityIndicator: () => <div>restoring</div>,
  StyleSheet: { absoluteFill: {} },
}));
vi.mock("@/ui/theme", () => ({ useColors: () => ({ background: "black", content: "white" }) }));
vi.mock("@/features/connection/ConnectionProvider", () => ({ useConnection: () => state }));
vi.mock("@/features/connection/ConnectScreen", () => ({ ConnectScreen: () => <div>connect</div> }));
vi.mock("@/features/connection/WorkspacePicker", () => ({ WorkspacePicker: () => <div>pick</div> }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = document.createElement("div");
const root = createRoot(host);
afterEach(() => act(() => root.unmount()));

it("keeps the root navigator mounted throughout pairing and project selection", () => {
  let mounts = 0;
  function Navigator() {
    useEffect(() => { mounts++; }, []);
    return <div>navigator</div>;
  }
  const render = () => act(() => root.render(<WorkspaceGate><Navigator /></WorkspaceGate>));
  render();
  expect(host.textContent).toContain("restoring");
  state.restoring = false;
  render();
  expect(host.textContent).toContain("connect");
  state.pairing = {};
  render();
  expect(host.textContent).toContain("pick");
  state.selection = { projectIds: ["project"], monoIds: [] };
  render();
  expect(host.textContent).toBe("navigator");
  expect(mounts).toBe(1);
});
