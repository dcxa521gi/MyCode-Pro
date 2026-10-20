import { describe, expect, it } from "vitest";
import { formatMobile, t } from "@/ui/i18n";

describe("mobile UI language", () => {
  it("keeps English and Simplified Chinese labels distinct", () => {
    expect(t("Connect to desktop", "en")).toBe("Connect to desktop");
    expect(t("Connect to desktop", "zh-CN")).toBe("连接电脑");
    expect(t("MyCode", "zh-CN")).toBe("MyCode");
  });

  it("formats values after translation", () => {
    expect(formatMobile("{count} files", { count: 3 }, "zh-CN")).toBe("3 个文件");
  });
});
