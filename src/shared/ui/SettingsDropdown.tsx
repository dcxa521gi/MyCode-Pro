import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { LAYER } from "../lib/layers";
import { useTranslation } from "../i18n";
import { Check, ChevronDown, Search } from "./icons";

/** Searchable settings choice, keeping the same value/onChange contract as a select. */
export function SettingsDropdown({
  children,
  value,
  onChange,
  disabled,
  onOpen,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { onOpen?: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const host = useRef<HTMLDivElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 208,
    maxHeight: 280,
  });
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = host.current?.getBoundingClientRect();
      if (!rect) return;
      const height = Math.min(
        panel.current?.scrollHeight || 280,
        280,
        window.innerHeight - 24,
      );
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const flip = below < height && above > below;
      const maxHeight = Math.max(80, Math.min(height, flip ? above : below));
      const width = Math.min(Math.max(rect.width, 208), window.innerWidth - 24);
      setPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: flip ? Math.max(12, rect.top - maxHeight - 4) : rect.bottom + 4,
        width,
        maxHeight,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, query]);
  const options: { value: string; label: ReactNode; disabled?: boolean }[] = [];
  const collect = (nodes: ReactNode) =>
    Children.forEach(nodes, (child) => {
      if (
        !isValidElement<{
          value?: string;
          children?: ReactNode;
          disabled?: boolean;
        }>(child)
      )
        return;
      if (child.type === "option")
        options.push({
          value: String(child.props.value ?? child.props.children ?? ""),
          label: child.props.children,
          disabled: child.props.disabled,
        });
      else collect(child.props.children);
    });
  collect(children);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (
        !host.current?.contains(e.target as Node) &&
        !panel.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const selected = options.find((o) => o.value === String(value ?? ""));
  const visible = options.filter((o) =>
    String(o.label).toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <div
      ref={host}
      className="relative min-w-40 max-w-full"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          setOpen(false);
          host.current?.querySelector<HTMLButtonElement>("button")?.focus();
        }
        if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          const buttons = [
            ...panel.current!.querySelectorAll<HTMLButtonElement>(
              '[role="option"]:not(:disabled)',
            ),
          ];
          if (!buttons.length) return;
          e.preventDefault();
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          buttons[
            (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
              buttons.length
          ]?.focus();
        }
      }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={props["aria-label"] ?? props.name}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setQuery("");
          if (!open) onOpen?.();
          setOpen(!open);
        }}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-content/15 bg-content/[0.035] px-3 py-2 text-left text-xs text-content hover:bg-content/5 disabled:opacity-40"
      >
        <span className="min-w-0 truncate">
          {selected?.label ?? t("Choose…")}
        </span>
        <ChevronDown className="size-3 shrink-0 text-content/45" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            data-dialog-popover
            style={{
              position: "fixed",
              ...position,
              zIndex: LAYER.dialogPopover,
            }}
            className="flex flex-col overflow-hidden rounded-xl border border-stroke bg-background-base p-1.5 shadow-xl"
          >
            <label className="mb-1 flex items-center gap-2 rounded-md bg-content/5 px-2 py-2">
              <Search className="size-3 text-content/45" />
              <input
                autoFocus
                aria-label={t("Search options…")}
                placeholder={t("Search options…")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              />
            </label>
            <div
              role="listbox"
              aria-label={props["aria-label"] ?? props.name}
              className="min-h-0 overflow-y-auto overscroll-contain"
            >
              {visible.map((o) => (
                <button
                  type="button"
                  key={o.value}
                  role="option"
                  aria-selected={o.value === String(value ?? "")}
                  disabled={o.disabled}
                  onClick={() => {
                    onChange?.({
                      target: { value: o.value },
                      currentTarget: { value: o.value },
                    } as ChangeEvent<HTMLSelectElement>);
                    setOpen(false);
                    host.current
                      ?.querySelector<HTMLButtonElement>("button")
                      ?.focus();
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-selection focus:bg-selection focus:outline-none disabled:opacity-40"
                >
                  <span className="min-w-0 break-words">{o.label}</span>
                  {o.value === String(value ?? "") && (
                    <Check className="size-3 shrink-0" />
                  )}
                </button>
              ))}
              {!visible.length && (
                <p className="p-2 text-xs text-content/45">
                  {t("No matching options")}
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
