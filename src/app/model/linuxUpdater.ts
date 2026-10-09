import { BundleType, getBundleType } from "@tauri-apps/api/app";
import { getLocale } from "../../shared/i18n";
import { RELEASES_URL } from "./githubReleases";
export type PackageManagedInstall = "deb" | "rpm";
export async function packageManagedInstall(): Promise<PackageManagedInstall | null> {
  try {
    const type = await getBundleType();
    return type === BundleType.Deb
      ? "deb"
      : type === BundleType.Rpm
        ? "rpm"
        : null;
  } catch {
    return null;
  }
}
export function packageManagerHint(kind: PackageManagedInstall): string {
  const command =
    kind === "deb"
      ? "sudo apt install ./MyCode_X.Y.Z_amd64.deb"
      : "sudo dnf install ./MyCode-X.Y.Z-1.x86_64.rpm";
  return getLocale() === "zh-CN"
    ? `请从 ${RELEASES_URL} 下载对应安装包，然后运行：${command}\n请替换为实际下载的文件名。`
    : `Download one .${kind} from ${RELEASES_URL} and run: ${command}\nReplace the file name with the one you downloaded.`;
}
