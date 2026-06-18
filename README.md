# ⚔️ Aethelgard

A **living voxel-world simulation** — not a Minecraft clone. The voxel sandbox is only
the foundation; the long-term game is an emergent world of agents, settlements, economies,
politics, dynasties, plagues, and history, in the lineage of Dwarf Fortress / Crusader
Kings / Mount & Blade / RimWorld.

> **"Nothing in this world exists because it was scripted. Everything exists because
> another system caused it."** — see [`docs/GAME_BIBLE.md`](docs/GAME_BIBLE.md).

Built to run in the browser on a tablet (tuned for Xiaomi Pad 7), TypeScript + Three.js,
bundled by Vite. NPC intelligence is pure on-device simulation — **no LLM/AI APIs**.

Live (after Pages is enabled): **https://itskrishnabajaj.github.io/InkFlow/**

## Status

**Milestone 1 — Engine + premium voxel sandbox** (in progress, built in stages):

- [x] Stage 1 — engine skeleton: layered architecture, fixed-timestep scheduler + multi-scale
      world clock, deterministic RNG streams, voxel math (vec3/AABB/DDA), IndexedDB wrapper,
      Web-Worker pool, event bus, debug overlay, minimal render boot. *(playable: boots to a lit 3D scene)*
- [ ] Stage 2 — ECS + intents + registries + serialization
- [ ] Stage 3 — worker terrain gen + greedy meshing + chunk streaming
- [ ] Stage 4 — physics character controller + touch controls
- [ ] Stage 5 — block place/break + inventory
- [ ] Stage 6 — incremental IndexedDB persistence
- [ ] Stage 7 — visual polish + dynamic quality
- [ ] Stage 8 — PWA + on-device verification

## Architecture (downward-only dependencies)

```
platform → core → worldgen → sim → render → ui     (composed in src/app/main.ts)
```

Simulation is fully independent of rendering: `core`/`sim` never import THREE or touch the
DOM. Rendering only visualizes state; UI sends intents. See the layout under `src/`.

## Develop

```bash
npm install
npm run dev        # local dev server (Vite)
npm run typecheck  # tsc --noEmit
npm test           # vitest
npm run build      # tsc + vite build → dist/
```

## Deploy

Pushing to the working branch triggers `.github/workflows/deploy.yml`, which builds and
publishes `dist/` to the **`gh-pages`** branch. One-time: in the repo, **Settings → Pages
→ Source: "Deploy from a branch" → `gh-pages` / `(root)`**.
