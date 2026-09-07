// BrewMate frontend — consume la API de FastAPI (backend/app.py)
// Cambiá API_URL si desplegás el backend en otro lado (Render, Railway, etc.)
// o si corrés el backend local en otro puerto.
const API_URL = "http://localhost:8010/api/recipes";

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
      Revisá que hayas ejecutado esto en una terminal, dentro de la carpeta <code>backend/</code>:<br>
      <code>uvicorn app:app --reload --port 8010</code><br>
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

fetchRecipes();
