# ⛏ InkCraft

A Minecraft-style **voxel building game that runs in your browser** — no install,
no app store, no PC required. Built to play on a tablet (designed and tuned for the
Xiaomi Pad 7), but it works on any phone, tablet, or desktop browser.

Live game: **https://itskrishnabajaj.github.io/inkflow/**
*(works after GitHub Pages is enabled — see "Play on your tablet" below)*

---

## How to play

- **Move** — drag the on-screen **joystick** (bottom-left). Push it all the way for a speed boost.
- **Look around** — drag anywhere on the **right side** of the screen.
- **Fly up / down** — the **▲ / ▼** buttons (this is Creative mode — you always fly).
- **Break a block** — aim with the crosshair, tap **⛏**.
- **Place a block** — aim at a face, tap **◼**.
- **Choose a block** — tap a slot in the **hotbar** along the bottom.
- **Menu** (☰, top-right) — Save, start a New World, or change render distance.
- **Sound** — 🔊 toggles audio.

Desktop testing controls: **WASD** move, **drag mouse** to look, **Space/Shift** up/down,
**left-click** break, **right-click** place, **number keys** pick a hotbar block.

Your world **auto-saves** in the browser and reloads next time you open the game.

---

## Play on your tablet (one-time setup)

This game is published with **GitHub Pages**. To turn it on (only needed once):

1. On your tablet, open this repo on **github.com**.
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Wait ~1 minute for the "Deploy InkCraft to GitHub Pages" action to finish
   (see the **Actions** tab).
5. Open **https://itskrishnabajaj.github.io/inkflow/** in Chrome.
6. Tap the **⋮** menu → **Add to Home screen** to install it like an app
   (launches fullscreen and works offline after the first load).

Every time changes are pushed to the branch, the game re-deploys automatically.

---

## How it's built (tech notes)

No build tools, no dependencies to install — just static files served as-is:

- **Three.js** (loaded from a CDN via an ES-module importmap) for WebGL rendering.
- **Vanilla JavaScript** ES modules under `src/`.
- **Procedural everything**: terrain from noise, block **textures drawn on a canvas**
  in code, and **sound effects synthesized** with the Web Audio API — zero asset files.

Performance is tuned for mobile via **chunked meshing**, **hidden-face culling**
(only visible block faces are drawn), a single shared texture atlas, and a
tunable render distance.

```
index.html            # importmap + touch UI overlay
styles.css            # touch-first HUD styling
src/
  main.js             # game loop, wires everything together
  engine/             # noise, block registry, procedural texture atlas
  world/              # terrain generation, chunk meshing, chunk manager, day/night sky
  player/             # flying camera + block raycast, touch/keyboard controls
  ui/hud.js           # hotbar, FPS, pause menu
  audio/sfx.js        # synthesized sounds
  save/storage.js     # localStorage save/load
.github/workflows/    # GitHub Pages auto-deploy
```

---

## Roadmap ideas (future)

- Survival mode (health, mining, day/night danger, simple mobs)
- More biomes and block types
- Multiplayer
