import { createIcons, Gamepad2, Maximize, Pause, Play, Square } from "lucide";
import "../styles.css";
import "./shaders.js";

const romSelect = document.querySelector("#rom-select");
const gameFilter = document.querySelector("#game-filter");
const systemFilter = document.querySelector("#system-filter");
const gameList = document.querySelector("#game-list");
const shaderSelect = document.querySelector("#shader-select");
const playButton = document.querySelector("#play-button");
const controllerButton = document.querySelector("#controller-button");
const controllerStatus = document.querySelector("#controller-status");
const pauseButton = document.querySelector("#pause-button");
const resumeButton = document.querySelector("#resume-button");
const stopButton = document.querySelector("#stop-button");
const fullscreenButton = document.querySelector("#fullscreen-button");
const playerFrame = document.querySelector("#player-frame");
const emptyState = document.querySelector("#empty-state");
const screenFrame = document.querySelector("#screen-frame");
const swapModal = document.querySelector("#swap-modal");
const swapMessage = document.querySelector("#swap-message");
const modalCancel = document.querySelector("#modal-cancel");
const modalPause = document.querySelector("#modal-pause");
const modalConfirm = document.querySelector("#modal-confirm");

const preferredShader = localStorage.getItem("retro-drop-shader") || "crt-mattias.glslp";
let manifest = [];
let selectedRomId = "";
let currentRomId = "";
let sessionState = "stopped";
let pendingSwapId = "";
let controllerLoop = 0;
let lastControllerCount = -1;
let lastControllerSignature = "";

function addOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function populateShaders() {
  addOption(shaderSelect, "disabled", "Disabled");
  for (const shader of window.RETRO_DROP_SHADERS || []) {
    addOption(shaderSelect, shader.value, shader.label);
  }
  shaderSelect.value = preferredShader;
}

function romLabel(rom) {
  return `${rom.title} - ${rom.systemLabel}`;
}

function postToPlayer(message) {
  if (!playerFrame.contentWindow) return;
  playerFrame.contentWindow.postMessage({ source: "retro-drop", ...message }, window.location.origin);
}

function focusPlayer() {
  playerFrame.focus();
  postToPlayer({ type: "focus-player" });
}

function applyShader(shader) {
  localStorage.setItem("retro-drop-shader", shader);
  postToPlayer({ type: "set-shader", shader });
}

function setSessionState(state) {
  sessionState = state;
  const isStopped = state === "stopped";
  const isPaused = state === "paused";

  pauseButton.hidden = isStopped || isPaused;
  resumeButton.hidden = isStopped || !isPaused;
  stopButton.hidden = isStopped;
  playButton.hidden = !isStopped;
}

function readGamepads() {
  if (!navigator.getGamepads) return [];

  return Array.from(navigator.getGamepads())
    .filter(Boolean)
    .map((pad) => ({
      id: pad.id,
      index: pad.index,
      mapping: pad.mapping || "",
      axes: Array.from(pad.axes),
      buttons: Array.from(pad.buttons, (button) => ({
        pressed: button.pressed,
        value: button.value
      }))
    }));
}

function updateControllerStatus(pads) {
  const count = pads.length;
  if (count === lastControllerCount) return;

  lastControllerCount = count;
  controllerButton.classList.toggle("is-active", count > 0);
  controllerStatus.textContent = count ? `${count} controller${count === 1 ? "" : "s"}` : "No controller";
}

function controllerSignature(pads) {
  return JSON.stringify(pads.map((pad) => ({
    id: pad.id,
    index: pad.index,
    axes: pad.axes.map((axis) => Math.round(axis * 100) / 100),
    buttons: pad.buttons.map((button) => button.pressed ? 1 : 0)
  })));
}

function pumpControllers() {
  const pads = readGamepads();
  const signature = controllerSignature(pads);

  updateControllerStatus(pads);
  if (signature !== lastControllerSignature) {
    lastControllerSignature = signature;
    postToPlayer({ type: "gamepad-state", pads });
  }
}

function activateControllers() {
  if (navigator.getGamepads) {
    navigator.getGamepads();
  }
  if (!controllerLoop) {
    pumpControllers();
    controllerLoop = window.setInterval(pumpControllers, 33);
  }
  focusPlayer();
  postToPlayer({ type: "activate-controls" });
}

function selectedRom() {
  return manifest.find((item) => item.id === selectedRomId);
}

function selectRom(id) {
  selectedRomId = id;
  romSelect.value = id;
  renderGameList();
}

function switchToRom(id) {
  selectRom(id);
  loadRom();
}

function selectedOrPendingTitle(id) {
  const rom = manifest.find((item) => item.id === id);
  return rom ? rom.title : "the selected game";
}

function closeSwapModal() {
  pendingSwapId = "";
  swapModal.hidden = true;
}

function openSwapModal(id) {
  pendingSwapId = id;
  const title = selectedOrPendingTitle(id);
  const running = sessionState === "running";

  swapMessage.textContent = running
    ? `Pause the current game before switching to ${title}.`
    : `Switch to ${title}? The current game session will be replaced.`;
  modalPause.hidden = !running;
  modalConfirm.disabled = running;
  swapModal.hidden = false;
}

function requestGameSwitch(id) {
  if (!id || id === selectedRomId && sessionState === "stopped") {
    selectRom(id);
    return;
  }

  if (!currentRomId || currentRomId === id && sessionState !== "stopped") {
    selectRom(id);
    return;
  }

  openSwapModal(id);
}

function filteredManifest() {
  const search = gameFilter.value.trim().toLowerCase();
  const system = systemFilter.value;

  return manifest.filter((rom) => {
    const matchesSystem = !system || rom.systemLabel === system;
    const matchesSearch = !search || `${rom.title} ${rom.systemLabel}`.toLowerCase().includes(search);
    return matchesSystem && matchesSearch;
  });
}

function renderSystems() {
  systemFilter.innerHTML = "";
  addOption(systemFilter, "", "All systems");

  const systems = [...new Set(manifest.map((rom) => rom.systemLabel))].sort((a, b) => a.localeCompare(b));
  for (const system of systems) {
    addOption(systemFilter, system, system);
  }
}

function renderGameList() {
  gameList.innerHTML = "";
  const games = filteredManifest();

  if (!games.length) {
    const empty = document.createElement("div");
    empty.className = "library-empty";
    empty.textContent = "No matching games";
    gameList.append(empty);
    playButton.disabled = true;
    return;
  }

  playButton.disabled = false;
  if (!games.some((rom) => rom.id === selectedRomId)) {
    selectedRomId = games[0].id;
    romSelect.value = selectedRomId;
  }

  const fragment = document.createDocumentFragment();
  for (const rom of games) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `game-card${rom.id === selectedRomId ? " is-selected" : ""}`;
    button.dataset.romId = rom.id;

    const title = document.createElement("span");
    title.className = "game-title";
    title.textContent = rom.title;

    const system = document.createElement("span");
    system.className = "game-system";
    system.textContent = rom.systemLabel;

    button.append(title, system);
    fragment.append(button);
  }

  gameList.append(fragment);
}

function loadRom() {
  const rom = selectedRom();
  if (!rom) return;

  const params = new URLSearchParams({
    rom: rom.path,
    core: rom.core,
    title: rom.title,
    shader: shaderSelect.value
  });

  localStorage.setItem("retro-drop-shader", shaderSelect.value);
  currentRomId = rom.id;
  setSessionState("running");
  playerFrame.addEventListener("load", focusPlayer, { once: true });
  playerFrame.src = `player.html?${params.toString()}`;
  emptyState.hidden = true;
}

function pauseGame() {
  postToPlayer({ type: "pause-game" });
}

function resumeGame() {
  postToPlayer({ type: "resume-game" });
}

function stopGame() {
  playerFrame.removeAttribute("src");
  currentRomId = "";
  closeSwapModal();
  setSessionState("stopped");
  emptyState.hidden = false;
}

async function loadManifest() {
  try {
    const response = await fetch("roms/manifest.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    manifest = await response.json();
  } catch (error) {
    manifest = [];
  }

  romSelect.innerHTML = "";

  if (!manifest.length) {
    addOption(romSelect, "", "No ROMs found");
    romSelect.disabled = true;
    playButton.disabled = true;
    gameList.innerHTML = '<div class="library-empty">No games found</div>';
    return;
  }

  for (const rom of manifest) {
    addOption(romSelect, rom.id, romLabel(rom));
  }

  selectedRomId = manifest[0].id;
  romSelect.value = selectedRomId;
  romSelect.disabled = false;
  playButton.disabled = false;
  renderSystems();
  renderGameList();
}

playButton.addEventListener("click", loadRom);
gameList.addEventListener("click", (event) => {
  const card = event.target.closest(".game-card");
  if (card) requestGameSwitch(card.dataset.romId);
});
gameFilter.addEventListener("input", renderGameList);
systemFilter.addEventListener("change", renderGameList);
shaderSelect.addEventListener("change", () => {
  const shader = shaderSelect.value;
  localStorage.setItem("retro-drop-shader", shader);
  if (currentRomId) {
    applyShader(shader);
  }
});
controllerButton.addEventListener("click", () => {
  activateControllers();
});
pauseButton.addEventListener("click", pauseGame);
resumeButton.addEventListener("click", resumeGame);
stopButton.addEventListener("click", stopGame);
fullscreenButton.addEventListener("click", () => {
  if (screenFrame.requestFullscreen) {
    screenFrame.requestFullscreen();
  }
  focusPlayer();
});

window.addEventListener("gamepadconnected", () => {
  activateControllers();
});

window.addEventListener("gamepaddisconnected", () => {
  const pads = readGamepads();
  lastControllerSignature = "";
  updateControllerStatus(pads);
  postToPlayer({ type: "gamepad-state", pads });
});

modalCancel.addEventListener("click", closeSwapModal);
swapModal.addEventListener("click", (event) => {
  if (event.target === swapModal) closeSwapModal();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !swapModal.hidden) closeSwapModal();
});
modalPause.addEventListener("click", () => {
  pauseGame();
});
modalConfirm.addEventListener("click", () => {
  if (!pendingSwapId || sessionState === "running") return;
  const id = pendingSwapId;
  closeSwapModal();
  switchToRom(id);
});

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin || event.data.source !== "retro-drop-player") return;

  if (event.data.type === "session-state") {
    setSessionState(event.data.state);
    if (event.data.state === "paused" && pendingSwapId) {
      modalPause.hidden = true;
      modalConfirm.disabled = false;
      swapMessage.textContent = `Switch to ${selectedOrPendingTitle(pendingSwapId)}? The current paused game session will be replaced.`;
    }
  }
});

populateShaders();
createIcons({ icons: { Gamepad2, Maximize, Pause, Play, Square } });
loadManifest();
updateControllerStatus(readGamepads());
setSessionState("stopped");
