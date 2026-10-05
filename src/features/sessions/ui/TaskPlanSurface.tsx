import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { useTranslation } from "../../../shared/i18n";
import { SettingsDropdown } from "../../../shared/ui/SettingsDropdown";
import {
  latestTaskPlan,
  planPosition,
  savePlanPosition,
  subscribePlanPosition,
} from "../model/taskPlanPlacement";
import type { Block } from "../model/session";
import { TaskListPreview } from "./TaskListPreview";

export function TaskPlanSurface({
  blocks,
  scope,
  scroller,
  aboveInput = false,
  visible,
}: {
  blocks: Block[];
  scope: RefObject<HTMLElement | null>;
  scroller: HTMLElement | null;
  aboveInput?: boolean;
  visible: boolean;
}) {
  const { t } = useTranslation();
  const position = useSyncExternalStore(subscribePlanPosition, planPosition);
  const plan = latestTaskPlan(blocks);
  const [passed, setPassed] = useState(false),
    [collapsed, setCollapsed] = useState(false);
  const frame = useRef(0);
  useEffect(() => {
    if (!visible || position !== "inline" || !plan || !scroller) return;
    const update = () => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const anchor = scope.current?.querySelector<HTMLElement>(
          `[data-task-plan="${CSS.escape(plan.id)}"]`,
        );
        setPassed(
          anchor
            ? anchor.getBoundingClientRect().bottom <
                scroller.getBoundingClientRect().top + 8
            : scroller.scrollTop > 0,
        );
      });
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const observer = new MutationObserver(update);
    if (scope.current)
      observer.observe(scope.current, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame.current);
      observer.disconnect();
      scroller.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [visible, position, plan?.id, scroller, scope]);
  if (
    !visible ||
    !plan ||
    aboveInput !== (position === "above-input") ||
    (position === "inline" && !passed)
  )
    return null;
  return (
    <aside
      data-task-plan-ledge={aboveInput ? "true" : undefined}
      className={
        aboveInput
          ? "relative mx-4 mb-2 shrink-0 rounded-xl border border-stroke bg-background-base shadow-sm"
          : `absolute right-3 z-30 w-[min(340px,calc(100%_-_24px))] rounded-xl border border-stroke bg-background-base/95 shadow-lg backdrop-blur ${position === "bottom-right" ? "bottom-3" : "top-3"}`
      }
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <SettingsDropdown
          aria-label={t("Plan position")}
          value={position}
          onChange={(e) => savePlanPosition(e.target.value as typeof position)}
        >
          <option value="inline">{t("In conversation")}</option>
          <option value="top-right">{t("Top right")}</option>
          <option value="bottom-right">{t("Bottom right")}</option>
          <option value="above-input">{t("Above input")}</option>
        </SettingsDropdown>
        <button
          type="button"
          className="rounded px-2 py-1 text-xs text-content/60 hover:bg-content/5"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          {t(collapsed ? "Expand" : "Collapse")}
        </button>
      </div>
      {!collapsed && (
        <div className="max-h-64 overflow-auto px-2 pb-1">
          <TaskListPreview
            items={plan.items}
            explanation={plan.explanation}
            floating
          />
        </div>
      )}
      {collapsed && (
        <p className="px-3 pb-2 text-xs text-content/60">
          {plan.items.filter((i) => i.status === "completed").length} /{" "}
          {plan.items.filter((i) => i.status !== "cancelled").length} ·{" "}
          {t("Task progress")}
        </p>
      )}
    </aside>
  );
}
