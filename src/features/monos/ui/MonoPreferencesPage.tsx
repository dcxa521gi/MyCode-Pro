import { translate as t, formatMessage } from "../../../shared/i18n";
import { useSyncExternalStore } from "react";
import { useLockOverscroll } from "../../../shared/hooks/useLockOverscroll";
import {
  findMono,
  subscribeMonos,
  updateMono,
  type MonoLook,
} from "../model/mono";
import { ConfirmReset } from "./ConfirmReset";
import { PageHeader, SwitchRow } from "./monoPanelParts";

/**
 * Where the sessions a Mono starts go, and resetting its conversation.
 * Opens from the Settings row in its details.
 */
export function MonoPreferencesPage({
  monoId,
  agent,
  onBack,
  onReset,
}: {
  monoId: string;
  agent: MonoLook;
  onBack: () => void;
  onReset?: () => Promise<void>;
}) {
  const lock = useLockOverscroll<HTMLDivElement>();
  const shown = useSyncExternalStore(
    subscribeMonos,
    () => findMono(monoId)?.showStartedSessionsInSidebar !== false,
  );
  const folders = useSyncExternalStore(
    subscribeMonos,
    () => findMono(monoId)?.useSidebarFolders === true,
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-mono-preferences>
      <PageHeader title={t("Settings")} onBack={onBack} />
      <div
        ref={lock}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-none"
      >
        <div className="flex flex-col gap-px p-2">
          <SwitchRow
            label={t("Show sessions in sidebar")}
            description={t(
              "Sessions it starts appear in your project sidebar. Hidden ones stay saved and open from its chat.",
            )}
            on={shown}
            onChange={(on) =>
              updateMono(monoId, (mono) => ({
                ...mono,
                showStartedSessionsInSidebar: on,
              }))
            }
          />
          {/* Hidden sessions have no sidebar folder to go in. */}
          <SwitchRow
            label={t("Group in a folder")}
            description={formatMessage(
              "Sessions it starts go in a “{name}” folder in your project sidebar.",
              { name: agent.name },
            )}
            on={shown && folders}
            disabled={!shown}
            onChange={(on) =>
              updateMono(monoId, ({ useSidebarFolders: _, ...mono }) =>
                on ? { ...mono, useSidebarFolders: true } : mono,
              )
            }
          />
        </div>
        {onReset ? (
          <div className="mt-auto p-2">
            <ConfirmReset
              label={t("Reset conversation")}
              title={formatMessage("Reset {value0}'s conversation?", {
                value0: agent.name,
              })}
              body={t(
                "All messages in this Mono's conversation will be deleted and any active reply will be stopped. This can't be undone.",
              )}
              kept={t("Its soul, memory and habits will be kept.")}
              failure={t("Could not reset the conversation.")}
              onConfirm={onReset}
            >
              {(open, ref) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={open}
                  className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-content/5"
                >
                  <span className="text-[13px] leading-5 text-red-400">
                    {t("Reset conversation")}
                  </span>
                  <span className="text-[12px] leading-5 text-content/40">
                    {t("Clear all messages and start fresh")}
                  </span>
                </button>
              )}
            </ConfirmReset>
          </div>
        ) : null}
      </div>
    </div>
  );
}
