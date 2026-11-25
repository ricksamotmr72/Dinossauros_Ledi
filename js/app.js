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
// Dinos fixos no ambiente (ver a seção "Dinos fixos no ambiente")
const CAMERA_FEED_FOV = 65;      // campo de visão da câmera do celular no lado maior da imagem (graus)
const SENSOR_MIN_CHANGES = 3;    // leituras diferentes do giroscópio até confiar nele
const SENSOR_TIMEOUT = 1500;     // ms sem leituras do giroscópio: volta a usar a imagem
const IMAGE_TRACK_SIZE = 160;    // px do lado maior da imagem reduzida usada no rastreio
const IMAGE_TRACK_FPS = 30;      // quadros analisados por segundo
const IMAGE_TRACK_SEARCH = 7;    // busca do deslocamento por quadro (px da imagem reduzida)
const IMAGE_TRACK_REKEY = 12;    // troca o quadro de referência após andar isso (px reduzidos)
const IMAGE_TRACK_DEADBAND = 0.2; // ignora tremidinhas menores que isso (px reduzidos)
const IMAGE_TRACK_MIN_CONTRAST = 2; // imagem sem detalhes (parede lisa): não rastreia

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
const markersLayer = document.querySelector("#offscreen-markers");
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

// Laço por quadro da cena: posição de cada dino no ambiente (giroscópio) e
// movimento simulado dos modelos sem animação.
function motionLoop(now) {
  motionFrame = null;
  const tracking = isAnchoringActive();
  if ((!motionEnabled && !tracking) || cameraStage.hidden || !dinos.length) {
    if (!tracking) hideAllMarkers();
    return;
  }
  dinos.forEach((dino) => {
    if (!dino.loaded) return;
    let changed = false;
    if (tracking) changed = applyAnchor(dino);
    if (motionEnabled && !dino.animation) { // animados usam a animação real
      updateMotion(dino, now);
      changed = true;
    }
    if (changed && dino.inView) updateDino(dino);
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
  if (motionFrame == null && (motionEnabled || isAnchoringActive())) {
    motionFrame = window.requestAnimationFrame(motionLoop);
  }
}

// ---------------------------------------------------------------------------
// Dinos fixos no ambiente
// ---------------------------------------------------------------------------
// Ao inserir ou mover um dino, guardamos ONDE NO AMBIENTE ele foi colocado
// (dino.anchor). A cada quadro calculamos onde esse lugar aparece na tela:
// virando a câmera, o dino fica no lugar, sai da tela e reaparece quando a
// câmera aponta de volta para lá. Há duas formas de saber como a câmera virou:
//  1. "sensor": giroscópio do celular (evento deviceorientation). É a mais
//     precisa; inclinando o celular de lado, o dino inclina junto.
//  2. "imagem": compara cada quadro da câmera com o anterior e mede quanto o
//     ambiente andou na tela. Funciona em qualquer aparelho com câmera
//     (inclusive notebook) e quando o sensor está bloqueado ou sem permissão.
// O sensor é usado sempre que envia dados de verdade; senão, a imagem.
// Limite: as duas medem a rotação da câmera (olhar em volta), não o
// deslocamento; andar até o dino não muda a perspectiva.
const anchoring = {
  mode: "none",          // "none" | "sensor" | "image"
  matrix: null,          // orientação atual do celular (modo sensor)
  lastSensor: null,      // última leitura, para saber se o sensor está vivo
  sensorChanges: 0,      // quantas leituras diferentes já chegaram
  lastSensorTime: 0,
  hinted: {},
};
const isAnchoringActive = () => anchoring.mode !== "none" && !cameraStage.hidden;
const isFrontCamera = () => facingMode === "user";
const stageCenter = () => ({ x: cameraStage.clientWidth / 2, y: cameraStage.clientHeight / 2 });

// --- Modo sensor (giroscópio) ------------------------------------------------
function getScreenAngle() {
  const angle = screen.orientation?.angle ?? window.orientation ?? 0;
  return toRad(angle);
}

// Matriz de rotação aparelho → mundo (especificação W3C, ordem Z-X'-Y'').
function orientationMatrix(alpha, beta, gamma) {
  const a = toRad(alpha), b = toRad(beta), g = toRad(gamma);
  const cA = Math.cos(a), sA = Math.sin(a);
  const cB = Math.cos(b), sB = Math.sin(b);
  const cG = Math.cos(g), sG = Math.sin(g);
  return [
    [cA * cG - sA * sB * sG, -cB * sA, cG * sA * sB + cA * sG],
    [cG * sA + cA * sB * sG, cA * cB, sA * sG - cA * cG * sB],
    [-cB * sG, sB, cB * cG],
  ];
}

const mulMatrix = (m, v) => ({
  x: m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z,
  y: m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z,
  z: m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z,
});
const mulTransposed = (m, v) => ({
  x: m[0][0] * v.x + m[1][0] * v.y + m[2][0] * v.z,
  y: m[0][1] * v.x + m[1][1] * v.y + m[2][1] * v.z,
  z: m[0][2] * v.x + m[1][2] * v.y + m[2][2] * v.z,
});

// Eixos do aparelho ↔ eixos da tela (a tela gira quando o celular deita).
function deviceToScreen(v) {
  const a = getScreenAngle(), c = Math.cos(a), s = Math.sin(a);
  return { x: c * v.x - s * v.y, y: s * v.x + c * v.y, z: v.z };
}
function screenToDevice(v) {
  const a = getScreenAngle(), c = Math.cos(a), s = Math.sin(a);
  return { x: c * v.x + s * v.y, y: -s * v.x + c * v.y, z: v.z };
}

// Distância focal da imagem da câmera, em pixels da tela.
function getFocalPx() {
  const width = cameraStage.clientWidth || 1;
  const height = cameraStage.clientHeight || 1;
  const halfFov = Math.tan(toRad(CAMERA_FEED_FOV / 2));
  const vw = cameraFeed.videoWidth, vh = cameraFeed.videoHeight;
  if (!vw || !vh) return Math.max(width, height) / 2 / halfFov;
  // O vídeo é exibido com "object-fit: cover" (ampliado até cobrir a tela).
  const cover = Math.max(width / vw, height / vh);
  return (Math.max(vw, vh) / 2 / halfFov) * cover;
}

// Ponto da tela → direção no mundo (com a orientação atual).
function screenPointToWorld(x, y) {
  const f = getFocalPx();
  const c = stageCenter();
  const sx = (x - c.x) / f;
  const sy = -(y - c.y) / f;
  // Câmera traseira olha para -Z do aparelho; a frontal para +Z (imagem sem espelho).
  const screenVec = isFrontCamera() ? { x: -sx, y: sy, z: 1 } : { x: sx, y: sy, z: -1 };
  const d = mulMatrix(anchoring.matrix, screenToDevice(screenVec));
  const len = Math.hypot(d.x, d.y, d.z) || 1;
  return { x: d.x / len, y: d.y / len, z: d.z / len };
}

// Direção no mundo → ponto da tela (ou "atrás de você").
function worldToScreen(d) {
  const v = deviceToScreen(mulTransposed(anchoring.matrix, d));
  const forward = isFrontCamera() ? v.z : -v.z;
  const sx = isFrontCamera() ? -v.x : v.x;
  const f = getFocalPx();
  const c = stageCenter();
  if (forward < 0.08) return { ahead: false, dirX: sx, dirY: -v.y };
  return { ahead: true, x: c.x + (f * sx) / forward, y: c.y - (f * v.y) / forward, dirX: sx, dirY: -v.y };
}

// Inclinação lateral do celular: ângulo para manter o dino "em pé".
function getRollAngle() {
  const up = deviceToScreen(mulTransposed(anchoring.matrix, { x: 0, y: 0, z: 1 }));
  return Math.atan2(isFrontCamera() ? -up.x : up.x, up.y);
}

function onDeviceOrientation(event) {
  if (event.alpha == null || event.beta == null || event.gamma == null) return;
  const reading = [event.alpha, event.beta, event.gamma];
  const last = anchoring.lastSensor;
  // Alguns navegadores mandam sempre o mesmo valor sem ter sensor de verdade:
  // só confiamos no sensor depois de ver leituras mudando.
  if (!last || reading.some((value, i) => Math.abs(value - last[i]) > 0.01)) anchoring.sensorChanges += 1;
  anchoring.lastSensor = reading;
  anchoring.lastSensorTime = performance.now();
  anchoring.matrix = orientationMatrix(event.alpha, event.beta, event.gamma);
  if (anchoring.mode !== "sensor" && anchoring.sensorChanges >= SENSOR_MIN_CHANGES && !cameraStage.hidden) {
    setAnchoringMode("sensor");
  }
}

// No iPhone/iPad é preciso pedir permissão, e isso só pode ser feito logo
// após um toque do usuário (chamado no botão "Ver no meu espaço").
let orientationRequested = false;
function requestOrientationAccess() {
  if (orientationRequested || typeof DeviceOrientationEvent === "undefined") return;
  orientationRequested = true;
  const listen = () => window.addEventListener("deviceorientation", onDeviceOrientation);
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission()
      .then((state) => { if (state === "granted") listen(); })
      .catch(() => {});
  } else {
    listen();
  }
}

// --- Modo imagem (rastreia o ambiente pela própria câmera) -------------------
// Reduzimos cada quadro para uma imagem pequena em tons de cinza (bordas) e
// procuramos o deslocamento que melhor encaixa o quadro atual num quadro de
// referência. Esse deslocamento é o quanto o ambiente andou na tela.
const imageTracker = {
  canvas: document.createElement("canvas"),
  ctx: null,
  w: 0, h: 0,                 // imagem reduzida (escala fina)
  w2: 0, h2: 0,               // metade disso (escala grossa)
  gray: null,
  current: null, current2: null, // quadro atual (bordas), nas duas escalas
  key: null, key2: null,         // quadro de referência (bordas), nas duas escalas
  sinceKeyX: 0, sinceKeyY: 0, // deslocamento desde a referência (px da escala fina)
  velX: 0, velY: 0,           // último passo, para prever o próximo
  baseX: 0, baseY: 0,         // deslocamento acumulado até a referência (px da tela)
  shiftX: 0, shiftY: 0,       // deslocamento total do ambiente (px da tela)
  timer: null,
};

function videoToScreenScale() {
  const vw = cameraFeed.videoWidth, vh = cameraFeed.videoHeight;
  if (!vw || !vh || !imageTracker.w) return 1;
  const cover = Math.max(cameraStage.clientWidth / vw, cameraStage.clientHeight / vh);
  return (vw / imageTracker.w) * cover;
}

function resetImageReference() {
  const t = imageTracker;
  t.key = null;
  t.key2 = null;
  t.sinceKeyX = t.sinceKeyY = 0;
  t.velX = t.velY = 0;
}

// Imagem de bordas (diferenças entre vizinhos): não muda quando a câmera
// ajusta o brilho sozinha.
function computeEdges(gray, out, w, h) {
  for (let y = 0; y < h - 1; y++) {
    const row = y * w;
    for (let x = 0; x < w - 1; x++) {
      const i = row + x;
      out[i] = Math.abs(gray[i + 1] - gray[i]) + Math.abs(gray[i + w] - gray[i]);
    }
  }
}

// Reduz pela metade (média de 2x2), para a busca na escala grossa.
function halve(src, w, h, out, w2, h2) {
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      const i = 2 * y * w + 2 * x;
      out[y * w2 + x] = (src[i] + src[i + 1] + src[i + w] + src[i + w + 1]) / 4;
    }
  }
}

// Procura (dx, dy), perto do palpite, tal que o conteúdo do quadro de
// referência na posição (x, y) aparece agora em (x + dx, y + dy).
function estimateShift(key, cur, w, h, guessX, guessY, search) {
  const gx = Math.round(guessX), gy = Math.round(guessY);
  const margin = search + Math.max(Math.abs(gx), Math.abs(gy)) + 2;
  if (margin * 2 + 8 > Math.min(w, h)) return null; // andou demais: perdeu o rastreio
  const step = 2;
  let contrast = 0, samples = 0;
  for (let y = margin; y < h - margin; y += step) {
    for (let x = margin; x < w - margin; x += step) { contrast += key[y * w + x]; samples += 1; }
  }
  if (!samples || contrast / samples < IMAGE_TRACK_MIN_CONTRAST) return null; // parede lisa / escuro
  const size = 2 * search + 1;
  const scores = new Float64Array(size * size);
  let best = Infinity, bestI = 0, bestJ = 0;
  for (let j = 0; j < size; j++) {
    const dy = gy - search + j;
    for (let i = 0; i < size; i++) {
      const dx = gx - search + i;
      let sad = 0;
      for (let y = margin; y < h - margin; y += step) {
        const kr = y * w, cr = (y + dy) * w + dx;
        for (let x = margin; x < w - margin; x += step) sad += Math.abs(key[kr + x] - cur[cr + x]);
      }
      scores[j * size + i] = sad;
      if (sad < best) { best = sad; bestI = i; bestJ = j; }
    }
  }
  // Ajuste fino (sub-pixel) em cada eixo. A soma de diferenças absolutas tem
  // forma de "V" perto do mínimo, então usamos o ajuste em V (uma parábola
  // puxaria o resultado para números inteiros e o dino andaria menos).
  const refine = (a, b, c) => {
    const den = 2 * (Math.max(a, c) - b);
    return den > 0 ? clamp((a - c) / den, -0.5, 0.5) : 0;
  };
  const fx = bestI > 0 && bestI < size - 1
    ? refine(scores[bestJ * size + bestI - 1], best, scores[bestJ * size + bestI + 1]) : 0;
  const fy = bestJ > 0 && bestJ < size - 1
    ? refine(scores[(bestJ - 1) * size + bestI], best, scores[(bestJ + 1) * size + bestI]) : 0;
  return { dx: gx - search + bestI + fx, dy: gy - search + bestJ + fy };
}

function trackImageFrame() {
  const t = imageTracker;
  const vw = cameraFeed.videoWidth, vh = cameraFeed.videoHeight;
  if (!vw || !vh || cameraFeed.readyState < 2) return;
  const longSide = IMAGE_TRACK_SIZE;
  const w = vw >= vh ? longSide : Math.round(longSide * vw / vh) & ~1;
  const h = vw >= vh ? Math.round(longSide * vh / vw) & ~1 : longSide;
  if (w !== t.w || h !== t.h || !t.ctx) {
    t.w = w; t.h = h; t.w2 = w / 2; t.h2 = h / 2;
    t.canvas.width = w; t.canvas.height = h;
    t.ctx = t.canvas.getContext("2d", { willReadFrequently: true });
    t.gray = new Float32Array(w * h);
    t.current = new Float32Array(w * h);
    t.current2 = new Float32Array(t.w2 * t.h2);
    resetImageReference();
  }
  t.ctx.drawImage(cameraFeed, 0, 0, w, h);
  const pixels = t.ctx.getImageData(0, 0, w, h).data;
  for (let i = 0, p = 0; i < t.gray.length; i++, p += 4) {
    t.gray[i] = pixels[p] * 0.299 + pixels[p + 1] * 0.587 + pixels[p + 2] * 0.114;
  }
  computeEdges(t.gray, t.current, w, h);
  halve(t.current, w, h, t.current2, t.w2, t.h2);
  if (!t.key) {
    t.key = Float32Array.from(t.current);
    t.key2 = Float32Array.from(t.current2);
    return;
  }
  // 1) Escala grossa: alcança movimentos grandes, partindo da previsão.
  const guessX = t.sinceKeyX + t.velX, guessY = t.sinceKeyY + t.velY;
  const coarse = estimateShift(t.key2, t.current2, t.w2, t.h2, guessX / 2, guessY / 2, IMAGE_TRACK_SEARCH);
  // 2) Escala fina: acerta o valor exato.
  const fine = coarse && estimateShift(t.key, t.current, w, h, coarse.dx * 2, coarse.dy * 2, 2);
  if (!fine) {
    // Imagem sem detalhes ou movimento brusco demais: recomeça a referência
    // a partir daqui, sem tirar os dinos do lugar.
    t.baseX = t.shiftX;
    t.baseY = t.shiftY;
    t.key.set(t.current);
    t.key2.set(t.current2);
    t.sinceKeyX = t.sinceKeyY = t.velX = t.velY = 0;
    return;
  }
  const stepX = fine.dx - t.sinceKeyX, stepY = fine.dy - t.sinceKeyY;
  // Ignora tremidinhas mínimas (câmera parada).
  if (Math.abs(stepX) > IMAGE_TRACK_DEADBAND || Math.abs(stepY) > IMAGE_TRACK_DEADBAND) {
    t.velX = stepX;
    t.velY = stepY;
    t.sinceKeyX = fine.dx;
    t.sinceKeyY = fine.dy;
  } else {
    t.velX = t.velY = 0;
  }
  const scale = videoToScreenScale();
  t.shiftX = t.baseX + t.sinceKeyX * scale;
  t.shiftY = t.baseY + t.sinceKeyY * scale;
  // Andou bastante desde a referência: o quadro atual vira a nova referência.
  if (Math.abs(t.sinceKeyX) > IMAGE_TRACK_REKEY || Math.abs(t.sinceKeyY) > IMAGE_TRACK_REKEY) {
    t.baseX = t.shiftX;
    t.baseY = t.shiftY;
    t.key.set(t.current);
    t.key2.set(t.current2);
    t.sinceKeyX = t.sinceKeyY = 0;
  }
}

// O rastreio roda no próprio ritmo (IMAGE_TRACK_FPS vezes por segundo),
// mesmo que o desenho 3D esteja lento.
function imageTrackerTick() {
  if (cameraStage.hidden) { stopImageTracker(); return; }
  // Sensor parou de mandar dados: volta para a imagem.
  if (anchoring.mode === "sensor" && performance.now() - anchoring.lastSensorTime > SENSOR_TIMEOUT) {
    setAnchoringMode("image");
  }
  if (anchoring.mode === "image") trackImageFrame();
}

function startImageTracker() {
  if (imageTracker.timer != null) return;
  imageTracker.timer = window.setInterval(imageTrackerTick, 1000 / IMAGE_TRACK_FPS);
}

function stopImageTracker() {
  window.clearInterval(imageTracker.timer);
  imageTracker.timer = null;
}

// --- Escolha do modo e posição de cada dino ----------------------------------
// Onde o dino aparece na tela agora (pode estar fora da tela ou atrás).
function projectAnchor(dino) {
  const a = dino.anchor;
  const c = stageCenter();
  if (a?.mode === "sensor" && anchoring.matrix) return worldToScreen(a.dir);
  if (a?.mode === "image") {
    const x = a.x + imageTracker.shiftX, y = a.y + imageTracker.shiftY;
    return { ahead: true, x, y, dirX: x - c.x, dirY: y - c.y };
  }
  return { ahead: true, x: dino.feetX, y: dino.feetY, dirX: dino.feetX - c.x, dirY: dino.feetY - c.y };
}

// Guarda a posição atual (na tela) do dino como o lugar dele no ambiente.
function anchorDino(dino, screenPoint = { x: dino.feetX, y: dino.feetY }) {
  if (anchoring.mode === "sensor" && anchoring.matrix) {
    dino.anchor = { mode: "sensor", dir: screenPointToWorld(screenPoint.x, screenPoint.y) };
  } else if (anchoring.mode === "image") {
    dino.anchor = { mode: "image", x: screenPoint.x - imageTracker.shiftX, y: screenPoint.y - imageTracker.shiftY };
  } else {
    dino.anchor = null;
  }
}

function setAnchoringMode(mode) {
  if (anchoring.mode === mode) return;
  // Converte a posição de cada dino para o novo modo, sem tirá-lo do lugar.
  const points = dinos.map((dino) => {
    const p = projectAnchor(dino);
    if (p.ahead) return { x: p.x, y: p.y };
    const c = stageCenter(); // estava atrás: manda para bem longe, do lado certo
    const len = Math.hypot(p.dirX, p.dirY) || 1;
    return { x: c.x + (p.dirX / len) * cameraStage.clientWidth * 3, y: c.y };
  });
  anchoring.mode = mode;
  if (mode === "image") resetImageReference();
  dinos.forEach((dino, i) => anchorDino(dino, points[i]));
  if (mode === "none") {
    dinos.forEach((dino) => {
      dino.inView = true;
      dino.el.style.visibility = "";
      dino.el.style.transform = "";
    });
    hideAllMarkers();
  }
  updateSelectionUI();
  showAnchoringHint();
  startMotion();
}

// Chamado quando a câmera abre e fecha.
function startAnchoring() {
  const sensorAlive = anchoring.sensorChanges >= SENSOR_MIN_CHANGES
    && performance.now() - anchoring.lastSensorTime < SENSOR_TIMEOUT;
  setAnchoringMode(sensorAlive ? "sensor" : "image");
  startImageTracker();
}

function stopAnchoring() {
  stopImageTracker();
  anchoring.mode = "none";
  imageTracker.baseX = imageTracker.baseY = imageTracker.shiftX = imageTracker.shiftY = 0;
  resetImageReference();
}

// Atualiza a posição na tela de um dino a partir do lugar guardado.
// Devolve true se ele está visível e precisa ser redesenhado.
function applyAnchor(dino) {
  if (!dino.anchor || dino.anchor.mode !== anchoring.mode) anchorDino(dino);
  const p = projectAnchor(dino);
  const width = cameraStage.clientWidth, height = cameraStage.clientHeight;
  const margin = Math.max(width, height) * 0.6; // o dino é largo: some só bem fora da tela
  const inView = p.ahead && p.x > -margin && p.x < width + margin && p.y > -margin && p.y < height + margin;
  dino.inView = inView;
  dino.el.style.visibility = inView ? "" : "hidden";
  if (inView) {
    dino.feetX = p.x;
    dino.feetY = p.y;
    if (anchoring.mode === "sensor") {
      dino.el.style.transformOrigin = `${p.x}px ${p.y}px`;
      dino.el.style.transform = `rotate(${getRollAngle().toFixed(4)}rad)`;
    } else {
      dino.el.style.transform = "";
    }
  } else {
    dino.box = null;
  }
  updateMarker(dino, p);
  return inView;
}

// Setinha na borda da tela apontando para um dino fora da vista.
function updateMarker(dino, p) {
  const width = cameraStage.clientWidth, height = cameraStage.clientHeight;
  const onScreen = p.ahead && p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height;
  if (onScreen) {
    if (dino.marker) dino.marker.hidden = true;
    return;
  }
  if (!dino.marker) {
    dino.marker = document.createElement("div");
    dino.marker.className = "offscreen-marker";
    dino.marker.setAttribute("aria-hidden", "true");
    const arrow = document.createElement("span");
    arrow.className = "offscreen-marker-arrow";
    dino.marker.append(createThumb(models[dino.typeIndex], "offscreen-marker-thumb"), arrow);
    markersLayer.append(dino.marker);
  }
  let dx = p.dirX, dy = p.dirY;
  // Dino atrás de você: a seta indica o lado para onde virar.
  if (!p.ahead) {
    dx = dx < 0 ? -1 : 1;
    dy = 0;
  }
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  const c = stageCenter();
  // Área onde as setas ficam: longe da barra do topo, da barra de baixo e
  // dos painéis laterais (para não ficarem escondidas atrás deles).
  const side = width < 520 ? 96 : 110;
  const box = { left: side, right: width - side, top: 120, bottom: height - 150 };
  const t = Math.min(
    dx > 0 ? (box.right - c.x) / dx : dx < 0 ? (box.left - c.x) / dx : Infinity,
    dy > 0 ? (box.bottom - c.y) / dy : dy < 0 ? (box.top - c.y) / dy : Infinity,
  );
  dino.marker.style.left = `${c.x + dx * t}px`;
  dino.marker.style.top = `${c.y + dy * t}px`;
  dino.marker.style.setProperty("--arrow-angle", `${Math.atan2(dy, dx)}rad`);
  dino.marker.classList.toggle("is-selected", dino === selectedDino);
  dino.marker.hidden = false;
}

function hideAllMarkers() {
  dinos.forEach((dino) => { if (dino.marker) dino.marker.hidden = true; });
}

function showAnchoringHint() {
  const mode = anchoring.mode;
  if (mode === "none" || cameraStage.hidden || anchoring.hinted[mode]) return;
  anchoring.hinted[mode] = true;
  showMessage(mode === "sensor"
    ? "Os dinos ficam onde você os colocou. Vire o celular para olhar em volta e colocar dinos em outros lugares!"
    : "Os dinos ficam onde você os colocou. Vire a câmera devagar para olhar em volta e colocar dinos em outros lugares!");
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
  el.setAttribute("max-field-of-view", "120deg");  return el;
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
    anchor: null,   // direção no ambiente (giroscópio); ver "Dinos fixos no ambiente"
    inView: true,
    marker: null,   // setinha na borda quando o dino está fora da tela
  };
  anchorDino(dino);
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
  const height = cameraStage.clientHeight;
  // Só contam os dinos que estão na tela agora (os outros ficaram em outro
  // lugar do ambiente).
  const visible = dinos.filter((dino) => dino.inView
    && dino.feetX >= 0 && dino.feetX <= width && dino.feetY >= 0 && dino.feetY <= height);
  const reference = visible.includes(selectedDino) ? selectedDino : null;
  const floorY = reference ? clamp(reference.feetY, TOP_LIMIT, height - 10) : getDefaultFloorY();
  const spacing = width * NEW_DINO_SPACING;
  const offsets = [0, 1, -1, 2, -2, 0.5, -0.5, 1.5, -1.5, 2.5, -2.5];
  const isFree = (x) => visible.every((dino) =>
    Math.abs(dino.feetX - x) > spacing * 0.45 || Math.abs(dino.feetY - floorY) > 40);
  const x = offsets
    .map((offset) => width / 2 + offset * spacing)
    .find((candidate) => candidate >= SIDE_MARGIN && candidate <= width - SIDE_MARGIN && isFree(candidate));
  return { x: x ?? clamp((reference?.feetX ?? width / 2) + 30, SIDE_MARGIN, width - SIDE_MARGIN), y: floorY };
}

function selectDino(dino) {
  selectedDino = dino;
  updateSelectionUI();
}

function removeDino(dino) {
  if (!dino) return;
  stopAnimation(dino);
  dino.el.remove();
  dino.marker?.remove();
  dinos = dinos.filter((item) => item !== dino);
  if (selectedDino === dino) selectedDino = dinos[dinos.length - 1] ?? null;
  updateSelectionUI();
  updateLoadingLabel();
}

function clearScene() {
  dinos.forEach((dino) => {
    stopAnimation(dino);
    dino.el.remove();
    dino.marker?.remove();
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
  cameraHint.textContent = anchoring.mode === "sensor"
    ? "🧭 Fixos pelo sensor · Vire o celular para olhar em volta · Arraste no dino para girar"
    : anchoring.mode === "image"
      ? "📷 Fixos pela imagem · Vire a câmera devagar · Arraste no dino para girar"
      : dinos.length > 1
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
  anchorDino(dino); // fixa o dino no novo lugar do ambiente
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

async function startCameraStream() {
  cameraStream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: facingMode } },
  });
  cameraFeed.srcObject = cameraStream;
  await cameraFeed.play();
}

async function openCamera() {
  if (openingCamera || cameraStream) return;
  // Sempre abrimos o nosso modo câmera no navegador (com os ícones para
  // adicionar, girar e mudar o tamanho), igual no computador, celular e
  // tablet. O AR/VR do aparelho nunca é usado.

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMessage("A câmera precisa de uma página segura. Abra pelo atalho abrir-no-navegador.bat ou use um endereço HTTPS.");
    return;
  }

  openingCamera = true;
  if (document.fullscreenEnabled && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }

  try {
    await startCameraStream();
    openingCamera = false;
    cameraStage.hidden = false;
    page.classList.add("camera-open");
    window.requestAnimationFrame(() => {
      if (!dinos.length) {
        addDino(selectedIndex, { x: cameraStage.clientWidth / 2, y: getDefaultFloorY(), rotation: previewRotation });
      }
      startAnchoring();
      startMotion();
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
  stopAnchoring();
  stopCamera();
  clearScene();
  cameraStage.hidden = true;
  page.classList.remove("camera-open");
}

document.querySelector("#ar-button").addEventListener("click", async () => {
  // Precisa ser logo no toque (exigência do iPhone/iPad para o giroscópio).
  requestOrientationAccess();
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
  resetImageReference(); // imagem nova: o rastreio recomeça dela
  try {
    await startCameraStream();
  } catch (error) {
    showMessage("Não foi possível trocar de câmera. Verifique a permissão e tente novamente.");
  }
});

// ---------------------------------------------------------------------------
// Câmera interrompida pelo sistema
// ---------------------------------------------------------------------------
// Tudo acontece no navegador, com a câmera do navegador (nunca o AR/VR do
// aparelho). No celular, bloquear a tela ou trocar de app pode desligar a
// câmera da página; quando a página volta a aparecer, religamos.
const isStreamLive = () => !!cameraStream
  && cameraStream.getVideoTracks().some((track) => track.readyState === "live");

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || cameraStage.hidden || isStreamLive()) return;
  try {
    stopCamera();
    resetImageReference();
    await startCameraStream();
  } catch (error) {
    showMessage("Não foi possível religar a câmera. Toque em ✕ e abra de novo.");
  }
  dinos.forEach(updateDino);
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
  // Com o giroscópio, cada quadro já recalcula a posição a partir do ambiente.
  if (isAnchoringActive()) return;
  dinos.forEach((dino) => setDinoPosition(dino, dino.feetX, dino.feetY));
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && cameraStream && !cameraStage.hidden) {
    closeCamera(false);
  }
});

selectPreviewDinosaur(0);
updateSelectionUI();
