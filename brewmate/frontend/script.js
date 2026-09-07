// BrewMate frontend — consume la API de FastAPI (backend/app.py)
// Apunta al backend ya desplegado en Render. Si corrés todo local, cambiá esto
// por "http://localhost:8010/api/recipes" (y el equivalente para GRAIN_WATER_URL).
const API_URL = "https://brewmate-api.onrender.com/api/recipes";
const GRAIN_WATER_URL = "https://brewmate-api.onrender.com/api/calculators/grain-water";
const ABV_URL = "https://brewmate-api.onrender.com/api/calculators/abv";
const STYLES_URL = "https://brewmate-api.onrender.com/api/styles";

const form = document.getElementById("recipe-form");
const list = document.getElementById("recipes-list");
const statusMsg = document.getElementById("status-msg");

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
    // --- Calculadora rápida de ABV ---
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

// --- Estilos base ---
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
  document.getElementById("style").value = style.name;
  document.getElementById("og").value = ((style.og_min + style.og_max) / 2).toFixed(3);
  document.getElementById("fg").value = ((style.fg_min + style.fg_max) / 2).toFixed(3);
  document.getElementById("ibu").value = Math.round((style.ibu_min + style.ibu_max) / 2);
  document.getElementById("name").focus();
  document.getElementById("name").scrollIntoView({ behavior: "smooth", block: "center" });
}

fetchStyles();
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
  fetchRecipes();
}

// --- Calculadora de malta y agua ---
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

fetchRecipes();
