import { SettingsDropdown } from "../../../shared/ui/SettingsDropdown";
import { STUDIO_SPECS, studioText } from "../model/studio";

const field =
  "w-full rounded-xl border border-content/15 bg-content/[0.035] px-3 py-2.5 text-sm outline-none focus:border-content/35";
export function StudioEditor({
  id,
  values,
  onChange,
}: {
  id: string;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  const spec = STUDIO_SPECS[id];
  const update = (key: string, value: string) =>
    onChange({ ...values, [key]: value });
  const count = Number(
    values.slides ?? values.pages ?? values.chapters ?? values.episodes ?? 0,
  );
  const outline = (values.outline ?? values.storyboard ?? "")
    .split("\n")
    .filter(Boolean);
  return (
    <div data-studio-layout={spec.layout} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {spec.fields.map((f) => (
          <label
            key={f.id}
            className={`block min-w-0 space-y-2 text-xs ${f.kind === "textarea" ? "sm:col-span-2" : ""}`}
          >
            <span className="text-content/70">{studioText(f.label)}</span>
            {f.kind === "select" ? (
              <SettingsDropdown
                value={values[f.id] ?? f.value}
                onChange={(e) => update(f.id, e.target.value)}
              >
                {f.choices!.map((c) => (
                  <option key={c[0]} value={c[0]}>
                    {studioText([c[1], c[2]])}
                  </option>
                ))}
              </SettingsDropdown>
            ) : f.kind === "textarea" ? (
              <textarea
                className={`${field} min-h-24 resize-y`}
                value={values[f.id] ?? f.value}
                onChange={(e) => update(f.id, e.target.value)}
                maxLength={20000}
              />
            ) : (
              <input
                type={f.kind}
                min={f.min}
                max={f.max}
                step={f.kind === "number" ? 1 : undefined}
                className={field}
                value={values[f.id] ?? f.value}
                onChange={(e) => update(f.id, e.target.value)}
                maxLength={20000}
              />
            )}
          </label>
        ))}
      </div>
      {spec.layout === "design" && (
        <div className="rounded-xl border border-content/10 p-4">
          <p className="mb-3 text-xs text-content/55">
            {studioText([
              "Page plan · structure preview, not generated output",
              "页面规划 · 仅结构预览，并非生成成品",
            ])}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from(
              { length: Math.min(Math.max(count || 1, 1), 12) },
              (_, i) => (
                <div
                  key={i}
                  className={`flex flex-col justify-between overflow-hidden rounded-lg border border-content/15 bg-content/5 p-2 ${id === "presentation" ? "aspect-video" : "aspect-[3/4]"}`}
                >
                  <span className="text-[10px] text-content/45">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="line-clamp-2 text-xs">
                    {outline[i] ||
                      (i === 0
                        ? studioText(["Cover", "封面"])
                        : studioText(["Content", "内容页"]))}
                  </span>
                </div>
              ),
            )}
          </div>
          {count > 12 && (
            <p className="mt-2 text-xs text-content/50">
              {studioText(["Total pages", "总页数"])}：{count}
            </p>
          )}
        </div>
      )}
      {spec.layout === "video" && (
        <div className="rounded-xl border border-content/10 p-4">
          <p className="mb-3 text-xs text-content/55">
            {studioText(["Production workflow", "制作流程"])}
          </p>
          <ol className="flex flex-wrap gap-2">
            {spec.steps.map((s, i) => (
              <li
                key={s[0]}
                className="min-w-20 flex-1 rounded-lg border-l-2 border-content/30 bg-content/5 p-3 text-xs"
              >
                <span className="mb-2 block text-content/40">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {studioText(s)}
              </li>
            ))}
          </ol>
          {values.storyboard && (
            <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-content/65">
              {values.storyboard}
            </p>
          )}
        </div>
      )}
      {spec.layout === "writing" && (
        <div className="rounded-xl border border-content/10 bg-content/[0.02] p-4">
          <p className="text-xs font-medium">
            {studioText(["Manuscript structure", "稿件结构"])}
          </p>
          <p className="mt-2 text-xs text-content/55">
            {id === "novel"
              ? `${count} ${studioText(["chapters", "章"])} · ${values.words} ${studioText(["words per chapter", "字 / 章"])}`
              : `${count} ${studioText(["episodes", "集"])} · ${values.duration} ${studioText(["seconds per episode", "秒 / 集"])}`}
          </p>
          {outline.length > 0 && (
            <ol className="mt-3 list-inside list-decimal space-y-2 text-xs text-content/70">
              {outline.slice(0, 12).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          )}
        </div>
      )}
      {spec.layout === "image" && (
        <div className="flex items-center gap-4 rounded-xl border border-content/10 p-4">
          <div
            aria-hidden="true"
            className={`shrink-0 rounded-md border-2 border-dashed border-content/25 ${values.size === "1024x1536" ? "h-16 w-11" : values.size === "1536x1024" ? "h-11 w-16" : "h-14 w-14"}`}
          />
          <div className="text-xs leading-relaxed text-content/55">
            <p>{studioText(["Creation steps", "创作步骤"])}</p>
            <p>{spec.steps.map(studioText).join(" → ")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
