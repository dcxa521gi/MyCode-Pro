import { createRoot } from "react-dom/client";
import { MonoRailSection } from "../../src/app/shell/MonoRailSection";
import { ConnectionsSettings } from "../../src/features/connections/ui/ConnectionsSettings";
import { createMono } from "../../src/features/monos/model/mono";
import { setLanguage, useTranslation } from "../../src/shared/i18n";
import "../../src/styles/index.css";
setLanguage("zh-CN");
createMono();
function Fixture() {
 useTranslation();
 return <main className="flex h-full bg-background-base text-content"><aside className="w-72"><button data-switch-language onClick={() => setLanguage(document.documentElement.lang === "zh-CN" ? "en" : "zh-CN")}>Switch language</button><MonoRailSection states={new Map()} onOpen={() => {}} onCreate={() => {}} onDelete={() => {}} /></aside><section className="flex-1 p-6"><ConnectionsSettings /></section></main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
