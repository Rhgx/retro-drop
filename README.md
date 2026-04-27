[![Retro Drop banner](https://capsule-render.vercel.app/api?type=waving&height=180&color=0:232018,35:4d4634,70:f2cb68,100:ffc857&text=Retro%20Drop&fontColor=f5f0df&fontSize=48&fontAlignY=35&desc=Static%20ROM%20launcher%20for%20GitHub%20Pages&descAlignY=58&descSize=16)](https://rhgx.github.io/retro-drop/)

<p align="center">
    <img alt="Static site" src="https://img.shields.io/badge/static_site-GitHub_Pages-222?style=for-the-badge">
  <img alt="Powered by EmulatorJS" src="https://img.shields.io/badge/powered_by-EmulatorJS-4f46e5?style=for-the-badge">
  <img alt="ROM manifest" src="https://img.shields.io/badge/ROM_manifest-auto_generated-06b6d4?style=for-the-badge">
  <img alt="Shaders" src="https://img.shields.io/badge/shaders-CRT_ready-f97316?style=for-the-badge">
  <img alt="No backend" src="https://img.shields.io/badge/backend-not_required-22c55e?style=for-the-badge">
</p>

A fast, tiny, static GitHub Pages launcher for your own NES, SNES, Game Boy, GBA, Genesis, N64, and other browser-supported ROM backups.

Built with [Vite](https://vite.dev/) and locally vendored EmulatorJS assets, so the deployed player has no runtime CDN dependencies.

---

## Features

- Launch your ROM library directly from a static web page
- GitHub Pages-friendly deployment
- Auto-generated ROM manifest
- Built-in shader picker with CRT presets
- Gamepad support with generated default mappings
- No backend, database, or server app required
- Works locally or from GitHub Pages

---

## Add ROMs

1. Put your ROM files in `roms/`.
2. Run the build script.
3. Start Vite locally, or push to GitHub Pages.

```powershell
npm run build
```

GitHub Pages deploys build automatically, so a normal push is enough once your ROM files are in the repo.

> Only add ROMs that you have the right to use.

---

## Local Preview

Install dependencies and start the Vite dev server:

```powershell
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

---

## Project Flow

```text
roms/
  your-game.nes
  your-game.sfc
  your-game.gba

npm run build
  |
dist/index.html launcher
  |
EmulatorJS player
```

---

## Supported File Types

The manifest generator maps these extensions to EmulatorJS cores:

```text
nes, fds, smc, sfc, gb, gbc, gba, n64, z64, v64,
md, gen, smd, sms, gg, 32x, chd, pbp, cue, pce,
ngp, ngc, ws, wsc, col, a26, a78, lnx
```

### Best GitHub Pages Fit

Cartridge-based systems are the smoothest option for static hosting:

- NES
- SNES
- Game Boy
- Game Boy Color
- Game Boy Advance
- Genesis / Mega Drive
- Nintendo 64

Disc-based systems may require BIOS files or extra `cue/bin` handling depending on the game.

---

## Shaders

The shader dropdown includes EmulatorJS' built-in shader set, including CRT presets:

```text
crt-mattias.glslp
crt-geom.glslp
crt-easymode.glslp
crt-lottes
crt-zfast
crt-aperture.glslp
crt-beam
crt-caligari
crt-yeetron
sabr
2xScaleHQ.glslp
4xScaleHQ.glslp
bicubic
mix-frames
```

Shaders can be changed while a ROM is already running, without reloading the game.

---

## Controllers

Use the controller icon after loading a game if a connected gamepad is not picked up automatically.

The button will:

- Focus the emulator iframe
- Detect already-connected pads
- Assign them to EmulatorJS player slots

Default DualSense-friendly mappings are generated at build time and cover:

- Face buttons
- D-pad
- Shoulders
- Triggers
- Thumbsticks
- PS button
- Touchpad button

---

## Useful Commands

```powershell
npm install
npm run dev
npm run build
npm run serve
```

| Command | What it does |
| --- | --- |
| `npm install` | Installs project dependencies |
| `npm run dev` | Generates local assets and starts Vite |
| `npm run build` | Generates the manifest and builds `dist/` |
| `npm run serve` | Starts a Vite preview server for `dist/` |

---

## GitHub Pages

Retro Drop is designed to work well as a static GitHub Pages site.

Once your ROM files are in the repo:

1. Commit your changes.
2. Push to GitHub.
3. Let the Pages workflow build `dist/`.
4. Open your deployed launcher.

No backend required. No upload service required. No database required.

---

## Notes

Only add ROMs that you have the right to use. Public GitHub repositories are not a good place for copyrighted game dumps.

This project is intended for personal backups, homebrew, public-domain ROMs, and other files you are legally allowed to use.
