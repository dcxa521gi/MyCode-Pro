// Phone-owned conversations are kept separately from desktop session identities.
let clientMode = "desktop",
  phoneState = { profiles: [], chats: [] },
  phoneChat = "",
  phoneBusy = false,
  phoneLoaded = false,
  phoneLoading = null,
  desktopPaired = false;
function nativeCall(method, value) {
  return new Promise((resolve, reject) => {
    const id = String(++sequence),
      timeout = setTimeout(
        () => {
          delete pending[id];
          reject(
            Error(
              t(
                "请求超时，请检查网络。",
                "Request timed out. Check the network.",
              ),
            ),
          );
        },
        method === "localChat" ? 195000 : 30000,
      );
    pending[id] = { resolve, reject, timeout };
    Desktop[method](
      id,
      ...(value === undefined ? [] : [JSON.stringify(value)]),
    );
  });
}
async function loadPhone() {
  if (phoneLoaded) return;
  if (!phoneLoading)
    phoneLoading = nativeCall("localLoad")
      .then((value) => {
        phoneState = { profiles: [], chats: [], ...value };
        phoneLoaded = true;
      })
      .finally(() => (phoneLoading = null));
  await phoneLoading;
}
async function savePhone() {
  await nativeCall("localSave", phoneState);
}
function showPhonePage(id) {
  for (const name of [
    "pairView",
    "listView",
    "chatView",
    "phoneView",
    "phoneSettings",
  ])
    $(name).hidden = name !== id;
  $("back").hidden = id === "phoneView";
  $("disconnect").hidden = true;
}
async function usePhone() {
  try {
    await loadPhone();
    clientMode = "phone";
    pauseRefresh();
    sessionId = "";
    current = null;
    showPhonePage("phoneView");
    renderPhoneChats();
    notice(
      t(
        "手机独立使用 · 对话保存在此设备",
        "Phone mode · Conversations stay on this device",
      ),
    );
  } catch (e) {
    notice(e.message);
  }
}
function renderPhoneChats() {
  const root = $("phoneChats");
  root.replaceChildren();
  for (const chat of phoneState.chats) {
    const button = document.createElement("button");
    button.className = "session";
    button.textContent = chat.title;
    button.onclick = () => openPhoneChat(chat.id);
    root.append(button);
  }
  if (!phoneState.chats.length)
    root.textContent = t(
      "添加模型服务商后，新建你的第一个会话。",
      "Add a model provider, then start your first chat.",
    );
}
function phoneModels() {
  const select = $("phoneModel");
  select.replaceChildren();
  for (const profile of phoneState.profiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name + " · " + profile.model;
    select.append(option);
  }
  select.disabled = phoneBusy;
}
async function newPhoneChat() {
  if (phoneBusy) return;
  if (!phoneState.profiles.length) {
    phoneSettings();
    return;
  }
  const chat = {
    id: crypto.randomUUID(),
    title: t("新会话", "New chat"),
    profile: phoneState.profiles[0].id,
    messages: [],
    createdAt: Date.now(),
  };
  phoneState.chats.unshift(chat);
  try {
    await savePhone();
    openPhoneChat(chat.id);
  } catch (e) {
    notice(e.message);
  }
}
function openPhoneChat(id) {
  if (phoneBusy && phoneChat !== id) {
    notice(
      t(
        "当前模型正在回复，请等待完成。",
        "Wait for the current reply to finish.",
      ),
    );
    return;
  }
  phoneChat = id;
  clientMode = "phone";
  showPhonePage("chatView");
  $("modelPanel").hidden = true;
  for (const name of ["plan", "activity", "older"]) $(name).hidden = true;
  $("approvals").replaceChildren();
  $("questions").replaceChildren();
  $("phoneModelRow").hidden = false;
  phoneModels();
  const chat = phoneState.chats.find((c) => c.id === id);
  $("phoneModel").value = chat.profile;
  $("chatTitle").textContent = chat.title;
  $("chatInfo").textContent = t("手机独立会话", "Phone conversation");
  $("composerHint").textContent=t("通过手机配置的模型生成回复，对话保存在手机中。","Replies use your phone model provider; conversations stay on this phone.");
  $("stop").hidden = true;
  $("draft").value = drafts["phone:" + id] || "";
  renderPhoneMessages();
  $("send").disabled = phoneBusy;
}
function renderPhoneMessages() {
  const root = $("messages");
  root.replaceChildren();
  const chat = phoneState.chats.find((c) => c.id === phoneChat);
  if(chat) $("chatTitle").textContent=chat.title;
  $("composerHint").textContent=t("通过手机配置的模型生成回复，对话保存在手机中。","Replies use your phone model provider; conversations stay on this phone.");
  for (const item of chat?.messages || []) {
    const div = document.createElement("div");
    div.className = "message " + item.role;
    const label = document.createElement("label");
    label.textContent = item.role === "user" ? t("你", "You") : "MyCode";
    div.append(label, document.createTextNode(item.text));
    root.append(div);
  }
}
async function sendPhone() {
  const text = $("draft").value.trim(),
    chat = phoneState.chats.find((c) => c.id === phoneChat),
    profile = phoneState.profiles.find((p) => p.id === $("phoneModel").value);
  if (!text || phoneBusy) return;
  if (!profile) {
    notice(t("请先配置模型服务商。", "Configure a model provider first."));
    return;
  }
  phoneBusy = true;
  $("send").disabled = true;
  $("phoneModel").disabled = true;
  const message = { role: "user", text };
  chat.profile = profile.id;
  chat.messages.push(message);
  if (chat.messages.length === 1) chat.title = text.slice(0, 32);
  try {
    await savePhone();
    $("draft").value = "";
    renderPhoneMessages();
    notice(t("正在生成回复…", "Generating reply…"));
    const result = await nativeCall("localChat", {
      profile,
      messages: chat.messages.slice(-100),
    });
    chat.messages.push({
      role: "assistant",
      text: result.text,
      usage: result.usage,
    });
    await savePhone();
    if (clientMode === "phone" && phoneChat === chat.id) renderPhoneMessages();
    notice(t("回复完成", "Reply complete"));
  } catch (e) {
    if (chat.messages.at(-1) === message) {
      chat.messages.pop();
      $("draft").value = text;
      try {
        await savePhone();
      } catch {}
    }
    notice(e.message);
  } finally {
    phoneBusy = false;
    $("send").disabled = false;
    $("phoneModel").disabled = false;
  }
}
function phoneSettings() {
  showPhonePage("phoneSettings");
  const root = $("phoneProfiles");
  root.replaceChildren();
  for (const p of phoneState.profiles) {
    const button = document.createElement("button");
    button.className = "session";
    button.textContent = p.name + " · " + p.model;
    button.onclick = () => {
      for (const key of ["name", "url", "model", "key", "protocol"])
        $("profile-" + key).value = p[key] || "";
      $("phoneProfileForm").dataset.id = p.id;
    };
    root.append(button);
  }
}
async function saveProfile() {
  const profile = {
    id: $("phoneProfileForm").dataset.id || crypto.randomUUID(),
  };
  for (const key of ["name", "url", "model", "key", "protocol"])
    profile[key] = $("profile-" + key).value.trim();
  try {
    const url = new URL(profile.url);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !profile.name ||
      !profile.model ||
      !profile.key
    )
      throw Error(
        t(
          "请完整填写名称、HTTPS API 地址、模型 ID 和密钥。",
          "Enter a name, HTTPS API URL, model ID and key.",
        ),
      );
    const index = phoneState.profiles.findIndex((p) => p.id === profile.id),
      previous = phoneState.profiles.slice();
    if (index >= 0) phoneState.profiles[index] = profile;
    else phoneState.profiles.push(profile);
    try {
      await savePhone();
    } catch (e) {
      phoneState.profiles = previous;
      throw e;
    }
    $("profile-key").value = "";
    $("phoneProfileForm").dataset.id = "";
    showPhonePage("phoneView");
    renderPhoneChats();
    notice(
      t(
        "模型服务商已保存，密钥已加密存储。",
        "Provider saved. Credentials are encrypted on this phone.",
      ),
    );
  } catch (e) {
    notice(e.message);
  }
}
const desktopSend = send,
  desktopBack = back,
  desktopRefresh = refresh,
  desktopConnected = connected;
send = () => (clientMode === "phone" ? sendPhone() : desktopSend());
back = () => {
  if (clientMode === "phone") {
    if (phoneChat) drafts["phone:" + phoneChat] = $("draft").value;
    phoneChat = "";
    showPhonePage("phoneView");
    renderPhoneChats();
  } else desktopBack();
};
refresh = () => (clientMode === "phone" ? Promise.resolve() : desktopRefresh());
connected = () => {
  desktopPaired = true;
  if (phoneBusy) return;
  clientMode = "desktop";
  showPhonePage("listView");
  $("modelPanel").hidden = false;
  $("phoneView").hidden = true;
  $("phoneSettings").hidden = true;
  $("phoneModelRow").hidden = true;
  $("stop").hidden = false;
  renderLabels();
  desktopConnected();
};
function desktopMode() {
  if (phoneBusy) {
    notice(
      t(
        "请等待手机模型回复完成。",
        "Wait for the phone model reply to finish.",
      ),
    );
    return;
  }
  clientMode = "desktop";
  phoneChat = "";
  $("modelPanel").hidden = false;
  showPhonePage(desktopPaired ? "listView" : "pairView");
  $("disconnect").hidden = !desktopPaired;
  $("phoneModelRow").hidden = true;
  $("stop").hidden = false;
  renderLabels();
  if (desktopPaired) {
    refresh();
    notice(t("正在同步电脑会话…", "Syncing desktop sessions…"));
  } else
    notice(
      t(
        "扫码或粘贴电脑配对信息。",
        "Scan or paste desktop pairing information.",
      ),
    );
}
function setUiLanguage(value) {
  language = value;
  if (Desktop.language) Desktop.language(language);
  renderLabels();
  if (clientMode === "phone") {
    if (phoneChat) {renderPhoneMessages();$("chatInfo").textContent=t("手机独立会话","Phone conversation");}
    else renderPhoneChats();
  } else {
    modelSignature = "";
    renderMessages();
    refresh();
  }
}
function chooseAddress() {
  try {
    const value = JSON.parse($("pairText").value),
      root = $("pairAddress");
    root.replaceChildren();
    root.hidden = value.mode === "relay";
    if (root.hidden) return;
    const url = new URL(value.url),
      addresses = [
        { address: url.hostname, name: t("当前地址", "Current address") },
        ...(value.addresses || []),
      ];
    const seen = new Set();
    for (const item of addresses) {
      if (
        !/^\d{1,3}(\.\d{1,3}){3}$/.test(item.address) ||
        seen.has(item.address)
      )
        continue;
      seen.add(item.address);
      const option = document.createElement("option");
      option.value = item.address;
      option.textContent = item.name + " · " + item.address;
      root.append(option);
    }
    root.value = url.hostname;
    root.onchange = () => {
      url.hostname = root.value;
      value.url = url.href;
      $("pairText").value = JSON.stringify(value);
    };
  } catch {
    $("pairAddress").hidden = true;
  }
}
const baseOnNative = window.onNative;
window.onNative = (id, result) => {
  if (id === "disconnect") desktopPaired = false;
  baseOnNative(id, result);
  if (id === "pairing") chooseAddress();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseRefresh();
  else if (clientMode === "desktop") refresh();
});
$("pairText").addEventListener("input", chooseAddress);
