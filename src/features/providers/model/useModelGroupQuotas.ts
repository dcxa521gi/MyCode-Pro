import { useEffect } from "react";
import { loadGroupConfig, MODEL_GROUPS_CHANGED } from "./modelGroups";
import { refreshModelGroupQuotas } from "./modelGroupRouting";

/** Warm only explicitly enabled pools; unrelated provider accounts are not probed. */
export function useModelGroupQuotas() {
  useEffect(() => {
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const config = loadGroupConfig();
        await Promise.allSettled(
          config.groups
            .filter((group) => config.defaults[group.harness] === group.id)
            .map((group) => refreshModelGroupQuotas(group)),
        );
      } finally {
        pending = false;
      }
    };
    void refresh();
    const changed = () => {
      void refresh();
    };
    window.addEventListener(MODEL_GROUPS_CHANGED, changed);
    const timer = setInterval(changed, 4 * 60_000);
    return () => {
      clearInterval(timer);
      window.removeEventListener(MODEL_GROUPS_CHANGED, changed);
    };
  }, []);
}
