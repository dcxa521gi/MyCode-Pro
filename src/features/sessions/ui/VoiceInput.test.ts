import { expect, it } from "vitest";
import { encodeWave, voiceCommand } from "./VoiceInput";
it("encodes mono PCM with a valid WAV header and clips overflowing samples", () => {
  const bytes = encodeWave([new Float32Array([-2, 0, 2])], 16000);
  const view = new DataView(bytes.buffer);
  expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
  expect(view.getUint32(24, true)).toBe(16000);
  expect(view.getUint32(40, true)).toBe(6);
  expect(view.getInt16(44, true)).toBe(-32768);
  expect(view.getInt16(48, true)).toBe(32767);
});
it("recognizes only complete explicit commands, never text mentioning a command", () => {
  expect(voiceCommand("新建任务。")).toBe("new-task");
  expect(voiceCommand("Office mode!")).toBe("office");
  expect(voiceCommand("请帮我说明怎么新建任务")).toBeUndefined();
  expect(voiceCommand("send message")).toBeUndefined();
});
