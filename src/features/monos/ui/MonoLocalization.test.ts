// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../../shared/i18n";
import { MonoHeader } from "./MonoHeader";
import { MonoStatus } from "./MonoStatus";
import { defaultSoul, monoTurn } from "../model/monoFiles";
import { defaultMonoName, monoLook } from "../model/mono";
import { habitScheduleLabel } from "../model/monoHabits";

afterEach(() => {
  setLanguage("en");
  vi.unstubAllGlobals();
});

it("localizes resident-agent status, project greeting, schedule and new instructions", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setLanguage("zh-CN");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        createElement(MonoStatus, {
          state: { status: "working", activity: "Thinking" },
          color: "#6ba",
        }),
      ),
    );
    expect(container.textContent).toContain("工作中");
    expect(container.textContent).toContain("思考");
    await act(async () =>
      root.render(
        createElement(MonoHeader, {
          agent: {
            name: "小助手",
            mascot: "cat",
            color: "#6ba",
            projects: [{ name: "项目A", path: "/repo" }],
          },
          greeting: true,
        }),
      ),
    );
    expect(container.textContent).toContain("我可以查看项目A");
    expect(
      habitScheduleLabel({
        scheduleKind: "hourly",
        minute: 15,
        time: "09:00",
        dayOfWeek: 1,
      }),
    ).toBe("每小时第 15 分钟");
    expect(defaultSoul()).toContain("长期指令");
    expect(monoTurn("帮我检查", ["context"])).toContain(
      "Use Simplified Chinese",
    );
    setLanguage("en");
    await act(async () =>
      root.render(
        createElement(MonoStatus, {
          state: { status: "idle" },
          color: "#6ba",
        }),
      ),
    );
    expect(container.textContent).toBe("Idle");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("localizes default resident names without changing custom names", () => {
  setLanguage("zh-CN");
  expect(defaultMonoName("invader")).toBe("小星际");
  expect(defaultMonoName("ghost")).toBe("小幽灵");
  expect(
    monoLook({
      id: "mono-n",
      mascot: "cat",
      color: "#abc",
      projects: [],
      name: "My assistant",
    }).name,
  ).toBe("My assistant");
  setLanguage("en");
  expect(defaultMonoName("invader")).toBe("MonoInvader");
});
