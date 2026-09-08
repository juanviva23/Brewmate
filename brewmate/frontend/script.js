// BrewMate frontend — consume la API de FastAPI (backend/app.py)
const API_URL = "https://brewmate-api.onrender.com/api/recipes";
const GRAIN_WATER_URL = "https://brewmate-api.onrender.com/api/calculators/grain-water";
const ABV_URL = "https://brewmate-api.onrender.com/api/calculators/abv";
const STYLES_URL = "https://brewmate-api.onrender.com/api/styles";

const form = document.getElementById("recipe-form");
const list = document.getElementById("recipes-list");
const statusMsg = document.getElementById("status-msg");

/* ======================================================================
   NAVEGACION (sidebar / vistas)
   ====================================================================== */
const LAST_VIEW_KEY = "brewmate_last_view";

function showView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById("view-" + viewId);
  if (target) target.classList.add("active");

  document.querySelectorAll("[data-view]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewId);
  });

  localStorage.setItem(LAST_VIEW_KEY, viewId);
  closeMobileSidebar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initNav() {
  document.querySelectorAll("[data-view]").forEach(btn => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });

  document.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const submenu = document.getElementById(btn.dataset.toggle);
      if (submenu) submenu.classList.toggle("open");
    });
  });

  showView(localStorage.getItem(LAST_VIEW_KEY) || "inicio");
}

function openMobileSidebar() {
  const s = document.getElementById("sidebar");
  const b = document.getElementById("sidebar-backdrop");
  if (s) s.classList.add("open");
  if (b) b.classList.add("open");
}
function closeMobileSidebar() {
  const s = document.getElementById("sidebar");
  const b = document.getElementById("sidebar-backdrop");
  if (s) s.classList.remove("open");
  if (b) b.classList.remove("open");
}

const sidebarToggle = document.getElementById("sidebar-toggle");
if (sidebarToggle) sidebarToggle.addEventListener("click", openMobileSidebar);
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", closeMobileSidebar);

/* ======================================================================
   RECETAS PROPIAS
   ====================================================================== */
async function fetchRecipes() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("No se pudo conectar con la API");
    renderRecipes(await res.json());
  } catch (err) {
    const baseUrl = API_URL.replace("/api/recipes", "");
    list.innerHTML = '<p class="empty">No se pudo conectar con el backend en <strong>' + baseUrl +
      '</strong>. Si es la primera visita en un rato, el backend gratis de Render puede tardar unos 30 segundos en despertarse. Proba recargar en unos segundos. (Detalle: ' + err.message + ')</p>';
  }
}

function renderRecipes(recipes) {
  if (!recipes || recipes.length === 0) {
    list.innerHTML = '<p class="empty">Todavia no cargaste ninguna receta. Agrega la primera arriba.</p>';
    return;
  }
  list.innerHTML = recipes.map(r => `
    <div class="recipe-card" data-id="${r.id}">
      <button class="delete-btn" onclick="deleteRecipe(${r.id})" title="Eliminar">&#10006;</button>
      <h3>${escapeHtml(r.name)}</h3>
      <span class="recipe-style">${escapeHtml(r.style)}</span>
      <div class="recipe-stats">
        <span>ABV<strong>${r.abv}%</strong></span>
        <span>OG<strong>${r.og}</strong></span>
        <span>FG<strong>${r.fg}</strong></span>
        ${r.ibu_target ? `<span>IBU<strong>${r.ibu_target}</strong></span>` : ""}
        <span>Batch<strong>${r.batch_liters != null ? r.batch_liters : 20}L</strong></span>
      </div>
      ${r.notes ? `<div class="recipe-notes">${escapeHtml(r.notes)}</div>` : ""}
      <button type="button" class="ferm-toggle-btn" onclick="toggleFermPanel(${r.id})">Fermentacion</button>
      <div class="ferm-panel" id="ferm-panel-${r.id}">
        <form class="ferm-add-row" onsubmit="return addFermReading(event, ${r.id})">
          <input type="date" class="ferm-date-input" required>
          <input type="number" step="0.001" placeholder="Densidad" class="ferm-gravity-input" required>
          <button type="submit">Sumar</button>
        </form>
        <div class="ferm-chart-wrap">
          <canvas id="ferm-chart-${r.id}" height="90"></canvas>
        </div>
      </div>
    </div>
  `).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById("name").value,
      style: document.getElementById("style").value,
      og: parseFloat(document.getElementById("og").value),
      fg: parseFloat(document.getElementById("fg").value),
      ibu_target: document.getElementById("ibu").value ? parseFloat(document.getElementById("ibu").value) : null,
      batch_liters: document.getElementById("liters").value ? parseFloat(document.getElementById("liters").value) : 20,
      notes: document.getElementById("notes").value || null,
    };
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(JSON.stringify(err.detail));
      }
      statusMsg.textContent = "Receta agregada correctamente.";
      statusMsg.style.color = "#16a34a";
      form.reset();
      fetchRecipes();
      setTimeout(() => { statusMsg.textContent = ""; }, 2500);
    } catch (err) {
      statusMsg.textContent = "Error: " + err.message;
      statusMsg.style.color = "#b91c1c";
    }
  });
}

async function deleteRecipe(id) {
  if (!confirm("Eliminar esta receta?")) return;
  await fetch(API_URL + "/" + id, { method: "DELETE" });
  localStorage.removeItem("ferm_" + id);
  fetchRecipes();
}

/* ======================================================================
   CALCULADORA DE MALTA Y AGUA
   ====================================================================== */
const grainWaterForm = document.getElementById("grain-water-form");
const grainWaterResult = document.getElementById("grain-water-result");

if (grainWaterForm) {
  grainWaterForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      og: parseFloat(document.getElementById("gw-og").value),
      batch_liters: parseFloat(document.getElementById("gw-liters").value),
      efficiency: (parseFloat(document.getElementById("gw-efficiency").value) || 70) / 100,
      boil_time_minutes: parseFloat(document.getElementById("gw-boiltime").value) || 60,
    };
    try {
      const res = await fetch(GRAIN_WATER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(JSON.stringify(err.detail));
      }
      const data = await res.json();
      grainWaterResult.innerHTML = `
        <div class="gw-result">
          <div class="gw-stat"><strong>${data.grain_kg} kg</strong><span>de malta base</span></div>
          <div class="gw-stat"><strong>${data.total_water_liters} L</strong><span>de agua total</span></div>
        </div>
        <p class="gw-breakdown">
          Desglose de agua: ${data.breakdown.batch_liters}L de batch final,
          ${data.breakdown.boil_off_liters}L de evaporacion,
          ${data.breakdown.grain_absorption_liters}L absorbidos por el grano y
          ${data.breakdown.trub_loss_liters}L de sedimento.
        </p>`;
    } catch (err) {
      grainWaterResult.innerHTML = '<p class="empty">Error: ' + err.message + '</p>';
    }
  });
}

/* ======================================================================
   CALCULADORA RAPIDA DE ABV
   ====================================================================== */
const abvForm = document.getElementById("abv-form");
const abvResult = document.getElementById("abv-result");

if (abvForm) {
  abvForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      og: parseFloat(document.getElementById("abv-og").value),
      fg: parseFloat(document.getElementById("abv-fg").value),
    };
    try {
      const res = await fetch(ABV_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(JSON.stringify(err.detail));
      }
      const data = await res.json();
      abvResult.innerHTML = '<div class="gw-result"><div class="gw-stat"><strong>' + data.abv + '%</strong><span>ABV estimado</span></div></div>';
    } catch (err) {
      abvResult.innerHTML = '<p class="empty">Error: ' + err.message + '</p>';
    }
  });
}

/* ======================================================================
   CALCULADORA DE IBU (Tinseth, client-side)
   ====================================================================== */
const hopRowsContainer = document.getElementById("hop-rows");
const hopRowTemplate = document.getElementById("hop-row-template");
const ibuForm = document.getElementById("ibu-form");
const ibuResult = document.getElementById("ibu-result");

function addHopRow() {
  if (!hopRowTemplate || !hopRowsContainer) return;
  const clone = hopRowTemplate.content.cloneNode(true);
  const row = clone.querySelector(".hop-row");
  row.querySelector(".remove-hop-btn").addEventListener("click", () => {
    if (hopRowsContainer.children.length > 1) row.remove();
  });
  hopRowsContainer.appendChild(clone);
}

const addHopBtn = document.getElementById("add-hop-row");
if (addHopBtn) addHopBtn.addEventListener("click", addHopRow);
addHopRow();

function tinsethUtilization(og, minutes) {
  const bignessFactor = 1.65 * Math.pow(0.000125, og - 1);
  const boilTimeFactor = (1 - Math.exp(-0.04 * minutes)) / 4.15;
  return bignessFactor * boilTimeFactor;
}

function calcIBU(og, volumeLiters, hops) {
  let totalIbu = 0;
  const breakdown = [];
  hops.forEach(h => {
    if (!h.grams || !h.alpha || h.time == null || isNaN(h.time)) return;
    const utilization = tinsethUtilization(og, h.time);
    const ibu = (h.grams * h.alpha * 10 * utilization) / volumeLiters;
    totalIbu += ibu;
    breakdown.push({ name: h.name || "Lupulo", ibu: Math.round(ibu * 10) / 10 });
  });
  return { total: Math.round(totalIbu * 10) / 10, breakdown };
}

if (ibuForm) {
  ibuForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const og = parseFloat(document.getElementById("ibu-og").value);
    const volumeLiters = parseFloat(document.getElementById("ibu-liters").value);

    const hops = Array.prototype.slice.call(hopRowsContainer.querySelectorAll(".hop-row")).map(row => ({
      name: row.querySelector(".hop-name").value,
      grams: parseFloat(row.querySelector(".hop-grams").value),
      alpha: parseFloat(row.querySelector(".hop-alpha").value),
      time: parseFloat(row.querySelector(".hop-time").value),
    }));

    if (!og || !volumeLiters || hops.every(h => !h.grams)) {
      ibuResult.innerHTML = '<p class="empty">Completa al menos OG, litros y un lupulo con gramos.</p>';
      return;
    }

    const result = calcIBU(og, volumeLiters, hops);
    ibuResult.innerHTML =
      '<div class="ibu-total"><strong>' + result.total + ' IBU</strong><span>amargor total estimado</span></div>' +
      '<p class="gw-breakdown">' + result.breakdown.map(b => escapeHtml(b.name) + ": " + b.ibu + " IBU").join(" &middot; ") + '</p>';
  });
}

/* ======================================================================
   TRACKER DE FERMENTACION
   ====================================================================== */
const fermCharts = {};

function getFermReadings(recipeId) {
  return JSON.parse(localStorage.getItem("ferm_" + recipeId) || "[]");
}
function saveFermReadings(recipeId, readings) {
  localStorage.setItem("ferm_" + recipeId, JSON.stringify(readings));
}

function toggleFermPanel(recipeId) {
  const panel = document.getElementById("ferm-panel-" + recipeId);
  if (!panel) return;
  panel.classList.toggle("open");
  if (panel.classList.contains("open")) renderFermChart(recipeId);
}

function addFermReading(event, recipeId) {
  event.preventDefault();
  const f = event.target;
  const date = f.querySelector(".ferm-date-input").value;
  const gravity = parseFloat(f.querySelector(".ferm-gravity-input").value);
  if (!date || !gravity) return false;

  const readings = getFermReadings(recipeId);
  readings.push({ date: date, gravity: gravity });
  readings.sort((a, b) => a.date.localeCompare(b.date));
  saveFermReadings(recipeId, readings);

  f.reset();
  renderFermChart(recipeId);
  return false;
}

function renderFermChart(recipeId) {
  const canvas = document.getElementById("ferm-chart-" + recipeId);
  if (!canvas || typeof Chart === "undefined") return;

  const readings = getFermReadings(recipeId);
  if (fermCharts[recipeId]) fermCharts[recipeId].destroy();
  if (readings.length === 0) return;

  fermCharts[recipeId] = new Chart(canvas, {
    type: "line",
    data: {
      labels: readings.map(r => r.date),
      datasets: [{
        label: "Densidad",
        data: readings.map(r => r.gravity),
        borderColor: "#d97706",
        backgroundColor: "rgba(217,119,6,0.15)",
        tension: 0.25,
        fill: true,
        pointRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { title: { display: true, text: "Densidad (SG)" } } },
    },
  });
}

/* ======================================================================
   RECORDATORIOS
   ====================================================================== */
const REMINDERS_KEY = "brewmate_reminders";
const notifEnableBtn = document.getElementById("notif-enable-btn");
const notifStatus = document.getElementById("notif-status");
const reminderForm = document.getElementById("reminder-form");
const remindersList = document.getElementById("reminders-list");

function updateNotifStatus() {
  if (!notifStatus) return;
  if (!("Notification" in window)) {
    notifStatus.textContent = "Tu navegador no soporta notificaciones.";
    return;
  }
  if (Notification.permission === "granted") {
    notifStatus.textContent = "Notificaciones activadas.";
  } else if (Notification.permission === "denied") {
    notifStatus.textContent = "Bloqueadas. Habilitalas desde la configuracion del navegador.";
  } else {
    notifStatus.textContent = "Todavia no activadas.";
  }
}

if (notifEnableBtn) {
  notifEnableBtn.addEventListener("click", async () => {
    if (!("Notification" in window)) return;
    await Notification.requestPermission();
    updateNotifStatus();
  });
}

async function sendNotification(text) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    if (navigator.serviceWorker) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        reg.showNotification("BrewMate", { body: text, icon: "icons/icon-180.png" });
        return;
      }
    }
    new Notification("BrewMate", { body: text, icon: "icons/icon-180.png" });
  } catch (e) {
    new Notification("BrewMate", { body: text });
  }
}

function getReminders() {
  return JSON.parse(localStorage.getItem(REMINDERS_KEY) || "[]");
}
function saveReminders(reminders) {
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}

function renderReminders() {
  if (!remindersList) return;
  const reminders = getReminders();
  if (reminders.length === 0) {
    remindersList.innerHTML = '<p class="ferm-empty">No tenes recordatorios programados.</p>';
    return;
  }
  remindersList.innerHTML = reminders.map(r => {
    const dateStr = new Date(r.due).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    return '<div class="reminder-item"><span>' + escapeHtml(r.text) + ' &mdash; ' + dateStr +
      '</span><button type="button" class="rem-cancel" onclick="cancelReminder(' + r.id + ')">&#10006;</button></div>';
  }).join("");
}

function cancelReminder(id) {
  saveReminders(getReminders().filter(r => r.id !== id));
  renderReminders();
}

if (reminderForm) {
  reminderForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = document.getElementById("reminder-text").value;
    const days = parseFloat(document.getElementById("reminder-days").value);
    if (!text || !days) return;
    const reminders = getReminders();
    reminders.push({ id: Date.now(), text: text, due: Date.now() + days * 86400000, notified: false });
    saveReminders(reminders);
    renderReminders();
    reminderForm.reset();
  });
}

function checkReminders() {
  const reminders = getReminders();
  let changed = false;
  reminders.forEach(r => {
    if (!r.notified && Date.now() >= r.due) {
      sendNotification(r.text);
      r.notified = true;
      changed = true;
    }
  });
  if (changed) {
    saveReminders(reminders.filter(r => !r.notified));
    renderReminders();
  }
}

/* ======================================================================
   ESTILOS BASE
   ====================================================================== */
const stylesList = document.getElementById("styles-list");

async function fetchStyles() {
  if (!stylesList) return;
  try {
    const res = await fetch(STYLES_URL);
    if (!res.ok) throw new Error("No se pudo conectar con la API");
    renderStyles(await res.json());
  } catch (err) {
    stylesList.innerHTML = '<p class="empty">No se pudieron cargar los estilos (' + err.message + ')</p>';
  }
}

function renderStyles(styles) {
  stylesList.innerHTML = styles.map(s => {
    const ogMid = ((s.og_min + s.og_max) / 2).toFixed(3);
    const fgMid = ((s.fg_min + s.fg_max) / 2).toFixed(3);
    const abvEstimate = calcAbvClient(parseFloat(ogMid), parseFloat(fgMid));
    return `
    <div class="style-card">
      <h3>${escapeHtml(s.name)}</h3>
      <p class="style-desc">${escapeHtml(s.description)}</p>
      <div class="recipe-stats">
        <span>OG<strong>${s.og_min}&ndash;${s.og_max}</strong></span>
        <span>FG<strong>${s.fg_min}&ndash;${s.fg_max}</strong></span>
        <span>IBU<strong>${s.ibu_min}&ndash;${s.ibu_max}</strong></span>
        <span>ABV<strong>${abvEstimate}%</strong></span>
      </div>
      <div class="yeast-box">
        <strong>Levadura recomendada</strong>
        <ul>${s.yeast_recommendations.map(y => "<li>" + escapeHtml(y) + "</li>").join("")}</ul>
      </div>
      <button type="button" class="use-style-btn" onclick='useStyle(${JSON.stringify(s).replace(/'/g, "&apos;")})'>Usar este estilo</button>
    </div>`;
  }).join("");
}

function calcAbvClient(og, fg) {
  return Math.round((og - fg) * 131.25 * 100) / 100;
}

function useStyle(style) {
  showView("recetas-propias");
  document.getElementById("style").value = style.name;
  document.getElementById("og").value = ((style.og_min + style.og_max) / 2).toFixed(3);
  document.getElementById("fg").value = ((style.fg_min + style.fg_max) / 2).toFixed(3);
  document.getElementById("ibu").value = Math.round((style.ibu_min + style.ibu_max) / 2);
  setTimeout(() => {
    const n = document.getElementById("name");
    n.focus();
    n.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 60);
}

/* ======================================================================
   INIT
   ====================================================================== */
initNav();
updateNotifStatus();
renderReminders();
checkReminders();
setInterval(checkReminders, 30000);
fetchStyles();
fetchRecipes();
