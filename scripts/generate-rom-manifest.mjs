import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const romDir = path.join(root, "roms");

const systems = new Map([
  ["nes", { core: "nes", label: "NES" }],
  ["fds", { core: "nes", label: "Famicom Disk System" }],
  ["smc", { core: "snes", label: "SNES" }],
  ["sfc", { core: "snes", label: "SNES" }],
  ["gb", { core: "gb", label: "Game Boy" }],
  ["gbc", { core: "gb", label: "Game Boy Color" }],
  ["gba", { core: "gba", label: "Game Boy Advance" }],
  ["n64", { core: "n64", label: "Nintendo 64" }],
  ["z64", { core: "n64", label: "Nintendo 64" }],
  ["v64", { core: "n64", label: "Nintendo 64" }],
  ["md", { core: "segaMD", label: "Genesis / Mega Drive" }],
  ["gen", { core: "segaMD", label: "Genesis / Mega Drive" }],
  ["smd", { core: "segaMD", label: "Genesis / Mega Drive" }],
  ["sms", { core: "segaMS", label: "Master System" }],
  ["gg", { core: "segaGG", label: "Game Gear" }],
  ["32x", { core: "sega32x", label: "Sega 32X" }],
  ["chd", { core: "psx", label: "PlayStation" }],
  ["pbp", { core: "psx", label: "PlayStation" }],
  ["cue", { core: "psx", label: "PlayStation" }],
  ["pce", { core: "pce", label: "PC Engine / TurboGrafx-16" }],
  ["ngp", { core: "ngp", label: "Neo Geo Pocket" }],
  ["ngc", { core: "ngp", label: "Neo Geo Pocket Color" }],
  ["ws", { core: "ws", label: "WonderSwan" }],
  ["wsc", { core: "ws", label: "WonderSwan Color" }],
  ["col", { core: "coleco", label: "ColecoVision" }],
  ["a26", { core: "atari2600", label: "Atari 2600" }],
  ["a78", { core: "atari7800", label: "Atari 7800" }],
  ["lnx", { core: "lynx", label: "Atari Lynx" }]
]);

const dualSenseControls = {
  0: {
    0: { value: "x", value2: "BUTTON_2" },
    1: { value: "s", value2: "BUTTON_4" },
    2: { value: "v", value2: "SELECT" },
    3: { value: "enter", value2: "START" },
    4: { value: "up arrow", value2: "DPAD_UP" },
    5: { value: "down arrow", value2: "DPAD_DOWN" },
    6: { value: "left arrow", value2: "DPAD_LEFT" },
    7: { value: "right arrow", value2: "DPAD_RIGHT" },
    8: { value: "z", value2: "BUTTON_1" },
    9: { value: "a", value2: "BUTTON_3" },
    10: { value: "q", value2: "LEFT_TOP_SHOULDER" },
    11: { value: "e", value2: "RIGHT_TOP_SHOULDER" },
    12: { value: "tab", value2: "LEFT_BOTTOM_SHOULDER" },
    13: { value: "r", value2: "RIGHT_BOTTOM_SHOULDER" },
    14: { value: "", value2: "LEFT_STICK" },
    15: { value: "", value2: "RIGHT_STICK" },
    16: { value: "h", value2: "LEFT_STICK_X:+1" },
    17: { value: "f", value2: "LEFT_STICK_X:-1" },
    18: { value: "g", value2: "LEFT_STICK_Y:+1" },
    19: { value: "t", value2: "LEFT_STICK_Y:-1" },
    20: { value: "l", value2: "RIGHT_STICK_X:+1" },
    21: { value: "j", value2: "RIGHT_STICK_X:-1" },
    22: { value: "k", value2: "RIGHT_STICK_Y:+1" },
    23: { value: "i", value2: "RIGHT_STICK_Y:-1" },
    24: { value: "1", value2: "TOUCHPAD" },
    25: { value: "2", value2: "PS" },
    26: { value: "3" },
    27: { value: "space" },
    28: { value: "backspace" },
    29: { value: "shift" }
  },
  1: {},
  2: {},
  3: {}
};

function titleFromFile(file) {
  return path.basename(file, path.extname(file)).replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
}

async function walk(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === "manifest.json" || entry.name.startsWith(".")) continue;

    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await walk(absolute, relative));
    } else {
      files.push(relative);
    }
  }

  return files;
}

const files = await walk(romDir);
const manifest = files.flatMap((file) => {
  const extension = path.extname(file).slice(1).toLowerCase();
  const system = systems.get(extension);
  if (!system) return [];

  const normalized = file.split(path.sep).join("/");
  return {
    id: normalized.toLowerCase(),
    title: titleFromFile(file),
    path: `roms/${encodeURI(normalized).replaceAll("%2F", "/")}`,
    core: system.core,
    systemLabel: system.label
  };
}).sort((a, b) => a.title.localeCompare(b.title));

await writeFile(path.join(romDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(
  path.join(root, "src", "generated-controls.js"),
  `window.RETRO_DROP_DEFAULT_CONTROLS = ${JSON.stringify(dualSenseControls, null, 2)};\n`
);
console.log(`Indexed ${manifest.length} ROM${manifest.length === 1 ? "" : "s"}.`);
console.log("Generated DualSense default controller mappings.");
