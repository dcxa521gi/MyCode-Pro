import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const d=JSON.parse(fs.readFileSync(path.join(root,'docs/mycode-feature-provenance.json'),'utf8'));
const check=process.argv.includes('--check');
const esc=v=>String(v??'').replaceAll('|','\\|').replaceAll('\r','').replaceAll('\n','<br>');
const link=p=>`[${esc(p)}](${p.startsWith('docs/')?p.slice(5):'../'+p})`;
const reqLink=id=>`[${id}](#${id.toLowerCase()})`;
const featureOf=id=>d.features.find(f=>f.id===id);
const versionOf=id=>d.versions.find(v=>v.key===id);
const eventOf=id=>d.events.find(e=>e.id===id);
// Associations are derived from events so a new release need not edit three lists.
for(const r of d.requirements)r.events=d.events.filter(e=>e.requirements.includes(r.id)).map(e=>e.id);
for(const f of d.features){const events=d.events.filter(e=>e.feature===f.id);if(!events.length)throw Error('Feature without events '+f.id);f.changes=events.map(e=>e.id);f.firstRecordedVersion=events[0].version;f.lastChangedVersion=events.at(-1).version;}
const count={};for(const e of d.events)count[e.origin]=(count[e.origin]??0)+1;

for(const collection of [d.versions,d.events,d.features,d.requirements]){
 const ids=collection.map(x=>x.id??x.key);if(new Set(ids).size!==ids.length)throw Error('Duplicate identifiers');
}
for(const e of d.events){
 if(!versionOf(e.version)||!featureOf(e.feature)||!d.origins[e.origin])throw Error('Unmapped event '+e.id);
 for(const r of e.requirements)if(!d.requirements.some(q=>q.id===r))throw Error('Unmapped requirement '+r);
 for(const doc of e.evidence)if(!fs.existsSync(path.join(root,'docs',doc)))throw Error('Missing evidence '+doc);
}
for(const f of d.features)for(const p of f.maintenancePaths)if(!fs.existsSync(path.join(root,p)))throw Error('Missing maintenance path '+p);
for(const r of d.requirements){for(const id of r.events)if(!eventOf(id)?.requirements.includes(r.id))throw Error('Broken requirement link '+r.id);if(r.id!=='R58'&&!r.events.length)throw Error('Uncovered requirement '+r.id);}

let md=`# MyCode 功能来源与版本台账

整理日期：${d.recordedDate}；当前产品基线：**MyCode ${d.currentProductVersion}**，源码提交 \`${d.sourceCommit}\`。

本文件按 **${d.versions.length} 个交付阶段、${d.events.length} 条变更、${d.features.length} 个稳定功能 ID、${d.requirements.length} 项用户要求** 梳理。需求来源与实现来源分开：用户要求参考上游，不等于功能源码来自该上游；已有等价能力核对也不算新移植。

## 如何使用

- 按版本看“这版增加、同步、适配、修复或移除了什么”。同一个功能 ID 可追踪多次变化。
- 按需求索引看“用户要求在哪些版本回应，有哪些边界”。R 编号为本会话要求索引，不是原始提出日期。
- 按当前处置看“后续升级要保留、融合还是禁止恢复”。表中的历史新增不代表今天仍启用。
- Excel 可打开 [逐条来源明细 CSV](mycode-feature-provenance.csv)，筛选版本、来源、需求或状态。
- 可维护数据为 [JSON 台账](mycode-feature-provenance.json)。修改数据后运行 \`node scripts/generate-feature-provenance.mjs\`；\`--check\` 检查 Markdown/CSV 是否一致。

## 来源分类与判定

| 来源代码 | 含义 | 本次变更条数 |
| --- | --- | --- |
`;
for(const[k,v]of Object.entries(d.origins))md+=`| ${k} | ${v} | ${count[k]??0} |\n`;
md+=`
“直接同步”说明功能基础来自 MonoCode，不表示整文件未改。MONO_ADAPT 专门标记 MyCode 模型路由、Windows、交互、存储与双语言融合。Cindy 的 IM/iLink 有开源传输代码复用；供应商、存储、记忆、调度等多数是设计参考后在 Tauri 架构实现。Synara 本表为设计借鉴或等价安全能力核对，不宣称移植完整 Hub/Effect/WebSocket。

上游仓库：${Object.entries(d.sourceRepositories??{}).map(([name,url])=>'['+name+']('+url+')').join('、')}。每版的实际核对快照列在下表，不把今天的 main 内容回填为当时已经融合。

早期用户原话未逐条核对的内容只归为版本记录，不推断最初需求时间。${d.caveats.map(x=>x).join(' ')}

## 版本与上游基线

日期是本地 tag 的提交日期，不替代发行服务器发布时间。MyCode 和 MonoCode 的同号版本是不同项目；本地 0.1–0.4 标记含前身/上游历史，本表明确的 MyCode 版本从 0.5.0 开始。

| MyCode 阶段 | 日期 / 本地 tag | 提交 | MonoCode 核对基线 | 其他来源 |
| --- | --- | --- | --- | --- |
`;
for(const v of d.versions)md+=`| [${v.display}](#v-${v.key.replaceAll('.','-')}) | ${v.date} / \`${v.tag}\` | \`${v.tagCommit.slice(0,8)}\` | ${esc(v.monoBaseline)} | ${esc(v.complementBaseline)} |\n`;
md+=`
## 按版本的功能明细

每个阶段关联原交付文档和 tag。下表的“当前处置”以 **0.20.0** 为截点；本版细节保留历史事实。当前维护路径与完整提交值在 CSV/JSON 中提供，不能代替历史源码归属证明。
`;
for(const v of d.versions){
 md+=`\n<a id="v-${v.key.replaceAll('.','-')}"></a>\n\n### ${v.display}（${v.date}）\n\n证据：${link('docs/'+v.releaseDoc)}；本地标签 \`${v.tag}\` → \`${v.tagCommit}\`。\n\n| 变更 ID / 功能 ID | 本版内容 | 相关用户要求 | 实现来源 / 性质 | 细节与来源依据 | 当前处置 |\n| --- | --- | --- | --- | --- | --- |\n`;
 for(const e of d.events.filter(e=>e.version===v.key))md+=`| ${e.id}<br>\`${e.feature}\` | ${esc(e.title)} | ${e.requirements.map(reqLink).join('、')||'上游/维护/历史记录'} | ${d.origins[e.origin]}<br>**${e.action}** | ${esc(e.detail)} | ${esc(featureOf(e.feature).status)} |\n`;
}
md+=`
## 用户要求覆盖索引

原始要求拆分为可追踪项，不按用户多次从“1”重新编号的消息混在一起。后提出的细化要求可能关联更早已有的基础功能；该关联不证明早期功能当时就是此条需求首次触发。
`;
for(const r of d.requirements){
 const stages=[...new Set(r.events.map(id=>versionOf(eventOf(id).version).display))];
 md+=`\n<a id="${r.id.toLowerCase()}"></a>\n\n**${r.id}：${r.title}**\n\n- 关联阶段：${stages.join(' → ')||'本次文档维护（产品版本仍 0.20.0）'}。\n- 变更记录：${r.events.map(id=>'\`'+id+'\`').join('、')||'本文件、CSV、JSON'}。\n- 当前范围：${r.scope}\n`;
}
md+=`
## 当前功能处置与升级维护入口

| 功能 ID | 首次记录 / 最近变化 | 当前状态 | 升级保留或替换策略 | 当前维护入口 |
| --- | --- | --- | --- | --- |
`;
for(const f of d.features)md+=`| \`${f.id}\` | ${versionOf(f.firstRecordedVersion).display}<br>${versionOf(f.lastChangedVersion).display} | ${esc(f.status)} | ${esc(f.upgradePolicy)} | ${f.maintenancePaths.map(link).join('<br>')||'已移除运行模块；查历史 tag 和交付说明'} |\n`;
md+=`
## 需要特别分清的演变

| 项目 | 历史演变 | 后续处理 |
| --- | --- | --- |
| 群聊 vs 常驻 Monos | MyCode 0.12/13 自有群聊 → 0.19.1 用户要求移除；MonoCode 常驻智能体在 0.19.0 补齐版同步 | 群聊不恢复，常驻智能体/习惯/产物继续保留；旧群数据保留 |
| CLI 三套提示 | 0.9 新会话旧版本弹窗；0.12 自有启动通知；0.19 补齐版上游更新提示 | 0.20 唯一更新提示为 HarnessUpdateNotice；只保留缺失时安装准备，不恢复重复扫描 |
| Freebuff | 0.9 官方终端 → 0.10 移除设置入口但未全退出 → 0.20 全移除集成 | 类型/旧事件出现只做历史保护/拒绝，禁止重新检测或安装 |
| 服务商布局 | Cindy 参考双栏/卡片 → 用户要求官方样式 → 0.19.1 MonoCode 账户式主列表 | 保留自有连接和词元跳动，不把官方外观当作删除 MyCode 路由的理由 |
| 文件撤回 | 0.13 MyCode 快照和回填 → 0.19.1 上游检查点 → 0.20 归属/共享工作区增强 | 保护后续修改与其他会话；外部副作用不作恢复保证 |
| 手机远程 vs SSH Host | 0.16/17 手机连接/自部署中继是 MyCode；0.19 补齐版加入 MonoCode 远程 Host | 分开协议、配对、运行环境与验收；电脑同步不等同独立手机历史双向合并 |
| 治理规则 vs 实际首次交付 | 0.19 初版没完整融合，之后同版本补齐 | 原始快照单列，不能把补齐版能力提前写成初版已交付 |

## 来源证据或验收仍需补齐

`;
for(const f of d.followups)md+=`- ${f}\n`;
md+=`
这些是后续文档/验收工作，不因本次整理而宣称已经修复。旧功能说明与当前实现冲突时，以明确的后续移除要求、实际注册入口、最新对应版本说明为准。

## 后续每次升级的维护步骤

1. 先读当前处置与用户要求覆盖表，记录 MonoCode/Cindy/Synara 的旧/新基线和完整提交清单。
2. 对每项新增/修复确定原始来源、用户触发、适配点、平台与数据边界；同一功能追加事件，不覆盖旧版本记录。
3. MonoCode 新能力完整融合；保留 MyCode 路由/Windows/中文/自有交互，明确用户已移除项的排除理由。
4. 在 JSON 增加新版本和变更，再生成 Markdown/CSV；更新对应发行说明与实际验证记录。
5. 分开记录编译、单元、模拟、浏览器、真实设备/账号/部署及公开下载，未执行的不得写成已验收。

`;
for(const r of d.rules)md+=`- ${r}\n`;

const cols=['变更ID','MyCode版本阶段','标签提交日期','本地标签','标签提交','功能ID','功能变更','需求定位','实现来源代码','实现来源','变更性质','本版细节及来源依据','当前状态','后续升级策略','当前维护入口','证据文档','证据等级'];
const csvEsc=v=>{const text=String(v??'');return '"'+(/^[=+\-@\t\r]/.test(text)?"'"+text:text).replaceAll('"','""')+'"';};
const lines=d.events.map(e=>{const v=versionOf(e.version),f=featureOf(e.feature);return[e.id,v.display,v.date,v.tag,v.tagCommit,e.feature,e.title,e.requirements.join(';'),e.origin,d.origins[e.origin],e.action,e.detail,f.status,f.upgradePolicy,e.maintenancePaths.join(';'),e.evidence.map(p=>'docs/'+p).join(';'),e.sourceConfidence].map(csvEsc).join(',');});
const csv='\uFEFF'+[cols.map(csvEsc).join(','),...lines].join('\r\n')+'\r\n';
for(const[p,content]of [['docs/mycode-feature-provenance.md',md],['docs/mycode-feature-provenance.csv',csv]]){
 const target=path.join(root,p);if(check){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==content)throw Error('Regenerate '+p);}else fs.writeFileSync(target,content);
}
const canonical=JSON.stringify(d,null,2)+'\n';
const canonicalPath=path.join(root,'docs/mycode-feature-provenance.json');
if(check){if(fs.readFileSync(canonicalPath,'utf8')!==canonical)throw Error('Regenerate derived JSON associations');}else fs.writeFileSync(canonicalPath,canonical);
console.log(`${check?'Checked':'Generated'} ${d.versions.length} stages / ${d.events.length} changes / ${d.features.length} features / ${d.requirements.length} requirements`);
