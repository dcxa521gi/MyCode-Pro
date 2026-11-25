import type { AgentModel } from "../../sessions/model/models";
import { getLocale } from "../../../shared/i18n";
export const WORKBENCH_TASKS = [
  {
    id: "text-image",
    title: "Text to image",
    category: "Images",
    media: "image",
    reference: false,
  },
  {
    id: "image-image",
    title: "Image to image",
    category: "Images",
    media: "image-edit",
    reference: true,
  },
  {
    id: "text-video",
    title: "Text to video",
    category: "Videos",
    media: "video",
    reference: false,
  },
  {
    id: "image-video",
    title: "Image to video",
    category: "Videos",
    media: "video",
    reference: true,
  },
  {
    id: "image-recreate",
    title: "Recreate an image",
    category: "Images",
    media: "image-edit",
    reference: true,
  },
  {
    id: "video-recreate",
    title: "Recreate a video",
    category: "Videos",
    media: "agent",
    reference: true,
  },
  {
    id: "image-prompt",
    title: "Image to prompt",
    category: "Writing",
    media: "agent",
    reference: true,
  },
  {
    id: "video-prompt",
    title: "Video to prompt",
    category: "Writing",
    media: "agent",
    reference: true,
  },
  {
    id: "novel",
    title: "Write a novel",
    category: "Writing",
    media: "agent",
    reference: false,
  },
  {
    id: "drama",
    title: "Create a short drama",
    category: "Writing",
    media: "agent",
    reference: false,
  },
  {
    id: "picture-book",
    title: "Create a picture book",
    category: "Design",
    media: "agent",
    reference: false,
  },
  {
    id: "presentation",
    title: "Create a presentation",
    category: "Design",
    media: "agent",
    reference: false,
  },
  {
    id: "short-video",
    title: "Create a short video",
    category: "Videos",
    media: "agent",
    reference: false,
  },
] as const;
export type WorkbenchTask = (typeof WORKBENCH_TASKS)[number];
export type WorkbenchJob = {
  id: string;
  task: string;
  title: string;
  prompt: string;
  cwd: string;
  model: string;
  connectionId?: string;
  reference?: string;
  createdAt: number;
  status: string;
  paths: string[];
  text?: string;
  remoteId?: string;
  sessionId?: string;
  mediaModels?: {
    image?: { connectionId: string; model: string };
    video?: { connectionId: string; model: string };
  };
};
const KEY = "mycode.workbench.jobs.v1";
export function workbenchJobs(): WorkbenchJob[] {
  try {
    const jobs = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(jobs)
      ? jobs.filter((j) => j && typeof j.id === "string" && typeof j.cwd === "string" && typeof j.model === "string" && typeof j.prompt === "string" && typeof j.status === "string" && Array.isArray(j.paths) && j.paths.every((p: unknown) => typeof p === "string")).slice(0, 200)
      : [];
  } catch {
    return [];
  }
}
export function saveWorkbenchJob(job: WorkbenchJob) {
  localStorage.setItem(
    KEY,
    JSON.stringify(
      [job, ...workbenchJobs().filter((j) => j.id !== job.id)].slice(0, 200),
    ),
  );
  window.dispatchEvent(new Event("mycode:workbench-jobs"));
}
export type WorkbenchAgentInput = {
  job: WorkbenchJob;
  task: WorkbenchTask;
  model: AgentModel;
  onStarted: (sessionId: string) => void;
};
export function workbenchPrompt({ job, task }: WorkbenchAgentInput): string {
  const deliverables: Record<string, string> = {
    novel:
      "Produce a chapter outline, character bible, consistent chapter manuscripts and an editable Markdown manuscript. Complete the requested scope, not merely a plan.",
    drama:
      "Produce the premise, character profiles, episode outline, full screenplay with dialogue, shot list and editable production documents.",
    "picture-book":
      "Produce age-appropriate page text, consistent character and illustration specifications, page layouts and a printable PDF or HTML book. Generate actual illustrations through an available configured image tool; if none is available clearly report the missing dependency rather than simulating images.",
    presentation:
      "Produce an actual editable .pptx file, with a coherent visual system, slide structure, diagrams and speaker notes. Render and inspect a preview when the environment supports it. Markdown alone is not the deliverable.",
    "short-video":
      "Create a storyboard, narration, subtitles, timeline and an actual playable video using available media generation and editing tools. Check installed tools and configured media models first. Never claim a video was generated when only a script exists.",
    "video-recreate":
      "Inspect the reference video, extracting frames and timing with local media tools. Describe composition, movement, transitions and sound; then produce a new original video following the requested visual direction using configured generation/editing tools. Clearly report unsupported media generation instead of substituting a fake result.",
    "image-prompt":
      "Inspect the actual reference image and write a reusable image-generation prompt: subject, framing, composition, lighting, materials, palette, camera, style and negative constraints. Save an editable prompt file.",
    "video-prompt":
      "Inspect the actual reference video through frames and timing, not just its filename. Produce a shot-by-shot reusable video prompt with motion, transitions, timing and sound, plus an overall style prompt. Save editable files.",
  };
  return [
    "/operator\nYou are MyCode's creative workbench agent.",
    `Task: ${task.title}`,
    `Output folder: ${job.cwd}/.mycode/workbench/${job.id}`,
    "For real image/video generation use the MyCode app CLI: media.models lists configured models; media.generate starts a billable generation using an explicit connectionId/model/kind/prompt and optional reference image; media.result polls its jobId and returns actual saved files. Choose a model the user configured for the required capability, ask when the choice is ambiguous, and never replay a submitted generation after a timeout.",
    `User-authorized media models: ${JSON.stringify(job.mediaModels ?? {})}. Use exactly these connectionId/model pairs. If a required generation model is not selected, ask the user to select it before generating paid media.`,
    "Keep generated files and task caches inside the selected project folder. Preserve existing files. Use the selected model and existing permission approvals. Inspect available tools before execution and report actual outputs and limitations.",
    getLocale() === "zh-CN"
      ? "请始终使用简体中文回复，文稿、状态和文件说明使用简体中文。"
      : "Respond in English.",
    deliverables[task.id] ?? task.title,
    job.reference ? `User-selected reference file: ${job.reference}` : "",
    `User request:\n${job.prompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
