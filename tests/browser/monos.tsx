import {useState} from "react";
import {createRoot} from "react-dom/client";
import {setLanguage,translate as t} from "../../src/shared/i18n";
import {applyThemePreference} from "../../src/features/settings/model/appearance";
import {createMono,monoLook,saveMonoName} from "../../src/features/monos/model/mono";
import {MonoHeader} from "../../src/features/monos/ui/MonoHeader";
import {MonoSettingsPage} from "../../src/features/monos/ui/MonoSettingsPage";
import {MonoComposer} from "../../src/features/monos/ui/MonoComposer";
import {ArtifactContent} from "../../src/features/artifacts/ui/ArtifactContent";
import "../../src/styles/index.css";
const query=new URLSearchParams(location.search);
setLanguage(query.get("lang")==="en"?"en":"zh-CN");
applyThemePreference(query.get("theme")==="light"?"light":"dark");
const mono=createMono(["/demo"]);
saveMonoName(mono.id,"小助手");
const agent={...monoLook(mono),name:"小助手"};
function Fixture(){
 const [page,setPage]=useState("");
 const [sent,setSent]=useState("");
 return <main className="flex h-full min-h-0 bg-background-base text-content">
  <section className="flex min-w-0 flex-1 flex-col border-r border-stroke">
   <MonoHeader agent={agent} state={{status:"working",activity:"Thinking"}} />
   <div className="mx-auto min-h-0 w-full max-w-xl flex-1 overflow-auto p-6">
    <ArtifactContent artifact={{id:"doc",kind:"document",title:"发布检查",body:"# 发布检查\n\n- 项目与模型配置已保留\n- 常驻智能体工作正常\n\n[README](/demo/README.md)",createdAt:0,updatedAt:0,sourceCwd:"/demo"}} onOpenFile={setPage}/>
    <p data-opened-file>{page}</p><p data-sent-message>{sent}</p>
   </div>
   <MonoComposer sessionId="browser-mono" name={agent.name} quoteRequest={{id:1,text:"Selected context\nThe complete second line"}} onSubmit={text=>{setSent(text);return true}}/>
  </section>
  <aside className="flex w-80 flex-col bg-surface">
   <MonoSettingsPage monoId={mono.id} agent={agent} counts={{habits:2,memory:3}} onOpen={next=>setPage(t(next==="habits"?"Habits":next==="soul"?"Soul":"Memory"))} />
  </aside>
 </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
