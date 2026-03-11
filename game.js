const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const startOverlay = document.getElementById('start-overlay');
const winOverlay = document.getElementById('win-overlay');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const touchLeftBtn = document.getElementById('touch-left');
const touchRightBtn = document.getElementById('touch-right');

const GOAL = 10;
const slideColors = ['#ff4d4d', '#ff944d', '#ffd84d', '#64d66b', '#57b2ff', '#a17dff'];
const FRUIT_SEQUENCE = ['apple', 'strawberry', 'cherry', 'orange', 'pineapple', 'grapes'];
const FRUIT_COLORS = {
  apple: '#85f784', strawberry: '#ff6d86', cherry: '#ff4f66',
  orange: '#ffb04d', pineapple: '#ffe56e', grapes: '#b489ff',
};

const state = {
  width: 900,
  height: 560,
  running: false,
  won: false,
  score: 0,
  time: 0,
  scroll: 0,
  cat: { x: 450, y: 420, vx: 0, radius: 26, bounce: 0 },
  fruits: [],
  particles: [],
  keys: new Set(),
  touchX: null,
  touchLeftHeld: false,
  touchRightHeld: false,
  lastSpawn: 0,
  nextFruitIndex: 0,
};

class MeowSynth {
  constructor() {
    this.ctx = null;
  }
  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  play() {
    this.ensure();
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    gain.connect(this.ctx.destination);

    const oscA = this.ctx.createOscillator();
    oscA.type = 'triangle';
    oscA.frequency.setValueAtTime(760, now);
    oscA.frequency.exponentialRampToValueAtTime(520, now + 0.12);
    oscA.frequency.exponentialRampToValueAtTime(340, now + 0.3);
    oscA.connect(gain);

    const oscB = this.ctx.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.setValueAtTime(1100, now);
    oscB.frequency.exponentialRampToValueAtTime(620, now + 0.2);
    oscB.connect(gain);

    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + 0.32);
    oscB.stop(now + 0.26);
  }
}

const meow = new MeowSynth();

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.width = width;
  state.height = height;
  state.cat.y = height * 0.74;
  state.cat.x = Math.max(80, Math.min(width - 80, state.cat.x || width * 0.5));
}

function nextFruitType() {
  const type = FRUIT_SEQUENCE[state.nextFruitIndex];
  state.nextFruitIndex = (state.nextFruitIndex + 1) % FRUIT_SEQUENCE.length;
  return type;
}

function resetGame() {
  state.running = true;
  state.won = false;
  state.score = 0;
  state.time = 0;
  state.scroll = 0;
  state.lastSpawn = 0;
  state.nextFruitIndex = 0;
  state.cat = { x: state.width * 0.5, y: state.height * 0.74, vx: 0, radius: 26, bounce: 0 };
  state.fruits = [];
  state.particles = [];
  state.touchX = null;
  state.touchLeftHeld = false;
  state.touchRightHeld = false;
  scoreEl.textContent = '0';
  startOverlay.classList.remove('visible');
  winOverlay.classList.remove('visible');
}

function spawnFruit() {
  const type = nextFruitType();
  const x = 90 + Math.random() * (state.width - 180);
  const y = -50;
  const speed = 190 + ((state.nextFruitIndex % 3) * 35);
  const size = 17;
  state.fruits.push({ x, y, speed, type, size });
}

function spawnCelebrationFruit() {
  state.particles.push({
    x: Math.random() * state.width,
    y: state.height + 40,
    vx: -90 + Math.random() * 180,
    vy: -520 - Math.random() * 220,
    gravity: 760,
    rot: Math.random() * Math.PI,
    vr: -4 + Math.random() * 8,
    type: FRUIT_SEQUENCE[(Math.random() * FRUIT_SEQUENCE.length) | 0],
    size: 14 + Math.random() * 10,
  });
}

function update(dt) {
  state.time += dt;

  if (state.running && !state.won) {
    const left = state.keys.has('ArrowLeft') || state.keys.has('a') || state.touchLeftHeld;
    const right = state.keys.has('ArrowRight') || state.keys.has('d') || state.touchRightHeld;
    let steer = (right ? 1 : 0) - (left ? 1 : 0);

    if (state.touchX !== null) {
      const diff = state.touchX - state.cat.x;
      steer = Math.abs(diff) > 6 ? Math.sign(diff) : 0;
    }

    state.cat.vx += steer * 1000 * dt;
    state.cat.vx *= 0.84;
    state.cat.x += state.cat.vx * dt;
    state.cat.x = Math.max(80, Math.min(state.width - 80, state.cat.x));

    state.scroll += 330 * dt;
    state.lastSpawn += dt;
    if (state.lastSpawn > 0.56) {
      state.lastSpawn = 0;
      spawnFruit();
    }

    for (const f of state.fruits) f.y += f.speed * dt;
    state.fruits = state.fruits.filter((f) => f.y < state.height + 40);

    for (let i = state.fruits.length - 1; i >= 0; i--) {
      const f = state.fruits[i];
      if (Math.hypot(f.x - state.cat.x, f.y - state.cat.y) < f.size + state.cat.radius - 4) {
        state.fruits.splice(i, 1);
        state.score += 1;
        scoreEl.textContent = String(state.score);
        meow.play();

        for (let p = 0; p < 9; p++) {
          state.particles.push({
            x: f.x, y: f.y, vx: -170 + Math.random() * 340, vy: -190 + Math.random() * 320,
            life: 0.4 + Math.random() * 0.4, t: 0, color: FRUIT_COLORS[f.type],
          });
        }

        if (state.score >= GOAL) {
          state.won = true;
          state.running = false;
          winOverlay.classList.add('visible');
        }
      }
    }
  }

  if (state.won) {
    state.cat.bounce = Math.sin(state.time * 8) * 16;
    if (Math.random() < 0.3) spawnCelebrationFruit();
  }

  for (const p of state.particles) {
    if ('life' in p) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.rot += p.vr * dt;
    }
  }
  state.particles = state.particles.filter((p) => ('life' in p ? p.t < p.life : p.y < state.height + 80));
}

function drawBackground() {
  const W = state.width;
  const H = state.height;
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, W, H);

  const center = W / 2;
  const topWidth = Math.max(210, W * 0.28);
  const bottomWidth = Math.max(560, W * 0.72);
  for (let i = 0; i < 26; i++) {
    const y = ((i * 64 + state.scroll) % (H + 64)) - 64;
    const t = y / H;
    const stripeWidth = topWidth + (bottomWidth - topWidth) * t;
    const x = center - stripeWidth / 2;
    for (let b = 0; b < slideColors.length; b++) {
      const bandHeight = 64 / slideColors.length;
      ctx.fillStyle = slideColors[(b + i) % slideColors.length];
      ctx.fillRect(x, y + b * bandHeight, stripeWidth, bandHeight + 1);
    }
  }
}

function drawCat() {
  const catX = state.cat.x;
  const catY = state.cat.y;
  ctx.save();
  ctx.translate(catX, catY + state.cat.bounce);
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(0, 8, 15, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.moveTo(-18, -16); ctx.lineTo(-5, -36); ctx.lineTo(-2, -12); ctx.fill();
  ctx.beginPath(); ctx.moveTo(18, -16); ctx.lineTo(5, -36); ctx.lineTo(2, -12); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-9, -2, 4, 0, Math.PI * 2); ctx.arc(9, -2, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(-9, -2, 2, 0, Math.PI * 2); ctx.arc(9, -2, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFruit(fruit) {
  ctx.save();
  ctx.translate(fruit.x, fruit.y);
  if (fruit.type === 'apple') {
    ctx.fillStyle = '#6be06f'; ctx.beginPath(); ctx.arc(0, 0, fruit.size, 0, Math.PI * 2); ctx.fill();
  } else if (fruit.type === 'strawberry') {
    ctx.fillStyle = '#ff476b'; ctx.beginPath(); ctx.moveTo(0, -fruit.size);
    ctx.bezierCurveTo(fruit.size, -fruit.size, fruit.size, 0, 0, fruit.size);
    ctx.bezierCurveTo(-fruit.size, 0, -fruit.size, -fruit.size, 0, -fruit.size); ctx.fill();
  } else if (fruit.type === 'cherry') {
    ctx.fillStyle = '#d7354d'; ctx.beginPath(); ctx.arc(-6, 3, fruit.size * 0.62, 0, Math.PI * 2); ctx.arc(6, 3, fruit.size * 0.62, 0, Math.PI * 2); ctx.fill();
  } else if (fruit.type === 'orange') {
    ctx.fillStyle = '#ff9d3d'; ctx.beginPath(); ctx.arc(0, 0, fruit.size, 0, Math.PI * 2); ctx.fill();
  } else if (fruit.type === 'pineapple') {
    ctx.fillStyle = '#f4ca58'; ctx.beginPath(); ctx.ellipse(0, 3, fruit.size * 0.85, fruit.size * 1.08, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = '#9d78f2';
    for (const [gx, gy] of [[-8, -1], [0, -4], [8, -1], [-5, 7], [4, 7], [0, 15]]) {
      ctx.beginPath(); ctx.arc(gx, gy, fruit.size * 0.45, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawParticles() {
  for (const p of state.particles) {
    if ('life' in p) {
      const alpha = 1 - p.t / p.life;
      ctx.fillStyle = `${p.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      drawFruit({ x: 0, y: 0, type: p.type, size: p.size });
      ctx.restore();
    }
  }
}

function draw() {
  drawBackground();
  for (const f of state.fruits) drawFruit(f);
  drawParticles();
  drawCat();
}

let previous = performance.now();
function loop(ts) {
  const dt = Math.min(0.033, (ts - previous) / 1000);
  previous = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => state.keys.add(e.key));
window.addEventListener('keyup', (e) => state.keys.delete(e.key));

function setTouchPosition(clientX) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * state.width;
  state.touchX = Math.max(80, Math.min(state.width - 80, x));
}

canvas.addEventListener('pointerdown', (e) => {
  setTouchPosition(e.clientX);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons > 0) setTouchPosition(e.clientX);
});
canvas.addEventListener('pointerup', () => { state.touchX = null; });
canvas.addEventListener('pointercancel', () => { state.touchX = null; });

function bindHoldButton(el, onChange) {
  const activate = (e) => { e.preventDefault(); onChange(true); };
  const deactivate = (e) => { e.preventDefault(); onChange(false); };
  el.addEventListener('pointerdown', activate);
  el.addEventListener('pointerup', deactivate);
  el.addEventListener('pointerleave', deactivate);
  el.addEventListener('pointercancel', deactivate);
}

bindHoldButton(touchLeftBtn, (down) => { state.touchLeftHeld = down; });
bindHoldButton(touchRightBtn, (down) => { state.touchRightHeld = down; });

startBtn.addEventListener('click', () => {
  resetGame();
  meow.ensure();
});
restartBtn.addEventListener('click', resetGame);
window.addEventListener('resize', resizeCanvas);

resizeCanvas();
requestAnimationFrame(loop);
