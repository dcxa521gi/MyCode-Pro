import { useTranslation } from "../i18n";
import { useState } from "react";

/** Keep account emails private in screenshots until explicitly revealed. */
export function PrivateEmail({ email }: { email: string }) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const action = revealed ? "Hide email" : "Reveal email";

  return (
    <button
      type="button"
      aria-label={t(action)}
      aria-pressed={revealed}
      title={t(action)}
      className="pointer-events-auto relative min-w-0 truncate rounded-sm text-left focus-visible:outline-2 focus-visible:outline-accent"
      onClick={(event) => {
        event.stopPropagation();
        setRevealed((value) => !value);
      }}
    >
      <span
        aria-hidden={!revealed}
        className={revealed ? undefined : "select-none blur-[5px]"}
      >
        {email}
      </span>
    </button>
  );
}
