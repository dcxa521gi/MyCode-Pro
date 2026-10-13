import { createRoot } from "react-dom/client";
import { HtmlArtifactFrame } from "../../src/features/artifacts/ui/HtmlArtifactFrame";
import { applyThemePreference } from "../../src/features/settings/model/appearance";
import "../../src/styles/index.css";
import { getLocale, setLanguage } from "../../src/shared/i18n";
setLanguage("en");
applyThemePreference("light");
createRoot(document.getElementById("root")!).render(
  <main className="min-h-screen bg-background-base p-6 text-content">
    <button
      data-switch-theme
      onClick={() =>
        applyThemePreference(
          document.documentElement.classList.contains("theme-light")
            ? "dark"
            : "light",
        )
      }
    >
      Switch theme
    </button>
    <div data-parent-private>Private parent DOM</div>
    <button
      data-switch-language
      onClick={() => setLanguage(getLocale() === "en" ? "zh-CN" : "en")}
    >
      Switch language
    </button>
    <HtmlArtifactFrame id="fixture-visual" title="Fixture visual" version={1} />
  </main>,
);
