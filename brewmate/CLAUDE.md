# CLAUDE.md — Contexto del proyecto BrewMate

> Este archivo es el que leería Claude Code (o cualquier agente similar) antes de
> tocar una sola línea de código. Es el equivalente a un "onboarding" para la IA.
> Usalo como plantilla para tus próximos proyectos.

## Qué es este proyecto
BrewMate es una app simple para guardar recetas de cerveza casera y calcular el
ABV (alcohol por volumen) automáticamente a partir de la densidad inicial (OG)
y final (FG).

## Stack técnico
- **Backend**: FastAPI (Python) + SQLite. Sin ORM, SQL directo para mantenerlo simple.
- **Frontend**: HTML + CSS + JavaScript vanilla (sin frameworks, sin build step).
- **Sin autenticación** (fuera de alcance para este MVP).

## Estructura de carpetas
```
brewmate/
  backend/
    app.py            # toda la API vive acá
    requirements.txt
  frontend/
    index.html
    style.css
    script.js
```

## Convenciones
- Todo el texto visible al usuario va en español.
- Nombres de variables y funciones en inglés (estándar de la industria).
- No agregar dependencias nuevas sin justificar por qué (mantener el proyecto liviano).
- La fórmula de ABV es `(OG - FG) * 131.25` — no cambiarla sin avisar.

## Cómo correr el proyecto
```bash
# Backend (dejar la terminal abierta corriendo)
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8010

# Frontend (en OTRA terminal, o simplemente doble clic en index.html)
cd frontend
python -m http.server 5500
```
⚠️ El backend y el frontend son dos procesos separados: si cerrás la terminal
del backend, el frontend deja de poder cargar/guardar recetas.

## Reglas para el agente (acciones prohibidas / permitidas)
- ✅ Podés modificar libremente `frontend/` y `backend/app.py`.
- ✅ Podés proponer tests, pero no borrar `brewmate.db` sin preguntar.
- ❌ No agregues autenticación, pagos, ni servicios de terceros sin que se pida explícitamente.
- ❌ No cambies la fórmula de cálculo de ABV/IBU sin confirmar la referencia usada.

## Próximas features (backlog de práctica)
1. Cálculo de IBU real (fórmula de Tinseth) en vez de solo guardar el target.
2. Exportar recetas a PDF.
3. Autenticación simple (una sola persona, API key en `.env`).
4. Deploy real en Render (backend) + Vercel (frontend).

---
### Ejemplo de prompts usados para construir este proyecto (log de aprendizaje)
Esta sección es solo para vos: así se ve un flujo de trabajo típico con un agente.

1. *"Necesito una API en FastAPI con SQLite para un CRUD de recetas de cerveza
   (nombre, estilo, OG, FG, IBU objetivo, litros, notas). Que calcule el ABV
   automáticamente con la fórmula (OG-FG)*131.25 y lo devuelva en cada respuesta."*
2. *"Ahora armame un frontend simple en HTML/CSS/JS vanilla que consuma esa API:
   un formulario para cargar recetas y una grilla de tarjetas mostrando ABV, OG,
   FG, IBU y notas, con botón de eliminar."*
3. *"Probá los endpoints con curl para confirmar que el CRUD funciona antes de
   entregarlo."*
4. *"Documentá el proyecto con un README y un CLAUDE.md para que cualquiera
   (humano o agente) entienda el contexto rápido."*
