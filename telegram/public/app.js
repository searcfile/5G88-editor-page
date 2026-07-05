import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase, ref, set, get, push, remove, update, onValue
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD3-r7y5chSlGrxx1QuSezoSkaCw_xVcE8",
  authDomain: "bot-8c959.firebaseapp.com",
  databaseURL: "https://bot-8c959-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bot-8c959",
  storageBucket: "bot-8c959.firebasestorage.app",
  messagingSenderId: "596404696711",
  appId: "1:596404696711:web:e9c9b7801324a11eb4ea22"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let selectedBotId = localStorage.getItem("selectedBotId") || "";
let listenerTimer = null;

const $ = (id) => document.getElementById(id);
const esc = (v = "") => String(v).replace(/[&<>"']/g, m => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[m]));

async function tg(token, method, data = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.description || "Telegram API error");
  return json.result;
}

async function getBot(botId = selectedBotId) {
  if (!botId) return null;
  const snap = await get(ref(db, `bots/${botId}`));
  return snap.exists() ? { id: botId, ...snap.val() } : null;
}

function navInit() {
  document.querySelectorAll(".nav").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".nav").forEach(n => n.classList.remove("active"));
      document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      $(btn.dataset.page).classList.add("active");
      $("pageTitle").textContent = btn.textContent.replace(/[^\w\s]/g, "").trim();
    };
  });
}

async function loadBots() {
  const snap = await get(ref(db, "bots"));
  const data = snap.val() || {};
  const bots = Object.entries(data).map(([id, bot]) => ({ id, ...bot }));

  $("statBots").textContent = bots.length;

  if (!selectedBotId && bots[0]) {
    selectedBotId = bots[0].id;
    localStorage.setItem("selectedBotId", selectedBotId);
  }

  const selected = bots.find(b => b.id === selectedBotId);
  $("activeBotText").textContent = selected
    ? `Active Bot: ${selected.botUsername || selected.botName || selected.id}`
    : "No bot selected";

  $("botList").innerHTML = bots.length ? bots.map(bot => `
    <div class="botCard">
      <h3>${esc(bot.botUsername || bot.botName || "Unnamed Bot")}</h3>
      <p>${esc(bot.botName || "")}</p>
      <p><b>Status:</b> ${bot.active === false ? "Disabled" : "Active"}</p>
      <div class="row">
        <button class="primary" onclick="selectBot('${bot.id}')">Open</button>
        <button class="ghost" onclick="testBot('${bot.id}')">Test</button>
        <button class="danger" onclick="deleteBot('${bot.id}')">Delete</button>
      </div>
    </div>
  `).join("") : `<p class="muted">Belum ada bot. Tekan Create New Bot.</p>`;
}

window.selectBot = async (botId) => {
  selectedBotId = botId;
  localStorage.setItem("selectedBotId", botId);
  await loadAll();
};

window.deleteBot = async (botId) => {
  if (!confirm("Delete bot ini bro?")) return;
  await remove(ref(db, `bots/${botId}`));
  if (selectedBotId === botId) {
    selectedBotId = "";
    localStorage.removeItem("selectedBotId");
  }
  await loadAll();
};

window.testBot = async (botId) => {
  try {
    const bot = await getBot(botId);
    const me = await tg(bot.token, "getMe");
    alert(`Bot OK ✅\n@${me.username}`);
  } catch (e) {
    alert(e.message);
  }
};

async function createBot() {
  const token = $("botToken").value.trim();
  if (!token) return alert("Masukkan token bot dulu bro");

  try {
    const me = await tg(token, "getMe");
    const newRef = push(ref(db, "bots"));

    await set(newRef, {
      token,
      botId: me.id,
      botName: me.first_name || "",
      botUsername: me.username ? "@" + me.username : "",
      active: true,
      createdAt: Date.now(),
      settings: {
        welcomeText: $("welcomeText").value,
        aboutText: $("aboutText").value
      }
    });

    selectedBotId = newRef.key;
    localStorage.setItem("selectedBotId", selectedBotId);
    $("botToken").value = "";
    $("botModal").classList.remove("show");
    await loadAll();
    alert("Bot berjaya dibuat ✅");
  } catch (e) {
    alert(e.message);
  }
}

async function loadSettings() {
  if (!selectedBotId) return;
  const bot = await getBot();
  const s = bot?.settings || {};

  $("mainBannerUrl").value = s.mainBannerUrl || "";
  $("welcomeText").value = s.welcomeText || $("welcomeText").value;
  $("aboutText").value = s.aboutText || $("aboutText").value;
  $("registerUrl").value = s.registerUrl || "";
  $("telegramSupport").value = s.telegramSupport || "";
  $("whatsappUrl").value = s.whatsappUrl || "";
}

async function saveSettings() {
  if (!selectedBotId) return alert("Pilih bot dulu bro");

  await update(ref(db, `bots/${selectedBotId}/settings`), {
    mainBannerUrl: $("mainBannerUrl").value.trim(),
    welcomeText: $("welcomeText").value,
    aboutText: $("aboutText").value,
    registerUrl: $("registerUrl").value.trim(),
    telegramSupport: $("telegramSupport").value.trim(),
    whatsappUrl: $("whatsappUrl").value.trim(),
    updatedAt: Date.now()
  });

  alert("Settings saved ✅");
}

async function addPromo() {
  if (!selectedBotId) return alert("Pilih bot dulu bro");

  const title = $("promoTitle").value.trim();
  if (!title) return alert("Isi promo title dulu bro");

  await set(push(ref(db, `bots/${selectedBotId}/promos`)), {
    title,
    imageUrl: $("promoImageUrl").value.trim(),
    caption: $("promoCaption").value.trim(),
    createdAt: Date.now()
  });

  $("promoTitle").value = "";
  $("promoImageUrl").value = "";
  $("promoCaption").value = "";
  await loadPromos();
}

async function loadPromos() {
  if (!selectedBotId) return;
  const snap = await get(ref(db, `bots/${selectedBotId}/promos`));
  const data = snap.val() || {};
  const promos = Object.entries(data).map(([id, p]) => ({ id, ...p }));

  $("statPromos").textContent = promos.length;
  $("promoList").innerHTML = promos.length ? promos.map(p => `
    <div class="item">
      <h3>${esc(p.title)}</h3>
      ${p.imageUrl ? `<p>${esc(p.imageUrl)}</p>` : ""}
      <p>${esc(p.caption || "")}</p>
      <div class="row">
        <button class="ghost" onclick="sendPromo('${p.id}')">Send Promo</button>
        <button class="danger" onclick="deletePromo('${p.id}')">Delete</button>
      </div>
    </div>
  `).join("") : `<p class="muted">Belum ada promo.</p>`;
}

window.deletePromo = async (promoId) => {
  await remove(ref(db, `bots/${selectedBotId}/promos/${promoId}`));
  await loadPromos();
};

window.sendPromo = async (promoId) => {
  const bot = await getBot();
  const ps = await get(ref(db, `bots/${selectedBotId}/promos/${promoId}`));
  const promo = ps.val();
  const us = await get(ref(db, `bots/${selectedBotId}/users`));
  const users = Object.values(us.val() || {});

  let ok = 0, fail = 0;
  for (const u of users) {
    try {
      if (promo.imageUrl) {
        await tg(bot.token, "sendPhoto", {
          chat_id: u.chatId,
          photo: promo.imageUrl,
          caption: promo.caption || promo.title
        });
      } else {
        await tg(bot.token, "sendMessage", {
          chat_id: u.chatId,
          text: promo.caption || promo.title
        });
      }
      ok++;
    } catch {
      fail++;
    }
  }
  alert(`Send done ✅\nSuccess: ${ok}\nFailed: ${fail}`);
};

async function addButton() {
  if (!selectedBotId) return alert("Pilih bot dulu bro");

  const text = $("btnText").value.trim();
  const url = $("btnUrl").value.trim();
  const action = $("btnAction").value;
  if (!text){
    alert("Isi button text bro");
    return;
}

if(action=="url" && !url){
    alert("Isi URL bro");
    return;
}

await set(push(ref(db,`bots/${selectedBotId}/buttons`)),{
    text,
    url,
    action,
    order:Number($("btnOrder").value||999),
    createdAt:Date.now()

});

$("btnText").value = "";
$("btnUrl").value = "";
$("btnOrder").value = "";
  $("btnAction").value = "url";
  await loadButtons();
}

async function loadButtons() {
  if (!selectedBotId) return;

  const snap = await get(ref(db, `bots/${selectedBotId}/buttons`));
  const data = snap.val() || {};

  const buttons = Object.entries(data)
    .map(([id, b]) => ({ id, ...b }))
    .sort((a, b) => (a.order || 999) - (b.order || 999));

  $("statButtons").textContent = buttons.length;

  $("buttonList").innerHTML = buttons.length ? buttons.map(b => `
    <div class="item">
      <h3>${esc(b.order || "-")} - ${esc(b.text)}</h3>
      <p>Action: ${esc(b.action || "url")}</p>
      <p>${b.url ? esc(b.url) : "No URL needed"}</p>
      <button class="danger" onclick="deleteButton('${b.id}')">Delete</button>
    </div>
  `).join("") : `<p class="muted">Belum ada button.</p>`;
}

window.deleteButton = async (buttonId) => {
  await remove(ref(db, `bots/${selectedBotId}/buttons/${buttonId}`));
  await loadButtons();
};

async function clearWebhook(bot) {
  try {
    await tg(bot.token, "deleteWebhook", {
      drop_pending_updates: false
    });
  } catch (e) {
    console.warn("deleteWebhook warning:", e.message);
  }
}

async function syncUpdates(showAlert = true) {
  const bot = await getBot();
  if (!bot) return alert("Pilih bot dulu bro");

  try {
    await clearWebhook(bot);

    const lastSnap = await get(ref(db, `bots/${selectedBotId}/lastUpdateId`));
    const offset = lastSnap.exists() ? Number(lastSnap.val()) + 1 : undefined;

    const updates = await tg(
      bot.token,
      "getUpdates",
      offset
        ? { offset, timeout: 1, allowed_updates: ["message", "callback_query"] }
        : { timeout: 1, allowed_updates: ["message", "callback_query"] }
    );

    let lastId = offset || 0;
    let count = 0;

    for (const up of updates) {
      lastId = up.update_id;

      if (up.callback_query) {
        const cb = up.callback_query;
        await handleAction(bot, cb.message.chat, cb.data, cb.id);
        continue;
      }

      const msg = up.message;
      if (!msg || !msg.chat) continue;

      const chat = msg.chat;
      const text = msg.text || "";

      if (text.startsWith("/start")) {
        await set(ref(db, `bots/${selectedBotId}/users/${chat.id}`), {
          chatId: chat.id,
          username: chat.username || "",
          firstName: chat.first_name || "",
          lastName: chat.last_name || "",
          startedAt: Date.now(),
          lastActive: Date.now()
        });

        await sendWelcome(bot, chat);
        count++;
      }
    }

    if (lastId) {
      await set(ref(db, `bots/${selectedBotId}/lastUpdateId`), lastId);
    }

    await loadUsers();

    if (showAlert) {
      alert(`Sync done ✅\nWelcome sent: ${count}`);
    }
  } catch (e) {
    console.error(e);
    if (showAlert) alert(e.message);
  }
}

let isSyncing = false;

function startListener() {
  if (listenerTimer) {
    clearInterval(listenerTimer);
    listenerTimer = null;
    $("listenBtn").textContent = "▶ Start Listener";
    alert("Listener stopped");
    return;
  }

  $("listenBtn").textContent = "⏸ Stop Listener";

  syncUpdates(false);

  listenerTimer = setInterval(async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
      await syncUpdates(false);
    } finally {
      isSyncing = false;
    }
  }, 6000);

  alert("Listener started ✅\nSekarang hantar /start test di Telegram.");
}
async function sendWelcome(bot, chat) {

    const s = bot.settings || {};

    const text = (s.welcomeText || "Welcome {username}")
        .replaceAll("{username}",
            chat.username ? "@" + chat.username : chat.first_name || "User")
        .replaceAll("{user_id}", chat.id);

    const buttonsSnap = await get(
        ref(db, `bots/${selectedBotId}/buttons`)
    );

    const buttons = Object.values(buttonsSnap.val() || {})
        .filter(b => b.text)
        .sort((a, b) => (a.order || 999) - (b.order || 999));

    const rows = [];

    for (let i = 0; i < buttons.length; i += 2) {

        rows.push(

            buttons.slice(i, i + 2).map(btn => {

                if (btn.action && btn.action !== "url") {

                    return {

                        text: btn.text,

                        callback_data: btn.action

                    };

                }

                return {

                    text: btn.text,

                    url: btn.url

                };

            })

        );

    }

    const reply_markup = {

        inline_keyboard: rows

    };

    if (s.mainBannerUrl) {

        await tg(bot.token, "sendPhoto", {

            chat_id: chat.id,

            photo: s.mainBannerUrl,

            caption: text,

            reply_markup

        });

    } else {

        await tg(bot.token, "sendMessage", {

            chat_id: chat.id,

            text,

            reply_markup

        });

    }

}

async function loadUsers() {
  if (!selectedBotId) return;
  const snap = await get(ref(db, `bots/${selectedBotId}/users`));
  const users = Object.values(snap.val() || {});
  $("statUsers").textContent = users.length;
  $("userList").innerHTML = users.map(u => `
    <div class="item">
      <h3>@${esc(u.username || "no_username")}</h3>
      <p>${esc(u.firstName || "")}</p>
      <p>Chat ID: ${esc(u.chatId)}</p>
    </div>
  `).join("");
}

async function broadcast() {
  alert("Broadcast function belum siap penuh bro, kita sambung lepas /start jalan dulu.");
}

async function uploadCloudinary() {
  const cloudName = $("cloudName").value.trim();
  const preset = $("uploadPreset").value.trim();
  const file = $("cloudFile").files[0];

  if (!cloudName || !preset || !file) return alert("Isi Cloud Name, Preset dan pilih gambar");

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", preset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form
  });

  const data = await res.json();
  if (!data.secure_url) return alert(data.error?.message || "Upload failed");

  $("cloudResult").innerHTML = `<input value="${data.secure_url}" readonly onclick="this.select()">`;
  $("mainBannerUrl").value = data.secure_url;
}
async function answerCallback(bot, callbackId) {
  try {
    await tg(bot.token, "answerCallbackQuery", {
      callback_query_id: callbackId
    });
  } catch {}
}

async function sendMenu(bot, chatId) {
  await tg(bot.token, "sendMessage", {
    chat_id: chatId,
    text: "🔥 Promotion Menu",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🔥 Promo 1", callback_data: "promo_1" },
          { text: "🎁 Promo 2", callback_data: "promo_2" }
        ],
        [
          { text: "💎 Promo 3", callback_data: "promo_3" },
          { text: "⬅️ Back Menu", callback_data: "back_menu" }
        ]
      ]
    }
  });
}

async function sendAbout(bot, chatId) {
  const s = bot.settings || {};
  await tg(bot.token, "sendMessage", {
    chat_id: chatId,
    text: s.aboutText || "📌 About Us\n\nFast Withdraw | 24/7 Support"
  });
}

async function sendContact(bot, chatId) {
  const s = bot.settings || {};
  await tg(bot.token, "sendMessage", {
    chat_id: chatId,
    text: "📞 Contact Us",
    reply_markup: {
      inline_keyboard: [
        [{ text: "💬 Telegram", url: s.telegramSupport || "https://t.me/" }],
        [{ text: "💬 WhatsApp", url: s.whatsappUrl || "https://wa.me/" }]
      ]
    }
  });
}

async function sendReferral(bot, chat) {
  const code = String(chat.id).slice(-4) + Math.random().toString(36).slice(2,6).toUpperCase();
  const link = `https://t.me/${(bot.botUsername || "").replace("@","")}?start=${code}`;

  await update(ref(db, `bots/${selectedBotId}/users/${chat.id}`), {
    referralCode: code,
    referralLink: link
  });

  await tg(bot.token, "sendMessage", {
    chat_id: chat.id,
    text: `🎁 Referral Pro\n\nYour referral code: ${code}\nYour referral link:\n${link}`
  });
}

async function sendPromoByNumber(bot, chatId, number) {
  const snap = await get(ref(db, `bots/${selectedBotId}/promos`));
  const promos = Object.values(snap.val() || {});

  const promo = promos[number - 1];
  if (!promo) {
    await tg(bot.token, "sendMessage", {
      chat_id: chatId,
      text: "Promo belum ada bro."
    });
    return;
  }

  const markup = {
    inline_keyboard: [
      [{ text: "🚀 Register", url: bot.settings?.registerUrl || "https://google.com" }],
      [{ text: "💬 Support", url: bot.settings?.telegramSupport || "https://t.me/" }],
      [{ text: "⬅️ Back Menu", callback_data: "menu" }]
    ]
  };

  if (promo.imageUrl) {
    await tg(bot.token, "sendPhoto", {
      chat_id: chatId,
      photo: promo.imageUrl,
      caption: promo.caption || promo.title,
      reply_markup: markup
    });
  } else {
    await tg(bot.token, "sendMessage", {
      chat_id: chatId,
      text: promo.caption || promo.title,
      reply_markup: markup
    });
  }
}

async function handleAction(bot, chat, action, callbackId = "") {
  if (callbackId) await answerCallback(bot, callbackId);

  if (action === "menu" || action === "back_menu") return sendMenu(bot, chat.id);
  if (action === "about") return sendAbout(bot, chat.id);
  if (action === "contact") return sendContact(bot, chat.id);
  if (action === "register") {
    return tg(bot.token, "sendMessage", {
      chat_id: chat.id,
      text: "🚀 Register Now",
      reply_markup: {
        inline_keyboard: [[{ text: "🌍 Register", url: bot.settings?.registerUrl || "https://google.com" }]]
      }
    });
  }
  if (action === "referral") return sendReferral(bot, chat);
  if (action === "promo_1") return sendPromoByNumber(bot, chat.id, 1);
  if (action === "promo_2") return sendPromoByNumber(bot, chat.id, 2);
  if (action === "promo_3") return sendPromoByNumber(bot, chat.id, 3);
}
async function exportUsers() {
  const snap = await get(ref(db, `bots/${selectedBotId}/users`));
  const users = Object.values(snap.val() || {});
  const csv = ["chatId,username,firstName,lastName,startedAt"]
    .concat(users.map(u => `${u.chatId},${u.username || ""},${u.firstName || ""},${u.lastName || ""},${u.startedAt || ""}`))
    .join("\n");

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "telegram-users.csv";
  a.click();
}

async function loadAll() {
  await loadBots();
  if (selectedBotId) {
    await loadSettings();
    await loadPromos();
    await loadButtons();
    await loadUsers();
  }
}

navInit();

$("createBotBtn").onclick = () => $("botModal").classList.add("show");
$("closeBotModalBtn").onclick = () => $("botModal").classList.remove("show");
$("saveBotBtn").onclick = createBot;
$("saveSettingsBtn").onclick = saveSettings;
$("addPromoBtn").onclick = addPromo;
$("addButtonBtn").onclick = addButton;
$("syncBtn").onclick = syncUpdates;
$("listenBtn").onclick = startListener;
$("broadcastBtn").onclick = broadcast;
$("uploadCloudBtn").onclick = uploadCloudinary;
$("exportUsersBtn").onclick = exportUsers;

onValue(ref(db, "bots"), () => loadAll());

loadAll();
