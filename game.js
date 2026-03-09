const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const startOverlay = document.getElementById('start-overlay');
const winOverlay = document.getElementById('win-overlay');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

const W = canvas.width;
const H = canvas.height;
const GOAL = 10;
const slideColors = ['#ff4d4d', '#ff944d', '#ffd84d', '#64d66b', '#57b2ff', '#a17dff'];

const state = {
  running: false,
  won: false,
  score: 0,
  time: 0,
  scroll: 0,
  cat: { x: W * 0.5, y: H * 0.75, vx: 0, radius: 26, bounce: 0 },
  fruits: [],
  particles: [],
  keys: new Set(),
  lastSpawn: 0,
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

function resetGame() {
  state.running = true;
  state.won = false;
  state.score = 0;
  state.time = 0;
  state.scroll = 0;
  state.lastSpawn = 0;
  state.cat = { x: W * 0.5, y: H * 0.75, vx: 0, radius: 26, bounce: 0 };
  state.fruits = [];
  state.particles = [];
  scoreEl.textContent = '0';
  startOverlay.classList.remove('visible');
  winOverlay.classList.remove('visible');
}

function spawnFruit() {
  const type = Math.random() < 0.5 ? 'apple' : 'strawberry';
  const x = 90 + Math.random() * (W - 180);
  const y = -40;
  const speed = 180 + Math.random() * 90;
  state.fruits.push({ x, y, speed, type, size: 18 });
}

function spawnCelebrationFruit() {
  const type = Math.random() < 0.5 ? 'apple' : 'strawberry';
  state.particles.push({
    x: Math.random() * W,
    y: H + 40,
    vx: -90 + Math.random() * 180,
    vy: -520 - Math.random() * 220,
    gravity: 760,
    rot: Math.random() * Math.PI,
    vr: -4 + Math.random() * 8,
    type,
    size: 14 + Math.random() * 10,
  });
}

function update(dt) {
  state.time += dt;

  if (state.running && !state.won) {
    const left = state.keys.has('ArrowLeft') || state.keys.has('a');
    const right = state.keys.has('ArrowRight') || state.keys.has('d');
    const steer = (right ? 1 : 0) - (left ? 1 : 0);

    state.cat.vx += steer * 1000 * dt;
    state.cat.vx *= 0.84;
    state.cat.x += state.cat.vx * dt;
    state.cat.x = Math.max(80, Math.min(W - 80, state.cat.x));

    state.scroll += 300 * dt;
    state.lastSpawn += dt;
    if (state.lastSpawn > 0.62) {
      state.lastSpawn = 0;
      spawnFruit();
    }

    for (const f of state.fruits) {
      f.y += f.speed * dt;
    }

    state.fruits = state.fruits.filter((f) => f.y < H + 40);

    const cat = state.cat;
    for (let i = state.fruits.length - 1; i >= 0; i--) {
      const f = state.fruits[i];
      const dx = f.x - cat.x;
      const dy = f.y - cat.y;
      if (Math.hypot(dx, dy) < f.size + cat.radius - 4) {
        state.fruits.splice(i, 1);
        state.score += 1;
        scoreEl.textContent = String(state.score);
        meow.play();

        for (let p = 0; p < 8; p++) {
          state.particles.push({
            x: f.x,
            y: f.y,
            vx: -150 + Math.random() * 300,
            vy: -180 + Math.random() * 300,
            life: 0.4 + Math.random() * 0.4,
            t: 0,
            color: f.type === 'apple' ? '#85f784' : '#ff6d86',
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
    if (Math.random() < 0.24) spawnCelebrationFruit();
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

  state.particles = state.particles.filter((p) => ('life' in p ? p.t < p.life : p.y < H + 80));
}

function drawBackground() {
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, W, H);

  const center = W / 2;
  const topWidth = 230;
  const bottomWidth = 640;

  for (let i = 0; i < 24; i++) {
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

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 90; i++) {
    const sx = (i * 97) % W;
    const sy = (i * 61 + state.scroll * 0.4) % H;
    ctx.fillRect(sx, sy, 2, 2);
  }
}

function drawCat(catX, catY) {
  ctx.save();
  ctx.translate(catX, catY + state.cat.bounce);

  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(0, 8, 15, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.moveTo(-18, -16);
  ctx.lineTo(-5, -36);
  ctx.lineTo(-2, -12);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(18, -16);
  ctx.lineTo(5, -36);
  ctx.lineTo(2, -12);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-9, -2, 4, 0, Math.PI * 2);
  ctx.arc(9, -2, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(-9, -2, 2, 0, Math.PI * 2);
  ctx.arc(9, -2, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-4, 6);
  ctx.lineTo(-18, 3);
  ctx.moveTo(-4, 10);
  ctx.lineTo(-19, 10);
  ctx.moveTo(4, 6);
  ctx.lineTo(18, 3);
  ctx.moveTo(4, 10);
  ctx.lineTo(19, 10);
  ctx.stroke();

  ctx.restore();
}

function drawFruit(fruit) {
  ctx.save();
  ctx.translate(fruit.x, fruit.y);

  if (fruit.type === 'apple') {
    ctx.fillStyle = '#6be06f';
    ctx.beginPath();
    ctx.arc(0, 0, fruit.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2f8b2e';
    ctx.fillRect(-2, -fruit.size - 8, 4, 10);
    ctx.fillStyle = '#98f29f';
    ctx.beginPath();
    ctx.ellipse(7, -fruit.size + 1, 8, 4, -0.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#ff476b';
    ctx.beginPath();
    ctx.moveTo(0, -fruit.size);
    ctx.bezierCurveTo(fruit.size, -fruit.size, fruit.size, 0, 0, fruit.size);
    ctx.bezierCurveTo(-fruit.size, 0, -fruit.size, -fruit.size, 0, -fruit.size);
    ctx.fill();

    ctx.fillStyle = '#58cb64';
    ctx.beginPath();
    ctx.ellipse(-7, -fruit.size + 4, 6, 4, 0.3, 0, Math.PI * 2);
    ctx.ellipse(7, -fruit.size + 4, 6, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffd7a1';
    for (let i = 0; i < 7; i++) {
      const a = (Math.PI * 2 * i) / 7;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 8, -2 + Math.sin(a) * 8, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawParticles() {
  for (const p of state.particles) {
    if ('life' in p) {
      const alpha = 1 - p.t / p.life;
      ctx.fillStyle = `${p.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      drawFruit({ x: 0, y: 0, type: p.type, size: p.size });
      ctx.restore();
    }
  }
}

function draw() {
  drawBackground();
  for (const f of state.fruits) drawFruit(f);
  drawParticles();
  drawCat(state.cat.x, state.cat.y);
}

let previous = performance.now();
function loop(ts) {
  const dt = Math.min(0.033, (ts - previous) / 1000);
  previous = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => {
  state.keys.add(e.key);
  if (e.key === ' ') e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  state.keys.delete(e.key);
});

startBtn.addEventListener('click', () => {
  resetGame();
  meow.ensure();
});

restartBtn.addEventListener('click', () => {
  resetGame();
});

requestAnimationFrame(loop);
