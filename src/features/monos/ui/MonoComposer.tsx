import { translate as t, formatMessage } from "../../../shared/i18n";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { isImeComposition } from "../../../shared/lib/keyboard";
import { ArrowUp, Plus } from "../../../shared/ui/icons";
import { AttachmentChip } from "../../sessions/ui/AttachmentChip";
import type { Attachment } from "../../sessions/model/session";
import {
  attachmentsFromFiles,
  filesFromClipboard,
  mergeAttachments,
  pickAttachments,
  revokeAttachment,
} from "../../sessions/model/attachments";
import {
  getComposerDraft,
  setComposerDraft,
} from "../../sessions/model/draftCache";
import { useFileDrop } from "../../sessions/hooks/useFileDrop";
import { resizeComposer } from "../../sessions/model/composerResize";
import {
  contextPrompt,
  decodeContextDraft,
  encodeContextDraft,
  numberedNewline,
  shouldSend,
  useComposerBehavior,
} from "../../sessions/model/composerBehavior";
import {
  consumeQuoteRequest,
  type QuoteRequest,
} from "../../sessions/model/quoteDraft";

const DROP_STATE = { current: { attachmentsSupported: true, remote: false } };

/** Tallest the field grows before it scrolls, in px. */
const MAX_HEIGHT = 160;
const INPUT_COLUMNS = "grid-cols-[1.625rem_minmax(0,1fr)_1.625rem]";
const FIELD_CLASSES =
  "scrollbar-none block min-w-0 w-full resize-none bg-transparent py-1 text-[13px] leading-4.5 text-content outline-none placeholder:text-content/35";

type Props = {
  sessionId: string;
  name: string;
  enabled?: boolean;
  focusToken?: number;
  quoteRequest?: QuoteRequest;
  onQuoteRequestConsumed?: (id: number) => void;
  onDraftChange?: (text: string) => void;
  /** Returns false when the message wasn't taken, so the draft stays. */
  onSubmit: (
    text: string,
    attachments: Attachment[],
  ) => boolean | void | Promise<boolean | void>;
  onFocus?: () => void;
};

/**
 * A messaging app's input for the Mono: attach, type, send, whether or not
 * it is mid-reply; Escape stops a reply. Files dropped anywhere on the chat
 * attach here. The model, permissions and checkout
 * live in the details panel instead.
 */
export function MonoComposer({
  sessionId,
  name,
  enabled = true,
  focusToken,
  quoteRequest,
  onQuoteRequestConsumed,
  onDraftChange,
  onSubmit,
  onFocus,
}: Props) {
  const behavior = useComposerBehavior();
  const [initial] = useState(() =>
    decodeContextDraft(getComposerDraft(sessionId) ?? ""),
  );
  const [text, setText] = useState(initial.text);
  const [quotes, setQuotes] = useState(initial.quotes);
  const quotesRef = useRef(quotes);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textRef = useRef(text);
  const attachmentsRef = useRef(attachments);
  const consumedQuote = useRef<number | null>(null);
  const readGeneration = useRef(0);
  const pendingReadsRef = useRef(0);
  const [pendingReads, setPendingReads] = useState(0);
  const [multiline, setMultiline] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const inlineMeasure = useRef<HTMLTextAreaElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const ready =
    enabled &&
    !submitting &&
    pendingReads === 0 &&
    (text.trim().length > 0 || attachments.length > 0 || quotes.length > 0);
  // Attachments sit above the field like a second line of text, so the field
  // moves above the buttons for them too.
  const stacked = multiline || attachments.length > 0 || quotes.length > 0;

  useLayoutEffect(() => {
    const el = field.current;
    const measure = inlineMeasure.current;
    if (!el || !measure) return;
    const fit = () => {
      if (!measure.clientWidth) return;
      // Always measure at the inline width. Expanding the field above the
      // buttons must not make it collapse again just because it is wider.
      const style = getComputedStyle(measure);
      const singleLineHeight =
        Number.parseFloat(style.lineHeight) +
        Number.parseFloat(style.paddingTop) +
        Number.parseFloat(style.paddingBottom);
      setMultiline(measure.scrollHeight > singleLineHeight + 1);
      // Holds the input's height while measuring, as sessions do, so the
      // transcript above never grows for a moment and loses its bottom pin.
      resizeComposer(el, MAX_HEIGHT);
      el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
    };
    fit();
    // An empty field stays one line at any width, so once measured, resizing
    // the panes beside it need not measure it every frame.
    if (!text && measure.clientWidth) return;
    const observer = new ResizeObserver(fit);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [text, multiline, stacked]);

  useLayoutEffect(() => {
    if (focusToken != null) field.current?.focus();
  }, [focusToken]);

  const update = (next: string) => {
    textRef.current = next;
    setText(next);
    const persisted = encodeContextDraft(next, quotesRef.current);
    setComposerDraft(sessionId, persisted);
    onDraftChange?.(persisted);
  };
  useLayoutEffect(() => {
    if (
      quoteRequest &&
      quoteRequest.id !== consumedQuote.current &&
      quoteRequest.mode !== "plain"
    ) {
      consumedQuote.current = quoteRequest.id;
      const selected = quoteRequest.text.replace(/\r\n?/g, "\n").trim();
      if (selected) {
        quotesRef.current = [...quotesRef.current, selected];
        setQuotes(quotesRef.current);
        update(textRef.current);
        if (enabled) field.current?.focus();
      }
      onQuoteRequestConsumed?.(quoteRequest.id);
      return;
    }
    const next = consumeQuoteRequest(
      textRef.current,
      consumedQuote.current,
      quoteRequest,
    );
    consumedQuote.current = next.consumedId;
    if (next.changed) {
      update(next.draft);
      if (enabled) field.current?.focus();
    }
    if (next.consumedId != null) onQuoteRequestConsumed?.(next.consumedId);
  }, [quoteRequest, onQuoteRequestConsumed, enabled]);
  useLayoutEffect(
    () => () => {
      readGeneration.current++;
      for (const file of attachmentsRef.current) revokeAttachment(file);
    },
    [],
  );
  const add = (incoming: Attachment[]) => {
    if (incoming.length === 0) return;
    const next = mergeAttachments(attachmentsRef.current, incoming);
    attachmentsRef.current = next;
    setAttachments(next);
  };
  const readAttachments = useCallback(
    (read: () => Promise<Attachment[]>, dropped = false) => {
      if (submittingRef.current) return;
      const generation = readGeneration.current;
      pendingReadsRef.current++;
      setPendingReads(pendingReadsRef.current);
      setDropError(null);
      Promise.resolve()
        .then(read)
        .then((incoming) => {
          if (generation !== readGeneration.current) {
            incoming.forEach(revokeAttachment);
            return;
          }
          if (incoming.length === 0) {
            if (dropped)
              setDropError(
                t(
                  "Nothing to attach from that drop — the file may have been moved, renamed, or deleted.",
                ),
              );
            return;
          }
          add(incoming);
        })
        .catch((reason: unknown) => {
          if (generation === readGeneration.current)
            setDropError(
              reason instanceof Error ? reason.message : String(reason),
            );
        })
        .finally(() => {
          pendingReadsRef.current--;
          if (generation === readGeneration.current)
            setPendingReads(pendingReadsRef.current);
        });
    },
    [],
  );
  const readDropped = useCallback(
    (read: () => Promise<Attachment[]>) => {
      readAttachments(read, true);
    },
    [readAttachments],
  );
  const fileDrag = useFileDrop({
    anchor: box,
    enabled: enabled && !submitting,
    state: DROP_STATE,
    read: readDropped,
    onError: setDropError,
  });
  const send = () => {
    if (!enabled || submittingRef.current || pendingReadsRef.current > 0)
      return;
    const message = contextPrompt(textRef.current.trim(), quotesRef.current);
    const draft = encodeContextDraft(textRef.current, quotesRef.current);
    const files = attachmentsRef.current;
    if (!message && !files.length) return;
    const generation = readGeneration.current;
    const clear = (accepted: boolean | void) => {
      if (accepted === false) return;
      if (generation !== readGeneration.current) {
        if (getComposerDraft(sessionId) === draft)
          setComposerDraft(sessionId, "");
        return;
      }
      quotesRef.current = [];
      setQuotes([]);
      update("");
      attachmentsRef.current = [];
      setAttachments([]);
      setDropError(null);
    };
    const result = onSubmit(message, files);
    if (result instanceof Promise) {
      submittingRef.current = true;
      setSubmitting(true);
      void result
        .then(clear)
        .catch((reason: unknown) => {
          if (generation === readGeneration.current)
            setDropError(
              reason instanceof Error ? reason.message : String(reason),
            );
        })
        .finally(() => {
          submittingRef.current = false;
          if (generation === readGeneration.current) setSubmitting(false);
        });
    } else clear(result);
  };

  return (
    <form
      className="mx-auto w-full max-w-4xl shrink-0 p-1.5 pt-0 font-sans"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <div
        ref={box}
        className={`agent-chat-composer relative rounded-lg border bg-content/3 backdrop-blur-sm ${fileDrag ? "border-accent/60" : "border-content/10 has-focus:border-content/20"}`}
      >
        {fileDrag ? (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-lg bg-accent/8 text-[12px] text-content/70">
            {t("Drop files to attach")}
          </div>
        ) : null}
        {dropError ? (
          <p role="alert" className="px-3 pt-2 text-xs text-red-400">
            {dropError}
          </p>
        ) : null}
        {quotes.length > 0 ? (
          <div
            aria-label={t("Quoted context")}
            className="flex flex-wrap gap-1.5 px-2.5 pt-2"
          >
            {quotes.map((quote, index) => (
              <span
                key={index}
                className="inline-flex max-w-64 items-center gap-2 rounded-md border border-content/15 bg-content/6 px-2 py-1 text-xs text-content/70"
              >
                <span className="truncate" title={quote}>
                  {quote.split("\n")[0].slice(0, 70) || t("Quoted text")}
                </span>
                <button
                  type="button"
                  aria-label={t("Remove quote")}
                  onClick={() => {
                    quotesRef.current = quotesRef.current.filter(
                      (_, i) => i !== index,
                    );
                    setQuotes(quotesRef.current);
                    update(textRef.current);
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 px-2.5 pt-2">
            {attachments.map((file) => (
              <AttachmentChip
                key={file.id}
                attachment={file}
                onRemove={() => {
                  if (submittingRef.current) return;
                  revokeAttachment(file);
                  const next = attachmentsRef.current.filter(
                    (item) => item.id !== file.id,
                  );
                  attachmentsRef.current = next;
                  setAttachments(next);
                }}
              />
            ))}
          </div>
        ) : null}
        <div
          data-layout={stacked ? "multiline" : "inline"}
          className={`relative grid min-h-9 ${INPUT_COLUMNS} items-center gap-x-1.5 p-1 ${stacked ? "gap-y-1" : ""}`}
        >
          <div
            aria-hidden="true"
            className={`pointer-events-none invisible absolute inset-x-1 top-1 grid ${INPUT_COLUMNS} gap-x-1.5`}
          >
            <textarea
              ref={inlineMeasure}
              tabIndex={-1}
              readOnly
              rows={1}
              value={text}
              className={`${FIELD_CLASSES} col-start-2 h-0 overflow-hidden`}
            />
          </div>
          <button
            type="button"
            title={t("Attach files")}
            aria-label={t("Attach files")}
            disabled={!enabled || submitting}
            onClick={() => readAttachments(pickAttachments)}
            className={`col-start-1 grid size-6.5 place-items-center rounded-md bg-content/8 text-content/55 hover:bg-content/12 hover:text-content ${stacked ? "row-start-2" : "row-start-1"}`}
          >
            <Plus className="size-3.5" strokeWidth={1.75} />
          </button>
          <textarea
            ref={field}
            rows={1}
            aria-label={formatMessage("Message {value0}", { value0: name })}
            placeholder={formatMessage("Message {value0}", { value0: name })}
            disabled={!enabled || submitting}
            value={text}
            onFocus={onFocus}
            onChange={(event) => update(event.target.value)}
            onKeyDown={(event) => {
              if (isImeComposition(event.nativeEvent)) return;
              if (shouldSend(event, behavior.sendKey)) {
                event.preventDefault();
                send();
              } else if (event.key === "Enter" && behavior.numberedLists) {
                const next = numberedNewline(
                  event.currentTarget.value,
                  event.currentTarget.selectionStart,
                  event.currentTarget.selectionEnd,
                );
                if (next) {
                  event.preventDefault();
                  update(next.text);
                  requestAnimationFrame(() =>
                    field.current?.setSelectionRange(next.cursor, next.cursor),
                  );
                }
              }
            }}
            onPaste={(event) => {
              const files = filesFromClipboard(event.clipboardData);
              if (files.length === 0) return;
              event.preventDefault();
              readAttachments(() => attachmentsFromFiles(files));
            }}
            className={`${FIELD_CLASSES} row-start-1 ${stacked ? "col-span-3 col-start-1 px-1.5" : "col-start-2"}`}
          />
          <button
            type="submit"
            aria-label={t("Send")}
            title={pendingReads ? t("Reading attachments…") : t("Send")}
            disabled={!ready}
            className={`primary-action col-start-3 grid size-6.5 place-items-center rounded-md transition-[background-color,color,transform] duration-150 active:scale-90 disabled:cursor-default ${stacked ? "row-start-2" : "row-start-1"}`}
          >
            <ArrowUp className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </form>
  );
}
