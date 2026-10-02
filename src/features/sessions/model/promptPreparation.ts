import { applyFileMentionsToTurn } from "../../files/model/fileMentions";
import { applyNotesToTurn } from "../../notes";
import {
  applySkillsToTurn,
  warmNativeSkills,
  isNativeCommandPrompt,
  type SkillCatalogContext,
} from "../../skills/model/skills";
import { nativeCommandPrompt } from "../../../integrations/harness/core/nativeCommands";
import { getLocale } from "../../../shared/i18n";
import { loadIMCompletion } from "../../settings/model/imCompletion";

export async function preparePrompt(
  text: string,
  context: SkillCatalogContext,
): Promise<string> {
  warmNativeSkills(context);
  if (isNativeCommandPrompt(text, context.harness))
    return nativeCommandPrompt(context.harness, text);
  const withFiles = await applyFileMentionsToTurn(text, context.cwd);
  const withNotes = await applyNotesToTurn(withFiles);
  const prompt = await applySkillsToTurn(withNotes, context);
  const chinese = getLocale() === "zh-CN";
  const language = chinese
    ? "Use Simplified Chinese for explanations and progress updates unless the user explicitly asks for another language. Keep code, paths and commands unchanged."
    : "Use English for explanations and progress updates unless the user explicitly asks for another language. Keep code, paths and commands unchanged.";
  const completion = loadIMCompletion().channels.length
    ? chinese
      ? "Finish with a concise Chinese summary of completed work and any proposed next steps. Do not invent results or execute unrequested next steps."
      : "Finish with a concise summary of completed work and any proposed next steps. Do not invent results or execute unrequested next steps."
    : "";
  return `${prompt}\n\n<MyCode-response-preferences>\n${language}\n${completion}\n</MyCode-response-preferences>`;
}
