"""
BrewMate API — mini proyecto de práctica full-stack
Construido como ejercicio para aprender a dirigir agentes de IA (Claude Code / Codex)
en el desarrollo de una plataforma punta a punta.

Stack: FastAPI + SQLite (sin dependencias externas de infraestructura)
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "brewmate.db"

app = FastAPI(title="BrewMate API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            style TEXT NOT NULL,
            og REAL NOT NULL,
            fg REAL NOT NULL,
            ibu_target REAL,
            batch_liters REAL DEFAULT 20,
            notes TEXT
        )
    """)
    conn.commit()
    conn.close()


class RecipeIn(BaseModel):
    name: str = Field(..., min_length=1)
    style: str = Field(..., min_length=1)
    og: float = Field(..., ge=0.98, le=1.20, description="Original Gravity, ej. 1.050")
    fg: float = Field(..., ge=0.98, le=1.20, description="Final Gravity, ej. 1.010")
    ibu_target: Optional[float] = None
    batch_liters: Optional[float] = 20
    notes: Optional[str] = None


class RecipeOut(RecipeIn):
    id: int
    abv: float


def calc_abv(og: float, fg: float) -> float:
    """Fórmula estándar simplificada: ABV = (OG - FG) * 131.25"""
    return round((og - fg) * 131.25, 2)


def row_to_out(row) -> dict:
    d = dict(row)
    d["abv"] = calc_abv(d["og"], d["fg"])
    return d


@app.on_event("startup")
def startup():
    init_db()


@app.get("/api/recipes", response_model=List[RecipeOut])
def list_recipes():
    conn = get_db()
    rows = conn.execute("SELECT * FROM recipes ORDER BY id DESC").fetchall()
    conn.close()
    return [row_to_out(r) for r in rows]


@app.post("/api/recipes", response_model=RecipeOut)
def create_recipe(recipe: RecipeIn):
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO recipes (name, style, og, fg, ibu_target, batch_liters, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (recipe.name, recipe.style, recipe.og, recipe.fg, recipe.ibu_target, recipe.batch_liters, recipe.notes),
    )
    conn.commit()
    new_id = cur.lastrowid
    row = conn.execute("SELECT * FROM recipes WHERE id = ?", (new_id,)).fetchone()
    conn.close()
    return row_to_out(row)


@app.get("/api/recipes/{recipe_id}", response_model=RecipeOut)
def get_recipe(recipe_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    return row_to_out(row)


@app.put("/api/recipes/{recipe_id}", response_model=RecipeOut)
def update_recipe(recipe_id: int, recipe: RecipeIn):
    conn = get_db()
    existing = conn.execute("SELECT id FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    conn.execute(
        "UPDATE recipes SET name=?, style=?, og=?, fg=?, ibu_target=?, batch_liters=?, notes=? WHERE id=?",
        (recipe.name, recipe.style, recipe.og, recipe.fg, recipe.ibu_target, recipe.batch_liters, recipe.notes, recipe_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
    conn.close()
    return row_to_out(row)


@app.delete("/api/recipes/{recipe_id}")
def delete_recipe(recipe_id: int):
    conn = get_db()
    existing = conn.execute("SELECT id FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    conn.execute("DELETE FROM recipes WHERE id = ?", (recipe_id,))
    conn.commit()
    conn.close()
    return {"ok": True, "deleted_id": recipe_id}


# ---------------------------------------------------------------------------
# Calculadora de Malta y Agua (feature nueva)
# ---------------------------------------------------------------------------
# Fórmula estándar de homebrewing (equivalente métrico del PPG imperial):
#   - "Puntos" de densidad = (OG - 1) * 1000
#   - Potencial de extracto de una malta base tipo Pilsen/Pale 2-row ≈ 300
#     puntos por kg por litro a 100% de eficiencia de macerado (constante
#     ampliamente usada en calculadoras de homebrew en unidades métricas).
#   - kg de malta = (puntos * litros del batch) / (potencial * eficiencia)
#
#   Agua total pre-hervor = litros del batch
#                          + pérdida por evaporación durante el hervor
#                          + agua absorbida por el grano (~1 L/kg)
#                          + pérdida por trub/sedimento (~1 L fija)

class GrainWaterRequest(BaseModel):
    og: float = Field(..., ge=1.00, le=1.20, description="Densidad inicial objetivo, ej. 1.050")
    batch_liters: float = Field(..., gt=0, description="Litros del batch final, ej. 20")
    efficiency: float = Field(0.70, gt=0, le=1.0, description="Eficiencia de macerado, ej. 0.70 = 70%")
    boil_time_minutes: float = Field(60, ge=0, description="Duración del hervor en minutos")
    boil_off_percent_per_hour: float = Field(10.0, ge=0, description="Porcentaje de evaporación por hora de hervor")
    grain_absorption_l_per_kg: float = Field(1.0, gt=0, description="Litros de agua absorbidos por kg de grano")
    trub_loss_liters: float = Field(1.0, ge=0, description="Pérdida fija por sedimento/trub, en litros")
    extract_potential_pkl: float = Field(300.0, gt=0, description="Potencial de extracto (puntos por kg por litro) de la malta base")


class GrainWaterResponse(BaseModel):
    grain_kg: float
    total_water_liters: float
    breakdown: dict


@app.post("/api/calculators/grain-water", response_model=GrainWaterResponse)
def calc_grain_water(req: GrainWaterRequest):
    og_points = (req.og - 1) * 1000
    grain_kg = (og_points * req.batch_liters) / (req.extract_potential_pkl * req.efficiency)

    boil_off_liters = req.batch_liters * (req.boil_off_percent_per_hour / 100) * (req.boil_time_minutes / 60)
    grain_absorption_liters = grain_kg * req.grain_absorption_l_per_kg
    total_water_liters = (
        req.batch_liters + boil_off_liters + grain_absorption_liters + req.trub_loss_liters
    )

    return GrainWaterResponse(
        grain_kg=round(grain_kg, 2),
        total_water_liters=round(total_water_liters, 2),
        breakdown={
            "batch_liters": req.batch_liters,
            "boil_off_liters": round(boil_off_liters, 2),
            "grain_absorption_liters": round(grain_absorption_liters, 2),
            "trub_loss_liters": req.trub_loss_liters,
        },
    )


# ---------------------------------------------------------------------------
# Calculadora rápida de ABV (standalone, sin necesidad de guardar una receta)
# ---------------------------------------------------------------------------

class ABVRequest(BaseModel):
    og: float = Field(..., ge=0.98, le=1.20)
    fg: float = Field(..., ge=0.98, le=1.20)


class ABVResponse(BaseModel):
    abv: float


@app.post("/api/calculators/abv", response_model=ABVResponse)
def calc_abv_endpoint(req: ABVRequest):
    return ABVResponse(abv=calc_abv(req.og, req.fg))


# ---------------------------------------------------------------------------
# Biblioteca de estilos base (10 estilos) con rangos típicos y levadura sugerida
# ---------------------------------------------------------------------------
# Fuente: rangos aproximados de guías BJCP y prácticas comunes de homebrewing.
# Son puntos de partida — cada receta real varía según ingredientes y equipo.

STYLE_PRESETS = [
    {
        "id": "american-ipa",
        "name": "American IPA",
        "description": "Hoppy, amarga, con carácter cítrico/resinoso de lúpulos americanos.",
        "og_min": 1.056, "og_max": 1.070,
        "fg_min": 1.008, "fg_max": 1.014,
        "ibu_min": 40, "ibu_max": 70,
        "yeast_recommendations": ["Safale US-05", "Wyeast 1056 American Ale", "White Labs WLP001"],
    },
    {
        "id": "neipa",
        "name": "NEIPA (New England IPA / Hazy IPA)",
        "description": "Turbia, jugosa, baja amargor percibido, con mucho aroma a lúpulo por dry hop.",
        "og_min": 1.060, "og_max": 1.072,
        "fg_min": 1.010, "fg_max": 1.015,
        "ibu_min": 25, "ibu_max": 50,
        "yeast_recommendations": ["Wyeast 1318 London Ale III", "Imperial Yeast A38 Juice (Conan)", "Escarpment Verdant IPA"],
    },
    {
        "id": "nepa",
        "name": "NEPA (New England Pale Ale)",
        "description": "Versión 'session' de la NEIPA: turbia, jugosa, más liviana en alcohol.",
        "og_min": 1.044, "og_max": 1.056,
        "fg_min": 1.008, "fg_max": 1.014,
        "ibu_min": 20, "ibu_max": 35,
        "yeast_recommendations": ["Wyeast 1318 London Ale III", "Escarpment Verdant IPA"],
    },
    {
        "id": "american-pale-ale",
        "name": "American Pale Ale (APA)",
        "description": "Equilibrada entre malta y lúpulo, menos intensa que una IPA.",
        "og_min": 1.045, "og_max": 1.060,
        "fg_min": 1.010, "fg_max": 1.015,
        "ibu_min": 30, "ibu_max": 45,
        "yeast_recommendations": ["Safale US-05", "Wyeast 1056 American Ale"],
    },
    {
        "id": "american-lager",
        "name": "Lager Americana / Standard",
        "description": "Liviana, crocante, de fermentación baja, muy bebible.",
        "og_min": 1.040, "og_max": 1.050,
        "fg_min": 1.008, "fg_max": 1.012,
        "ibu_min": 8, "ibu_max": 18,
        "yeast_recommendations": ["Saflager W-34/70", "Saflager S-23", "Wyeast 2124 Bohemian Lager"],
    },
    {
        "id": "pilsner",
        "name": "Pilsner (German/Czech)",
        "description": "Lager dorada, con carácter maltoso pero final seco y lúpulo noble notorio.",
        "og_min": 1.044, "og_max": 1.056,
        "fg_min": 1.010, "fg_max": 1.014,
        "ibu_min": 25, "ibu_max": 45,
        "yeast_recommendations": ["Saflager W-34/70", "Wyeast 2278 Czech Pils"],
    },
    {
        "id": "irish-stout",
        "name": "Irish Stout (Dry Stout)",
        "description": "Negra, seca, con notas a café y chocolate por la cebada tostada.",
        "og_min": 1.036, "og_max": 1.044,
        "fg_min": 1.007, "fg_max": 1.011,
        "ibu_min": 25, "ibu_max": 45,
        "yeast_recommendations": ["Safale S-04", "Wyeast 1084 Irish Ale"],
    },
    {
        "id": "porter",
        "name": "Porter",
        "description": "Oscura, maltosa, con notas a chocolate/tostado, menos intensa que un stout robusto.",
        "og_min": 1.050, "og_max": 1.056,
        "fg_min": 1.012, "fg_max": 1.016,
        "ibu_min": 18, "ibu_max": 35,
        "yeast_recommendations": ["Safale S-04", "Wyeast 1056 American Ale"],
    },
    {
        "id": "witbier",
        "name": "Witbier (Belgian White)",
        "description": "Trigo belga, turbia, especiada con cilantro y cáscara de naranja.",
        "og_min": 1.044, "og_max": 1.052,
        "fg_min": 1.008, "fg_max": 1.012,
        "ibu_min": 10, "ibu_max": 20,
        "yeast_recommendations": ["Wyeast 3944 Belgian Witbier", "Fermentis T-58"],
    },
    {
        "id": "saison",
        "name": "Saison",
        "description": "Belga rústica, muy seca, afrutada y especiada, alta carbonatación.",
        "og_min": 1.048, "og_max": 1.065,
        "fg_min": 1.002, "fg_max": 1.012,
        "ibu_min": 20, "ibu_max": 35,
        "yeast_recommendations": ["Wyeast 3711 French Saison", "Mangrove Jack's M29 Belgian Saison"],
    },
]


@app.get("/api/styles")
def list_styles():
    return STYLE_PRESETS


@app.get("/api/styles/{style_id}")
def get_style(style_id: str):
    for s in STYLE_PRESETS:
        if s["id"] == style_id:
            return s
    raise HTTPException(status_code=404, detail="Estilo no encontrado")


@app.get("/api/health")
def health():
    return {"status": "ok"}
