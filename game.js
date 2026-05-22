/* ----------------------------------------------------
   NEON STRIKER - Game Engine
   Engine: HTML5 2D Canvas with Neon Glow Effects
   Features: 3D perspective scrolling grid, particle pool,
             trauma screen shake, floating damage text, 
             complex enemy AI paths, and multi-phase Boss.
   ---------------------------------------------------- */

// Ensure game configuration is set up
const CONFIG = {
  width: 800,
  height: 600,
  playerSpeed: 7,
  playerFriction: 0.88,
  laserSpeed: 10,
  laserCooldown: 250, // ms
  shakeEnabled: true,
  particleDensity: 25
};

// Global state variables
let canvas, ctx;
let lastTime = 0;
let keys = {};
let gameActive = false;
let gamePaused = false;
let score = 0;
let highScore = 0;
let wave = 1;
let lives = 3; // Kept as player health/shield layers
let health = 100; // 0 to 100 (glowing shield bar)
let activePowerUps = {};
let spawnTimer = 0;
let traumaLevel = 0; // Screen vibration trauma indicator

// Game Entity Pools
let player = null;
let playerLasers = [];
let enemyLasers = [];
let enemies = [];
let powerUps = [];
let particles = [];
let floatingTexts = [];

// Scrolling background state
let gridOffset = 0;
const stars = [];

// Initialize Starfield once
for (let i = 0; i < 60; i++) {
  stars.push({
    x: Math.random() * CONFIG.width,
    y: Math.random() * CONFIG.height,
    speed: Math.random() * 1.5 + 0.5,
    size: Math.random() * 2 + 1,
    color: Math.random() > 0.5 ? '#ff00aa' : '#00f0ff'
  });
}

/* ----------------------------------------------------
   LEADERBOARD DATA STORAGE
   ---------------------------------------------------- */
function getLeaderboard() {
  let board = localStorage.getItem('neon_striker_high_scores');
  if (!board) {
    // Default mock data
    board = [
      { name: 'CPU', score: 85000 },
      { name: 'DM2', score: 62000 },
      { name: 'RET', score: 48000 },
      { name: 'ADA', score: 35000 },
      { name: 'SYN', score: 20000 }
    ];
    localStorage.setItem('neon_striker_high_scores', JSON.stringify(board));
  } else {
    board = JSON.parse(board);
  }
  return board.sort((a, b) => b.score - a.score);
}

function saveHighScore(name, scoreVal) {
  const board = getLeaderboard();
  board.push({ name: name.toUpperCase().slice(0, 3), score: scoreVal });
  const sorted = board.sort((a, b) => b.score - a.score).slice(0, 8); // Keep top 8
  localStorage.setItem('neon_striker_high_scores', JSON.stringify(sorted));
}

function checkNewHighScore(scoreVal) {
  const board = getLeaderboard();
  if (board.length < 8) return true;
  return scoreVal > board[board.length - 1].score;
}

function updateLeaderboardUI() {
  const body = document.getElementById('leaderboard-body');
  const board = getLeaderboard();
  body.innerHTML = '';
  board.forEach((record, index) => {
    const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
    body.innerHTML += `
      <tr>
        <td class="${rankClass}">#${index + 1}</td>
        <td class="${rankClass}">${record.name}</td>
        <td class="text-right ${rankClass}">${record.score.toLocaleString()}</td>
      </tr>
    `;
  });
}

/* ----------------------------------------------------
   CLASSES DEFINITION
   ---------------------------------------------------- */

// Player Space Fighter Class
class PlayerShip {
  constructor() {
    this.width = 44;
    this.height = 36;
    this.x = CONFIG.width / 2 - this.width / 2;
    this.y = CONFIG.height - 80;
    this.vx = 0;
    this.lastShotTime = 0;
    this.invulnFrames = 0;
  }

  update(dt) {
    // Process input keyboard movements
    if (keys['ArrowLeft'] || keys['KeyA']) {
      this.vx -= CONFIG.playerSpeed * 0.15;
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
      this.vx += CONFIG.playerSpeed * 0.15;
    }

    // Apply smooth inertia friction
    this.vx *= CONFIG.playerFriction;
    this.x += this.vx;

    // Boundary check clamping
    if (this.x < 15) {
      this.x = 15;
      this.vx = 0;
    }
    if (this.x > CONFIG.width - this.width - 15) {
      this.x = CONFIG.width - this.width - 15;
      this.vx = 0;
    }

    // Shoot triggers
    if (keys['Space']) {
      this.shoot();
    }

    if (this.invulnFrames > 0) {
      this.invulnFrames--;
    }
  }

  draw() {
    // Blinking effect if player is temporarily invulnerable (hit recently)
    if (this.invulnFrames > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
      return;
    }

    ctx.save();
    
    // Glowing cyan outline
    ctx.shadowBlur = 15;
    ctx.shadowColor = CONFIG.playerShieldActive() ? '#8b00ff' : '#00f0ff';
    ctx.lineWidth = 2.5;

    // Draw Spacecraft hull shape
    ctx.strokeStyle = '#00f0ff';
    ctx.fillStyle = '#01152a';
    ctx.beginPath();
    ctx.moveTo(this.x + this.width / 2, this.y); // Nose cone
    ctx.lineTo(this.x + this.width, this.y + this.height); // Bottom right wing tip
    ctx.lineTo(this.x + this.width - 10, this.y + this.height - 8); // Wing indentation right
    ctx.lineTo(this.x + 10, this.y + this.height - 8); // Wing indentation left
    ctx.lineTo(this.x, this.y + this.height); // Bottom left wing tip
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Secondary detail line
    ctx.strokeStyle = '#ff00aa';
    ctx.beginPath();
    ctx.moveTo(this.x + this.width / 2, this.y + 8);
    ctx.lineTo(this.x + this.width - 12, this.y + this.height - 10);
    ctx.lineTo(this.x + 12, this.y + this.height - 10);
    ctx.closePath();
    ctx.stroke();

    // Render cockpit window
    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.arc(this.x + this.width / 2, this.y + 16, 4, 0, Math.PI * 2);
    ctx.fill();

    // Engine flames
    const flameLen = Math.random() * 15 + 10;
    ctx.fillStyle = '#ff00aa';
    ctx.beginPath();
    ctx.moveTo(this.x + 15, this.y + this.height - 6);
    ctx.lineTo(this.x + this.width / 2, this.y + this.height - 6 + flameLen);
    ctx.lineTo(this.x + this.width - 15, this.y + this.height - 6);
    ctx.closePath();
    ctx.fill();

    // Draw active energy shield
    if (CONFIG.playerShieldActive()) {
      ctx.strokeStyle = '#ff00aa';
      ctx.shadowColor = '#ff00aa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 32, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  shoot() {
    const now = Date.now();
    let cooldown = CONFIG.laserCooldown;
    
    if (activePowerUps['RAPID_FIRE']) {
      cooldown = CONFIG.laserCooldown * 0.45; // Increase firing speed
    }

    if (now - this.lastShotTime >= cooldown) {
      this.lastShotTime = now;
      
      const beamColor = activePowerUps['TRIPLE_SHOT'] ? '#ffea00' : '#00f0ff';
      GameAudio.playLaserSound(activePowerUps['RAPID_FIRE'] ? 1.3 : 1.0);

      if (activePowerUps['TRIPLE_SHOT']) {
        // Angled side lasers + main laser
        playerLasers.push(new Laser(this.x + this.width / 2, this.y, 0, -CONFIG.laserSpeed, beamColor));
        playerLasers.push(new Laser(this.x + 5, this.y + 10, -2, -CONFIG.laserSpeed + 1, beamColor));
        playerLasers.push(new Laser(this.x + this.width - 5, this.y + 10, 2, -CONFIG.laserSpeed + 1, beamColor));
      } else {
        // Standard center dual-nose laser
        playerLasers.push(new Laser(this.x + 12, this.y, 0, -CONFIG.laserSpeed, beamColor));
        playerLasers.push(new Laser(this.x + this.width - 12, this.y, 0, -CONFIG.laserSpeed, beamColor));
      }
    }
  }
}

// Laser class (Player & Enemy projectiles)
class Laser {
  constructor(x, y, vx, vy, color = '#00f0ff') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.radius = 3;
    this.width = 4;
    this.height = 16;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
    ctx.restore();
  }

  isOutOfBounds() {
    return this.y < -30 || this.y > CONFIG.height + 30 || this.x < -30 || this.x > CONFIG.width + 30;
  }
}

// Enemy Spacecraft class
class Enemy {
  constructor(x, y, type = 'scout', offset = 0) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.offset = offset; // Used for sine wave synchronization
    this.shootTimer = Math.random() * 2000;
    
    // Set parameters depending on enemy type
    this.maxHealth = 1;
    this.scoreValue = 100;
    this.width = 30;
    this.height = 25;
    this.color = '#ff00aa';
    this.speed = 1;
    this.phase = Math.random() * Math.PI;

    if (type === 'scout') {
      this.maxHealth = 1;
      this.scoreValue = 150;
      this.color = '#ff00aa';
      this.width = 32;
      this.height = 26;
      this.speed = 1.6;
    } else if (type === 'swarmer') {
      this.maxHealth = 3;
      this.scoreValue = 350;
      this.color = '#ffea00';
      this.width = 36;
      this.height = 32;
      this.speed = 1.0;
    } else if (type === 'kamikaze') {
      this.maxHealth = 1;
      this.scoreValue = 250;
      this.color = '#ff003c';
      this.width = 28;
      this.height = 28;
      this.speed = 2.8;
    } else if (type === 'boss') {
      this.maxHealth = 60 + wave * 25; // Massive health scaling
      this.scoreValue = 5000;
      this.color = '#8b00ff';
      this.width = 160;
      this.height = 90;
      this.speed = 1.3;
      this.bossDirection = 1;
    }

    this.health = this.maxHealth;
  }

  update(dt) {
    this.phase += 0.03;

    // Movement Behavior logic based on AI type
    if (this.type === 'scout') {
      // Sweeping sine waves from horizontal position
      this.y += this.speed * 0.8;
      this.x += Math.sin(this.phase) * 1.5;
    } 
    else if (this.type === 'swarmer') {
      // Slow grid swoops downwards
      this.y += this.speed * 0.5;
      this.x += Math.sin(this.phase * 0.5) * 0.5;
    } 
    else if (this.type === 'kamikaze') {
      // Divebombing directly towards the player
      this.y += this.speed;
      if (player && this.y < player.y - 100) {
        // Slowly track/home on player horizontal position
        const targetDx = player.x + player.width / 2 - this.x;
        this.x += Math.sign(targetDx) * 1.2;
      }
    } 
    else if (this.type === 'boss') {
      // Boss floats horizontally at top, diving forward occasionally
      this.x += this.speed * this.bossDirection;
      if (this.x < 40) {
        this.x = 40;
        this.bossDirection = 1;
      }
      if (this.x > CONFIG.width - this.width - 40) {
        this.x = CONFIG.width - this.width - 40;
        this.bossDirection = -1;
      }
      
      // Floating hover movement height wise
      this.y = 80 + Math.sin(this.phase) * 12;
    }

    // Firing logic
    if (gameActive && this.type !== 'kamikaze') {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shoot();
        this.shootTimer = this.type === 'boss' ? (1500 - wave * 100) : (2500 + Math.random() * 3000);
      }
    }
  }

  shoot() {
    if (this.y < 30 || this.y > CONFIG.height - 120) return; // Prevent shooting if offscreen

    if (this.type === 'boss') {
      GameAudio.playBossLaserSound();
      // Boss shoots sweeping sprays
      const centerX = this.x + this.width / 2;
      const bottomY = this.y + this.height - 10;
      enemyLasers.push(new Laser(centerX - 40, bottomY, -1.5, 6, '#8b00ff'));
      enemyLasers.push(new Laser(centerX - 10, bottomY, 0, 7, '#ff003c'));
      enemyLasers.push(new Laser(centerX + 10, bottomY, 0, 7, '#ff003c'));
      enemyLasers.push(new Laser(centerX + 40, bottomY, 1.5, 6, '#8b00ff'));

      // Occasional burst summon
      if (Math.random() < 0.3) {
        enemies.push(new Enemy(this.x + 20, this.y + 40, 'kamikaze'));
        enemies.push(new Enemy(this.x + this.width - 20, this.y + 40, 'kamikaze'));
      }
    } 
    else {
      // Standard enemy lasers
      enemyLasers.push(new Laser(this.x + this.width / 2, this.y + this.height, 0, 5, this.color));
    }
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.fillStyle = '#060312';
    ctx.lineWidth = 2.0;

    if (this.type === 'boss') {
      // Huge multi-phase heavy boss cruiser
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, this.y + this.height); // Center cannon tip
      ctx.lineTo(this.x + this.width / 2 + 35, this.y + this.height - 20);
      ctx.lineTo(this.x + this.width - 25, this.y + this.height - 10); // Starboard thruster tip
      ctx.lineTo(this.x + this.width, this.y + 15);
      ctx.lineTo(this.x + this.width - 40, this.y); // Tail sweep right
      ctx.lineTo(this.x + 40, this.y); // Tail sweep left
      ctx.lineTo(this.x, this.y + 15);
      ctx.lineTo(this.x + 25, this.y + this.height - 10); // Port thruster tip
      ctx.lineTo(this.x + this.width / 2 - 35, this.y + this.height - 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Render glowing energy core in boss center
      ctx.fillStyle = '#ffea00';
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + 35, 16 + Math.sin(this.phase * 2) * 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw secondary details
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x + 45, this.y + 25);
      ctx.lineTo(this.x + this.width - 45, this.y + 25);
      ctx.stroke();

      // Draw Boss health bar overlay directly above
      const barW = this.width;
      const barH = 5;
      const fillW = barW * (this.health / this.maxHealth);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(this.x, this.y - 15, barW, barH);
      ctx.fillStyle = '#8b00ff';
      ctx.fillRect(this.x, this.y - 15, fillW, barH);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(this.x, this.y - 15, barW, barH);
    } 
    else {
      // Standard modular small ships
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, this.y + this.height); // Nose cone down
      ctx.lineTo(this.x + this.width, this.y); // Back right wing
      ctx.lineTo(this.x + this.width / 2, this.y + 6); // Core body indent
      ctx.lineTo(this.x, this.y); // Back left wing
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Mini details based on category
      if (this.type === 'swarmer') {
        ctx.fillStyle = '#ffea00';
        ctx.fillRect(this.x + 10, this.y + 8, 4, 4);
        ctx.fillRect(this.x + this.width - 14, this.y + 8, 4, 4);
      }
    }

    ctx.restore();
  }

  takeDamage(amount) {
    this.health -= amount;
    // Spawn numeric impact indicator
    floatingTexts.push(new FloatingText(this.x + this.width / 2, this.y, `-${amount}`, this.color));
    
    if (this.health <= 0) {
      return true; // Marked for destruction
    }
    GameAudio.playHitSound();
    return false;
  }
}

// Capsule Powerups
class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'TRIPLE_SHOT', 'SHIELD', 'RAPID_FIRE', 'BOMB'
    this.width = 24;
    this.height = 24;
    this.speed = 1.8;
    this.color = '#39ff14';
    this.label = 'P';
    this.phase = 0;

    if (type === 'TRIPLE_SHOT') {
      this.color = '#ffea00';
      this.label = 'T';
    } else if (type === 'SHIELD') {
      this.color = '#ff00aa';
      this.label = 'S';
    } else if (type === 'RAPID_FIRE') {
      this.color = '#00f0ff';
      this.label = 'R';
    } else if (type === 'BOMB') {
      this.color = '#8b00ff';
      this.label = '💣';
    }
  }

  update() {
    this.y += this.speed;
    this.phase += 0.05;
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    
    // Glowing diamond capsule shape
    ctx.strokeStyle = this.color;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 2.0;

    ctx.beginPath();
    ctx.moveTo(this.x + this.width / 2, this.y + Math.sin(this.phase) * 2);
    ctx.lineTo(this.x + this.width, this.y + this.height / 2 + Math.sin(this.phase) * 2);
    ctx.lineTo(this.x + this.width / 2, this.y + this.height + Math.sin(this.phase) * 2);
    ctx.lineTo(this.x, this.y + this.height / 2 + Math.sin(this.phase) * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Render badge letter
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label, this.x + this.width / 2, this.y + this.height / 2 + Math.sin(this.phase) * 2);

    ctx.restore();
  }
}

// Particle System Element (sparks/debris)
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = Math.random() * 2.5 + 1;
    
    // Spread speed velocity
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4.5 + 1.5;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    
    this.alpha = 1.0;
    this.decay = Math.random() * 0.02 + 0.015;
    this.gravity = 0.06;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity; // Gravity pulling debris downwards
    this.alpha -= this.decay;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.shadowBlur = 6;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Floating Damage Numbers / Level Popups
class FloatingText {
  constructor(x, y, text, color = '#00f0ff') {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.vy = -1.2;
    this.alpha = 1.0;
    this.decay = 0.025;
    this.fontSize = 13;
  }

  update() {
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.shadowBlur = 4;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.font = `bold ${this.fontSize}px Orbitron, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

/* ----------------------------------------------------
   CONFIG/GETTER METHODS
   ---------------------------------------------------- */
CONFIG.playerShieldActive = function() {
  return activePowerUps['SHIELD'] && activePowerUps['SHIELD'] > 0;
};

/* ----------------------------------------------------
   BACKGROUND SCROLLING GRID RENDER
   ---------------------------------------------------- */
function drawSynthwaveBackground(dt) {
  // Clear backdrop with dark indigo wash
  ctx.fillStyle = '#03010b';
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

  // Render distant drifting stars
  stars.forEach(star => {
    star.y += star.speed;
    if (star.y > CONFIG.height) {
      star.y = 0;
      star.x = Math.random() * CONFIG.width;
    }
    ctx.fillStyle = star.color;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  });

  // Draw cyber horizon glow line
  const horizonY = 220;
  
  // Radial grid sky gradient glow
  const glowGrad = ctx.createRadialGradient(
    CONFIG.width / 2, horizonY, 0, 
    CONFIG.width / 2, horizonY, CONFIG.height - horizonY
  );
  glowGrad.addColorStop(0, 'rgba(139, 0, 255, 0.25)');
  glowGrad.addColorStop(0.5, 'rgba(255, 0, 170, 0.05)');
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, horizonY, CONFIG.width, CONFIG.height - horizonY);

  // Scrolling Grid Math (Exponential 3D Grid Effect)
  gridOffset += 1.8;
  if (gridOffset >= 60) gridOffset = 0;

  ctx.strokeStyle = 'rgba(255, 0, 170, 0.18)';
  ctx.lineWidth = 1.5;

  // 1. Perspective Converging Vertical Lines
  const centerLineX = CONFIG.width / 2;
  const numLines = 14;
  for (let i = -numLines; i <= numLines; i++) {
    const spacing = 65;
    const startX = centerLineX + i * spacing * 4.5;
    ctx.beginPath();
    ctx.moveTo(centerLineX + i * 2, horizonY);
    ctx.lineTo(startX, CONFIG.height);
    ctx.stroke();
  }

  // 2. Scrolling Exponential Horizontal Lines
  for (let y = 0; y < 14; y++) {
    // Generate exponential curvature spacing
    const py = Math.pow(y / 14, 2.5) * (CONFIG.height - horizonY) + horizonY + gridOffset;
    if (py <= CONFIG.height && py >= horizonY) {
      const alpha = ((py - horizonY) / (CONFIG.height - horizonY)) * 0.28; // Fade into horizon
      ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(CONFIG.width, py);
      ctx.stroke();
    }
  }

  // Neon glowing dividing horizon line
  ctx.save();
  ctx.strokeStyle = '#ff00aa';
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#ff00aa';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(CONFIG.width, horizonY);
  ctx.stroke();
  ctx.restore();
}

/* ----------------------------------------------------
   SPAWNING ENEMY WAVES SYSTEM
   ---------------------------------------------------- */
function handleWaveSpawning(dt) {
  if (enemies.length > 0) return;

  // Wave cleared logic
  if (spawnTimer === 0) {
    // Pause briefly between waves, display level up text
    spawnTimer = setTimeout(() => {
      spawnNextWave();
      spawnTimer = 0;
    }, 2000);

    floatingTexts.push(new FloatingText(CONFIG.width / 2, CONFIG.height / 2 - 40, `WAVE ${wave} INITIATED`, '#ffea00'));
  }
}

function spawnNextWave() {
  playerLasers = [];
  enemyLasers = [];
  powerUps = [];

  // Determine configuration based on Wave index
  if (wave === 5 || wave === 10) {
    // EPIC BOSS ENCOUNTER!
    enemies.push(new Enemy(CONFIG.width / 2 - 80, -100, 'boss'));
    floatingTexts.push(new FloatingText(CONFIG.width / 2, 250, '⚠️ CRITICAL CAP SHIP TARGET IDENTIFIED ⚠️', '#ff003c'));
  } 
  else {
    // Standard wave formation grids
    const rows = Math.min(3 + Math.floor(wave / 2), 5);
    const cols = 6;
    const spacingX = 75;
    const spacingY = 55;
    const startX = CONFIG.width / 2 - ((cols - 1) * spacingX) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * spacingX;
        const y = 60 + r * spacingY;
        
        let type = 'scout';
        if (r === 0 && wave >= 3) {
          type = 'swarmer'; // Multi-hit heavy backlines
        } else if (Math.random() < 0.15 + (wave * 0.03)) {
          type = 'kamikaze'; // Speed dive-bombers
        }

        enemies.push(new Enemy(x, y - 200, type, c * 0.4)); // Stagger spawn depth
      }
    }
  }
}

function triggerScreenShake(intensity) {
  if (!CONFIG.shakeEnabled) return;
  traumaLevel = Math.min(traumaLevel + intensity, 1.0);
}

/* ----------------------------------------------------
   GAME CORE UPDATE LOOP
   ---------------------------------------------------- */
function updateGame(dt) {
  // Update Background Grid (done in drawing step)

  // Update trauma shake value decay
  if (traumaLevel > 0) {
    traumaLevel -= 0.04;
    if (traumaLevel < 0) traumaLevel = 0;
  }

  // Update Player
  if (player) {
    player.update(dt);
  }

  // Update HUD values
  document.getElementById('hud-score').innerText = String(score).padStart(6, '0');
  document.getElementById('hud-wave').innerText = wave;
  const highRecord = Math.max(score, highScore);
  document.getElementById('hud-high-score').innerText = String(highRecord).padStart(6, '0');

  // Update Shield Bar UI
  const fill = document.getElementById('hud-health-fill');
  fill.style.width = `${health}%`;
  
  if (health > 50) {
    fill.className = 'hud-health-fill shield-active';
  } else if (health > 25) {
    fill.className = 'hud-health-fill warning';
  } else {
    fill.className = 'hud-health-fill critical';
  }

  // Update Active Power-ups counters & display UI
  const powerupsHUD = document.getElementById('hud-powerups');
  powerupsHUD.innerHTML = '';
  Object.keys(activePowerUps).forEach(key => {
    if (activePowerUps[key] > 0) {
      activePowerUps[key] -= dt;
      
      const secondsLeft = Math.ceil(activePowerUps[key] / 1000);
      let name = 'SHIELD';
      if (key === 'TRIPLE_SHOT') name = 'TRIPLE';
      if (key === 'RAPID_FIRE') name = 'BOOST';
      
      powerupsHUD.innerHTML += `
        <div class="powerup-badge">
          <span>${name}</span>
          <span class="badge-timer">${secondsLeft}s</span>
        </div>
      `;
      
      if (activePowerUps[key] <= 0) {
        delete activePowerUps[key];
      }
    }
  });

  // Update Player Projectiles
  for (let i = playerLasers.length - 1; i >= 0; i--) {
    const laser = playerLasers[i];
    laser.update();
    if (laser.isOutOfBounds()) {
      playerLasers.splice(i, 1);
    }
  }

  // Update Enemy Projectiles
  for (let i = enemyLasers.length - 1; i >= 0; i--) {
    const laser = enemyLasers[i];
    laser.update();
    if (laser.isOutOfBounds()) {
      enemyLasers.splice(i, 1);
    }
  }

  // Update Enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    enemy.update(dt);
    
    // If enemy flies completely below canvas bounds
    if (enemy.y > CONFIG.height + 40) {
      enemies.splice(i, 1);
      // Take structural damage to player base shield
      health = Math.max(0, health - 15);
      triggerScreenShake(0.3);
      if (health <= 0) {
        triggerPlayerExplosion();
      }
    }
  }

  // Update Floating Texts
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const txt = floatingTexts[i];
    txt.update();
    if (txt.alpha <= 0) {
      floatingTexts.splice(i, 1);
    }
  }

  // Update Floating Capsules
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const pup = powerUps[i];
    pup.update();
    if (pup.y > CONFIG.height + 40) {
      powerUps.splice(i, 1);
    }
  }

  // Update Debris Particles pool
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }

  // Check Collisions
  if (gameActive) {
    handleCollisions();
    handleWaveSpawning(dt);
  }
}

/* ----------------------------------------------------
   COLLISIONS HANDLER
   ---------------------------------------------------- */
function handleCollisions() {
  if (!player) return;

  // 1. Player lasers vs Enemies
  for (let l = playerLasers.length - 1; l >= 0; l--) {
    const laser = playerLasers[l];
    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];

      // AABB Box overlap check
      if (laser.x + laser.width > enemy.x &&
          laser.x - laser.width < enemy.x + enemy.width &&
          laser.y + laser.height > enemy.y &&
          laser.y - laser.height < enemy.y + enemy.height) {
        
        // Remove laser beam
        playerLasers.splice(l, 1);
        
        // Deal damage
        const damageAmount = 1;
        const destroyed = enemy.takeDamage(damageAmount);

        // Spawn hit debris
        spawnSparkParticles(laser.x, laser.y, enemy.color);

        if (destroyed) {
          enemies.splice(e, 1);
          score += enemy.scoreValue;
          GameAudio.playExplosionSound(enemy.type === 'boss' ? 2.0 : 0.8);
          triggerScreenShake(enemy.type === 'boss' ? 0.8 : 0.25);
          
          // Spawn explosion particles
          spawnExplosionParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, enemy.type === 'boss' ? 60 : 15);

          // Spawn random floating capsule powerup
          if (enemy.type === 'boss') {
            wave++;
            floatingTexts.push(new FloatingText(CONFIG.width / 2, CONFIG.height / 2, 'BOSS DESTROYED - PREPARE WING', '#ffea00'));
            powerUps.push(new PowerUp(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 'BOMB'));
          } 
          else if (Math.random() < 0.12) {
            const types = ['TRIPLE_SHOT', 'SHIELD', 'RAPID_FIRE', 'BOMB'];
            const randType = types[Math.floor(Math.random() * types.length)];
            powerUps.push(new PowerUp(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, randType));
          }
        }
        break; // Stop evaluating enemies for this laser
      }
    }
  }

  // 2. Enemy Lasers vs Player
  for (let l = enemyLasers.length - 1; l >= 0; l--) {
    const laser = enemyLasers[l];
    
    // Bounding Box check with player ship bounds
    if (laser.x + laser.width > player.x &&
        laser.x - laser.width < player.x + player.width &&
        laser.y + laser.height > player.y &&
        laser.y - laser.height < player.y + player.height) {
      
      enemyLasers.splice(l, 1);
      damagePlayer(15);
    }
  }

  // 3. Enemies physical collision vs Player
  for (let e = enemies.length - 1; e >= 0; e--) {
    const enemy = enemies[e];
    
    if (player.x + player.width > enemy.x &&
        player.x < enemy.x + enemy.width &&
        player.y + player.height > enemy.y &&
        player.y < enemy.y + enemy.height) {
      
      if (enemy.type !== 'boss') {
        enemies.splice(e, 1);
        spawnExplosionParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, 12);
        GameAudio.playExplosionSound(0.7);
      }
      
      damagePlayer(enemy.type === 'boss' ? 40 : 25);
    }
  }

  // 4. Floating Capsules Pickups
  for (let p = powerUps.length - 1; p >= 0; p--) {
    const pup = powerUps[p];
    
    if (player.x + player.width > pup.x &&
        player.x < pup.x + pup.width &&
        player.y + player.height > pup.y &&
        player.y < pup.y + pup.height) {
      
      powerUps.splice(p, 1);
      applyPowerUp(pup.type);
    }
  }
}

function damagePlayer(amount) {
  if (player.invulnFrames > 0) return;

  if (CONFIG.playerShieldActive()) {
    // Shield absorbs the entire damage hit!
    delete activePowerUps['SHIELD'];
    floatingTexts.push(new FloatingText(player.x + player.width / 2, player.y - 15, 'SHIELD ABSORBED', '#ff00aa'));
    GameAudio.playPowerUpSound();
    player.invulnFrames = 30; // Half second invulnerability
    return;
  }

  health = Math.max(0, health - amount);
  triggerScreenShake(0.5);
  GameAudio.playExplosionSound(0.8);
  spawnExplosionParticles(player.x + player.width / 2, player.y + player.height / 2, '#ff003c', 15);
  player.invulnFrames = 60; // 1 second invulnerability

  if (health <= 0) {
    triggerPlayerExplosion();
  }
}

function applyPowerUp(type) {
  GameAudio.playPowerUpSound();
  floatingTexts.push(new FloatingText(player.x + player.width / 2, player.y - 20, type.replace('_', ' '), '#39ff14'));
  
  if (type === 'BOMB') {
    // Screen clear bomb
    triggerScreenShake(1.0);
    GameAudio.playBombSound();
    
    // Vaporize all small enemies on screen
    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];
      if (enemy.type !== 'boss') {
        enemies.splice(e, 1);
        score += enemy.scoreValue;
        spawnExplosionParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, 12);
      } else {
        // Boss takes heavy direct damage
        enemy.takeDamage(20);
      }
    }
    // Vaporize enemy lasers
    enemyLasers = [];
  } 
  else {
    activePowerUps[type] = 8000; // Duration 8 seconds
  }
}

function spawnSparkParticles(x, y, color) {
  for (let i = 0; i < 4; i++) {
    particles.push(new Particle(x, y, color));
  }
}

function spawnExplosionParticles(x, y, color, count = 15) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color));
  }
}

function triggerPlayerExplosion() {
  gameActive = false;
  GameAudio.playBombSound();
  spawnExplosionParticles(player.x + player.width / 2, player.y + player.height / 2, '#00f0ff', 50);
  spawnExplosionParticles(player.x + player.width / 2, player.y + player.height / 2, '#ff00aa', 30);
  
  setTimeout(() => {
    showGameOverScreen();
  }, 1200);
}

/* ----------------------------------------------------
   CANVAS DRAWING / RENDERING STAGE
   ---------------------------------------------------- */
function drawGame() {
  ctx.save();

  // Screen shake viewport shifts
  if (traumaLevel > 0) {
    const shakeX = (Math.random() * 2 - 1) * traumaLevel * 14;
    const shakeY = (Math.random() * 2 - 1) * traumaLevel * 14;
    ctx.translate(shakeX, shakeY);
  }

  // Draw scrolling grids background
  drawSynthwaveBackground();

  // Draw Enemy lasers
  enemyLasers.forEach(laser => laser.draw());

  // Draw Player lasers
  playerLasers.forEach(laser => laser.draw());

  // Draw Powerups
  powerUps.forEach(pup => pup.draw());

  // Draw Enemies
  enemies.forEach(enemy => enemy.draw());

  // Draw Floating texts
  floatingTexts.forEach(txt => txt.draw());

  // Draw Explosion Debris particles
  particles.forEach(p => p.draw());

  // Draw Player ship
  if (player && health > 0) {
    player.draw();
  }

  ctx.restore();
}

/* ----------------------------------------------------
   GAME CONTROL STATE MACHINE & UI
   ---------------------------------------------------- */

// Main loop requestAnimationFrame
function gameTick(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (gameActive && !gamePaused) {
    updateGame(dt);
  }
  
  drawGame();
  requestAnimationFrame(gameTick);
}

function startGame() {
  GameAudio.init();
  GameAudio.resume();
  GameAudio.startBackgroundMusic();

  // Initialize fresh play variables
  score = 0;
  wave = 1;
  health = 100;
  activePowerUps = {};
  playerLasers = [];
  enemyLasers = [];
  enemies = [];
  powerUps = [];
  particles = [];
  floatingTexts = [];
  
  player = new PlayerShip();
  
  // High score pre-fetches
  const records = getLeaderboard();
  highScore = records.length > 0 ? records[0].score : 0;

  // Toggle Screen Views
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('game-over-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  
  gameActive = true;
  gamePaused = false;
  lastTime = 0;
  
  spawnNextWave();
}

function togglePause() {
  if (!gameActive) return;
  gamePaused = !gamePaused;
  
  const pauseScreen = document.getElementById('pause-screen');
  if (gamePaused) {
    pauseScreen.classList.remove('hidden');
    GameAudio.stopBackgroundMusic();
  } else {
    pauseScreen.classList.add('hidden');
    GameAudio.startBackgroundMusic();
  }
}

function showGameOverScreen() {
  GameAudio.stopBackgroundMusic();
  document.getElementById('hud').classList.add('hidden');
  
  const finalScoreEl = document.getElementById('final-score');
  const finalWaveEl = document.getElementById('final-wave');
  
  finalScoreEl.innerText = String(score).padStart(6, '0');
  finalWaveEl.innerText = wave;

  const inputContainer = document.getElementById('high-score-input-container');
  if (checkNewHighScore(score)) {
    inputContainer.classList.remove('hidden');
    document.getElementById('pilot-name').value = '';
    document.getElementById('pilot-name').focus();
  } else {
    inputContainer.classList.add('hidden');
  }

  document.getElementById('game-over-screen').classList.remove('hidden');
}

// Window Onload wires up UI elements
window.addEventListener('load', () => {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');

  // Hardcode dimensions for exact logical size ratio
  canvas.width = CONFIG.width;
  canvas.height = CONFIG.height;

  // Global Keyboard Event listeners
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') e.preventDefault(); // Stop space bar scrolling
    keys[e.code] = true;

    // Trigger pause on key P
    if (e.code === 'KeyP') {
      togglePause();
    }
  });

  window.addEventListener('keyup', e => {
    keys[e.code] = false;
  });

  // UI Event hooks
  document.getElementById('btn-start').addEventListener('click', () => {
    startGame();
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    // Open system params
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('settings-menu').classList.remove('hidden');
  });

  document.getElementById('btn-settings-back').addEventListener('click', () => {
    document.getElementById('settings-menu').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
  });

  document.getElementById('btn-scores').addEventListener('click', () => {
    updateLeaderboardUI();
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('leaderboard-menu').classList.remove('hidden');
  });

  document.getElementById('btn-scores-back').addEventListener('click', () => {
    document.getElementById('leaderboard-menu').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
  });

  document.getElementById('btn-restart').addEventListener('click', () => {
    startGame();
  });

  document.getElementById('btn-main-menu').addEventListener('click', () => {
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
  });

  document.getElementById('btn-pause-abort').addEventListener('click', () => {
    gameActive = false;
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
  });

  // High score submission
  document.getElementById('btn-submit-score').addEventListener('click', () => {
    const input = document.getElementById('pilot-name');
    const name = input.value.trim() || 'ACE';
    saveHighScore(name, score);
    document.getElementById('high-score-input-container').classList.add('hidden');
    
    // Jump straight to records display
    document.getElementById('game-over-screen').classList.add('hidden');
    updateLeaderboardUI();
    document.getElementById('leaderboard-menu').classList.remove('hidden');
  });

  // Keyboard shortcut for submitting score on Enter
  document.getElementById('pilot-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      document.getElementById('btn-submit-score').click();
    }
  });

  // Settings Sliders & Toggles event wiring
  const sliderMusic = document.getElementById('slider-music');
  const sliderSfx = document.getElementById('slider-sfx');
  const toggleShake = document.getElementById('toggle-shake');
  const toggleScanlines = document.getElementById('toggle-scanlines');

  sliderMusic.addEventListener('input', e => {
    const val = e.target.value;
    document.getElementById('music-vol-val').innerText = `${val}%`;
    GameAudio.setMusicVolume(val);
  });

  sliderSfx.addEventListener('input', e => {
    const val = e.target.value;
    document.getElementById('sfx-vol-val').innerText = `${val}%`;
    GameAudio.setSfxVolume(val);
  });

  toggleShake.addEventListener('change', e => {
    CONFIG.shakeEnabled = e.target.checked;
  });

  toggleScanlines.addEventListener('change', e => {
    const lines = document.querySelector('.scanlines');
    if (e.target.checked) {
      lines.classList.remove('scanlines-disabled');
    } else {
      lines.classList.add('scanlines-disabled');
    }
  });

  // Start executing standard rendering immediately
  requestAnimationFrame(gameTick);
});
