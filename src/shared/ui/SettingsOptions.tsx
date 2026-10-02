import {
  Children,
  isValidElement,
  useState,
  type ChangeEvent,
  type SelectHTMLAttributes,
} from "react";
import { useTranslation } from "../i18n";

/** Inline choices share the settings segmented-control style. Long catalogs remain searchable. */
export function SettingsOptions({
  children,
  value,
  onChange,
  disabled,
  className: _className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const options: {
    value: string;
    label: React.ReactNode;
    disabled?: boolean;
  }[] = [];
  const collect = (nodes: React.ReactNode) =>
    Children.forEach(nodes, (child) => {
      if (
        !isValidElement<{
          value?: string;
          children?: React.ReactNode;
          disabled?: boolean;
        }>(child)
      )
        return;
      if (child.type === "option")
        options.push({
          value: String(child.props.value ?? ""),
          label: child.props.children,
          disabled: child.props.disabled,
        });
      else collect(child.props.children);
    });
  collect(children);
  const visible = query
    ? options.filter((o) =>
        String(o.label).toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      )
    : options;
  return (
    <div className="min-w-0 max-w-full space-y-2">
      {options.length > 8 && (
        <input
          aria-label={t("Search options…")}
          placeholder={t("Search options…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-content/10 bg-content/5 px-3 py-2 text-xs"
        />
      )}
      <div
        role="radiogroup"
        aria-label={props["aria-label"] ?? props.name}
        aria-required={props.required}
        onKeyDown={(e) => {
          if (
            disabled ||
            ![
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
            ].includes(e.key)
          )
            return;
          const available = visible.filter((o) => !o.disabled);
          if (!available.length) return;
          e.preventDefault();
          const index = available.findIndex((o) => o.value === String(value));
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? available.length - 1
                : (index +
                    (["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 1) +
                    available.length) %
                  available.length;
          const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          );
          buttons[next]?.click();
          buttons[next]?.focus();
        }}
        className={`flex flex-wrap gap-0.5 rounded-lg border border-content/10 bg-content/[0.025] p-0.5 text-xs ${options.length > 8 ? "max-h-48 overflow-y-auto" : ""}`}
      >
        {visible.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={String(value ?? "") === o.value}
            disabled={disabled || o.disabled}
            onClick={() =>
              onChange?.({
                target: { value: o.value },
                currentTarget: { value: o.value },
              } as ChangeEvent<HTMLSelectElement>)
            }
            className={`min-w-0 rounded-md px-3 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-content/30 disabled:opacity-40 ${String(value ?? "") === o.value ? "bg-selection text-content shadow-sm" : "text-content/55 hover:bg-content/5 hover:text-content"}`}
          >
            {o.label}
          </button>
        ))}
        {!visible.length && (
          <span className="p-2 text-content/45">
            {t("No matching options")}
          </span>
        )}
      </div>
    </div>
  );
}
