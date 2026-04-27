import "./generated-controls.js";

const params = new URLSearchParams(window.location.search);
const rom = params.get("rom");
const core = params.get("core");
const title = params.get("title") || "Retro Drop";
const shader = params.get("shader") || "disabled";
const emulatorVendorVersion = "2026-04-27.2";
let pendingShader = shader;
let relayedPads = [];
const previousPads = new Map();
const previousHatPads = new Map();
const assignedPads = new Set();
let dualSensePresetApplied = false;
const buttonLabels = {
  0: "BUTTON_1",
  1: "BUTTON_2",
  2: "BUTTON_3",
  3: "BUTTON_4",
  4: "LEFT_TOP_SHOULDER",
  5: "RIGHT_TOP_SHOULDER",
  6: "LEFT_BOTTOM_SHOULDER",
  7: "RIGHT_BOTTOM_SHOULDER",
  8: "SELECT",
  9: "START",
  10: "LEFT_STICK",
  11: "RIGHT_STICK",
  12: "DPAD_UP",
  13: "DPAD_DOWN",
  14: "DPAD_LEFT",
  15: "DPAD_RIGHT",
  16: "PS",
  17: "TOUCHPAD"
};
const axisLabels = ["LEFT_STICK_X", "LEFT_STICK_Y", "RIGHT_STICK_X", "RIGHT_STICK_Y"];
const dpadButtons = [
  { index: 12, label: "DPAD_UP" },
  { index: 13, label: "DPAD_DOWN" },
  { index: 14, label: "DPAD_LEFT" },
  { index: 15, label: "DPAD_RIGHT" }
];

function applyShader(name) {
  pendingShader = name;
  if (!window.EJS_emulator || !window.EJS_emulator.gameManager || typeof window.EJS_emulator.enableShader !== "function") {
    return false;
  }

  window.EJS_emulator.enableShader(name);
  pendingShader = "";
  return true;
}

function postSessionState(state) {
  window.parent.postMessage({ source: "retro-drop-player", type: "session-state", state }, window.location.origin);
}

function setPaused(paused) {
  const emulator = window.EJS_emulator;
  if (!emulator) return;

  if (paused && typeof emulator.pause === "function") {
    emulator.pause();
    if (!emulator.retroDropWrappedSessionControls) postSessionState("paused");
  } else if (!paused && typeof emulator.play === "function") {
    emulator.play();
    if (!emulator.retroDropWrappedSessionControls) postSessionState("running");
  }
}

function wrapSessionControls() {
  const emulator = window.EJS_emulator;
  if (!emulator || emulator.retroDropWrappedSessionControls) return;

  const originalPause = emulator.pause;
  const originalPlay = emulator.play;

  if (typeof originalPause === "function") {
    emulator.pause = (...args) => {
      const result = originalPause.apply(emulator, args);
      postSessionState("paused");
      return result;
    };
  }

  if (typeof originalPlay === "function") {
    emulator.play = (...args) => {
      const result = originalPlay.apply(emulator, args);
      postSessionState("running");
      return result;
    };
  }

  emulator.retroDropWrappedSessionControls = true;
}

function syncGamepads() {
  const emulator = window.EJS_emulator;
  const handler = emulator && emulator.gamepad;
  if (!emulator || !handler || !Array.isArray(emulator.gamepadSelection)) return;

  if (typeof handler.updateGamepadState === "function") {
    handler.updateGamepadState();
  }

  const pads = Array.isArray(handler.gamepads) ? handler.gamepads.filter(Boolean) : [];
  for (const pad of pads) {
    const key = `${pad.id}_${pad.index}`;
    if (emulator.gamepadSelection.includes(key)) continue;

    const slot = emulator.gamepadSelection.indexOf("");
    if (slot >= 0) {
      emulator.gamepadSelection[slot] = key;
    } else {
      emulator.gamepadSelection.push(key);
    }
  }

  if (pads.length && typeof emulator.updateGamepadLabels === "function") {
    emulator.updateGamepadLabels();
  }
}

function buttonLabel(index) {
  return buttonLabels[index] || `GAMEPAD_${index}`;
}

function axisLabel(index, value) {
  const axis = axisLabels[index] || `EXTRA_STICK_${index}`;
  if (value > 0.5) return `${axis}:+1`;
  if (value < -0.5) return `${axis}:-1`;
  return null;
}

function normalizedAxis(value) {
  return value < 0.1 && value > -0.1 ? 0 : value;
}

function isDualSense(pad) {
  const id = (pad && pad.id ? pad.id : "").toLowerCase();
  return id.includes("dualsense") || id.includes("dual sense") || id.includes("wireless controller") || id.includes("playstation");
}

function cloneControls(controls) {
  return JSON.parse(JSON.stringify(controls));
}

function applyDualSensePreset() {
  const emulator = window.EJS_emulator;
  const controls = window.RETRO_DROP_DEFAULT_CONTROLS;
  if (dualSensePresetApplied || !emulator || !controls) return;

  emulator.defaultControllers = cloneControls(controls);
  emulator.controls = cloneControls(controls);
  dualSensePresetApplied = true;

  if (typeof emulator.setupKeys === "function") {
    emulator.setupKeys();
  }
  if (typeof emulator.checkGamepadInputs === "function") {
    emulator.checkGamepadInputs();
  }
  if (typeof emulator.updateGamepadLabels === "function") {
    emulator.updateGamepadLabels();
  }
  if (typeof emulator.saveSettings === "function") {
    emulator.saveSettings();
  }
}

function hatDirections(value) {
  const normalized = Math.round(value * 1000) / 1000;
  if (normalized > 1.1 || normalized < -1.1) return [];

  const positions = [
    { value: -1, directions: ["up"] },
    { value: -0.714, directions: ["up", "right"] },
    { value: -0.428, directions: ["right"] },
    { value: -0.142, directions: ["down", "right"] },
    { value: 0.142, directions: ["down"] },
    { value: 0.428, directions: ["down", "left"] },
    { value: 0.714, directions: ["left"] },
    { value: 1, directions: ["up", "left"] }
  ];

  const nearest = positions.reduce((best, position) => {
    const distance = Math.abs(normalized - position.value);
    return distance < best.distance ? { ...position, distance } : best;
  }, { directions: [], distance: Infinity });

  return nearest.distance <= 0.08 ? nearest.directions : [];
}

function relayHatAxis(emulator, pad, axisIndex, previousValue, currentValue) {
  const before = new Set(hatDirections(previousValue));
  const now = new Set(hatDirections(currentValue));
  const key = `${pad.index}:${axisIndex}`;
  const old = previousHatPads.get(key) || before;

  for (const button of dpadButtons) {
    const direction = button.label.replace("DPAD_", "").toLowerCase();
    const wasPressed = old.has(direction);
    const isPressed = now.has(direction);
    if (wasPressed === isPressed) continue;

    emulator.gamepadEvent({
      type: isPressed ? "buttondown" : "buttonup",
      index: button.index,
      label: button.label,
      gamepadIndex: pad.index
    });
  }

  previousHatPads.set(key, now);
  return before.size > 0 || now.size > 0;
}

function ensureRelayedPad(pad) {
  const emulator = window.EJS_emulator;
  if (!emulator || !emulator.gamepad || !Array.isArray(emulator.gamepadSelection)) return false;

  emulator.gamepad.getGamepads = () => relayedPads;
  const virtualPad = {
    id: pad.id,
    index: pad.index,
    axes: pad.axes || [],
    buttons: pad.buttons || []
  };
  emulator.gamepad.gamepads[pad.index] = virtualPad;

  const key = `${pad.id}_${pad.index}`;
  let changed = false;
  if (!emulator.gamepadSelection.includes(key)) {
    const slot = emulator.gamepadSelection.indexOf("");
    if (slot >= 0) {
      emulator.gamepadSelection[slot] = key;
    } else {
      emulator.gamepadSelection.push(key);
    }
    changed = true;
  }

  if (!assignedPads.has(key)) {
    assignedPads.add(key);
    changed = true;
  }

  if (changed && typeof emulator.updateGamepadLabels === "function") {
    emulator.updateGamepadLabels();
  }

  return true;
}

function relayGamepads(pads) {
  const emulator = window.EJS_emulator;
  if (!emulator || typeof emulator.gamepadEvent !== "function") return;

  if (pads.some(isDualSense)) {
    applyDualSensePreset();
  }

  relayedPads = pads.map((pad) => ({
    id: pad.id,
    index: pad.index,
    axes: pad.axes || [],
    buttons: pad.buttons || []
  }));

  for (const pad of pads) {
    if (!ensureRelayedPad(pad)) continue;

    const previous = previousPads.get(pad.index) || { axes: [], buttons: [] };
    pad.buttons.forEach((button, index) => {
      const wasPressed = Boolean(previous.buttons[index] && previous.buttons[index].pressed);
      const isPressed = Boolean(button.pressed);
      if (wasPressed === isPressed) return;

      emulator.gamepadEvent({
        type: isPressed ? "buttondown" : "buttonup",
        index,
        label: buttonLabel(index),
        gamepadIndex: pad.index
      });
    });

    pad.axes.forEach((axis, index) => {
      const before = normalizedAxis(previous.axes[index] || 0);
      const now = normalizedAxis(axis);
      if (index >= 4 && relayHatAxis(emulator, pad, index, before, now)) {
        return;
      }

      const beforeBucket = before > 0.5 ? 1 : before < -0.5 ? -1 : 0;
      const nowBucket = now > 0.5 ? 1 : now < -0.5 ? -1 : 0;
      if (beforeBucket === nowBucket && Math.abs(before - now) < 0.12) return;

      emulator.gamepadEvent({
        type: "axischanged",
        axis: axisLabels[index] || `EXTRA_STICK_${index}`,
        value: now,
        label: axisLabel(index, now),
        gamepadIndex: pad.index
      });
    });

    previousPads.set(pad.index, pad);
  }
}

function focusEmulator() {
  window.focus();
  const parent = window.EJS_emulator && window.EJS_emulator.elements && window.EJS_emulator.elements.parent;
  if (parent && typeof parent.focus === "function") {
    parent.focus();
  } else {
    document.querySelector("#game").focus();
  }
  syncGamepads();
}

function afterEmulatorReady() {
  wrapSessionControls();
  applyShader(pendingShader || shader);
  syncGamepads();
  focusEmulator();
  postSessionState("running");
}

if (!rom || !core) {
  document.body.textContent = "Missing ROM or emulator core.";
} else {
  const emulatorDataUrl = new URL("vendor/emulatorjs/data/", window.location.href).href;
  const cacheBusted = (path) => `${new URL(path, emulatorDataUrl).href}?v=${emulatorVendorVersion}`;

  window.EJS_player = "#game";
  window.EJS_gameUrl = rom;
  window.EJS_core = core;
  window.EJS_gameName = title;
  window.EJS_color = "#ffc857";
  window.EJS_DEBUG_XX = true;
  window.EJS_pathtodata = emulatorDataUrl;
  window.EJS_paths = {
    "emulator.js": cacheBusted("src/emulator.js"),
    "nipplejs.js": cacheBusted("src/nipplejs.js"),
    "shaders.js": cacheBusted("src/shaders.js"),
    "storage.js": cacheBusted("src/storage.js"),
    "gamepad.js": cacheBusted("src/gamepad.js"),
    "GameManager.js": cacheBusted("src/GameManager.js"),
    "socket.io.min.js": cacheBusted("src/socket.io.min.js"),
    "compression.js": cacheBusted("src/compression.js"),
    "emulator.css": cacheBusted("emulator.css"),
    "en-US": cacheBusted("localization/en-US.json")
  };
  window.EJS_language = "en-US";
  window.EJS_disableAutoLang = true;
  window.EJS_startOnLoaded = true;
  window.EJS_defaultOptions = { shader };
  window.EJS_defaultControls = window.RETRO_DROP_DEFAULT_CONTROLS;
  window.EJS_ready = afterEmulatorReady;
  window.EJS_onGameStart = afterEmulatorReady;
  window.EJS_Buttons = {
    playPause: true,
    restart: true,
    mute: true,
    settings: true,
    fullscreen: true,
    saveState: true,
    loadState: true,
    screenRecord: false,
    gamepad: true,
    cheat: true,
    volume: true
  };

  const loader = document.createElement("script");
  loader.src = cacheBusted("loader.js");
  document.body.append(loader);
}

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin || event.data.source !== "retro-drop") return;

  if (event.data.type === "set-shader") {
    applyShader(event.data.shader);
  }

  if (event.data.type === "focus-player" || event.data.type === "activate-controls") {
    focusEmulator();
  }

  if (event.data.type === "pause-game") {
    setPaused(true);
  }

  if (event.data.type === "resume-game") {
    setPaused(false);
  }

  if (event.data.type === "gamepad-state" && Array.isArray(event.data.pads)) {
    relayGamepads(event.data.pads);
  }
});

window.addEventListener("gamepadconnected", syncGamepads);
window.addEventListener("pointerdown", focusEmulator);
