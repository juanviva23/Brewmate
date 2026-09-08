// BrewMate frontend — consume la API de FastAPI (backend/app.py)
// Apunta al backend ya desplegado en Render. Si corrés todo local, cambiá esto
// por "http://localhost:8010/api/recipes" (y los equivalentes de abajo).
const API_URL = "https://brewmate-api.onrender.com/api/recipes";
const GRAIN_WATER_URL = "https://brewmate-api.onrender.com/api/calculators/grain-water";
const ABV_URL = "https://brewmate-api.onrender.com/api/calculators/abv";
const STYLES_URL = "https://brewmate-api.onrender.com/api/styles";

const form = document.getElementById("recipe-form");
const list = document.getElementById("recipes-list");
const statusMsg = document.getElementById("status-msg");

/* ======================================================================
   NAVEGACIÓN (sidebar / vistas)
   ====================================================================== */
const LAST_VIEW_KEY = "brewmate_last_view";

function showView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById(`view-${viewId}`);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-item[data-view], .nav-subitem[data-view]").forEach(btn => {
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
      submenu?.classList.toggle("open");
    });
  });

  const savedView = localStorage.getItem(LAST_VIEW_KEY) || "inicio";
  showView(savedView);
}

function openMobileSidebar() {
  document.getElementById("sidebar")?.classList.add("open");
  document.getElementById("sidebar-backdrop")?.classList.add("open");
}
function closeMobileSidebar() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebar-backdrop")?.classList.remove("open");
}
document.getElementById("sidebar-toggle")?.addEventListener("click", openMobileSidebar);
document.getElementById("sidebar-backdrop")?.addEventListener("click", closeMobileSidebar);

/* ======================================================================
   RECETAS PROPIAS (igual que antes, + panel de fermentación por receta)
   ====================================================================== */
async function fetchRecipes() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("No se pudo conectar con la API");
    const recipes = await res.json();
    renderRecipes(recipes);
  } catch (err) {
    const baseUrl = API_URL.replace("/api/recipes", "");
    list.innerHTML = `<p class="empty">⚠️ No se pudo conectar con el backend en <strong>${baseUrl}</strong>.<br>
      Si es la primera visita en un rato, el backend gratis de Render puede tardar
      unos 30 segundos en "despertarse" — probá recargar en unos segundos.<br>
      (Detalle técnico: ${err.message})</p>`;
  }
}

function renderRecipes(recipes) {
  if (recipes.length === 0) {
    list.innerHTML = `<p class="empty">Todavía no cargaste ninguna receta. ¡Agregá la primera arriba!</p>`;
    return;
  }
  list.innerHTML = recipes.map(r => `
    <div class="recipe-card" data-id="${r.id}">
      <button class="delete-btn" onclick="deleteRecipe(${r.id})" title="Eliminar">✖</button>
      <h3>${escapeHtml(r.name)}</h3>
      <span class="recipe-style">${escapeHtml(r.style)}</span>
      <div class="recipe-stats">
        <span>ABV<strong>${r.abv}%</strong></span>
        <span>OG<strong>${r.og}</strong></span>
        <span>FG<strong>${r.fg}</strong></span>
        ${r.ibu_target ? `<span>IBU<strong>${r.ibu_target}</strong></span>` : ""}
        <span>Batch<strong>${r.batch_liters ?? 20}L</strong></span>
      </div>
      ${r.notes ? `<div class="recipe-notes">${escapeHtml(r.notes)}</div>` : ""}

      <button type="button" class="ferm-toggle-btn" onclick="toggleFermPanel(${r.id})">📉 Fermentación</button>
      <div class="ferm-panel" id="ferm-panel-${r.id}">
        <form class="ferm-add-row" onsubmit="return addFermReading(event, ${r.id})">
          <input type="date" class="ferm-date-input" required>
          <input type="number" step="0.001" placeholder="Densidad (1.020)" class="ferm-gravity-input" required>
          <button type="submit">➕</button>
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
  div.textContent = str ?? "";
  return div.innerHTML;
}

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
    statusMsg.textContent = "✅ Receta agregada";
    statusMsg.style.color = "#16a34a";
    form.reset();
    fetchRecipes();
    setTimeout(() => statusMsg.textContent = "", 2500);
  } catch (err) {
    statusMsg.textContent = `⚠️ Error: ${err.message}`;
    statusMsg.style.color = "#b91c1c";
  }
});

async function deleteRecipe(id) {
  if (!confirm("¿Eliminar esta receta?")) return;
  await fetch(`${API_URL}/${id}`, { method: "DELETE" });
  localStorage.removeItem(`ferm_${id}`);
  fetchRecipes();
}

/* ======================================================================
   CALCULADORA DE MALTA Y AGUA (igual que antes)
   ====================================================================== */
const grainWaterForm = document.getElementById("grain-water-form");
const grainWaterResult = document.getElementById("grain-water-result");

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
        Desglose de agua: ${data.breakdown.batch_liters}L batch final +
        ${data.breakdown.boil_off_liters}L evaporación +
        ${data.breakdown.grain_absorption_liters}L absorbida por el grano +
        ${data.breakdown.trub_loss_liters}L de sedimento/trub.
      </p>
    `;
  } catch (err) {
    grainWaterResult.innerHTML = `<p class="empty">⚠️ Error: ${err.message}</p>`;
  }
});

/* ======================================================================
   CALCULADORA RÁPIDA DE ABV (igual que antes)
   ====================================================================== */
const abvForm = document.getElementById("abv-form");
const abvResult = document.getElementById("abv-result");

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
    abvResult.innerHTML = `<div class="gw-result"><div class="gw-stat"><strong>${data.abv}%</strong><span>ABV estimado</span></div></div>`;
  } catch (err) {
    abvResult.innerHTML = `<p class="empty">⚠️ Error: ${err.message}</p>`;
  }
});

/* ======================================================================
   NUEVO: CALCULADORA DE IBU (fórmula de Tinseth, 100% client-side)
   ====================================================================== */
const hopRowsContainer = document.getElementById("hop-rows");
const hopRowTemplate = document.getElementById("hop-row-template");
const ibuForm = document.getElementById("ibu-form");
const ibuResult = document.getElementById("ibu-result");

function addHopRow() {
  const clone = hopRowTemplate.content.cloneNode(true);
  const row = clone.querySelector(".hop-row");
  row.querySelector(".remove-hop-btn").addEventListener("click", () => {
    if (hopRowsContainer.children.length > 1) row.remove();
  });
  hopRowsContainer.appendChild(clone);
}
document.getElementById("add-hop-row").addEventListener("click", addHopRow);
addHopRow(); // arranca con una fila cargada

// Utilización de Tinseth: qué % del ácido alfa realmente se isomeriza en el hervor
function tinsethUtilization(og, minutes) {
  const bignessFactor = 1.65 * Math.pow(0.000125, og - 1);
  const boilTimeFactor = (1 - Math.exp(-0.04 * minutes)) / 4.15;
  return bignessFactor * boilTimeFactor;
}

function calcIBU(og, volumeLiters, hops) {
  let totalIbu = 0;
  const breakdown = [];
  hops.forEach(h => {
    if (!h.grams || !h.alpha || h.time === null || h.time === undefined) return;
    const utilization = tinsethUtilization(og, h.time);
    const ibu = (h.grams * h.alpha * 10 * utilization) / volumeLiters;
    totalIbu += ibu;
    breakdown.push({ name: h.name || "Lúpulo", ibu: Math.round(ibu * 10) / 10 });
  });
  return { total: Math.round(totalIbu * 10) / 10, breakdown };
}

ibuForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const og = parseFloat(document.getElementById("ibu-og").value);
  const volumeLiters = parseFloat(document.getElementById("ibu-liters").value);

  const hops = [...hopRowsContainer.querySelectorAll(".hop-row")].map(row => ({
    name: row.querySelector(".hop-name").value,
    grams: parseFloat(row.querySelector(".hop-grams").value),
    alpha: parseFloat(row.querySelector(".hop-alpha").value),
    time: parseFloat(row.querySelector(".hop-time").value),
  }));

  if (!og || !volumeLiters || hops.every(h => !h.grams)) {
    ibuResult.innerHTML = `<p class="empty">⚠️ Completá al menos OG, litros y un lúpulo con gramos.</p>`;
    return;
  }

  const { total, breakdown } = calcIBU(og, volumeLiters, hops);
  ibuResult.innerHTML = `
    <div class="ibu-total"><strong>${total} IBU</strong><span>amargor total estimado</span></div>
    <p class="gw-breakdown">
      ${breakdown.map(b => `${escapeHtml(b.name)}: ${b.ibu} IBU`).join(" · ")}
    </p>
  `;
});

/* ======================================================================
   NUEVO: TRACKER DE FERMENTACIÓN (por receta, guardado en localStorage)
   ====================================================================== */
const fermCharts = {}; // recipeId -> instancia de Chart.js

function getFermReadings(recipeId) {
  return JSON.parse(localStorage.getItem(`ferm_${recipeId}`) || "[]");
}
function saveFermReadings(recipeId, readings) {
  localStorage.setItem(`ferm_${recipeId}`, JSON.stringify(readings));
}

function toggleFermPanel(recipeId) {
  const panel = document.getElementById(`ferm-panel-${recipeId}`);
  if (!panel) return;
  panel.classList.toggle("open");
  if (panel.classList.contains("open")) {
    renderFermChart(recipeId);
  }
}

function addFermReading(event, recipeId) {
  event.preventDefault();
  const form = event.target;
  const date = form.querySelector(".ferm-date-input").value;
  const gravity = parseFloat(form.querySelector(".ferm-gravity-input").value);
  if (!date || !gravity) return false;

  const readings = getFermReadings(recipeId);
  readings.push({ date, gravity });
  readings.sort((a, b) => a.date.localeCompare(b.date));
  saveFermReadings(recipeId, readings);

  form.reset();
  renderFermChart(recipeId);
  return false;
}

function renderFermChart(recipeId) {
  const canvas = document.getElementById(`ferm-chart-${recipeId}`);
  if (!canvas || typeof Chart === "undefined") return;

  const readings = getFermReadings(recipeId);

  if (fermCharts[recipeId]) {
    fermCharts[recipeId].destroy();
  }

  if (readings.length === 0) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

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
      scales: {
        y: { title: { display: true, text: "Densidad (SG)" } },
      },
    },
  });
}

/* ======================================================================
   NUEVO: RECORDATORIOS / NOTIFICACIONES
   ====================================================================== */
const REMINDERS_KEY = "brewmate_reminders";
const notifEnableBtn = document.getElementById("notif-enable-btn");
const notifStatus = document.getElementById("notif-status");
const reminderForm = document.getElementById("reminder-form");
const remindersList = document.getElementById("reminders-list");

function updateNotifStatus() {
  if (!("Notification" in window)) {
    notifStatus.textContent = "⚠️ Tu navegador no soporta notificaciones.";
    return;
  }
  if (Notification.permission === "granted") {
    notifStatus.textContent = "✅ Notificaciones activadas.";
  } else if (Notification.permission === "denied") {
    notifStatus.textContent = "❌ Bloqueadas. Habilitalas desde la configuración del navegador para este sitio.";
  } else {
    notifStatus.textContent = "🔕 Todavía no activadas.";
  }
}

notifEnableBtn?.addEventListener("click", async () => {
  if (!("Notification" in window)) return;
  await Notification.requestPermission();
  updateNotifStatus();
});

async function sendNotification(title) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    if (navigator.serviceWorker) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        reg.showNotification("🍺 BrewMate", { body: title, icon: "icons/icon-180.png" });
        return;
      }
    }
    new Notification("🍺 BrewMate", { body: title, icon: "icons/icon-180.png" });
  } catch {
    new Notification("🍺 BrewMate", { body: title });
  }
}

function getReminders() {
  return JSON.parse(localStorage.getItem(REMINDERS_KEY) || "[]");
}
function saveReminders(reminders) {
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}

function renderReminders() {
  const reminders = getReminders();
  if (reminders.length === 0) {
    remindersList.innerHTML = `<p class="ferm-empty">No tenés recordatorios programados.</p>`;
    return;
  }
  remindersList.innerHTML = reminders.map(r => {
    const dueDate = new Date(r.due);
    const dateStr = dueDate.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `
      <div class="reminder-item">
        <span>⏰ ${escapeHtml(r.text)} — ${dateStr}</span>
        <button type="button" class="rem-cancel" onclick="cancelReminder(${r.id})">✖</button>
      </div>
    `;
  }).join("");
}

function cancelReminder(id) {
  const reminders = getReminders().filter(r => r.id !== id);
  saveReminders(reminders);
  renderReminders();
}

reminderForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = document.getElementById("reminder-text").value;
  const days = parseFloat(document.getElementById("reminder-days").value);
  if (!text || !days) return;

  const reminders = getReminders();
  reminders.push({
    id: Date.now(),
    text,
    due: Date.now() + days * 24 * 60 * 60 * 1000,
    notified: false,
  });
  saveReminders(reminders);
  renderReminders();
  reminderForm.reset();
});

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
    saveReminders(reminders.filter(r => !r.notified)); // limpia los ya avisados
    renderReminders();
  }
}

/* ======================================================================
   ESTILOS BASE (igual que antes, + navega a "Recetas propias" al usar uno)
   ====================================================================== */
const stylesList = document.getElementById("styles-list");

async function fetchStyles() {
  try {
    const res = await fetch(STYLES_URL);
    if (!res.ok) throw new Error("No se pudo conectar con la API");
    const styles = await res.json();
    renderStyles(styles);
  } catch (err) {
    stylesList.innerHTML = `<p class="empty">⚠️ No se pudieron cargar los estilos (${err.message})</p>`;
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
        <span>OG<strong>${s.og_min}–${s.og_max}</strong></span>
        <span>FG<strong>${s.fg_min}–${s.fg_max}</strong></span>
        <span>IBU<strong>${s.ibu_min}–${s.ibu_max}</strong></span>
        <span>ABV~<strong>${abvEstimate}%</strong></span>
      </div>
      <div class="yeast-box">
        <strong>🧫 Levadura recomendada:</strong>
        <ul>${s.yeast_recommendations.map(y => `<li>${escapeHtml(y)}</li>`).join("")}</ul>
      </div>
      <button type="button" class="use-style-btn" onclick='useStyle(${JSON.stringify(s).replace(/'/g, "&apos;")})'>✨ Usar este estilo</button>
    </div>
  `;
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
    document.getElementById("name").focus();
    document.getElementById("name").scrollIntoView({ behavior: "smooth", block: "center" });
  }, 50);
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
