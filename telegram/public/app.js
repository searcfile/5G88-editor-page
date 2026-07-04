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
  if (!text || !url) return alert("Isi text dan URL button bro");

  await set(push(ref(db, `bots/${selectedBotId}/buttons`)), {
    text, url, createdAt: Date.now()
  });

  $("btnText").value = "";
  $("btnUrl").value = "";
  await loadButtons();
}

async function loadButtons() {
  if (!selectedBotId) return;
  const snap = await get(ref(db, `bots/${selectedBotId}/buttons`));
  const data = snap.val() || {};
  const buttons = Object.entries(data).map(([id, b]) => ({ id, ...b }));

  $("statButtons").textContent = buttons.length;
  $("buttonList").innerHTML = buttons.length ? buttons.map(b => `
    <div class="item">
      <h3>${esc(b.text)}</h3>
      <p>${esc(b.url)}</p>
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
        ? { offset, timeout: 1, allowed_updates: ["message"] }
        : { timeout: 1, allowed_updates: ["message"] }
    );

    let lastId = offset || 0;
    let count = 0;

    for (const up of updates) {
      lastId = up.update_id;

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

function startListener() {
  if (listenerTimer) {
    clearInterval(listenerTimer);
    listenerTimer = null;
    $("listenBtn").textContent = "▶ Start Listener";
    alert("Listener stopped");
    return;
  }

  listenerTimer = setInterval(() => syncUpdates(false), 3000);
  $("listenBtn").textContent = "⏸ Stop Listener";
  syncUpdates(false);
  alert("Listener started ✅\nSekarang cuba tekan /start di Telegram.");
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
