import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
import { keybindingPressed } from "../../settings/model/settings";
import type { VoiceConfig } from "../../settings/ui/VoiceSettings";
import { setWorkMode } from "../../settings/model/workMode";

export function encodeWave(
  chunks: Float32Array[],
  sampleRate: number,
): Uint8Array {
  const samples = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((char, i) =>
      view.setUint8(offset + i, char.charCodeAt(0)),
    );
  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  let offset = 44;
  for (const chunk of chunks)
    for (const value of chunk) {
      const sample = Math.max(-1, Math.min(1, value));
      view.setInt16(offset, sample * (sample < 0 ? 32768 : 32767), true);
      offset += 2;
    }
  return new Uint8Array(buffer);
}
export function voiceCommand(text: string): string | undefined {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[。.!！?？]+$/g, "");
  return (
    {
      新建任务: "new-task",
      "new task": "new-task",
      打开设置: "settings",
      "open settings": "settings",
      切换办公模式: "office",
      办公模式: "office",
      "office mode": "office",
      切换开发模式: "development",
      开发模式: "development",
      "development mode": "development",
    } as Record<string, string>
  )[normalized];
}
export function VoiceInput({
  onText,
  enabled = true,
  shortcutEnabled = true,
}: {
  onText: (text: string) => void;
  enabled?: boolean;
  shortcutEnabled?: boolean;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<
    "idle" | "starting" | "recording" | "transcribing"
  >("idle");
  const [error, setError] = useState("");
  const capture = useRef<{
    stream: MediaStream;
    context: AudioContext;
    source: MediaStreamAudioSourceNode;
    processor: ScriptProcessorNode;
    mute: GainNode;
    chunks: Float32Array[];
    timer: number;
  } | null>(null);
  const generation = useRef(0);
  const operation = useRef(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const cleanup = () => {
    const current = capture.current;
    capture.current = null;
    if (!current) return;
    window.clearTimeout(current.timer);
    current.processor.onaudioprocess = null;
    current.source.disconnect();
    current.processor.disconnect();
    current.mute.disconnect();
    current.stream.getTracks().forEach((track) => track.stop());
    void current.context.close();
  };
  useEffect(
    () => () => {
      generation.current++;
      cleanup();
    },
    [],
  );
  useEffect(() => {
    if (!enabled) {
      generation.current++;
      cleanup();
      operation.current = false;
      setState("idle");
    }
  }, [enabled]);
  const stop = async () => {
    const current = capture.current;
    if (!current) return;
    const token = generation.current;
    const audio = encodeWave(current.chunks, current.context.sampleRate);
    cleanup();
    setState("transcribing");
    try {
      const text = await invoke<string>("voice_transcribe", {
        audio: Array.from(audio),
      });
      if (token !== generation.current) return;
      const config = await invoke<VoiceConfig>("voice_config");
      if (token !== generation.current) return;
      const command = config.commands ? voiceCommand(text) : undefined;
      if (command === "office" || command === "development")
        setWorkMode(command);
      else if (command)
        window.dispatchEvent(
          new CustomEvent("mycode:voice-command", { detail: command }),
        );
      else if (text.trim()) onTextRef.current(text.trim());
    } catch (cause) {
      if (token === generation.current) setError(String(cause));
    } finally {
      if (token === generation.current) {
        operation.current = false;
        setState("idle");
      }
    }
  };
  const toggle = async () => {
    if (capture.current) {
      await stop();
      return;
    }
    if (operation.current || !enabled) return;
    operation.current = true;
    const token = ++generation.current;
    setError("");
    setState("starting");
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    try {
      const config = await invoke<VoiceConfig>("voice_config");
      if (!config.endpoint || !config.model)
        throw new Error(t("Configure a speech model in Settings first."));
      const endpoint = new URL(config.endpoint);
      if (/^token-plan.*\.xiaomimimo\.com$/.test(endpoint.hostname))
        throw new Error(t("MiMo speech requires the API endpoint and API key, not Token Plan. Select xiaomimimo API in Settings > Voice input and enter its API key."));
      if (endpoint.hostname === "api.xiaomimimo.com" && !config.hasKey)
        throw new Error(t("Speech authentication failed. Check the API key and model permissions in Settings > Voice input."));
      if (token !== generation.current) return;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (token !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      context = new AudioContext({ sampleRate: 16000 });
      await context.resume();
      if (token !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        await context.close();
        return;
      }
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const mute = context.createGain();
      mute.gain.value = 0;
      const chunks: Float32Array[] = [];
      processor.onaudioprocess = (event) =>
        chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      source.connect(processor);
      processor.connect(mute);
      mute.connect(context.destination);
      capture.current = {
        stream,
        context,
        source,
        processor,
        mute,
        chunks,
        timer: window.setTimeout(() => void stop(), 120000),
      };
      setState("recording");
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop());
      if (context) void context.close();
      if (token === generation.current) {
        setError(String(cause));
        setState("idle");
        operation.current = false;
      }
    }
  };
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        !enabled ||
        !shortcutEnabled ||
        event.defaultPrevented ||
        event.repeat ||
        document.querySelector('[role="dialog"]')
      )
        return;
      if (
        keybindingPressed(
          "Composer: Voice input",
          event,
          event.ctrlKey &&
            event.shiftKey &&
            !event.altKey &&
            !event.metaKey &&
            event.code === "Space",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
        void toggleRef.current();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [enabled, shortcutEnabled]);
  const label =
    state === "recording"
      ? "Stop recording"
      : state === "transcribing"
        ? "Transcribing…"
        : state === "starting"
          ? "Starting microphone…"
          : "Voice input";
  return (
    <span className="relative inline-flex items-center gap-1">
      {error && (
        <span
          role="alert"
          className="absolute bottom-full right-0 z-50 mb-2 w-80 max-w-[80vw] rounded-lg border border-red-400/30 bg-surface p-3 text-xs text-red-400 shadow-xl whitespace-normal break-words"
        >
          {error
            .replace(/^Error: /, "")
            .split(/(?= \(HTTP)/)
            .map((part) => t(part))}
          <button
            type="button"
            className="mt-2 block text-content/70 underline"
            onClick={() => setError("")}
          >
            {t("Dismiss")}
          </button>
        </span>
      )}
      <button
        type="button"
        title={t(label)}
        aria-label={t(label)}
        disabled={!enabled || state === "starting" || state === "transcribing"}
        onClick={() => void toggle()}
        className={`grid size-6.5 place-items-center rounded-md hover:bg-content/10 disabled:opacity-40 ${state === "recording" ? "animate-pulse text-red-400" : "text-content/60"}`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v2a7 7 0 0014 0v-2M12 19v3m-4 0h8" />
        </svg>
      </button>
    </span>
  );
}
