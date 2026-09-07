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

app = FastAPI(title="BrewMate API", version="1.0.0")

# CORS abierto para desarrollo local (en producción restringir a tu dominio real)
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


@app.get("/api/health")
def health():
    return {"status": "ok"}
