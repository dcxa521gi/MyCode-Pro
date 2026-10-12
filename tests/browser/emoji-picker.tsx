import { setLanguage, useTranslation } from "../../src/shared/i18n";
import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { EmojiPickerPopover } from "../../src/shared/ui/EmojiPicker";
import "../../src/styles/index.css";

setLanguage(
  new URLSearchParams(location.search).get("lang") === "zh-CN" ? "zh-CN" : "en",
);

// The real picker and its bundled data, opened from a button like the
// composer's, with each pick written out for the test to read.
function Fixture() {
  const { t, locale } = useTranslation();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState("");
  return (
    <div className="text-content">
      <button ref={button} type="button" onClick={() => setOpen(true)}>
        {t("Open")}
      </button>
      <button
        data-switch-language
        type="button"
        onClick={() => setLanguage(locale === "zh-CN" ? "en" : "zh-CN")}
      >
        {locale === "zh-CN" ? "切换语言" : "Switch language"}
      </button>
      <output data-picked>{picked}</output>
      {open ? (
        <EmojiPickerPopover
          anchor={button}
          onPick={(emoji) => {
            setPicked((current) => current + emoji);
            setOpen(false);
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
