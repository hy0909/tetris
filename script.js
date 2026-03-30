const COLS = 10;
const ROWS = 20;
const COLORS = [
  null,
  "#57e2e5",
  "#f25f5c",
  "#ffe066",
  "#7bd389",
  "#b388ff",
  "#ff9f68",
  "#38bdf8",
];

const SHAPES = {
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [2, 2],
    [2, 2],
  ],
  L: [
    [0, 0, 3],
    [3, 3, 3],
    [0, 0, 0],
  ],
  J: [
    [4, 0, 0],
    [4, 4, 4],
    [0, 0, 0],
  ],
  I: [
    [0, 0, 0, 0],
    [5, 5, 5, 5],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  S: [
    [0, 6, 6],
    [6, 6, 0],
    [0, 0, 0],
  ],
  Z: [
    [7, 7, 0],
    [0, 7, 7],
    [0, 0, 0],
  ],
};

const canvas = document.getElementById("tetris");
const context = canvas.getContext("2d");
const previewCanvas = document.getElementById("preview");
const previewContext = previewCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const bestEl = document.getElementById("best");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayTextEl = document.getElementById("overlay-text");
const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const touchPanel = document.querySelector(".touch-panel");

context.scale(30, 30);
previewContext.scale(32, 32);

const arena = createMatrix(COLS, ROWS);
const player = {
  pos: { x: 0, y: 0 },
  matrix: null,
  score: 0,
  lines: 0,
  level: 1,
};

let animationId = null;
let lastTime = 0;
let dropCounter = 0;
let gameStarted = false;
let isPaused = true;
let nextPiece = null;
let bag = [];

const bestScore = Number(localStorage.getItem("tetris-best-score") || 0);
bestEl.textContent = String(bestScore);

function createMatrix(width, height) {
  return Array.from({ length: height }, () => Array(width).fill(0));
}

function createPiece(type) {
  return SHAPES[type].map((row) => row.slice());
}

function createBag() {
  const pieces = ["T", "O", "L", "J", "I", "S", "Z"];
  for (let i = pieces.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  return pieces;
}

function getNextShape() {
  if (!bag.length) {
    bag = createBag();
  }
  return bag.pop();
}

function resetArena() {
  arena.forEach((row) => row.fill(0));
}

function merge(arenaMatrix, currentPlayer) {
  currentPlayer.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arenaMatrix[y + currentPlayer.pos.y][x + currentPlayer.pos.x] = value;
      }
    });
  });
}

function collide(arenaMatrix, currentPlayer) {
  const { matrix, pos } = currentPlayer;
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (
        matrix[y][x] !== 0 &&
        (arenaMatrix[y + pos.y] && arenaMatrix[y + pos.y][x + pos.x]) !== 0
      ) {
        return true;
      }
    }
  }
  return false;
}

function rotate(matrix) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < y; x += 1) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  matrix.forEach((row) => row.reverse());
}

function playerRotate() {
  if (!player.matrix || isPaused) {
    return;
  }

  const originalX = player.pos.x;
  rotate(player.matrix);

  const offsets = [0, -1, 1, -2, 2];
  for (const offset of offsets) {
    player.pos.x = originalX + offset;
    if (!collide(arena, player)) {
      draw();
      return;
    }
  }

  for (let y = 0; y < player.matrix.length; y += 1) {
    for (let x = 0; x < y; x += 1) {
      [player.matrix[x][y], player.matrix[y][x]] = [player.matrix[y][x], player.matrix[x][y]];
    }
  }
  player.matrix.reverse();
  player.pos.x = originalX;
}

function playerMove(direction) {
  if (!player.matrix || isPaused) {
    return;
  }
  player.pos.x += direction;
  if (collide(arena, player)) {
    player.pos.x -= direction;
  } else {
    draw();
  }
}

function getDropInterval() {
  return Math.max(120, 900 - (player.level - 1) * 70);
}

function playerDrop() {
  if (!player.matrix || isPaused) {
    return;
  }

  player.pos.y += 1;
  if (collide(arena, player)) {
    player.pos.y -= 1;
    merge(arena, player);
    sweepArena();
    spawnPlayer();
  }
  dropCounter = 0;
}

function hardDrop() {
  if (!player.matrix || isPaused) {
    return;
  }

  while (!collide(arena, player)) {
    player.pos.y += 1;
  }
  player.pos.y -= 1;
  merge(arena, player);
  sweepArena();
  spawnPlayer();
  dropCounter = 0;
}

function sweepArena() {
  let cleared = 0;
  outer: for (let y = arena.length - 1; y >= 0; y -= 1) {
    for (let x = 0; x < arena[y].length; x += 1) {
      if (arena[y][x] === 0) {
        continue outer;
      }
    }
    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    y += 1;
    cleared += 1;
  }

  if (!cleared) {
    return;
  }

  const points = [0, 100, 300, 500, 800];
  player.score += points[cleared] * player.level;
  player.lines += cleared;
  player.level = Math.floor(player.lines / 10) + 1;
  updateScore();
}

function drawMatrix(matrix, offset, targetContext, withGlow = false) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value === 0) {
        return;
      }

      targetContext.fillStyle = COLORS[value];
      if (withGlow) {
        targetContext.shadowColor = COLORS[value];
        targetContext.shadowBlur = 12;
      }
      targetContext.fillRect(x + offset.x, y + offset.y, 1, 1);
      targetContext.fillStyle = "rgba(255, 255, 255, 0.18)";
      targetContext.fillRect(x + offset.x + 0.08, y + offset.y + 0.08, 0.84, 0.18);
      targetContext.strokeStyle = "rgba(1, 8, 18, 0.35)";
      targetContext.lineWidth = 0.06;
      targetContext.strokeRect(x + offset.x, y + offset.y, 1, 1);
      targetContext.shadowBlur = 0;
    });
  });
}

function drawGhost() {
  const ghost = {
    pos: { x: player.pos.x, y: player.pos.y },
    matrix: player.matrix,
  };

  while (!collide(arena, ghost)) {
    ghost.pos.y += 1;
  }
  ghost.pos.y -= 1;

  ghost.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value === 0) {
        return;
      }
      context.fillStyle = "rgba(255, 255, 255, 0.08)";
      context.strokeStyle = "rgba(255, 255, 255, 0.25)";
      context.lineWidth = 0.05;
      context.fillRect(x + ghost.pos.x, y + ghost.pos.y, 1, 1);
      context.strokeRect(x + ghost.pos.x, y + ghost.pos.y, 1, 1);
    });
  });
}

function drawPreview() {
  previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  if (!nextPiece) {
    return;
  }

  const matrix = createPiece(nextPiece);
  const offsetX = (5 - matrix[0].length) / 2;
  const offsetY = (5 - matrix.length) / 2;
  drawMatrix(matrix, { x: offsetX, y: offsetY }, previewContext, true);
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawMatrix(arena, { x: 0, y: 0 }, context);
  if (player.matrix) {
    drawGhost();
    drawMatrix(player.matrix, player.pos, context, true);
  }
  drawPreview();
}

function updateScore() {
  scoreEl.textContent = String(player.score);
  linesEl.textContent = String(player.lines);
  levelEl.textContent = String(player.level);

  if (player.score > Number(bestEl.textContent)) {
    bestEl.textContent = String(player.score);
    localStorage.setItem("tetris-best-score", String(player.score));
  }
}

function showOverlay(title, text) {
  overlayTitleEl.textContent = title;
  overlayTextEl.textContent = text;
  overlayEl.classList.remove("hidden");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function spawnPlayer() {
  const currentType = nextPiece || getNextShape();
  nextPiece = getNextShape();
  player.matrix = createPiece(currentType);
  player.pos.y = 0;
  player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);

  if (collide(arena, player)) {
    endGame();
    return;
  }

  drawPreview();
  draw();
}

function startGame() {
  resetArena();
  bag = [];
  nextPiece = getNextShape();
  player.score = 0;
  player.lines = 0;
  player.level = 1;
  dropCounter = 0;
  lastTime = 0;
  gameStarted = true;
  isPaused = false;
  pauseButton.textContent = "일시정지";
  updateScore();
  hideOverlay();
  spawnPlayer();
  if (!animationId) {
    animationId = requestAnimationFrame(update);
  }
}

function pauseGame() {
  if (!gameStarted) {
    return;
  }
  isPaused = !isPaused;
  pauseButton.textContent = isPaused ? "다시 시작" : "일시정지";
  if (isPaused) {
    showOverlay("잠시 멈췄어요", "버튼을 다시 누르거나 P 키를 눌러 이어서 플레이하세요.");
  } else {
    hideOverlay();
    lastTime = 0;
    if (!animationId) {
      animationId = requestAnimationFrame(update);
    }
  }
}

function endGame() {
  isPaused = true;
  gameStarted = false;
  player.matrix = null;
  pauseButton.textContent = "일시정지";
  showOverlay("게임 오버", `최종 점수 ${player.score}점, 다시 도전해보세요.`);
}

function update(time = 0) {
  if (isPaused) {
    animationId = null;
    draw();
    return;
  }

  const deltaTime = lastTime ? time - lastTime : 0;
  lastTime = time;
  dropCounter += deltaTime;

  if (dropCounter > getDropInterval()) {
    playerDrop();
  }

  draw();
  animationId = requestAnimationFrame(update);
}

document.addEventListener("keydown", (event) => {
  if (event.code === "KeyP") {
    pauseGame();
    return;
  }

  if (!gameStarted && (event.code === "Enter" || event.code === "Space")) {
    startGame();
    return;
  }

  switch (event.code) {
    case "ArrowLeft":
      event.preventDefault();
      playerMove(-1);
      break;
    case "ArrowRight":
      event.preventDefault();
      playerMove(1);
      break;
    case "ArrowDown":
      event.preventDefault();
      playerDrop();
      break;
    case "ArrowUp":
    case "KeyX":
      event.preventDefault();
      playerRotate();
      break;
    case "Space":
      event.preventDefault();
      hardDrop();
      break;
    default:
      break;
  }
});

touchPanel.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  if (!gameStarted) {
    startGame();
  }

  const { action } = button.dataset;
  if (action === "left") {
    playerMove(-1);
  } else if (action === "right") {
    playerMove(1);
  } else if (action === "rotate") {
    playerRotate();
  } else if (action === "down") {
    playerDrop();
  } else if (action === "drop") {
    hardDrop();
  }
});

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", pauseGame);

showOverlay("게임을 시작해보세요", "버튼을 누르거나 Enter 키를 눌러 플레이를 시작할 수 있습니다.");
drawPreview();
draw();
