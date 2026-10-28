import { describe, expect, it } from "vitest";
import { formatMobile, t } from "@/ui/i18n";

describe("mobile UI language", () => {
  it("keeps English and Simplified Chinese labels distinct", () => {
    expect(t("Connect to desktop", "en")).toBe("Connect to desktop");
    expect(t("Connect to desktop", "zh-CN")).toBe("连接电脑");
    expect(t("MyCode", "zh-CN")).toBe("MyCode");
    expect(t("Desktop default", "en")).toBe("Desktop default");
    expect(t("Desktop default", "zh-CN")).toBe("电脑端默认模型");
    expect(t("Choose the model, account, effort and permissions", "zh-CN"))
      .toBe("选择模型、账号、推理强度和权限");
  });

  it("formats values after translation", () => {
    expect(formatMobile("{count} files", { count: 3 }, "zh-CN")).toBe("3 个文件");
  });
});
