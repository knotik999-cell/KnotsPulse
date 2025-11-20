const selectors = {
  energy: document.getElementById("energyDisplay"),
  credits: document.getElementById("creditDisplay"),
  data: document.getElementById("dataDisplay"),
  clickValue: document.getElementById("clickValue"),
  pps: document.getElementById("pps"),
  sessionTime: document.getElementById("sessionTime"),
  pulseCore: document.getElementById("pulseCore"),
  shopList: document.getElementById("shopList"),
  prestigeShopList: document.getElementById("prestigeShopList"),
  achievementList: document.getElementById("achievementList"),
  saveButton: document.getElementById("saveButton"),
  resetButton: document.getElementById("resetButton"),
  prestigeButton: document.getElementById("prestigeButton"),
  prestigePointsDisplay: document.getElementById("prestigePointsDisplay"),
  prestigeRuns: document.getElementById("prestigeRuns"),
  prestigeCost: document.getElementById("prestigeCost"),
  toastFeed: document.querySelector(".achievement-feed"),
  labCards: document.querySelectorAll(".lab-card"),
  konamiHint: document.getElementById("konamiHint"),
  tabs: document.querySelectorAll(".deck-tab"),
  views: document.querySelectorAll(".view"),
};

const SAVE_KEY = "knots-pulse-save-v1";
const sessionStart = Date.now();
const PPS_WINDOW = 3000;
const clickTimestamps = [];
const konamiSequence = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];
let konamiProgress = 0;
const PRESTIGE_COST = 5000;
let currentView = "core";

const deepClone =
  typeof structuredClone === "function"
    ? structuredClone
    : (obj) => JSON.parse(JSON.stringify(obj));

const baseState = {
  version: 1,
  energy: 0,
  credits: 0,
  data: 0,
  clickValue: 1,
  passiveRate: 0,
  totalClicks: 0,
  prestige: 0,
  prestigePoints: 0,
  prestigeInventory: {},
  prestigeBonuses: { click: 1, passive: 1, global: 1, dataPerClick: 0 },
  inventory: {},
  achievements: {},
  lastSave: null,
  streaks: {
    perfectEcho: 0,
  },
};

const shopCatalog = [
  {
    id: "resonator",
    title: "Резонатор Кнота",
    desc: "Каждый импульс толще на +1 энергии.",
    baseCost: 40,
    currency: "energy",
    clickBonus: 1,
  },
  {
    id: "holoPress",
    title: "Holo-Press",
    desc: "+5 энергии в секунду пассивно.",
    baseCost: 150,
    currency: "energy",
    passiveBonus: 5,
  },
  {
    id: "driftBank",
    title: "Drift Bank",
    desc: "Конвертирует энергию в кредиты (5% автоматически).",
    baseCost: 300,
    currency: "energy",
    generator: "credits",
    yield: 0.05,
  },
  {
    id: "archiveNode",
    title: "Archive Node",
    desc: "+0.5 данных за каждый клик.",
    baseCost: 500,
    currency: "credits",
    dataPerClick: 0.5,
  },
  {
    id: "spectralRig",
    title: "Spectral Rig",
    desc: "+20 пассивной энергии и +2 клика.",
    baseCost: 1200,
    currency: "credits",
    clickBonus: 2,
    passiveBonus: 20,
  },
  {
    id: "mythicVault",
    title: "Mythic Vault",
    desc: "Раз в минуту дарит 100 кредитов.",
    baseCost: 3000,
    currency: "credits",
    timedReward: { currency: "credits", amount: 100, interval: 60000 },
  },
  {
    id: "irisDrone",
    title: "Iris Drone",
    desc: "Каждый набор из 100 кликов даёт 50 энергии сверху.",
    baseCost: 4500,
    currency: "credits",
    burstThreshold: 100,
    burstReward: 50,
  },
  {
    id: "knotSignature",
    title: "Подпись Кнота",
    desc: "Стилизует интерфейс и усиливает все бонусы на 15%.",
    baseCost: 9000,
    currency: "data",
    globalMultiplier: 1.15,
  },
];

const prestigeCatalog = [
  {
    id: "emberSeal",
    title: "Ember Seal",
    desc: "Клики навсегда усиливаются на 20%.",
    cost: 1,
    effects: { click: 1.2 },
  },
  {
    id: "pulseAnvil",
    title: "Pulse Anvil",
    desc: "Пассивная энергия ×1.25.",
    cost: 2,
    effects: { passive: 1.25 },
  },
  {
    id: "crownOfKnot",
    title: "Crown of Knot",
    desc: "Глобальный множитель +10%.",
    cost: 3,
    effects: { global: 1.1 },
  },
  {
    id: "datastream",
    title: "Datastream Bloom",
    desc: "+0.2 данных за каждый клик навсегда.",
    cost: 2,
    effects: { dataPerClick: 0.2 },
  },
];

const achievements = [
  {
    id: "firstPulse",
    title: "Первый разряд",
    description: "Сделай первый клик.",
    reward: { credits: 10 },
    condition: (s) => s.totalClicks >= 1,
  },
  {
    id: "hundredClicks",
    title: "Сотня тихих",
    description: "100 ручных импульсов.",
    reward: { energy: 200 },
    condition: (s) => s.totalClicks >= 100,
  },
  {
    id: "energyTycoon",
    title: "Энергобарон",
    description: "Накопи 10 000 энергии.",
    reward: { credits: 250, data: 5 },
    condition: (s) => s.energy >= 10000,
  },
  {
    id: "creditRain",
    title: "Кредитный дождь",
    description: "Истратить 5 000 кредитов.",
    reward: { passiveRate: 25 },
    condition: (s) => totalSpent("credits") >= 5000,
  },
  {
    id: "dataWhisper",
    title: "Шёпот данных",
    description: "Получить 50 данных.",
    reward: { globalMultiplier: 1.05 },
    condition: (s) => s.data >= 50,
  },
  {
    id: "labMaestro",
    title: "Повелитель игрулек",
    description: "Победить в каждой мини-игре хотя бы раз.",
    reward: { credits: 400, energy: 2000 },
    condition: (s) =>
      s.inventory.fluxWin &&
      s.inventory.echoWin &&
      s.inventory.oracleWin &&
      s.inventory.glitchWin &&
      s.inventory.novaWin,
  },
  {
    id: "konami",
    title: "Комбо Кнота",
    description: "Разгадайте подсказку 6-6-8-6-8-8-4.",
    reward: { data: 20 },
    condition: (s) => s.inventory.konamiUnlocked,
  },
  {
    id: "glitchBreaker",
    title: "Цифровой взломщик",
    description: "Успешно вскрой Glitch Lock.",
    reward: { credits: 150 },
    condition: (s) => s.inventory.glitchWin,
  },
  {
    id: "novaPilot",
    title: "Nova-пилот",
    description: "Попади в цель в Nova Drift.",
    reward: { energy: 500 },
    condition: (s) => s.inventory.novaWin,
  },
  {
    id: "reborn",
    title: "Новый цикл",
    description: "Совершить первое перерождение.",
    reward: { credits: 300, data: 10 },
    condition: (s) => s.prestige >= 1,
  },
  {
    id: "sparkCollector",
    title: "Коллекционер искр",
    description: "Собрать 5 очков перерождения.",
    reward: { globalMultiplier: 1.05 },
    condition: (s) => s.prestigePoints >= 5,
  },
];

const state = loadState();
state.prestigeInventory = state.prestigeInventory || {};
state.prestigeBonuses = state.prestigeBonuses || { click: 1, passive: 1, global: 1, dataPerClick: 0 };
state.prestigeBonuses.dataPerClick = state.prestigeBonuses.dataPerClick ?? 0;
const spendLog = {
  energy: 0,
  credits: 0,
  data: 0,
};
const timerHandles = new Map();

function loadState() {
  try {
    const restored = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!restored) return deepClone(baseState);
    return { ...deepClone(baseState), ...restored };
  } catch {
    return deepClone(baseState);
  }
}

function saveState(manual = false) {
  state.lastSave = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  if (manual) {
    addToast("Сохранено", "Слепок цикла ушёл в архив.");
  }
}

function resetState() {
  localStorage.removeItem(SAVE_KEY);
  timerHandles.forEach((handle) => clearInterval(handle));
  timerHandles.clear();
  const preserved = {
    prestigePoints: state.prestigePoints,
    prestigeInventory: { ...state.prestigeInventory },
    prestigeBonuses: { ...state.prestigeBonuses },
    prestige: state.prestige,
    achievements: { ...state.achievements },
  };
  Object.assign(state, deepClone(baseState), preserved);
  reapplyAchievementRewards();
  Object.keys(spendLog).forEach((k) => (spendLog[k] = 0));
  renderAll();
  addToast("Цикл сброшен", "Город ждёт новый импульс.");
}

function performPrestige() {
  const gain = prestigePreviewGain();
  if (gain <= 0) {
    addToast("Перерождение", `Нужно минимум ${formatNumber(PRESTIGE_COST)} кредитов.`);
    return;
  }
  state.prestigePoints += gain;
  state.prestige += 1;
  addToast("Перерождение", `+${gain} искр. Цикл начинается заново.`);
  const preserved = {
    prestigePoints: state.prestigePoints,
    prestigeInventory: { ...state.prestigeInventory },
    prestigeBonuses: { ...state.prestigeBonuses },
    prestige: state.prestige,
    achievements: { ...state.achievements },
  };
  timerHandles.forEach((handle) => clearInterval(handle));
  timerHandles.clear();
  Object.assign(state, deepClone(baseState), preserved);
  reapplyAchievementRewards();
  Object.keys(spendLog).forEach((k) => (spendLog[k] = 0));
  resumeTimedRewards();
  renderAll();
  checkAchievements();
  saveState(false);
}

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
  return n.toFixed(0);
}

function applyReward(reward) {
  if (!reward) return;
  if (reward.energy) state.energy += reward.energy;
  if (reward.credits) state.credits += reward.credits;
  if (reward.data) state.data += reward.data;
  if (reward.passiveRate) state.passiveRate += reward.passiveRate;
  if (reward.globalMultiplier) {
    state.inventory.globalMultiplier = (state.inventory.globalMultiplier || 1) * reward.globalMultiplier;
  }
}

function addToast(title, text) {
  const template = document.getElementById("achievementToast");
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector(".toast-title").textContent = title;
  node.querySelector(".toast-text").textContent = text;
  selectors.toastFeed.appendChild(node);
  setTimeout(() => node.remove(), 5000);
}

function updateSessionTime() {
  const elapsed = Date.now() - sessionStart;
  const hours = String(Math.floor(elapsed / 3600000)).padStart(2, "0");
  const minutes = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, "0");
  const seconds = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0");
  selectors.sessionTime.textContent = `${hours}:${minutes}:${seconds}`;
}

function totalSpent(currency) {
  return spendLog[currency] || 0;
}

function purchase(item) {
  const entry = (state.inventory[item.id] = state.inventory[item.id] || { count: 0 });
  const owned = entry.count;
  const cost = Math.ceil(item.baseCost * Math.pow(1.18, owned));
  if (state[item.currency ?? "energy"] < cost) return;
  state[item.currency ?? "energy"] -= cost;
  spendLog[item.currency ?? "energy"] += cost;
  entry.count = owned + 1;
  if (item.clickBonus) state.clickValue += item.clickBonus * activeMultiplier();
  if (item.passiveBonus) state.passiveRate += item.passiveBonus * activeMultiplier();
  if (item.generator) {
    const key = `${item.id}-generator`;
    if (!state.inventory[key]) {
      state.inventory[key] = true;
    }
    // Для Drift Bank инициализируем флаг enabled при первой покупке
    if (item.id === "driftBank" && entry.count === 1) {
      entry.enabled = true;
    }
  }
  if (item.dataPerClick) {
    entry.dataPerClick = (entry.dataPerClick || 0) + item.dataPerClick;
  }
  if (item.timedReward) {
    startTimedReward(item);
  }
  if (item.burstThreshold) {
    entry.burstProgress = 0;
  }
  if (item.globalMultiplier) {
    state.inventory.globalMultiplier = (state.inventory.globalMultiplier || 1) * item.globalMultiplier;
    addToast("Почерк Кнота", "Все бонусы усилились.");
  }
  renderShop();
  renderResources();
}

function toggleDriftBank() {
  if (!state.inventory.driftBank || state.inventory.driftBank.count === 0) {
    return;
  }
  const currentState = state.inventory.driftBank.enabled !== false; // по умолчанию true
  state.inventory.driftBank.enabled = !currentState;
  addToast("Drift Bank", currentState ? "Конвертация остановлена." : "Конвертация возобновлена.");
  renderShop();
  saveState(false);
}

function startTimedReward(item) {
  if (timerHandles.has(item.id)) return;
  const handle = setInterval(() => {
    const owned = state.inventory[item.id]?.count || 0;
    if (!owned) return;
    const amount = item.timedReward.amount * owned;
    state[item.timedReward.currency] += amount;
    addToast(item.title, `+${amount} ${item.timedReward.currency}`);
    renderResources();
  }, item.timedReward.interval);
  timerHandles.set(item.id, handle);
}

function activeMultiplier() {
  return (state.inventory.globalMultiplier || 1) * (state.prestigeBonuses.global || 1);
}

function clickGainValue() {
  return state.clickValue * activeMultiplier() * (state.prestigeBonuses.click || 1);
}

function passiveGainValue() {
  return state.passiveRate * (state.prestigeBonuses.passive || 1);
}

function dataPerClickBonus() {
  const shopBonus = Object.values(state.inventory)
    .filter((inv) => typeof inv === "object" && inv.dataPerClick)
    .reduce((sum, inv) => sum + inv.dataPerClick, 0);
  return shopBonus + (state.prestigeBonuses.dataPerClick || 0);
}

function pruneClickTimestamps(now = Date.now()) {
  while (clickTimestamps.length && clickTimestamps[0] < now - PPS_WINDOW) {
    clickTimestamps.shift();
  }
}

function recordClickTimestamp() {
  const now = Date.now();
  clickTimestamps.push(now);
  pruneClickTimestamps(now);
  updatePPSDisplay();
}

function updatePPSDisplay() {
  const now = Date.now();
  pruneClickTimestamps(now);
  if (!selectors.pps) return;
  if (!clickTimestamps.length) {
    selectors.pps.textContent = "0.0";
    return;
  }
  const earliest = clickTimestamps[0];
  const spanMs = Math.max(now - earliest, 1);
  const windowMs = Math.min(spanMs, PPS_WINDOW);
  const rate = clickTimestamps.length / (windowMs / 1000);
  selectors.pps.textContent = rate.toFixed(1);
}

function renderResources() {
  selectors.energy.textContent = formatNumber(state.energy);
  selectors.credits.textContent = formatNumber(state.credits);
  selectors.data.textContent = formatNumber(state.data);
  selectors.clickValue.textContent = clickGainValue().toFixed(1);
  refreshShopButtons();
  renderPrestigeStats();
}

function renderShop() {
  selectors.shopList.innerHTML = "";
  shopCatalog.forEach((item) => {
    const owned = state.inventory[item.id]?.count || 0;
    const cost = Math.ceil(item.baseCost * Math.pow(1.18, owned));
    const currencyLabel = item.currency === "credits" ? "кредитов" : item.currency === "data" ? "данных" : "энергии";
    const entry = document.createElement("div");
    entry.className = "shop-item";
    entry.dataset.shopId = item.id;
    
    // Специальная обработка для Drift Bank - показываем статус включен/выключен
    let statusText = "";
    if (item.id === "driftBank" && owned > 0) {
      const isEnabled = state.inventory.driftBank?.enabled !== false; // по умолчанию true
      statusText = ` · Статус: ${isEnabled ? "ВКЛ" : "ВЫКЛ"}`;
    }
    
    entry.innerHTML = `
      <div>
        <strong>${item.title}</strong>
        <p>${item.desc}</p>
        <small>Цена: ${formatNumber(cost)} ${currencyLabel} · Владеешь: ${owned}${statusText}</small>
      </div>
    `;
    
    // Для Drift Bank, если он куплен, добавляем кнопку переключения
    if (item.id === "driftBank" && owned > 0) {
      const toggleBtn = document.createElement("button");
      toggleBtn.className = "shop-item__cta shop-item__toggle";
      const isEnabled = state.inventory.driftBank?.enabled !== false;
      toggleBtn.textContent = isEnabled ? "Выключить" : "Включить";
      toggleBtn.dataset.shopId = item.id;
      toggleBtn.dataset.action = "toggle";
      toggleBtn.disabled = false; // Кнопка переключения всегда активна
      toggleBtn.addEventListener("click", () => toggleDriftBank());
      entry.appendChild(toggleBtn);
    }
    
    const btn = document.createElement("button");
    btn.className = "shop-item__cta";
    btn.textContent = "Взять";
    btn.disabled = state[item.currency ?? "energy"] < cost;
    btn.dataset.shopId = item.id;
    btn.addEventListener("click", () => purchase(item));
    entry.appendChild(btn);
    selectors.shopList.appendChild(entry);
  });
}

function refreshShopButtons() {
  shopCatalog.forEach((item) => {
    // Ищем только кнопку покупки, исключая кнопку переключения
    const btn = selectors.shopList.querySelector(`button[data-shop-id="${item.id}"]:not([data-action="toggle"])`);
    if (!btn) return;
    const owned = state.inventory[item.id]?.count || 0;
    const cost = Math.ceil(item.baseCost * Math.pow(1.18, owned));
    btn.disabled = state[item.currency ?? "energy"] < cost;
  });
}

function renderPrestigeShop() {
  if (!selectors.prestigeShopList) return;
  selectors.prestigeShopList.innerHTML = "";
  prestigeCatalog.forEach((item) => {
    const owned = state.prestigeInventory[item.id] || 0;
    const entry = document.createElement("div");
    entry.className = "shop-item";
    entry.innerHTML = `
      <div>
        <strong>${item.title}</strong>
        <p>${item.desc}</p>
        <small>Цена: ${item.cost} искр · Взято: ${owned}</small>
      </div>
    `;
    const btn = document.createElement("button");
    btn.className = "shop-item__cta";
    btn.textContent = "Взять";
    btn.disabled = state.prestigePoints < item.cost;
    btn.addEventListener("click", () => purchasePrestige(item));
    entry.appendChild(btn);
    selectors.prestigeShopList.appendChild(entry);
  });
}

function purchasePrestige(item) {
  if (state.prestigePoints < item.cost) {
    addToast("Лавка искр", "Нужно больше искр.");
    return;
  }
  state.prestigePoints -= item.cost;
  state.prestigeInventory[item.id] = (state.prestigeInventory[item.id] || 0) + 1;
  applyPrestigeEffect(item);
  renderPrestigeShop();
  renderPrestigeStats();
  renderResources();
  addToast("Лавка искр", `${item.title} активирован.`);
  checkAchievements();
}

function applyPrestigeEffect(item) {
  if (!item.effects) return;
  if (item.effects.click) state.prestigeBonuses.click *= item.effects.click;
  if (item.effects.passive) state.prestigeBonuses.passive *= item.effects.passive;
  if (item.effects.global) state.prestigeBonuses.global *= item.effects.global;
  if (item.effects.dataPerClick) state.prestigeBonuses.dataPerClick += item.effects.dataPerClick;
}

function prestigePreviewGain() {
  return Math.floor(state.credits / PRESTIGE_COST);
}

function renderPrestigeStats() {
  if (!selectors.prestigePointsDisplay) return;
  selectors.prestigePointsDisplay.textContent = formatNumber(state.prestigePoints);
  selectors.prestigeRuns.textContent = state.prestige;
  const gain = prestigePreviewGain();
  selectors.prestigeCost.textContent = gain
    ? `готово: ${gain} искр`
    : `нужно ${formatNumber(PRESTIGE_COST)} кредитов`;
  if (selectors.prestigeButton) {
    selectors.prestigeButton.disabled = gain <= 0;
  }
}

function renderAchievements() {
  selectors.achievementList.innerHTML = "";
  achievements.forEach((ach) => {
    const unlocked = state.achievements[ach.id];
    const card = document.createElement("div");
    card.className = "ach-item";
    card.innerHTML = `
      <div>
        <strong>${ach.title}</strong>
        <p>${ach.description}</p>
        <small>${unlocked ? "Разблокировано" : "Секрет"}</small>
      </div>
      <div>${unlocked ? "✓" : "…"}</div>
    `;
    selectors.achievementList.appendChild(card);
  });
}

function checkAchievements() {
  achievements.forEach((ach) => {
    if (state.achievements[ach.id]) return;
    if (ach.condition(state)) {
      state.achievements[ach.id] = true;
      applyReward(ach.reward);
      addToast(ach.title, "Награда выдана.");
      renderResources();
      renderAchievements();
    }
  });
}

function reapplyAchievementRewards() {
  achievements.forEach((ach) => {
    if (state.achievements[ach.id]) {
      applyReward(ach.reward);
    }
  });
}

function handleClick() {
  const gained = clickGainValue();
  state.energy += gained;
  state.totalClicks += 1;
  recordClickTimestamp();
  const dataBonus = dataPerClickBonus();
  if (dataBonus) state.data += dataBonus * activeMultiplier();
  triggerBurstRewards();
  renderResources();
  checkAchievements();
}

function triggerBurstRewards() {
  if (!state.inventory.irisDrone) return;
  const inv = state.inventory.irisDrone;
  inv.burstProgress = (inv.burstProgress || 0) + 1;
  if (inv.burstProgress >= 100) {
    inv.burstProgress = 0;
    state.energy += 50 * activeMultiplier();
    addToast("Iris Drone", "Снял зефирный бонус +50 энергии.");
  }
}

function passiveTick() {
  state.energy += passiveGainValue();
  // Drift Bank работает только если включен
  if (state.inventory["driftBank-generator"] && (state.inventory.driftBank?.enabled !== false)) {
    const bankCount = state.inventory.driftBank?.count || 1;
    const siphon = Math.min(state.energy, 20 * bankCount);
    if (siphon > 0) {
      state.energy -= siphon;
      state.credits += Math.floor(siphon * shopCatalog.find((i) => i.id === "driftBank").yield);
    }
  }
  renderResources();
  checkAchievements();
}

function renderAll() {
  renderResources();
  renderShop();
  renderPrestigeShop();
  renderAchievements();
}

function labGameHandler(event) {
  const type = event.currentTarget.dataset.game;
  if (type === "flux") return fluxDice();
  if (type === "echo") return echoTrail();
  if (type === "oracle") return oraclePulse();
  if (type === "glitch") return glitchLock();
  if (type === "nova") return novaDrift();
}

function fluxDice() {
  const entry = 50;
  if (state.credits < entry) {
    return addToast("Нет хода", "Нужен резерв в 50 кредитов.");
  }
  state.credits -= entry;
  spendLog.credits += entry;
  const roll = Math.random();
  let payout = 0;
  if (roll > 0.95) payout = 600;
  else if (roll > 0.7) payout = 150;
  else if (roll > 0.4) payout = 80;
  else payout = 0;
  state.credits += payout;
  const text = payout
    ? `Flux Dice развеселились: +${payout} кредитов`
    : "Куб кувыркнулся в пустоту. Ничего.";
  addToast("Flux Dice", text);
  if (payout >= 150) state.inventory.fluxWin = true;
  renderResources();
  checkAchievements();
}

function echoTrail() {
  const duration = 10_000;
  let clicks = 0;
  const modal = buildModal("Echo Trail", "10 секунд чистого ритма. Нажимай Pulse Core и удержи темп, чтобы получить бафф.");
  const stats = document.createElement("p");
  stats.textContent = "Кликов: 0";
  modal.body.appendChild(stats);
  const startBtn = document.createElement("button");
  startBtn.textContent = "Старт";
  modal.body.appendChild(startBtn);
  let timer;

  function startRun() {
    clicks = 0;
    stats.textContent = "Кликов: 0";
    const originalHandler = handleClick;
    function echoClick() {
      clicks += 1;
      stats.textContent = `Кликов: ${clicks}`;
      originalHandler();
    }
    selectors.pulseCore.addEventListener("click", echoClick);
    startBtn.disabled = true;
    timer = setTimeout(() => {
      selectors.pulseCore.removeEventListener("click", echoClick);
      const reward = clicks >= 40 ? 400 : clicks >= 25 ? 200 : 50;
      state.energy += reward;
      addToast("Echo Trail", `Срезонировал на ${clicks} кликов: +${reward} энергии.`);
      if (clicks >= 40) state.inventory.echoWin = true;
      stats.textContent = `Дистанция: ${clicks} · Награда ${reward}`;
      startBtn.disabled = false;
      checkAchievements();
    }, duration);
  }

  startBtn.addEventListener("click", startRun);
  modal.closeBtn.addEventListener("click", () => clearTimeout(timer));
}

function oraclePulse() {
  const price = 200;
  if (state.energy < price) {
    return addToast("Oracle Pulse", "Требуется 200 энергии для ритуала.");
  }
  state.energy -= price;
  spendLog.energy += price;
  const effects = [
    () => {
      state.passiveRate += 35;
      return "+35 пассивной энергии.";
    },
    () => {
      state.clickValue += 5;
      return "+5 к силе клика.";
    },
    () => {
      state.credits += 500;
      return "+500 кредитов.";
    },
    () => {
      state.data += 15;
      return "+15 данных.";
    },
  ];
  const outcome = effects[Math.floor(Math.random() * effects.length)]();
  state.inventory.oracleWin = true;
  addToast("Oracle Pulse", outcome);
  renderResources();
  checkAchievements();
}

function glitchLock() {
  const code = Array.from({ length: 4 }, () => Math.floor(Math.random() * 9)).join("");
  const modal = buildModal("Glitch Lock", "Запомни код, затем введи его, пока шум не съел символы.");
  const codeDisplay = document.createElement("div");
  codeDisplay.className = "glitch-code";
  codeDisplay.textContent = code;
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = code.length;
  input.className = "modal-input";
  input.autofocus = true;
  const action = document.createElement("button");
  action.textContent = "Ввести код";
  action.className = "ghost-btn ghost-btn--accent";
  modal.body.insertBefore(codeDisplay, modal.closeBtn);
  modal.body.insertBefore(input, modal.closeBtn);
  modal.body.insertBefore(action, modal.closeBtn);
  setTimeout(() => {
    codeDisplay.textContent = "???";
  }, 2500);
  action.addEventListener("click", () => {
    if (input.value === code) {
      const reward = 120 + Math.floor(Math.random() * 160);
      state.credits += reward;
      state.inventory.glitchWin = true;
      addToast("Glitch Lock", `Код принят: +${reward} кредитов.`);
    } else {
      addToast("Glitch Lock", "Шум поглотил код. Награды нет.");
    }
    action.disabled = true;
    renderResources();
    checkAchievements();
  });
}

function novaDrift() {
  const target = Math.floor(Math.random() * 81) + 10;
  const modal = buildModal("Nova Drift", "Совмести бегунок с целью. Чем ближе — тем жирнее импульс.");
  const targetLabel = document.createElement("p");
  targetLabel.textContent = `Цель: ${target}`;
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = 0;
  slider.max = 100;
  slider.value = 50;
  slider.className = "nova-slider";
  const action = document.createElement("button");
  action.textContent = "Зафиксировать";
  action.className = "ghost-btn ghost-btn--accent";
  modal.body.insertBefore(targetLabel, modal.closeBtn);
  modal.body.insertBefore(slider, modal.closeBtn);
  modal.body.insertBefore(action, modal.closeBtn);
  action.addEventListener("click", () => {
    const diff = Math.abs(Number(slider.value) - target);
    let reward = 0;
    if (diff <= 3) {
      reward = 500;
      state.inventory.novaWin = true;
    } else if (diff <= 10) {
      reward = 250;
    } else {
      reward = 90;
    }
    state.energy += reward;
    addToast("Nova Drift", `Промах ${diff} ед. +${reward} энергии.`);
    action.disabled = true;
    renderResources();
    checkAchievements();
  });
}

function buildModal(title, description) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const modal = document.createElement("div");
  modal.className = "modal";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const desc = document.createElement("p");
  desc.textContent = description;
  const close = document.createElement("button");
  close.textContent = "Закрыть";
  close.className = "ghost-btn";
  close.style.width = "100%";
  overlay.appendChild(modal);
  modal.appendChild(heading);
  modal.appendChild(desc);
  modal.appendChild(close);
  document.body.appendChild(overlay);
  close.addEventListener("click", () => overlay.remove());
  return { overlay, body: modal, closeBtn: close };
}

function switchView(target) {
  if (!target || target === currentView) return;
  currentView = target;
  selectors.views.forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === target);
  });
  selectors.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.viewTarget === target);
  });
}

function setupNavigation() {
  selectors.tabs.forEach((tab) =>
    tab.addEventListener("click", () => switchView(tab.dataset.viewTarget))
  );
}

function setupKonami() {
  window.addEventListener("keydown", (event) => {
    if (event.key === konamiSequence[konamiProgress]) {
      konamiProgress += 1;
      if (konamiProgress === konamiSequence.length) {
        state.inventory.konamiUnlocked = true;
        state.data += 20;
        addToast("Комбо Кнота", "+20 данных за чёткое чувство ностальгии.");
        checkAchievements();
        konamiProgress = 0;
      }
    } else {
      konamiProgress = 0;
    }
  });
}

function setupEvents() {
  selectors.pulseCore.addEventListener("click", handleClick);
  selectors.saveButton.addEventListener("click", () => saveState(true));
  selectors.resetButton.addEventListener("click", resetState);
  selectors.labCards.forEach((card) => card.addEventListener("click", labGameHandler));
  selectors.konamiHint.addEventListener("click", () => addToast("Подсказка", "Порядок на кнопках? Может быть, но только тем, кто помнит джойстик."));
  if (selectors.prestigeButton) {
    selectors.prestigeButton.addEventListener("click", performPrestige);
  }
  setupNavigation();
}

function tick() {
  passiveTick();
}

function init() {
  renderAll();
  setupEvents();
  setupKonami();
  resumeTimedRewards();
  setInterval(tick, 1000);
  setInterval(updateSessionTime, 1000);
  setInterval(updatePPSDisplay, 250);
  setInterval(() => saveState(false), 30000);
}

function resumeTimedRewards() {
  shopCatalog
    .filter((item) => item.timedReward)
    .forEach((item) => {
      if (state.inventory[item.id]?.count) {
        startTimedReward(item);
      }
    });
}

init();

