# 🍺 BrewMate

Mini proyecto full-stack de práctica — pensado como primer paso del roadmap para
colaborar en proyectos freelance dirigiendo agentes de IA (Claude Code / Codex).

Guarda recetas de cerveza casera y calcula el **ABV** automáticamente a partir
de la densidad inicial (OG) y final (FG).

## Stack
- **Backend**: FastAPI + SQLite (`backend/app.py`)
- **Frontend**: HTML + CSS + JS vanilla, sin frameworks (`frontend/`)

## ⚠️ IMPORTANTE antes de arrancar
Este proyecto tiene **dos partes que corren por separado** y necesitás las dos
prendidas al mismo tiempo:
1. El **backend** (la API) — corre en una terminal.
2. El **frontend** (lo que ves en el navegador) — es solo HTML/CSS/JS.

Si abrís `index.html` sin haber arrancado el backend primero, vas a ver el
error *"No se pudo conectar con el backend"* — es normal, significa que falta
el paso 1.

## Cómo correrlo localmente, paso a paso

### 1. Backend
Abrí una terminal (CMD / PowerShell / Terminal) y ejecutá:
```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8010
```
Dejá esa terminal abierta. Vas a ver un mensaje tipo
`Uvicorn running on http://0.0.0.0:8010` — eso confirma que quedó levantado.

Podés verificarlo entrando a `http://localhost:8010/docs` en el navegador:
si ves la documentación interactiva de la API, el backend está funcionando.

### 2. Frontend
Con el backend ya corriendo, abrí `frontend/index.html` con doble clic
(se abre directo en tu navegador), o serví la carpeta con:
```bash
cd frontend
python -m http.server 5500
```
y entrá a `http://localhost:5500`.

> El frontend está configurado para apuntar a `http://localhost:8010`
> (ver `script.js`, constante `API_URL`). Si corrés el backend en otro puerto,
> actualizá esa línea.

## Endpoints de la API
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/recipes` | Lista todas las recetas |
| POST | `/api/recipes` | Crea una receta |
| GET | `/api/recipes/{id}` | Obtiene una receta |
| PUT | `/api/recipes/{id}` | Edita una receta |
| DELETE | `/api/recipes/{id}` | Elimina una receta |
| GET | `/api/health` | Health check |

## Qué demuestra este proyecto
- CRUD completo (Create, Read, Update, Delete) con validación de datos (Pydantic).
- Separación clara frontend/backend, comunicándose vía API REST + JSON.
- Base de datos persistente (SQLite) sin dependencias externas de infraestructura.
- Manejo de errores tanto en backend (HTTP 404) como en frontend (mensajes claros al usuario).
- Documentación pensada para un agente de IA (`CLAUDE.md`) y para humanos (este README).

## Próximos pasos sugeridos (ver también `CLAUDE.md`)
1. Desplegar el backend en Render/Railway y el frontend en Vercel/Netlify (así no dependés de tener la terminal abierta).
2. Calcular IBU real con la fórmula de Tinseth.
3. Agregar autenticación simple si vas a compartirlo con más gente.
4. Exportar recetas a PDF.

---
*Armado como ejercicio de aprendizaje — Roadmap "De Tax Specialist a freelance dev con IA".*
