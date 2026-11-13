// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------
const MAX_DINOS = 5;               // quantos dinossauros cabem na cena
const SCALE_MIN = 0.4;
const SCALE_MAX = 4;
const SCALE_STEP = 0.1;
const CAMERA_PITCH = 75;           // graus: 90 = olhando reto, menor = mais de cima
const CAMERA_FOV = 40;             // campo de visão vertical (graus) no tamanho 100%
const SCREEN_FILL = 0.8;           // quanto da tela o dino ocupa no tamanho 100%
const ROTATE_STEP = 15;            // graus por toque nos botões ⟲ ⟳
const ROTATE_HOLD_SPEED = 120;     // graus por segundo segurando ⟲ ⟳
const NUDGE_STEP = 2;              // px por toque nos botões ▲ ▼ (ajuste fino)
const NUDGE_HOLD_SPEED = 60;       // px por segundo segurando ▲ ▼
const HOLD_DELAY = 300;            // ms até um botão segurado começar a repetir
const DRAG_ROTATE_FACTOR = 0.7;    // graus por pixel ao arrastar para girar
const TOP_LIMIT = 70;              // px: os pés não sobem além da barra do topo
const HIT_PADDING = 24;            // px de folga ao redor do dino para o toque
const WHEEL_SCALE_FACTOR = 0.0015; // sensibilidade da rodinha do mouse
const NEW_DINO_SPACING = 0.22;     // distância (fração da largura) entre dinos novos
const SIDE_MARGIN = 90;            // px: dinos novos não nascem atrás dos botões laterais
const REFERENCE_RADIUS = 10;       // metros: tamanho de referência comum (≈ T-Rex)
// Movimento natural (botão 🐾 liga/desliga)
const MOTION_BREATH_DEG = 0.8;         // respiração: balanço para frente/trás (graus)
const MOTION_SWAY_DEG = 3;             // balanço lateral contínuo (graus)
const MOTION_LOOK_ANGLE = [12, 28];    // "olhar em volta": quanto vira (graus, mín/máx)
const MOTION_LOOK_TIME = [2600, 4200]; // duração de cada olhada (ms, mín/máx)
const MOTION_LOOK_PAUSE = [4000, 10000]; // intervalo entre olhadas (ms, mín/máx)
const ANIMATION_ACTION_PAUSE = [4000, 9000]; // modelos animados: intervalo entre ações (ms)

// ---------------------------------------------------------------------------
// Elementos
// ---------------------------------------------------------------------------
const previewViewer = document.querySelector("#dinosaur");
const loading = document.querySelector("#loading");
const loadingThumb = document.querySelector("#loading-thumb");
const currentName = document.querySelector("#current-name");
const currentThumb = document.querySelector("#current-thumb");
const currentDiet = document.querySelector("#current-diet");
const factLength = document.querySelector("#fact-length");
const factWeight = document.querySelector("#fact-weight");
const factPeriod = document.querySelector("#fact-period");
const factPeriodItem = document.querySelector("#fact-period-item");
const factText = document.querySelector("#fact-text");
const message = document.querySelector("#message");
const page = document.querySelector(".page");
const cameraStage = document.querySelector("#camera-stage");
const cameraFeed = document.querySelector("#camera-feed");
const cameraLoading = document.querySelector("#camera-loading");
const cameraName = document.querySelector("#camera-name");
const cameraHint = document.querySelector("#camera-hint");
const sceneLayer = document.querySelector("#scene-layer");
const motionButton = document.querySelector("#toggle-motion");
const sizeValue = document.querySelector("#size-value");
const rotateValue = document.querySelector("#rotate-value");
const dinoControls = [...document.querySelectorAll(".dino-control")];

// Lista de dinossauros: vem de js/dinos.js.
const models = DINOSAURS;

function createThumb(model, className) {
  const img = document.createElement("img");
  img.className = className;
  img.src = model.thumb;
  img.alt = "";
  img.draggable = false;
  return img;
}

// Botões da página inicial (escolher) e do modo câmera (adicionar).
const buttons = models.map((model, index) => {
  const button = document.createElement("button");
  button.className = "dino-choice";
  button.type = "button";
  button.setAttribute("aria-pressed", String(index === 0));
  const name = document.createElement("span");
  name.className = "dino-name";
  name.textContent = model.name;
  button.append(createThumb(model, "dino-thumb"), name);
  // Selo de alimentação no canto do botão.
  const diet = DIETS[model.info?.diet];
  if (diet) {
    const badge = document.createElement("span");
    badge.className = `diet-badge diet-${model.info.diet}`;
    badge.textContent = diet.icon;
    badge.title = diet.label;
    badge.setAttribute("aria-hidden", "true");
    button.append(badge);
    button.setAttribute("aria-label", `${model.name}, ${diet.label}`);
  }
  document.querySelector("#dino-list").append(button);
  return button;
});

const cameraDinoButtons = models.map((model) => {
  const button = document.createElement("button");
  button.className = "camera-dino";
  button.type = "button";
  button.setAttribute("aria-label", `Adicionar ${model.name}`);
  button.setAttribute("aria-pressed", "false");
  button.title = model.name;
  button.append(createThumb(model, "camera-dino-thumb"));
  document.querySelector("#camera-dinos").append(button);
  return button;
});

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
let messageTimer;
let cameraStream;
let facingMode = "environment";
let openingCamera = false;

// Prévia (página inicial)
let selectedIndex = 0;
let previewLoading = true;
let previewRotation = 0;
let previewPointerId = null;
let lastPointerX = 0;

// Cena do modo câmera
// Cada dino: { el, typeIndex, loaded, rotation, scale, feetX, feetY, box,
//              motion, motionYaw, motionPitch }
let dinos = [];
let selectedDino = null;
const activePointers = new Map();
let gesture = null; // { type: "move" | "rotate" | "pinch", ... }

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const toRad = (deg) => deg * Math.PI / 180;
const fmt = (n) => n.toFixed(4);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeAngle = (deg) => ((deg % 360) + 360) % 360;

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
  window.clearTimeout(messageTimer);
  messageTimer = window.setTimeout(() => { message.hidden = true; }, 4800);
}

function getStagePoint(event) {
  const rect = cameraStage.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function getDefaultFloorY() {
  const height = cameraStage.clientHeight;
  return Math.min(height * 0.78, height - 110);
}

// ---------------------------------------------------------------------------
// Prévia (fora da câmera)
// ---------------------------------------------------------------------------
function applyPreviewView() {
  if (!previewViewer.loaded || previewLoading) return;
  previewViewer.cameraOrbit = `${fmt(previewRotation)}deg ${CAMERA_PITCH}deg auto`;
}

function selectPreviewDinosaur(index) {
  const selected = models[index];
  const source = new URL(selected.model, document.baseURI).href;
  const changed = previewViewer.src !== source;
  selectedIndex = index;
  buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
  if (changed) {
    previewLoading = true;
    previewViewer.pause?.();
    previewViewer.removeAttribute("animation-name");
    previewViewer.removeAttribute("autoplay");
    previewViewer.setAttribute("src", source);
    loading.hidden = false;
  }
  previewViewer.alt = `Modelo 3D de um ${selected.name}`;
  currentName.textContent = selected.name;
  currentThumb.src = selected.thumb;
  loadingThumb.src = selected.thumb;
  showDinoInfo(selected);
}

// Cartão de informações da página inicial.
function showDinoInfo(model) {
  const info = model.info ?? {};
  const diet = DIETS[info.diet];
  currentDiet.hidden = !diet;
  currentDiet.className = `diet-tag${diet ? ` diet-${info.diet}` : ""}`;
  currentDiet.textContent = diet ? `${diet.icon} ${diet.label}` : "";
  currentDiet.title = diet ? diet.hint : "";
  factLength.textContent = info.length ?? "–";
  factWeight.textContent = info.weight ?? "–";
  factPeriod.textContent = info.period ?? "–";
  factPeriodItem.title = info.age ? `Viveu no ${info.period}, ${info.age}` : "Época";
  factText.textContent = info.fact ?? "";
  factText.hidden = !info.fact;
}

previewViewer.addEventListener("load", () => {
  previewLoading = false;
  // Modelos com animação ficam tocando a animação "parado" na prévia.
  const animation = models[selectedIndex].animation;
  if (animation) {
    previewViewer.animationName = animation.idle;
    previewViewer.play();
  }
  applyPreviewView();
  previewViewer.jumpCameraToGoal?.();
  loading.hidden = true;
});

previewViewer.addEventListener("error", () => {
  previewLoading = false;
  loading.hidden = true;
  showMessage("Não foi possível carregar este dinossauro. Tente escolher outro!");
});

buttons.forEach((button, index) => {
  button.addEventListener("click", () => selectPreviewDinosaur(index));
});

previewViewer.addEventListener("pointerdown", (event) => {
  previewPointerId = event.pointerId;
  lastPointerX = event.clientX;
  previewViewer.setPointerCapture(event.pointerId);
  event.preventDefault();
});

previewViewer.addEventListener("pointermove", (event) => {
  if (event.pointerId !== previewPointerId) return;
  previewRotation = normalizeAngle(previewRotation + (event.clientX - lastPointerX) * DRAG_ROTATE_FACTOR);
  lastPointerX = event.clientX;
  applyPreviewView();
});

function stopPreviewRotation(event) {
  if (event.pointerId === previewPointerId) previewPointerId = null;
}
previewViewer.addEventListener("pointerup", stopPreviewRotation);
previewViewer.addEventListener("pointercancel", stopPreviewRotation);

// ---------------------------------------------------------------------------
// Cena: câmera 3D de cada dinossauro
// ---------------------------------------------------------------------------
// Cada dino tem seu próprio model-viewer em tela cheia. A câmera 3D dele é
// calculada para que os pés do modelo (centro da base da caixa delimitadora)
// apareçam exatamente em (feetX, feetY) na tela.
// - Rotação: gira a câmera em volta do dino (gira sobre os pés).
// - Tamanho: >100% fecha o campo de visão (zoom de lente, sem aproximar a
//   câmera, então o modelo nunca é cortado); <100% afasta a câmera.
function updateDino(dino) {
  if (!dino.loaded) return;
  const el = dino.el;
  const size = el.getDimensions();
  const center = el.getBoundingBoxCenter();
  const width = cameraStage.clientWidth || 1;
  const height = cameraStage.clientHeight || 1;
  const aspect = width / height;

  // Pés do modelo no mundo 3D.
  const feet = { x: center.x, y: center.y - size.y / 2, z: center.z };
  // Todos usam a mesma referência de tamanho, então os dinos mantêm a
  // proporção real entre si (o T-Rex é maior que o Galimimo).
  const modelRadius = Math.max(REFERENCE_RADIUS, Math.hypot(size.y, size.x / 2, size.z / 2));

  // Campo de visão desejado (tangente da metade, na vertical). Em tela em pé
  // o CAMERA_FOV vale para a largura, para o dino caber de lado a lado.
  const baseTan = Math.tan(toRad(CAMERA_FOV / 2));
  let radius = modelRadius / (baseTan * SCREEN_FILL);
  let tanHalfFov = baseTan / Math.min(1, aspect);
  if (dino.scale >= 1) tanHalfFov /= dino.scale;
  else radius /= dino.scale;
  // O model-viewer amplia o campo de visão vertical por
  // max(1, idealAspect / aspect) (ver adjustedFoV no model-viewer), e esse
  // fator muda de modelo para modelo. Compensamos para que o campo de visão
  // real seja exatamente o desejado (mesma escala para todos os dinos).
  const fovBoost = Math.max(1, (el.getIdealAspect?.() || 0) / aspect);
  const fov = 2 * Math.atan(tanHalfFov / fovBoost) * 180 / Math.PI;

  // Orientação mostrada = a escolhida pelo usuário + o movimento natural.
  const shownRotation = dino.rotation + dino.motionYaw;
  const shownPitch = CAMERA_PITCH + dino.motionPitch;

  // Vetores "direita" e "cima" da câmera para a orientação atual.
  const theta = toRad(shownRotation);
  const phi = toRad(shownPitch);
  const right = { x: Math.cos(theta), y: 0, z: -Math.sin(theta) };
  const up = {
    x: -Math.sin(theta) * Math.cos(phi),
    y: Math.sin(phi),
    z: -Math.cos(theta) * Math.cos(phi),
  };

  // Desloca o alvo da câmera para que os pés caiam no ponto da tela.
  const worldPerPixel = (radius * tanHalfFov) / (height / 2);
  const a = (dino.feetX - width / 2) * worldPerPixel;
  const b = (height / 2 - dino.feetY) * worldPerPixel;
  const target = {
    x: feet.x - a * right.x - b * up.x,
    y: feet.y - a * right.y - b * up.y,
    z: feet.z - a * right.z - b * up.z,
  };

  // Área ocupada na tela (para saber se um toque foi neste dino).
  const projectedWidth = Math.abs(size.x * Math.cos(theta)) + Math.abs(size.z * Math.sin(theta));
  const projectedDepth = Math.abs(size.x * Math.sin(theta)) + Math.abs(size.z * Math.cos(theta));
  const groundHalfDepth = (projectedDepth / 2 * Math.cos(phi)) / worldPerPixel;
  dino.box = {
    left: dino.feetX - projectedWidth / 2 / worldPerPixel,
    right: dino.feetX + projectedWidth / 2 / worldPerPixel,
    top: dino.feetY - (size.y * Math.sin(phi)) / worldPerPixel - groundHalfDepth,
    bottom: dino.feetY + groundHalfDepth,
    groundHalfDepth,
  };

  // O limite de distância precisa acompanhar o raio calculado: sem ele o
  // model-viewer trava a distância; com um valor enorme ele deixa de desenhar.
  el.maxCameraOrbit = `Infinity 180deg ${fmt(radius * 1.5)}m`;
  el.fieldOfView = `${fmt(fov)}deg`;
  el.cameraTarget = `${fmt(target.x)}m ${fmt(target.y)}m ${fmt(target.z)}m`;
  el.cameraOrbit = `${fmt(shownRotation)}deg ${fmt(shownPitch)}deg ${fmt(radius)}m`;
  el.jumpCameraToGoal?.();

  // Quem está mais embaixo na tela (mais perto) fica na frente.
  el.style.zIndex = String(1 + Math.round(dino.feetY));
}

// ---------------------------------------------------------------------------
// Movimento natural
// ---------------------------------------------------------------------------
// Modelos COM animações (campo "animation" em js/dinos.js): tocam a animação
// "parado" sem parar e, de vez em quando, uma das "ações" (uma vez só).
//
// Modelos SEM animações nem esqueleto: o movimento é do corpo inteiro,
// sempre com os pés parados no chão:
//  - respiração: leve balanço para frente e para trás (contínuo);
//  - balanço: o corpo oscila devagar para os lados (contínuo);
//  - "olhar em volta": de vez em quando vira um pouco para um lado e volta.
// Cada dino tem seu próprio ritmo, para não se moverem todos juntos.
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let motionEnabled = !reducedMotion;
let motionFrame = null;
const randomBetween = (min, max) => min + Math.random() * (max - min);

function createMotionState(now) {
  return {
    phase: Math.random() * Math.PI * 2,
    breathPeriod: randomBetween(2.8, 3.8),   // segundos
    swayPeriod: randomBetween(6, 9),          // segundos
    lookStart: now + randomBetween(1500, 5000),
    lookDuration: 0,
    lookAngle: 0,
  };
}

function updateMotion(dino, now) {
  const m = dino.motion;
  const t = now / 1000;
  const breath = Math.sin((2 * Math.PI * t) / m.breathPeriod + m.phase);
  const sway = Math.sin((2 * Math.PI * t) / m.swayPeriod + m.phase * 1.7);

  let look = 0;
  if (now >= m.lookStart) {
    if (!m.lookDuration) {
      m.lookDuration = randomBetween(MOTION_LOOK_TIME[0], MOTION_LOOK_TIME[1]);
      m.lookAngle = randomBetween(MOTION_LOOK_ANGLE[0], MOTION_LOOK_ANGLE[1]) * (Math.random() < 0.5 ? -1 : 1);
    }
    const progress = (now - m.lookStart) / m.lookDuration;
    if (progress >= 1) {
      m.lookDuration = 0;
      m.lookStart = now + randomBetween(MOTION_LOOK_PAUSE[0], MOTION_LOOK_PAUSE[1]);
    } else {
      // Vira, segura um instante e volta, com começo e fim suaves.
      const ease = Math.sin(Math.PI * progress);
      look = m.lookAngle * Math.min(1, ease * 1.6);
    }
  }

  dino.motionYaw = sway * MOTION_SWAY_DEG + look;
  dino.motionPitch = breath * MOTION_BREATH_DEG;
}

function motionLoop(now) {
  motionFrame = null;
  if (!motionEnabled || cameraStage.hidden || !dinos.length) return;
  dinos.forEach((dino) => {
    if (!dino.loaded || dino.animation) return; // animados usam a animação real
    updateMotion(dino, now);
    updateDino(dino);
  });
  motionFrame = window.requestAnimationFrame(motionLoop);
}

// --- Animações reais -------------------------------------------------------
function scheduleNextAction(dino) {
  window.clearTimeout(dino.actionTimer);
  if (!dino.animation?.actions?.length) return;
  dino.actionTimer = window.setTimeout(() => playAction(dino),
    randomBetween(ANIMATION_ACTION_PAUSE[0], ANIMATION_ACTION_PAUSE[1]));
}

function playIdle(dino) {
  dino.playingAction = false;
  dino.el.animationName = dino.animation.idle;
  dino.el.play();
}

function playAction(dino) {
  if (!motionEnabled || !dinos.includes(dino)) return;
  const { actions } = dino.animation;
  const options = actions.length > 1 ? actions.filter((name) => name !== dino.lastAction) : actions;
  const action = options[Math.floor(Math.random() * options.length)];
  dino.lastAction = action;
  dino.playingAction = true;
  dino.el.animationName = action;
  dino.el.play({ repetitions: 1 });
}

function startAnimation(dino) {
  if (!dino.animation || !dino.loaded) return;
  playIdle(dino);
  if (motionEnabled) scheduleNextAction(dino);
  else dino.el.pause();
}

function stopAnimation(dino) {
  window.clearTimeout(dino.actionTimer);
}

function startMotion() {
  if (motionFrame == null && motionEnabled) motionFrame = window.requestAnimationFrame(motionLoop);
}

function setMotionEnabled(enabled) {
  motionEnabled = enabled;
  motionButton.setAttribute("aria-pressed", String(enabled));
  motionButton.setAttribute("aria-label", enabled ? "Parar movimento dos dinossauros" : "Ligar movimento dos dinossauros");
  if (enabled) {
    startMotion();
    dinos.forEach(startAnimation);
  } else {
    if (motionFrame != null) window.cancelAnimationFrame(motionFrame);
    motionFrame = null;
    dinos.forEach((dino) => {
      dino.motionYaw = 0;
      dino.motionPitch = 0;
      updateDino(dino);
      if (dino.animation && dino.loaded) {
        stopAnimation(dino);
        dino.el.pause();
      }
    });
  }
}

motionButton.addEventListener("click", () => setMotionEnabled(!motionEnabled));
setMotionEnabled(motionEnabled);

// ---------------------------------------------------------------------------
// Cena: criar, escolher, remover
// ---------------------------------------------------------------------------
function createDinoElement(model) {
  const el = document.createElement("model-viewer");
  el.setAttribute("src", model.model);
  el.setAttribute("alt", `Modelo 3D de um ${model.name}`);
  el.setAttribute("shadow-intensity", "1");
  el.setAttribute("exposure", "1");
  el.setAttribute("animation-crossfade-duration", "500");
  el.setAttribute("interaction-prompt", "none");
  el.setAttribute("loading", "eager");
  // Limites livres (os padrões do model-viewer travariam o zoom).
  // O limite máximo de distância é ajustado em updateDino.
  el.setAttribute("min-camera-orbit", "-Infinity 0deg 0m");
  el.setAttribute("min-field-of-view", "1deg");
  el.setAttribute("max-field-of-view", "120deg");
  return el;
}

function updateLoadingLabel() {
  cameraLoading.hidden = dinos.every((dino) => dino.loaded);
}

function addDino(typeIndex, { x, y, rotation = 0, scale = 1 } = {}) {
  if (dinos.length >= MAX_DINOS) {
    showMessage(`A cena já tem ${MAX_DINOS} dinossauros. Remova um com 🗑 para adicionar outro.`);
    return null;
  }
  const model = models[typeIndex];
  const dino = {
    el: createDinoElement(model),
    typeIndex,
    loaded: false,
    rotation,
    scale,
    feetX: x,
    feetY: y,
    box: null,
    motion: createMotionState(performance.now()),
    motionYaw: 0,
    motionPitch: 0,
    animation: model.animation ?? null,
    actionTimer: null,
    playingAction: false,
    lastAction: null,
  };
  dino.el.addEventListener("load", () => {
    dino.loaded = true;
    updateDino(dino);
    updateLoadingLabel();
    startMotion();
    startAnimation(dino);
  });
  // Quando uma ação termina, volta para a animação "parado".
  dino.el.addEventListener("finished", () => {
    if (!dino.playingAction || !dinos.includes(dino)) return;
    playIdle(dino);
    if (motionEnabled) scheduleNextAction(dino);
    else dino.el.pause();
  });
  dino.el.addEventListener("error", () => {
    showMessage(`Não foi possível carregar o ${model.name}. Tente de novo!`);
    removeDino(dino);
  });
  dinos.push(dino);
  sceneLayer.append(dino.el);
  selectDino(dino);
  updateLoadingLabel();
  return dino;
}

// Posição de um dino novo: na MESMA linha de chão do dino escolhido (fica
// alinhado com ele), no lugar livre mais perto do centro da tela.
function getNewDinoPosition() {
  const width = cameraStage.clientWidth;
  const floorY = selectedDino ? selectedDino.feetY : getDefaultFloorY();
  const spacing = width * NEW_DINO_SPACING;
  const offsets = [0, 1, -1, 2, -2, 0.5, -0.5, 1.5, -1.5, 2.5, -2.5];
  const isFree = (x) => dinos.every((dino) =>
    Math.abs(dino.feetX - x) > spacing * 0.45 || Math.abs(dino.feetY - floorY) > 40);
  const x = offsets
    .map((offset) => width / 2 + offset * spacing)
    .find((candidate) => candidate >= SIDE_MARGIN && candidate <= width - SIDE_MARGIN && isFree(candidate));
  return { x: x ?? clamp((selectedDino?.feetX ?? width / 2) + 30, SIDE_MARGIN, width - SIDE_MARGIN), y: floorY };
}

function selectDino(dino) {
  selectedDino = dino;
  updateSelectionUI();
}

function removeDino(dino) {
  if (!dino) return;
  stopAnimation(dino);
  dino.el.remove();
  dinos = dinos.filter((item) => item !== dino);
  if (selectedDino === dino) selectedDino = dinos[dinos.length - 1] ?? null;
  updateSelectionUI();
  updateLoadingLabel();
}

function clearScene() {
  dinos.forEach((dino) => {
    stopAnimation(dino);
    dino.el.remove();
  });
  dinos = [];
  selectedDino = null;
  updateSelectionUI();
}

function updateSelectionUI() {
  const dino = selectedDino;
  dinoControls.forEach((control) => { control.disabled = !dino; });
  cameraDinoButtons.forEach((button, index) => {
    button.setAttribute("aria-pressed", String(!!dino && dino.typeIndex === index));
  });

  if (!dino) {
    rotateValue.textContent = "–";
    sizeValue.textContent = "–";
    cameraName.textContent = "Escolha um dino abaixo";
    cameraHint.textContent = "Toque em um dinossauro abaixo para adicionar à cena";
    return;
  }

  const model = models[dino.typeIndex];
  rotateValue.textContent = `${Math.round(dino.rotation)}°`;
  sizeValue.textContent = `${Math.round(dino.scale * 100)}%`;
  const label = dinos.length > 1
    ? `${model.name} · ${dinos.indexOf(dino) + 1}/${dinos.length}`
    : model.name;
  cameraName.replaceChildren(createThumb(model, "camera-name-thumb"), document.createTextNode(label));
  cameraHint.textContent = dinos.length > 1
    ? "Toque num dino para escolher · Arraste nele para girar · Arraste fora para mover"
    : "Arraste o dino para girar · Arraste fora dele para mover · Pinça ou +/− para o tamanho";
}

// Dino que está sob o ponto (o da frente primeiro).
function getDinoAt(event) {
  const p = getStagePoint(event);
  const pad = HIT_PADDING;
  return [...dinos]
    .filter((dino) => dino.loaded && dino.box)
    .sort((first, second) => second.feetY - first.feetY)
    .find(({ box }) => p.x >= box.left - pad && p.x <= box.right + pad
      && p.y >= box.top - pad && p.y <= box.bottom + pad) ?? null;
}

// ---------------------------------------------------------------------------
// Cena: alterar o dino escolhido
// ---------------------------------------------------------------------------
function setDinoPosition(dino, x, y) {
  if (!dino) return;
  dino.feetX = clamp(x, 0, cameraStage.clientWidth);
  dino.feetY = clamp(y, TOP_LIMIT, cameraStage.clientHeight - 10);
  updateDino(dino);
}

function setDinoRotation(dino, degrees) {
  if (!dino) return;
  dino.rotation = normalizeAngle(degrees);
  updateDino(dino);
  updateSelectionUI();
}

function setDinoScale(dino, scale) {
  if (!dino) return;
  dino.scale = clamp(scale, SCALE_MIN, SCALE_MAX);
  updateDino(dino);
  updateSelectionUI();
}

// ---------------------------------------------------------------------------
// Câmera do aparelho
// ---------------------------------------------------------------------------
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = undefined;
  }
  cameraFeed.srcObject = null;
}

async function openCamera() {
  if (openingCamera || cameraStream) return;
  // Sempre usamos o nosso modo câmera (com os ícones para adicionar, girar e
  // mudar o tamanho), também em celulares e tablets. O AR nativo do aparelho
  // (WebXR / Scene Viewer / Quick Look) tem a própria tela, sem esses controles.

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMessage("A câmera precisa de uma página segura. Abra pelo atalho abrir-no-navegador.bat ou use um endereço HTTPS.");
    return;
  }

  openingCamera = true;
  if (document.fullscreenEnabled && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facingMode } },
    });
    cameraFeed.srcObject = cameraStream;
    await cameraFeed.play();
    openingCamera = false;
    cameraStage.hidden = false;
    page.classList.add("camera-open");
    window.requestAnimationFrame(() => {
      if (!dinos.length) {
        addDino(selectedIndex, { x: cameraStage.clientWidth / 2, y: getDefaultFloorY(), rotation: previewRotation });
      }
    });
  } catch (error) {
    openingCamera = false;
    stopCamera();
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen().catch(() => {});
    }
    const messageText = error.name === "NotAllowedError"
      ? "Permita o acesso à câmera nas configurações do navegador e tente novamente."
      : error.name === "NotFoundError"
        ? "Não encontramos uma câmera neste aparelho."
        : "Não foi possível abrir a câmera. Verifique a permissão e tente novamente.";
    showMessage(messageText);
  }
}

async function closeCamera(exitFullscreen = true) {
  if (exitFullscreen && document.fullscreenElement && document.exitFullscreen) {
    await document.exitFullscreen().catch(() => {});
  }
  stopAllHolds();
  activePointers.clear();
  gesture = null;
  stopCamera();
  clearScene();
  cameraStage.hidden = true;
  page.classList.remove("camera-open");
}

document.querySelector("#ar-button").addEventListener("click", async () => {
  if (!previewViewer.loaded) {
    showMessage("Só um instante! O dinossauro ainda está chegando.");
    return;
  }
  await openCamera();
});

document.querySelector("#close-camera").addEventListener("click", () => closeCamera());

document.querySelector("#switch-camera").addEventListener("click", async () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  stopCamera();
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facingMode } },
    });
    cameraFeed.srcObject = cameraStream;
    await cameraFeed.play();
  } catch (error) {
    showMessage("Não foi possível trocar de câmera. Verifique a permissão e tente novamente.");
  }
});

// ---------------------------------------------------------------------------
// Botões
// ---------------------------------------------------------------------------
cameraDinoButtons.forEach((button, index) => {
  button.addEventListener("click", () => addDino(index, getNewDinoPosition()));
});

document.querySelector("#remove-dino").addEventListener("click", () => removeDino(selectedDino));
document.querySelector("#size-down").addEventListener("click", () => setDinoScale(selectedDino, (selectedDino?.scale ?? 1) - SCALE_STEP));
document.querySelector("#size-up").addEventListener("click", () => setDinoScale(selectedDino, (selectedDino?.scale ?? 1) + SCALE_STEP));

// Botões "segurar para repetir": um toque dá um passo; segurando, continua.
// onStep(amount) recebe 1 no toque e uma fração (por tempo) ao segurar.
const holdStops = [];

function makeHoldButton(button, { tapAmount, holdSpeed, onStep }) {
  let timer = null;
  let frame = null;
  const stop = () => {
    window.clearTimeout(timer);
    window.cancelAnimationFrame(frame);
    timer = null;
    frame = null;
  };
  holdStops.push(stop);
  button.addEventListener("pointerdown", (event) => {
    if (button.disabled) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    stop();
    onStep(tapAmount);
    timer = window.setTimeout(() => {
      let last = performance.now();
      const step = (now) => {
        onStep(holdSpeed * (now - last) / 1000);
        last = now;
        frame = window.requestAnimationFrame(step);
      };
      frame = window.requestAnimationFrame(step);
    }, HOLD_DELAY);
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => button.addEventListener(type, stop));
  button.addEventListener("contextmenu", (event) => event.preventDefault());
  // Teclado (Enter/Espaço) dispara "click" sem ponteiro (detail === 0).
  button.addEventListener("click", (event) => {
    if (event.detail === 0) onStep(tapAmount);
  });
}

function stopAllHolds() {
  holdStops.forEach((stop) => stop());
}

makeHoldButton(document.querySelector("#rotate-left"), {
  tapAmount: ROTATE_STEP, holdSpeed: ROTATE_HOLD_SPEED,
  onStep: (deg) => setDinoRotation(selectedDino, (selectedDino?.rotation ?? 0) - deg),
});
makeHoldButton(document.querySelector("#rotate-right"), {
  tapAmount: ROTATE_STEP, holdSpeed: ROTATE_HOLD_SPEED,
  onStep: (deg) => setDinoRotation(selectedDino, (selectedDino?.rotation ?? 0) + deg),
});
makeHoldButton(document.querySelector("#move-up"), {
  tapAmount: NUDGE_STEP, holdSpeed: NUDGE_HOLD_SPEED,
  onStep: (px) => selectedDino && setDinoPosition(selectedDino, selectedDino.feetX, selectedDino.feetY - px),
});
makeHoldButton(document.querySelector("#move-down"), {
  tapAmount: NUDGE_STEP, holdSpeed: NUDGE_HOLD_SPEED,
  onStep: (px) => selectedDino && setDinoPosition(selectedDino, selectedDino.feetX, selectedDino.feetY + px),
});

// ---------------------------------------------------------------------------
// Gestos na cena
//  - Tocar num dino: escolhe esse dino. Arrastar sobre ele para os lados: gira.
//  - Arrastar fora dos dinos: move o dino escolhido livremente pela tela.
//  - 2 dedos: pinça muda o tamanho e arrastar os dois move o dino escolhido.
//  - Rodinha do mouse: tamanho do dino escolhido.
// ---------------------------------------------------------------------------
function getPinchInfo() {
  const [first, second] = [...activePointers.values()];
  return {
    distance: Math.hypot(first.x - second.x, first.y - second.y) || 1,
    midX: (first.x + second.x) / 2,
    midY: (first.y + second.y) / 2,
  };
}

function startMoveGesture(pointerId, point) {
  if (!selectedDino) { gesture = null; return; }
  gesture = {
    type: "move",
    pointerId,
    dino: selectedDino,
    offsetX: selectedDino.feetX - point.x,
    offsetY: selectedDino.feetY - point.y,
  };
}

cameraStage.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button")) return;
  const point = getStagePoint(event);
  activePointers.set(event.pointerId, point);
  cameraStage.setPointerCapture(event.pointerId);

  if (activePointers.size >= 2) {
    if (!selectedDino) { gesture = null; return; }
    const info = getPinchInfo();
    gesture = {
      type: "pinch",
      dino: selectedDino,
      startDistance: info.distance,
      startScale: selectedDino.scale,
      offsetX: selectedDino.feetX - info.midX,
      offsetY: selectedDino.feetY - info.midY,
    };
    return;
  }

  const hit = getDinoAt(event);
  if (hit) {
    selectDino(hit);
    gesture = { type: "rotate", pointerId: event.pointerId, dino: hit, lastX: point.x };
  } else {
    startMoveGesture(event.pointerId, point);
  }
});

cameraStage.addEventListener("pointermove", (event) => {
  if (!activePointers.has(event.pointerId) || !gesture) return;
  const point = getStagePoint(event);
  activePointers.set(event.pointerId, point);
  const { dino } = gesture;
  if (!dinos.includes(dino)) { gesture = null; return; }

  if (gesture.type === "pinch" && activePointers.size >= 2) {
    const info = getPinchInfo();
    dino.scale = clamp(gesture.startScale * info.distance / gesture.startDistance, SCALE_MIN, SCALE_MAX);
    setDinoPosition(dino, info.midX + gesture.offsetX, info.midY + gesture.offsetY);
    updateSelectionUI();
  } else if (gesture.type === "rotate" && event.pointerId === gesture.pointerId) {
    setDinoRotation(dino, dino.rotation + (point.x - gesture.lastX) * DRAG_ROTATE_FACTOR);
    gesture.lastX = point.x;
  } else if (gesture.type === "move" && event.pointerId === gesture.pointerId) {
    setDinoPosition(dino, point.x + gesture.offsetX, point.y + gesture.offsetY);
  }
});

function endPointer(event) {
  if (!activePointers.delete(event.pointerId)) return;
  if (activePointers.size === 1) {
    // Ao tirar um dos dois dedos, o que sobra continua movendo o dino.
    const [pointerId, point] = activePointers.entries().next().value;
    startMoveGesture(pointerId, point);
  } else if (activePointers.size === 0) {
    gesture = null;
  }
}
cameraStage.addEventListener("pointerup", endPointer);
cameraStage.addEventListener("pointercancel", endPointer);

cameraStage.addEventListener("wheel", (event) => {
  if (event.target.closest("button") || !selectedDino) return;
  event.preventDefault();
  setDinoScale(selectedDino, selectedDino.scale * Math.exp(-event.deltaY * WHEEL_SCALE_FACTOR));
}, { passive: false });

// Cursor do mouse: ↔ sobre um dino (girar), ✥ fora (mover).
cameraStage.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse" || activePointers.size) return;
  if (event.target.closest("button")) { cameraStage.style.cursor = ""; return; }
  cameraStage.style.cursor = getDinoAt(event) ? "ew-resize" : (selectedDino ? "move" : "default");
});

// ---------------------------------------------------------------------------
// Janela
// ---------------------------------------------------------------------------
window.addEventListener("resize", () => {
  if (cameraStage.hidden) return;
  dinos.forEach((dino) => setDinoPosition(dino, dino.feetX, dino.feetY));
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && cameraStream && !cameraStage.hidden) {
    closeCamera(false);
  }
});

selectPreviewDinosaur(0);
updateSelectionUI();
