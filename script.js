/* =========================================================
   NEON RUSH — top-down arcade racer
   All visuals are drawn on the canvas with 2D context calls.
   ========================================================= */

// ---------- Canvas setup ----------

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const CANVAS_WIDTH = canvas.width;   // 480
const CANVAS_HEIGHT = canvas.height; // 720

// ---------- Road layout ----------

const ROAD_LEFT = 60;
const ROAD_RIGHT = CANVAS_WIDTH - 60;
const ROAD_WIDTH = ROAD_RIGHT - ROAD_LEFT;
const LANE_COUNT = 3;
const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT;

function laneCenterX(laneIndex) {
  return ROAD_LEFT + LANE_WIDTH * laneIndex + LANE_WIDTH / 2;
}

// ---------- Player car ----------

const CAR_WIDTH = 34;
const CAR_HEIGHT = 56;

const player = {
  x: CANVAS_WIDTH / 2,       // horizontal position (center of car)
  y: CANVAS_HEIGHT - 130,    // fixed vertical position on screen
  width: CAR_WIDTH,
  height: CAR_HEIGHT,
  speed: 0,                  // current forward speed
  maxSpeed: 480,             // top speed (px/sec, affects scroll rate)
  accelRate: 260,            // acceleration px/sec^2
  brakeRate: 420,            // braking px/sec^2
  friction: 140,             // natural deceleration px/sec^2
  steerSpeed: 300            // horizontal px/sec while steering
};

// ---------- Input state ----------

const input = {
  left: false,
  right: false,
  gas: false,
  brake: false
};

window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      input.left = true;
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      input.right = true;
      break;
    case 'ArrowUp':
    case 'w':
    case 'W':
      input.gas = true;
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      input.brake = true;
      break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      input.left = false;
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      input.right = false;
      break;
    case 'ArrowUp':
    case 'w':
    case 'W':
      input.gas = false;
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      input.brake = false;
      break;
  }
});

// Touch controls — press-and-hold buttons map to the same input flags
function bindTouchButton(buttonId, inputKey) {
  const btn = document.getElementById(buttonId);
  const setState = (value) => (e) => {
    e.preventDefault();
    input[inputKey] = value;
  };
  btn.addEventListener('touchstart', setState(true), { passive: false });
  btn.addEventListener('touchend', setState(false), { passive: false });
  btn.addEventListener('touchcancel', setState(false), { passive: false });
  // Also support mouse for testing on desktop
  btn.addEventListener('mousedown', setState(true));
  btn.addEventListener('mouseup', setState(false));
  btn.addEventListener('mouseleave', setState(false));
}

bindTouchButton('btn-left', 'left');
bindTouchButton('btn-right', 'right');
bindTouchButton('btn-gas', 'gas');
bindTouchButton('btn-brake', 'brake');

// ---------- Lane lines (scrolling road markings) ----------

const LINE_HEIGHT = 40;
const LINE_GAP = 30;
const laneLines = [];

function setupLaneLines() {
  laneLines.length = 0;
  const totalSpan = LINE_HEIGHT + LINE_GAP;
  const count = Math.ceil(CANVAS_HEIGHT / totalSpan) + 1;
  for (let i = 0; i < count; i++) {
    laneLines.push(i * totalSpan);
  }
}

// ---------- Traffic cars ----------

const traffic = [];
const TRAFFIC_COLORS = ['#ff3d9a', '#ffcb47', '#9dff6b', '#a78bff', '#ff8a4d'];

function spawnTrafficCar() {
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const width = 34;
  const height = 56;
  const car = {
    x: laneCenterX(lane),
    y: -height - Math.random() * 200,
    width,
    height,
    // traffic cars have their own baseline speed; the on-screen
    // motion is (player.speed - car.baseSpeed) so faster traffic
    // appears to pull away and slower traffic rushes toward us
    baseSpeed: 90 + Math.random() * 140,
    color: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)]
  };
  traffic.push(car);
}

let spawnTimer = 0;
let spawnInterval = 1.1; // seconds, gets shorter as score increases

// ---------- Game state ----------

const STATE = {
  START: 'start',
  PLAYING: 'playing',
  GAMEOVER: 'gameover'
};

let gameState = STATE.START;
let score = 0;
let bestScore = Number(localStorage.getItem('neonRushBestScore')) || 0;
let lastTime = 0;
let roadOffset = 0;

document.getElementById('best-value').textContent = Math.floor(bestScore);

// ---------- DOM references ----------

const scoreValueEl = document.getElementById('score-value');
const bestValueEl = document.getElementById('best-value');
const speedFillEl = document.getElementById('speed-fill');
const startScreen = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const finalScoreEl = document.getElementById('final-score');
const newBestMsgEl = document.getElementById('new-best-msg');

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

// ---------- Game control ----------

function resetGame() {
  player.x = CANVAS_WIDTH / 2;
  player.speed = 0;
  score = 0;
  traffic.length = 0;
  spawnTimer = 0;
  spawnInterval = 1.1;
  roadOffset = 0;
  setupLaneLines();
}

function startGame() {
  resetGame();
  gameState = STATE.PLAYING;
  startScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
}

function endGame() {
  gameState = STATE.GAMEOVER;
  const finalScore = Math.floor(score);
  finalScoreEl.textContent = finalScore;

  if (finalScore > bestScore) {
    bestScore = finalScore;
    localStorage.setItem('neonRushBestScore', String(bestScore));
    newBestMsgEl.classList.remove('hidden');
  } else {
    newBestMsgEl.classList.add('hidden');
  }
  bestValueEl.textContent = Math.floor(bestScore);

  gameoverScreen.classList.remove('hidden');
}

// ---------- Update logic ----------

function updatePlayer(dt) {
  // Steering
  if (input.left) {
    player.x -= player.steerSpeed * dt;
  }
  if (input.right) {
    player.x += player.steerSpeed * dt;
  }

  // Keep the car within the road boundaries
  const minX = ROAD_LEFT + player.width / 2 + 4;
  const maxX = ROAD_RIGHT - player.width / 2 - 4;
  player.x = Math.max(minX, Math.min(maxX, player.x));

  // Acceleration / braking / friction
  if (input.gas) {
    player.speed += player.accelRate * dt;
  } else if (input.brake) {
    player.speed -= player.brakeRate * dt;
  } else if (player.speed > 0) {
    player.speed -= player.friction * dt;
  }

  player.speed = Math.max(0, Math.min(player.maxSpeed, player.speed));
}

function updateRoad(dt) {
  const totalSpan = LINE_HEIGHT + LINE_GAP;
  roadOffset += player.speed * dt;
  if (roadOffset >= totalSpan) {
    roadOffset -= totalSpan;
  }
}

function updateTraffic(dt) {
  // Spawn new traffic over time; spawn a little faster as score grows
  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnTrafficCar();
    spawnInterval = Math.max(0.5, 1.1 - score / 4000);
  }

  for (let i = traffic.length - 1; i >= 0; i--) {
    const car = traffic[i];
    const relativeSpeed = player.speed - car.baseSpeed;
    car.y += relativeSpeed * dt;

    // Remove cars that have scrolled off either end of the screen
    if (car.y > CANVAS_HEIGHT + 80 || car.y < -200) {
      traffic.splice(i, 1);
    }
  }
}

function checkCollisions() {
  const playerBox = {
    left: player.x - player.width / 2 + 6,
    right: player.x + player.width / 2 - 6,
    top: player.y - player.height / 2 + 6,
    bottom: player.y + player.height / 2 - 6
  };

  for (const car of traffic) {
    const carBox = {
      left: car.x - car.width / 2 + 4,
      right: car.x + car.width / 2 - 4,
      top: car.y - car.height / 2 + 4,
      bottom: car.y + car.height / 2 - 4
    };

    const overlapping =
      playerBox.left < carBox.right &&
      playerBox.right > carBox.left &&
      playerBox.top < carBox.bottom &&
      playerBox.bottom > carBox.top;

    if (overlapping) {
      endGame();
      return;
    }
  }
}

function updateScoreAndHud(dt) {
  // Score increases with distance traveled
  score += player.speed * dt * 0.05;
  scoreValueEl.textContent = Math.floor(score);

  const speedPercent = (player.speed / player.maxSpeed) * 100;
  speedFillEl.style.width = speedPercent + '%';
}

function update(dt) {
  updatePlayer(dt);
  updateRoad(dt);
  updateTraffic(dt);
  checkCollisions();
  if (gameState === STATE.PLAYING) {
    updateScoreAndHud(dt);
  }
}

// ---------- Drawing ----------

function drawRoad() {
  // Road surface
  ctx.fillStyle = '#10151f';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = '#171f2f';
  ctx.fillRect(ROAD_LEFT, 0, ROAD_WIDTH, CANVAS_HEIGHT);

  // Road edge glow lines
  ctx.fillStyle = '#4deaff';
  ctx.shadowColor = 'rgba(77, 234, 255, 0.7)';
  ctx.shadowBlur = 8;
  ctx.fillRect(ROAD_LEFT - 3, 0, 3, CANVAS_HEIGHT);
  ctx.fillRect(ROAD_RIGHT, 0, 3, CANVAS_HEIGHT);
  ctx.shadowBlur = 0;

  // Dashed lane divider lines
  ctx.fillStyle = '#5a6a8c';
  for (let lane = 1; lane < LANE_COUNT; lane++) {
    const x = ROAD_LEFT + LANE_WIDTH * lane;
    for (const baseY of laneLines) {
      const y = baseY + roadOffset - LINE_HEIGHT;
      ctx.fillRect(x - 2, y, 4, LINE_HEIGHT);
    }
  }
}

function drawCar(car, isPlayer) {
  const { x, y, width, height } = car;
  const color = isPlayer ? '#4deaff' : car.color;

  ctx.save();
  ctx.translate(x, y);

  // Soft glow beneath the car
  ctx.shadowColor = color;
  ctx.shadowBlur = isPlayer ? 14 : 8;

  // Body
  ctx.fillStyle = color;
  roundRect(ctx, -width / 2, -height / 2, width, height, 8);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Windshield / cabin
  ctx.fillStyle = 'rgba(10, 14, 23, 0.75)';
  const cabinW = width * 0.62;
  const cabinH = height * 0.32;
  roundRect(ctx, -cabinW / 2, -height * 0.12, cabinW, cabinH, 4);
  ctx.fill();

  // Headlights (front = top, since cars face up the screen)
  ctx.fillStyle = isPlayer ? '#ffffff' : '#ffe9b8';
  ctx.fillRect(-width / 2 + 4, -height / 2 + 4, 6, 6);
  ctx.fillRect(width / 2 - 10, -height / 2 + 4, 6, 6);

  // Taillights
  ctx.fillStyle = '#ff4d5e';
  ctx.fillRect(-width / 2 + 4, height / 2 - 10, 6, 5);
  ctx.fillRect(width / 2 - 10, height / 2 - 10, 6, 5);

  ctx.restore();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function draw() {
  drawRoad();

  for (const car of traffic) {
    drawCar(car, false);
  }

  drawCar(player, true);
}

// ---------- Main loop ----------

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  dt = Math.min(dt, 0.05); // clamp to avoid big jumps on tab-switch
  lastTime = timestamp;

  if (gameState === STATE.PLAYING) {
    update(dt);
  }

  draw();
  requestAnimationFrame(loop);
}

// ---------- Init ----------

setupLaneLines();
requestAnimationFrame(loop);
