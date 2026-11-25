import { getLocale } from "../../../shared/i18n";
export type StudioText = readonly [string, string];
export const studioText = (text: StudioText) =>
  text[getLocale() === "zh-CN" ? 1 : 0];
export type StudioField = {
  id: string;
  label: StudioText;
  kind: "text" | "textarea" | "number" | "select";
  value: string;
  choices?: readonly (readonly [string, string, string])[];
  min?: number;
  max?: number;
};
export type StudioSpec = {
  description: StudioText;
  prompt: StudioText;
  placeholder: StudioText;
  fields: StudioField[];
  steps: StudioText[];
  layout: "writing" | "image" | "video" | "design";
};
const text = (
  id: string,
  en: string,
  zh: string,
  multiline = false,
): StudioField => ({
  id,
  label: [en, zh],
  kind: multiline ? "textarea" : "text",
  value: "",
});
const number = (
  id: string,
  en: string,
  zh: string,
  value: number,
  min: number,
  max: number,
): StudioField => ({
  id,
  label: [en, zh],
  kind: "number",
  value: String(value),
  min,
  max,
});
const select = (
  id: string,
  en: string,
  zh: string,
  choices: readonly (readonly [string, string, string])[],
): StudioField => ({
  id,
  label: [en, zh],
  kind: "select",
  value: choices[0][0],
  choices,
});
const imageSize = () =>
  select("size", "Canvas size", "画布尺寸", [
    ["auto", "Model default", "模型默认"],
    ["1024x1024", "Square · 1024 × 1024", "方形 · 1024 × 1024"],
    ["1536x1024", "Landscape · 1536 × 1024", "横向 · 1536 × 1024"],
    ["1024x1536", "Portrait · 1024 × 1536", "竖向 · 1024 × 1536"],
  ]);
const videoSize = () =>
  select("size", "Video frame", "视频画幅", [
    ["auto", "Model default", "模型默认"],
    ["1280x720", "Landscape · 16:9", "横屏 · 16:9"],
    ["720x1280", "Portrait · 9:16", "竖屏 · 9:16"],
  ]);
const art = () =>
  select("style", "Visual style", "视觉风格", [
    ["natural", "Natural photography", "自然摄影"],
    ["cinematic", "Cinematic", "电影质感"],
    ["illustration", "Illustration", "插画"],
    ["watercolor", "Watercolor", "水彩"],
    ["3d", "3D design", "三维设计"],
  ]);
const negative = () =>
  text("negative", "Avoid in the result", "排除内容", true);
const motion = () =>
  select("camera", "Camera movement", "镜头运动", [
    ["static", "Static camera", "固定镜头"],
    ["push-in", "Slow push-in", "缓慢推进"],
    ["orbit", "Orbit subject", "环绕主体"],
    ["tracking", "Track subject", "跟随主体"],
    ["handheld", "Handheld", "手持跟拍"],
  ]);
const imageSteps: StudioText[] = [
  ["Describe", "描述画面"],
  ["Generate", "生成图片"],
  ["Review", "检查成品"],
];
const videoSteps: StudioText[] = [
  ["Direct", "设定镜头"],
  ["Generate", "生成视频"],
  ["Preview", "播放检查"],
];
export const STUDIO_SPECS: Record<string, StudioSpec> = {
  "text-image": {
    layout: "image",
    description: [
      "Compose an image from a subject, visual direction and canvas.",
      "从主体、视觉风格和画布尺寸开始创作一张图片。",
    ],
    prompt: ["Describe the scene", "画面描述"],
    placeholder: [
      "Subject, environment, lighting and composition…",
      "描述主体、环境、光线与构图……",
    ],
    fields: [
      imageSize(),
      art(),
      number("n", "Image count", "生成数量", 1, 1, 4),
      negative(),
    ],
    steps: imageSteps,
  },
  "image-image": {
    layout: "image",
    description: [
      "Transform a reference image while keeping the details you choose.",
      "以参考图为基础，明确需要修改和保留的部分。",
    ],
    prompt: ["What should change?", "你想修改哪里？"],
    placeholder: [
      "Change the background to… Keep the person and pose…",
      "例如：将背景改为海边，保留人物和姿势……",
    ],
    fields: [
      text("preserve", "Details to preserve", "需要保留的细节", true),
      imageSize(),
      art(),
      negative(),
    ],
    steps: [
      ["Reference", "选择原图"],
      ["Edit direction", "指定修改"],
      ["Compare", "对比结果"],
    ],
  },
  "image-recreate": {
    layout: "image",
    description: [
      "Study the reference and create a new interpretation with controlled similarities.",
      "拆解参考图的构图与风格，创作有明确保留重点的新画面。",
    ],
    prompt: ["Your reinterpretation", "复刻方向"],
    placeholder: [
      "A new subject using the reference composition…",
      "描述新的主体，以及希望参考的构图或质感……",
    ],
    fields: [
      select("retain", "Reference priority", "参考重点", [
        ["composition", "Composition", "构图布局"],
        ["palette", "Color palette", "配色氛围"],
        ["lighting", "Lighting", "光影质感"],
        ["style", "Art direction", "整体风格"],
      ]),
      text("changes", "Intentional differences", "希望改变的元素", true),
      imageSize(),
      negative(),
    ],
    steps: [
      ["Analyze", "提炼参考"],
      ["Reinterpret", "重建画面"],
      ["Compare", "检查差异"],
    ],
  },
  "text-video": {
    layout: "video",
    description: [
      "Direct a shot with action, camera motion and timing.",
      "通过主体动作、镜头运动与时长，导演一段视频。",
    ],
    prompt: ["Describe the action", "镜头内容"],
    placeholder: [
      "A continuous shot of… The subject moves…",
      "描述连续镜头中的场景和主体动作……",
    ],
    fields: [
      videoSize(),
      select("seconds", "Clip length", "生成时长", [
        ["auto", "Model default", "模型默认"],
        ["4", "4 seconds", "4 秒"],
        ["8", "8 seconds", "8 秒"],
        ["12", "12 seconds", "12 秒"],
      ]),
      motion(),
      text("lighting", "Light and atmosphere", "光线与氛围"),
      negative(),
    ],
    steps: videoSteps,
  },
  "image-video": {
    layout: "video",
    description: [
      "Animate the reference frame with a precise motion brief.",
      "以参考图作为起始画面，分别控制主体运动和镜头变化。",
    ],
    prompt: ["How should the image move?", "画面如何动起来？"],
    placeholder: [
      "The leaves sway gently while the camera…",
      "例如：树叶轻轻摇动，镜头缓慢向前推进……",
    ],
    fields: [
      text("subjectMotion", "Subject motion", "主体运动"),
      motion(),
      text("preserve", "Keep stable", "保持不变的元素"),
      videoSize(),
      select("seconds", "Clip length", "生成时长", [
        ["auto", "Model default", "模型默认"],
        ["4", "4 seconds", "4 秒"],
        ["8", "8 seconds", "8 秒"],
        ["12", "12 seconds", "12 秒"],
      ]),
    ],
    steps: [
      ["First frame", "选择首帧"],
      ["Motion brief", "编排运动"],
      ["Preview", "播放检查"],
    ],
  },
  "video-recreate": {
    layout: "video",
    description: [
      "Analyze shot timing and rebuild a reference video as an original production.",
      "先分析参考视频的镜头和节奏，再制作新的原创视频。",
    ],
    prompt: ["Recreation brief", "视频复刻要求"],
    placeholder: [
      "Keep the pacing but use a different setting…",
      "例如：保留节奏，替换场景、主角和文案……",
    ],
    fields: [
      text("segment", "Reference time range", "参考片段范围（如 00:05–00:20）"),
      text("shots", "Shots to preserve or change", "镜头保留与调整", true),
      number("duration", "Target seconds", "目标时长（秒）", 30, 4, 600),
      videoSize(),
      text("audio", "Sound and narration", "声音与旁白"),
    ],
    steps: [
      ["Extract frames", "抽帧分析"],
      ["Shot breakdown", "镜头拆解"],
      ["Rebuild", "制作新片"],
      ["Review", "检查成片"],
    ],
  },
  "image-prompt": {
    layout: "image",
    description: [
      "Extract a reusable prompt from the actual visual composition.",
      "从真实图片提取构图、光线、材质与风格，输出可复用提示词。",
    ],
    prompt: ["Analysis focus", "重点分析要求"],
    placeholder: [
      "Focus on the lighting, lens and materials…",
      "例如：重点分析光线、镜头和材质……",
    ],
    fields: [
      select("language", "Prompt language", "提示词语言", [
        ["bilingual", "Chinese + English", "中英双语"],
        ["Chinese", "Chinese", "简体中文"],
        ["English", "English", "英语"],
      ]),
      select("format", "Output structure", "输出结构", [
        [
          "structured",
          "Structured fields + full prompt",
          "分项拆解 + 完整提示词",
        ],
        ["json", "JSON + negative prompt", "JSON + 负面提示词"],
      ]),
      text("target", "Target generation model", "目标生图模型（可选）"),
    ],
    steps: [
      ["Inspect", "读取图片"],
      ["Decompose", "视觉拆解"],
      ["Export prompt", "导出提示词"],
    ],
  },
  "video-prompt": {
    layout: "video",
    description: [
      "Turn a reference clip into timed shot prompts and a style guide.",
      "把参考视频转为逐镜头提示词、时间轴和整体风格说明。",
    ],
    prompt: ["Analysis brief", "视频分析要求"],
    placeholder: [
      "Describe each shot, transition and sound cue…",
      "描述需要提取的镜头、转场和声音信息……",
    ],
    fields: [
      text("segment", "Time range", "分析时间范围"),
      number(
        "interval",
        "Frame sampling interval (seconds)",
        "抽帧间隔（秒）",
        2,
        1,
        30,
      ),
      select("language", "Prompt language", "提示词语言", [
        ["bilingual", "Chinese + English", "中英双语"],
        ["Chinese", "Chinese", "简体中文"],
        ["English", "English", "英语"],
      ]),
      text("focus", "Camera and transition focus", "镜头与转场重点", true),
    ],
    steps: [
      ["Sample", "抽帧采样"],
      ["Timeline", "镜头时间轴"],
      ["Export prompts", "导出分镜提示词"],
    ],
  },
  novel: {
    layout: "writing",
    description: [
      "Build a story bible, chapter outline and consistent manuscript.",
      "从故事设定、角色档案到章节大纲，完成连贯的小说正文。",
    ],
    prompt: ["Story premise", "故事梗概"],
    placeholder: [
      "Who is the protagonist, what do they want, and what stands in their way?",
      "主角是谁、想要什么、将面临怎样的阻碍？",
    ],
    fields: [
      select("genre", "Genre", "题材", [
        ["fantasy", "Fantasy", "奇幻"],
        ["suspense", "Suspense", "悬疑"],
        ["romance", "Romance", "情感"],
        ["scifi", "Science fiction", "科幻"],
        ["realism", "Realism", "现实主义"],
      ]),
      select("pov", "Point of view", "叙事视角", [
        ["third-person", "Third person", "第三人称"],
        ["first-person", "First person", "第一人称"],
      ]),
      number("chapters", "Chapters", "章节数", 12, 1, 100),
      number("words", "Words per chapter", "每章目标字数", 1500, 200, 10000),
      text("characters", "Character bible", "人物设定", true),
      text("outline", "Chapter outline", "章节大纲（可选）", true),
    ],
    steps: [
      ["Story bible", "故事设定"],
      ["Outline", "章节大纲"],
      ["Manuscript", "正文创作"],
      ["Continuity", "一致性校对"],
    ],
  },
  drama: {
    layout: "writing",
    description: [
      "Develop a dramatic hook, episode arcs and a production-ready screenplay.",
      "设计冲突与钩子，形成分集剧情、完整对白和拍摄分镜。",
    ],
    prompt: ["Dramatic premise", "核心剧情"],
    placeholder: [
      "The central conflict and the opening hook…",
      "描述核心冲突、开场钩子和人物关系……",
    ],
    fields: [
      number("episodes", "Episodes", "集数", 8, 1, 100),
      number("duration", "Seconds per episode", "每集时长（秒）", 90, 15, 600),
      text("cast", "Cast and relationships", "角色与关系", true),
      text("ending", "Ending and cliffhangers", "结局与悬念", true),
      select("format", "Screenplay format", "剧本形式", [
        ["vertical", "Vertical short drama", "竖屏短剧"],
        ["dialogue", "Dialogue-driven", "对白驱动"],
        ["storyboard", "Shot-by-shot", "分镜剧本"],
      ]),
    ],
    steps: [
      ["Hook", "冲突钩子"],
      ["Episodes", "分集大纲"],
      ["Dialogue", "剧本对白"],
      ["Shot list", "拍摄分镜"],
    ],
  },
  "picture-book": {
    layout: "design",
    description: [
      "Plan a book page by page with a consistent cast and visual language.",
      "按页编排故事、文字和插画，保持角色与视觉风格一致。",
    ],
    prompt: ["Book idea", "绘本故事"],
    placeholder: [
      "A story about courage for young readers…",
      "例如：面向幼儿的勇气主题故事……",
    ],
    fields: [
      select("age", "Reading age", "读者年龄", [
        ["3-5", "Ages 3–5", "3–5 岁"],
        ["6-8", "Ages 6–8", "6–8 岁"],
        ["9-12", "Ages 9–12", "9–12 岁"],
      ]),
      number("pages", "Pages", "页数", 12, 4, 48),
      text("characters", "Character appearance", "角色外观档案", true),
      art(),
      text("outline", "Page-by-page outline", "分页内容（可选）", true),
      select("format", "Book output", "绘本输出", [
        ["pdf-html", "Printable PDF + HTML", "可打印 PDF + HTML"],
        ["html", "Interactive HTML", "HTML 绘本"],
      ]),
    ],
    steps: [
      ["Page plan", "分页规划"],
      ["Illustrations", "插画制作"],
      ["Layout", "图文排版"],
      ["Book export", "导出绘本"],
    ],
  },
  presentation: {
    layout: "design",
    description: [
      "Shape a narrative, slides and speaker notes into an editable deck.",
      "围绕受众组织叙事、页面和演讲备注，输出可编辑 PPT。",
    ],
    prompt: ["Presentation brief", "演示主题与目标"],
    placeholder: [
      "Explain the key message and what the audience should do next…",
      "说明核心观点，以及希望受众理解或采取的行动……",
    ],
    fields: [
      text("audience", "Audience", "目标受众"),
      number("slides", "Slide count", "页数", 10, 3, 60),
      select("aspect", "Slide ratio", "页面比例", [
        ["16:9", "Widescreen 16:9", "宽屏 16:9"],
        ["4:3", "Classic 4:3", "标准 4:3"],
      ]),
      select("style", "Design direction", "设计方向", [
        ["editorial", "Editorial minimal", "简洁编辑风"],
        ["business", "Business report", "商务报告"],
        ["data", "Data storytelling", "数据叙事"],
        ["creative", "Creative pitch", "创意提案"],
      ]),
      text("outline", "Slide outline and source facts", "页面大纲与资料", true),
      select("notes", "Speaker notes", "演讲备注", [
        ["include", "Include speaker notes", "生成逐页演讲备注"],
        ["none", "Slides only", "仅幻灯片"],
      ]),
    ],
    steps: [
      ["Narrative", "叙事结构"],
      ["Slides", "页面设计"],
      ["Notes", "演讲备注"],
      ["PPTX export", "导出 PPTX"],
    ],
  },
  "short-video": {
    layout: "video",
    description: [
      "Build a complete short with a hook, storyboard, voice and subtitles.",
      "从开场钩子到分镜、配音和字幕，制作完整短视频。",
    ],
    prompt: ["Video brief", "短视频选题"],
    placeholder: [
      "A 30-second explainer for… Start with…",
      "描述选题、受众和开场吸引点……",
    ],
    fields: [
      number("duration", "Target seconds", "目标时长（秒）", 30, 10, 600),
      select("platform", "Publishing format", "发布形式", [
        ["vertical", "Vertical social video", "竖屏社交短视频"],
        ["landscape", "Landscape video", "横屏视频"],
      ]),
      text("storyboard", "Storyboard", "分镜脚本", true),
      text(
        "narration",
        "Narration and voice direction",
        "旁白与声音要求",
        true,
      ),
      select("subtitles", "Subtitles", "字幕", [
        ["burned-in", "Burned-in + SRT", "内嵌字幕 + SRT"],
        ["srt", "SRT file", "SRT 字幕文件"],
      ]),
    ],
    steps: [
      ["Hook", "选题钩子"],
      ["Storyboard", "分镜编排"],
      ["Production", "素材与剪辑"],
      ["Export", "导出成片"],
    ],
  },
};
export function studioDefaults(id: string): Record<string, string> {
  return Object.fromEntries(
    STUDIO_SPECS[id].fields.map((f) => [f.id, f.value]),
  );
}
export function studioPrompt(
  id: string,
  prompt: string,
  values: Record<string, string> = {},
): string {
  return [
    prompt,
    ...STUDIO_SPECS[id].fields.flatMap((f) => {
      const value = values[f.id];
      if (!value || value === "auto") return [];
      const choice = f.choices?.find((c) => c[0] === value);
      return [
        `${studioText(f.label)}: ${choice ? studioText([choice[1], choice[2]]) : value}`,
      ];
    }),
  ].join("\n\n");
}
export function studioMediaOptions(id: string, values: Record<string, string>) {
  const result: Record<string, string | number> = {};
  for (const key of ["size", "seconds", "n"]) {
    const v = values[key];
    if (v && v !== "auto" && STUDIO_SPECS[id].fields.some((f) => f.id === key))
      result[key] = key === "n" ? Number(v) : v;
  }
  return result;
}
export function validateStudio(
  id: string,
  values: Record<string, string>,
): string | null {
  for (const field of STUDIO_SPECS[id].fields) {
    const v = values[field.id] ?? field.value;
    if (
      field.kind === "number" &&
      (!Number.isInteger(Number(v)) ||
        Number(v) < field.min! ||
        Number(v) > field.max!)
    )
      return studioText(field.label);
    if (field.kind === "select" && !field.choices?.some((c) => c[0] === v))
      return studioText(field.label);
    if (v.length > 20000) return studioText(field.label);
  }
  return null;
}
