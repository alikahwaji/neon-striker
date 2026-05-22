/* ----------------------------------------------------
   NEON STRIKER - Upgraded Game Engine (V 1.5.0)
   Engine: HTML5 2D Canvas with Neon Glow Effects
   Features: 15 structured Levels (Levels 11-15 Movie Themes),
             Nanotech scrap credits drop + magnetism,
             Hangar Hangar shop, Homing missiles,
             Split physics Asteroids, and Sandworm Boss.
   ---------------------------------------------------- */

// Upgraded game configuration
const CONFIG = {
  width: 800,
  height: 600,
  playerSpeedBase: 5.5,
  playerSpeed: 5.5,
  playerFriction: 0.88,
  laserSpeed: 11,
  laserCooldownBase: 250,
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
let inShop = false;
let inIntro = false;
let score = 0;
let highScore = 0;
let currentLevel = 1;

// Upgrade Levels & Player Core Stats
let scrapCredits = 0;
let maxHealth = 100;
let health = 100;

const playerUpgrades = {
  speed: 1,      // Max level 5
  shield: 1,     // Max level 5
  cooldown: 1,   // Max level 5
  homing: 0      // 0 = Locked, 1 = Unlocked
};

const upgradeCosts = {
  speed: [100, 150, 220, 300, 400],
  shield: [150, 220, 300, 400, 500],
  cooldown: [200, 280, 380, 500, 650],
  homing: 300
};

// Active weapon powerups
let activePowerUps = {};
let nextHomingLaunchTime = 0;

// Trauma Screen Shake trauma level
let traumaLevel = 0;

// Game Entity Pools
let player = null;
let playerLasers = [];
let enemyLasers = [];
let enemies = [];
let powerUps = [];
let particles = [];
let floatingTexts = [];
let scrapItems = [];
let asteroids = [];
let homingMissiles = [];
let wallTurrets = [];

// Scrolling background state
let gridOffset = 0;
const stars = [];

// Level Data - 15 Structured Sectors
const LEVEL_DATABASE = {
  1: {
    title: "LEVEL 1",
    subtitle: "OUTER FRONTIER",
    theme: "standard",
    quote: "A low-threat quadrant on the fringe of the cybernet. Keep scanner arrays active.",
    enemyGrid: { rows: 2, cols: 6, scouts: true, swarmers: false, kamikazes: false }
  },
  2: {
    title: "LEVEL 2",
    subtitle: "ASTEROID SHOWER",
    theme: "standard",
    quote: "Warning: High-density neon asteroid storm detected. Blast or dodge drift fragments.",
    asteroidChance: 0.015,
    enemyGrid: { rows: 2, cols: 5, scouts: true, swarmers: false, kamikazes: false }
  },
  3: {
    title: "LEVEL 3",
    subtitle: "DIVE-BOMBER WING",
    theme: "standard",
    quote: "Red alert! High-speed kamikaze fighters detected. Engage with maximum lateral thrusters.",
    enemyGrid: { rows: 3, cols: 6, scouts: false, swarmers: false, kamikazes: true }
  },
  4: {
    title: "LEVEL 4",
    subtitle: "SHIELD CRUSER INTRUSION",
    theme: "standard",
    quote: "Heavy swarmers incoming. Their outer shields absorb single laser hits. Overcharge active.",
    enemyGrid: { rows: 3, cols: 6, scouts: true, swarmers: true, kamikazes: false }
  },
  5: {
    title: "LEVEL 5",
    subtitle: "DREADNOUGHT CRUISER",
    theme: "standard",
    quote: "⚠️ CRITICAL SECTOR BOSS ⚠️\nThe Dreadnought has breached the perimeter. Destroy its multi-laser core.",
    bossType: "dreadnought"
  },
  6: {
    title: "LEVEL 6",
    subtitle: "QUANTUM PHASE SHIFT",
    theme: "standard",
    quote: "Quantum anomalies detected. Encroaching hostile vessels are phasing in and out of our sensor arrays.",
    enemyGrid: { rows: 3, cols: 6, scouts: true, swarmers: false, kamikazes: true, phaseShips: true }
  },
  7: {
    title: "LEVEL 7",
    subtitle: "HEAT-SEEKING PLASMA SHOWER",
    theme: "standard",
    quote: "Hostile ships have armed lock-on plasma charges that track your lateral coordinates.",
    enemyGrid: { rows: 3, cols: 6, scouts: true, swarmers: true, heatSeekers: true }
  },
  8: {
    title: "LEVEL 8",
    subtitle: "ASTEROID BLITZ",
    theme: "standard",
    quote: "Extreme environment: High-velocity asteroid field combined with kamikaze units.",
    asteroidChance: 0.035,
    enemyGrid: { rows: 2, cols: 4, scouts: false, swarmers: false, kamikazes: true }
  },
  9: {
    title: "LEVEL 9",
    subtitle: "SECTOR ARMAGEDDON",
    theme: "standard",
    quote: "Unstable sector. Heavy cruiser swarms, asteroid showers, and thermal lock-on missiles active.",
    asteroidChance: 0.02,
    enemyGrid: { rows: 4, cols: 6, scouts: true, swarmers: true, kamikazes: true, heatSeekers: true }
  },
  10: {
    title: "LEVEL 10",
    subtitle: "THE CYBER COMMANDER",
    theme: "standard",
    quote: "⚠️ DECISIVE ENCOUNTER ⚠️\nThe AI core flagship has warped in. Brace for orbital bullet hell grids.",
    bossType: "cyber_commander"
  },
  // --- Movie Themed Levels ---
  11: {
    title: "LEVEL 11",
    subtitle: "THE TRENCH RUN",
    theme: "trench",
    quote: "'Stay on target...' Narrow death conduit active. Sidewall defense turrets armed.",
    trenchWalls: true,
    enemyGrid: { rows: 2, cols: 4, scouts: true, swarmers: false, kamikazes: false }
  },
  12: {
    title: "LEVEL 12",
    subtitle: "XENOMORPH HIVE",
    theme: "organic",
    quote: "'They're coming out of the walls!' Warning: Blasting organic egg pulsars releases fast larval facehugger drones.",
    hatchingPods: true,
    enemyGrid: { rows: 2, cols: 5, scouts: true, swarmers: false, kamikazes: false }
  },
  13: {
    title: "LEVEL 13",
    subtitle: "GARGANTUA EVENT HORIZON",
    theme: "gargantua",
    quote: "'This little maneuver is gonna cost us 51 years.' The gravity well exerts a constant pull. Do not fall in.",
    blackHole: true,
    enemyGrid: { rows: 2, cols: 6, scouts: true, swarmers: true, kamikazes: false }
  },
  14: {
    title: "LEVEL 14",
    subtitle: "HAL 9000 DATA CORE",
    theme: "standard",
    quote: "'I'm sorry, Dave. I'm afraid I can't do that.' Indestructible Monolith block shields active. HAL core eye observing.",
    halEye: true,
    enemyGrid: { rows: 2, cols: 5, scouts: true, swarmers: false, kamikazes: true }
  },
  15: {
    title: "LEVEL 15",
    subtitle: "ARRAKIS SPICE ORBIT",
    theme: "spice",
    quote: "'The Spice must flow!' Shimmering sand orbit. Collect gold spice clouds for weapon overcharge. Sandworm cruiser incoming.",
    spiceClouds: true,
    bossType: "sandworm"
  }
};

// Initialize Starfield once
for (let i = 0; i < 70; i++) {
  stars.push({
    x: Math.random() * CONFIG.width,
    y: Math.random() * CONFIG.height,
    speed: Math.random() * 1.6 + 0.4,
    size: Math.random() * 2 + 1,
    color: Math.random() > 0.5 ? '#ff00aa' : '#00f0ff'
  });
}

/* ----------------------------------------------------
   LEADERBOARD STORAGE HANDLERS
   ---------------------------------------------------- */
function getLeaderboard() {
  let board = localStorage.getItem('neon_striker_high_scores');
  if (!board) {
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
  // Always save locally first as double-redundancy safety net
  const board = getLeaderboard();
  board.push({ name: name.toUpperCase().slice(0, 3), score: scoreVal });
  const sorted = board.sort((a, b) => b.score - a.score).slice(0, 8);
  localStorage.setItem('neon_striker_high_scores', JSON.stringify(sorted));

  // If Firebase database is active, push the score to Firestore globally!
  if (window.firebaseEnabled) {
    window.saveGlobalHighScore(name, scoreVal);
  }
}

function checkNewHighScore(scoreVal) {
  const board = getLeaderboard();
  if (board.length < 8) return true;
  return scoreVal > board[board.length - 1].score;
}

async function updateLeaderboardUI() {
  const body = document.getElementById('leaderboard-body');
  body.innerHTML = '';
  
  // If Firebase is enabled, attempt to load global scores
  if (window.firebaseEnabled) {
    body.innerHTML = `
      <tr>
        <td colspan="3" class="text-center font-mono neon-blue blinking-text" style="padding: 2.5rem 0;">
          🌐 SYNCING SECTOR ARCHIVES...
        </td>
      </tr>
    `;
    
    try {
      const globalScores = await window.getGlobalHighScores();
      if (globalScores && globalScores.length > 0) {
        body.innerHTML = '';
        globalScores.forEach((record, index) => {
          const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
          body.innerHTML += `
            <tr>
              <td class="${rankClass}">#${index + 1}</td>
              <td class="${rankClass}">🌐 ${record.name}</td>
              <td class="text-right ${rankClass}">${parseInt(record.score).toLocaleString()}</td>
            </tr>
          `;
        });
        return; // Success! We successfully rendered global scores.
      }
    } catch (e) {
      console.warn("Failed to load Firebase scores, falling back to browser archives:", e);
    }
  }
  
  // Local Backup Fallback
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
   GAME CLASSES DEFINITIONS
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

    // Apply level specific physical constraint borders
    let minX = 15;
    let maxX = CONFIG.width - this.width - 15;
    
    const lvlData = LEVEL_DATABASE[currentLevel] || {};
    if (lvlData.trenchWalls) {
      // Trench Run constrains player to middle corridor (200px to 600px)
      minX = 210;
      maxX = 590 - this.width;
    }

    // Boundary check clamping
    if (this.x < minX) {
      this.x = minX;
      this.vx = 0;
    }
    if (this.x > maxX) {
      this.x = maxX;
      this.vx = 0;
    }

    // Interstellar Black Hole gravity pull towards center (400px X coordinate)
    if (lvlData.blackHole) {
      const pullForce = 0.16;
      const pullDir = player.x + player.width / 2 < 400 ? 1 : -1;
      this.vx += pullDir * pullForce;
    }

    // Shooting cannon fires
    if (keys['Space']) {
      this.shoot();
    }

    // Auto launcher homing rocket trigger
    if (playerUpgrades.homing > 0 && gameActive && !gamePaused) {
      const now = Date.now();
      if (now >= nextHomingLaunchTime) {
        this.fireHomingMissile();
        nextHomingLaunchTime = now + 1800; // Auto fires every 1.8 seconds
      }
    }

    if (this.invulnFrames > 0) {
      this.invulnFrames--;
    }
  }

  draw() {
    if (this.invulnFrames > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
      return;
    }

    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = CONFIG.playerShieldActive() ? '#8b00ff' : '#00f0ff';
    ctx.lineWidth = 2.5;

    // Draw main hull shape
    ctx.strokeStyle = '#00f0ff';
    ctx.fillStyle = '#01152a';
    ctx.beginPath();
    ctx.moveTo(this.x + this.width / 2, this.y); // Nose
    ctx.lineTo(this.x + this.width, this.y + this.height); // Wing tip right
    ctx.lineTo(this.x + this.width - 10, this.y + this.height - 8);
    ctx.lineTo(this.x + 10, this.y + this.height - 8);
    ctx.lineTo(this.x, this.y + this.height); // Wing tip left
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw secondary details
    ctx.strokeStyle = '#ff00aa';
    ctx.beginPath();
    ctx.moveTo(this.x + this.width / 2, this.y + 8);
    ctx.lineTo(this.x + this.width - 12, this.y + this.height - 10);
    ctx.lineTo(this.x + 12, this.y + this.height - 10);
    ctx.closePath();
    ctx.stroke();

    // Cockpit
    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.arc(this.x + this.width / 2, this.y + 16, 4, 0, Math.PI * 2);
    ctx.fill();

    // Homing Pod shoulder wings
    if (playerUpgrades.homing > 0) {
      ctx.strokeStyle = '#ffea00';
      ctx.strokeRect(this.x - 6, this.y + 18, 6, 8);
      ctx.strokeRect(this.x + this.width, this.y + 18, 6, 8);
    }

    // Engine flame
    const flameLen = Math.random() * 15 + 10;
    ctx.fillStyle = '#ff00aa';
    ctx.beginPath();
    ctx.moveTo(this.x + 15, this.y + this.height - 6);
    ctx.lineTo(this.x + this.width / 2, this.y + this.height - 6 + flameLen);
    ctx.lineTo(this.x + this.width - 15, this.y + this.height - 6);
    ctx.closePath();
    ctx.fill();

    // Shield bubble
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
      cooldown = CONFIG.laserCooldown * 0.45;
    }

    if (now - this.lastShotTime >= cooldown) {
      this.lastShotTime = now;
      
      const beamColor = activePowerUps['TRIPLE_SHOT'] ? '#ffea00' : '#00f0ff';
      GameAudio.playLaserSound(activePowerUps['RAPID_FIRE'] ? 1.3 : 1.0);

      if (activePowerUps['TRIPLE_SHOT']) {
        playerLasers.push(new Laser(this.x + this.width / 2, this.y, 0, -CONFIG.laserSpeed, beamColor));
        playerLasers.push(new Laser(this.x + 5, this.y + 10, -2.5, -CONFIG.laserSpeed + 1, beamColor));
        playerLasers.push(new Laser(this.x + this.width - 5, this.y + 10, 2.5, -CONFIG.laserSpeed + 1, beamColor));
      } else {
        playerLasers.push(new Laser(this.x + 12, this.y, 0, -CONFIG.laserSpeed, beamColor));
        playerLasers.push(new Laser(this.x + this.width - 12, this.y, 0, -CONFIG.laserSpeed, beamColor));
      }
    }
  }

  fireHomingMissile() {
    if (enemies.length === 0) return;
    
    // Find closest active enemy
    let closestEnemy = null;
    let minDist = Infinity;
    
    enemies.forEach(enemy => {
      if (enemy.y > 0 && enemy.y < CONFIG.height) {
        const dx = enemy.x + enemy.width/2 - (this.x + this.width/2);
        const dy = enemy.y + enemy.height/2 - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < minDist) {
          minDist = dist;
          closestEnemy = enemy;
        }
      }
    });

    if (closestEnemy) {
      GameAudio.playHomingLaunchSound();
      // Launch a rocket from left and right shoulders alternatively
      const rx = Math.random() > 0.5 ? this.x - 3 : this.x + this.width + 3;
      homingMissiles.push(new HomingMissile(rx, this.y + 18, closestEnemy));
    }
  }
}

// Homing Seek Missile
class HomingMissile {
  constructor(x, y, target) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.vx = 0;
    this.vy = -3;
    this.speed = 7.5;
    this.width = 6;
    this.height = 16;
    this.color = '#39ff14'; // Bright green fire
    this.trailTimer = 0;
  }

  update() {
    // Seek Target Vector calculation
    if (this.target && this.target.health > 0 && enemies.includes(this.target)) {
      const tx = this.target.x + this.target.width / 2;
      const ty = this.target.y + this.target.height / 2;
      
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist > 10) {
        const targetVx = (dx / dist) * this.speed;
        const targetVy = (dy / dist) * this.speed;
        
        // Steering factor (curves the rocket trajectory smoothly)
        this.vx += (targetVx - this.vx) * 0.15;
        this.vy += (targetVy - this.vy) * 0.15;
      }
    } else {
      // Find new target if current is destroyed
      let closest = null;
      let minDist = Infinity;
      enemies.forEach(e => {
        const dist = Math.sqrt(Math.pow(e.x - this.x, 2) + Math.pow(e.y - this.y, 2));
        if (dist < minDist) {
          minDist = dist;
          closest = e;
        }
      });
      if (closest) this.target = closest;
    }

    this.x += this.vx;
    this.y += this.vy;

    // Rocket particles trail
    this.trailTimer++;
    if (this.trailTimer % 2 === 0) {
      particles.push(new Particle(this.x, this.y, '#ffea00'));
    }
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    
    // Rotate missile facing travel vector
    const angle = Math.atan2(this.vy, this.vx) + Math.PI / 2;
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);
    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
    
    // Flame nose cone
    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.moveTo(-this.width/2, -this.height/2);
    ctx.lineTo(0, -this.height/2 - 5);
    ctx.lineTo(this.width/2, -this.height/2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  isOutOfBounds() {
    return this.y < -30 || this.y > CONFIG.height + 30 || this.x < -30 || this.x > CONFIG.width + 30;
  }
}

// Laser class
class Laser {
  constructor(x, y, vx, vy, color = '#00f0ff') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
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

// Splitting Physics-Based Asteroid Class
class Asteroid {
  constructor(x, y, size = 'large', vx = null, vy = null) {
    this.x = x;
    this.y = y;
    this.size = size; // 'large', 'medium', 'small'
    this.vy = vy !== null ? vy : Math.random() * 1.5 + 1.2;
    this.vx = vx !== null ? vx : (Math.random() * 1.5 - 0.75);
    
    this.spin = 0;
    this.spinSpeed = Math.random() * 0.04 - 0.02;

    if (size === 'large') {
      this.radius = 35;
      this.maxHealth = 4;
      this.scoreValue = 300;
      this.color = '#00f0ff'; // Neon ice blue rocks
    } else if (size === 'medium') {
      this.radius = 22;
      this.maxHealth = 2;
      this.scoreValue = 150;
      this.color = '#ff00aa'; // Pink
    } else if (size === 'small') {
      this.radius = 12;
      this.maxHealth = 1;
      this.scoreValue = 75;
      this.color = '#ffea00'; // Yellow
    }

    this.health = this.maxHealth;
    this.width = this.radius * 2;
    this.height = this.radius * 2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.spin += this.spinSpeed;

    // Bounce horizontally off side walls
    if (this.x < this.radius || this.x > CONFIG.width - this.radius) {
      this.vx = -this.vx;
    }
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.fillStyle = '#050314';
    ctx.lineWidth = 2.0;

    ctx.translate(this.x, this.y);
    ctx.rotate(this.spin);
    
    // Draw rigid multi-sided vector asteroid outline
    ctx.beginPath();
    const sides = 8;
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      // Stagger radius to create rough rocky shapes
      const variance = 0.8 + (Math.sin(i * 1.7) * 0.15);
      const rx = Math.cos(angle) * this.radius * variance;
      const ry = Math.sin(angle) * this.radius * variance;
      if (i === 0) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cracks details
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(-this.radius/3, this.radius/4);
    ctx.moveTo(0,0);
    ctx.lineTo(this.radius/2, -this.radius/3);
    ctx.stroke();

    ctx.restore();
  }

  takeDamage(amount) {
    this.health -= amount;
    floatingTexts.push(new FloatingText(this.x, this.y, `-${amount}`, this.color));
    
    if (this.health <= 0) {
      return true;
    }
    GameAudio.playHitSound();
    return false;
  }
}

// Enemy Spacecraft class
class Enemy {
  constructor(x, y, type = 'scout', offset = 0) {
    this.x = x;
    this.y = y;
    this.type = type; // 'scout', 'swarmer', 'kamikaze', 'phase', 'heatSeeker', 'boss', 'boss2', 'sandworm'
    this.offset = offset;
    this.shootTimer = Math.random() * 2000;
    
    this.maxHealth = 1;
    this.scoreValue = 100;
    this.width = 30;
    this.height = 25;
    this.color = '#ff00aa';
    this.speed = 1;
    this.phase = Math.random() * Math.PI;

    // Boss & Sandworm parameters
    this.bossDirection = 1;
    this.teleportTimer = 0;
    this.alpha = 1.0; // Phase ships transparency
    this.shieldActive = false; // Sandworm shields

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
    } else if (type === 'phase') { // Level 6 Quantum phase ship
      this.maxHealth = 2;
      this.scoreValue = 400;
      this.color = '#00f0ff';
      this.width = 34;
      this.height = 28;
      this.speed = 1.4;
    } else if (type === 'heatSeeker') { // Level 7 tracking laser shooter
      this.maxHealth = 2;
      this.scoreValue = 500;
      this.color = '#8b00ff';
      this.width = 38;
      this.height = 32;
      this.speed = 1.1;
    } else if (type === 'boss') { // Sector 5 Boss Dreadnought
      this.maxHealth = 60 + currentLevel * 15;
      this.scoreValue = 5000;
      this.color = '#8b00ff';
      this.width = 160;
      this.height = 90;
      this.speed = 1.3;
    } else if (type === 'boss2') { // Sector 10 Boss Cyber Commander
      this.maxHealth = 100 + currentLevel * 20;
      this.scoreValue = 10000;
      this.color = '#ff003c';
      this.width = 180;
      this.height = 100;
      this.speed = 1.5;
    } else if (type === 'sandworm') { // Sector 15 Dune Sandworm Serpentine Boss
      this.maxHealth = 150;
      this.scoreValue = 20000;
      this.color = '#ffb700'; // Gold Sandworm
      this.width = 90;
      this.height = 90;
      this.speed = 2.4;
      this.serpentinePhase = 0;
    }

    this.health = this.maxHealth;
  }

  update(dt) {
    this.phase += 0.035;

    // Movement Behavior AI based on type
    if (this.type === 'scout') {
      this.y += this.speed * 0.8;
      this.x += Math.sin(this.phase) * 1.5;
    } 
    else if (this.type === 'swarmer') {
      this.y += this.speed * 0.55;
      this.x += Math.sin(this.phase * 0.5) * 0.6;
    } 
    else if (this.type === 'kamikaze') {
      this.y += this.speed;
      if (player && this.y < player.y - 120) {
        const targetDx = player.x + player.width / 2 - this.x;
        this.x += Math.sign(targetDx) * 1.4;
      }
    } 
    else if (this.type === 'phase') {
      // Slowly drift down, occasionally fading out of visibility
      this.y += this.speed * 0.7;
      this.x += Math.sin(this.phase * 0.8) * 1.8;
      this.alpha = 0.2 + Math.abs(Math.sin(this.phase * 2)) * 0.8;
    } 
    else if (this.type === 'heatSeeker') {
      // Slowly swoops, homing coordinates
      this.y += this.speed * 0.6;
      this.x += Math.sin(this.phase) * 1.2;
    } 
    else if (this.type === 'boss' || this.type === 'boss2') {
      // Horizontal hover loops
      this.x += this.speed * this.bossDirection;
      if (this.x < 40) {
        this.x = 40;
        this.bossDirection = 1;
      }
      if (this.x > CONFIG.width - this.width - 40) {
        this.x = CONFIG.width - this.width - 40;
        this.bossDirection = -1;
      }
      this.y = 80 + Math.sin(this.phase) * 12;
    } 
    else if (this.type === 'sandworm') {
      // Serpentine wavy flying maneuvers across canvas!
      this.serpentinePhase += 0.02;
      this.x = CONFIG.width / 2 - this.width / 2 + Math.sin(this.serpentinePhase * 2) * (CONFIG.width / 2 - 80);
      this.y = 120 + Math.cos(this.serpentinePhase) * 60;
      
      // Dune sandworm shield flashes periodically
      this.shieldActive = Math.sin(this.serpentinePhase * 4) > 0.4;
    }

    // Firing checks
    if (gameActive && this.type !== 'kamikaze') {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shoot();
        
        if (this.type === 'boss' || this.type === 'boss2') {
          this.shootTimer = 1400 - currentLevel * 80;
        } else if (this.type === 'sandworm') {
          this.shootTimer = 800; // Super fast firing rate
        } else {
          this.shootTimer = 2200 + Math.random() * 2500;
        }
      }
    }
  }

  shoot() {
    if (this.y < 30 || this.y > CONFIG.height - 120) return;

    if (this.type === 'boss') {
      GameAudio.playBossLaserSound();
      const centerX = this.x + this.width / 2;
      const bottomY = this.y + this.height - 10;
      enemyLasers.push(new Laser(centerX - 40, bottomY, -1.8, 6, '#8b00ff'));
      enemyLasers.push(new Laser(centerX - 10, bottomY, 0, 7, '#ff003c'));
      enemyLasers.push(new Laser(centerX + 10, bottomY, 0, 7, '#ff003c'));
      enemyLasers.push(new Laser(centerX + 40, bottomY, 1.8, 6, '#8b00ff'));
    } 
    else if (this.type === 'boss2') {
      GameAudio.playBossLaserSound();
      const centerX = this.x + this.width / 2;
      const bottomY = this.y + this.height - 10;
      
      // Cyber commander shoots circular waves of lasers (5 lasers radial sweep)
      enemyLasers.push(new Laser(centerX, bottomY, 0, 7.5, '#ff003c'));
      enemyLasers.push(new Laser(centerX, bottomY, -2.5, 6.5, '#ff003c'));
      enemyLasers.push(new Laser(centerX, bottomY, 2.5, 6.5, '#ff003c'));
      enemyLasers.push(new Laser(centerX, bottomY, -4.5, 4.5, '#8b00ff'));
      enemyLasers.push(new Laser(centerX, bottomY, 4.5, 4.5, '#8b00ff'));
    } 
    else if (this.type === 'sandworm') {
      GameAudio.playBossLaserSound();
      // Dune Sandworm fires golden plasma cascade
      enemyLasers.push(new Laser(this.x + this.width/2, this.y + this.height, 0, 7, '#ffb700'));
      enemyLasers.push(new Laser(this.x + this.width/2, this.y + this.height, -1.5, 6.5, '#ffb700'));
      enemyLasers.push(new Laser(this.x + this.width/2, this.y + this.height, 1.5, 6.5, '#ffb700'));
    } 
    else if (this.type === 'heatSeeker') {
      // Fires heat-seeking bullet that moves with horizontal angle towards player's current X
      let targetDx = 0;
      if (player) {
        const dx = player.x + player.width/2 - this.x;
        targetDx = Math.sign(dx) * 1.5;
      }
      enemyLasers.push(new Laser(this.x + this.width / 2, this.y + this.height, targetDx, 5, '#ff00aa'));
    }
    else {
      // Standard small lasers
      enemyLasers.push(new Laser(this.x + this.width / 2, this.y + this.height, 0, 5.2, this.color));
    }
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.fillStyle = '#060312';
    ctx.lineWidth = 2.0;

    if (this.type === 'boss') {
      // Dreadnought shape
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, this.y + this.height);
      ctx.lineTo(this.x + this.width / 2 + 35, this.y + this.height - 20);
      ctx.lineTo(this.x + this.width - 25, this.y + this.height - 10);
      ctx.lineTo(this.x + this.width, this.y + 15);
      ctx.lineTo(this.x + this.width - 40, this.y);
      ctx.lineTo(this.x + 40, this.y);
      ctx.lineTo(this.x, this.y + 15);
      ctx.lineTo(this.x + 25, this.y + this.height - 10);
      ctx.lineTo(this.x + this.width / 2 - 35, this.y + this.height - 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Energy core
      ctx.fillStyle = '#ffea00';
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + 35, 16 + Math.sin(this.phase * 2) * 4, 0, Math.PI * 2);
      ctx.fill();
    } 
    else if (this.type === 'boss2') {
      // Cyber Commander flagship (sharp red outline)
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, this.y + this.height);
      ctx.lineTo(this.x + this.width - 15, this.y + this.height - 30);
      ctx.lineTo(this.x + this.width, this.y + 20);
      ctx.lineTo(this.x + this.width - 20, this.y);
      ctx.lineTo(this.x + 20, this.y);
      ctx.lineTo(this.x, this.y + 20);
      ctx.lineTo(this.x + 15, this.y + this.height - 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Shield wings lines
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(this.x + 30, this.y + 20, this.width - 60, 4);
    } 
    else if (this.type === 'sandworm') {
      // Serpentine Dune sandworm visual segmented body
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Golden outer rings
      ctx.strokeStyle = '#ffea00';
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 40, 0, Math.PI * 2);
      ctx.stroke();

      // Inner maw
      ctx.fillStyle = '#ff003c';
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 14 + Math.sin(this.phase * 3) * 3, 0, Math.PI * 2);
      ctx.fill();

      // Shield indicator ring if active
      if (this.shieldActive) {
        ctx.strokeStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 48, 0, Math.PI * 2);
        ctx.stroke();
      }
    } 
    else {
      // Standard small alien shapes
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, this.y + this.height);
      ctx.lineTo(this.x + this.width, this.y);
      ctx.lineTo(this.x + this.width / 2, this.y + 6);
      ctx.lineTo(this.x, this.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Health bar above for Bosses
    if (this.type === 'boss' || this.type === 'boss2' || this.type === 'sandworm') {
      const barW = this.width;
      const barH = 6;
      const fillW = barW * (this.health / this.maxHealth);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(this.x, this.y - 18, barW, barH);
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y - 18, fillW, barH);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(this.x, this.y - 18, barW, barH);
    }

    ctx.restore();
  }

  takeDamage(amount) {
    if (this.type === 'sandworm' && this.shieldActive) {
      // Sandworm shield active - absorbs damage
      floatingTexts.push(new FloatingText(this.x + this.width/2, this.y, 'BLOCKED', '#00f0ff'));
      GameAudio.playHitSound();
      return false;
    }

    this.health -= amount;
    floatingTexts.push(new FloatingText(this.x + this.width / 2, this.y, `-${amount}`, this.color));
    
    if (this.health <= 0) {
      return true;
    }
    GameAudio.playHitSound();
    return false;
  }
}

// Organic Hatching Pod Egg class (Level 12 Alien theme)
class HatchingPod {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 38;
    this.height = 42;
    this.vy = 1.0;
    this.vx = Math.random() * 0.8 - 0.4;
    this.color = '#39ff14'; // Pulsing green eggs
    this.health = 2;
    this.phase = Math.random() * Math.PI;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.phase += 0.05;
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.fillStyle = '#030d04';
    ctx.lineWidth = 2.0;

    // Draw pulsing oval pod
    ctx.translate(this.x + this.width/2, this.y + this.height/2);
    ctx.scale(1.0 + Math.sin(this.phase) * 0.05, 1.0);
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Petal lips details top
    ctx.fillStyle = '#ff00aa';
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.quadraticCurveTo(0, -18, 8, -12);
    ctx.quadraticCurveTo(0, -6, -8, -12);
    ctx.fill();

    ctx.restore();
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) return true;
    GameAudio.playHitSound();
    return false;
  }
}

// Glowing nanotech green scrap drops
class ScrapCredit {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 12;
    this.height = 12;
    this.vy = 1.5;
    this.vx = Math.random() * 2 - 1;
    this.color = '#39ff14'; // Neon Green
    this.phase = Math.random() * Math.PI;
  }

  update() {
    // Magnetism pull to Player ship
    if (player) {
      const px = player.x + player.width / 2;
      const py = player.y + player.height / 2;
      const dx = px - this.x;
      const dy = py - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < 180) { // Magnet radius 180px
        const magnetSpeed = 8.5;
        this.vx += (dx / dist) * magnetSpeed - this.vx;
        this.vy += (dy / dist) * magnetSpeed - this.vy;
      } else {
        // Slow float
        this.vx *= 0.95;
        this.vy = 1.5;
      }
    }

    this.x += this.vx;
    this.y += this.vy;
    this.phase += 0.08;
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;

    ctx.translate(this.x, this.y);
    ctx.rotate(this.phase);
    
    // Draw spinning gear/screw shape
    ctx.fillRect(-4, -4, 8, 8);
    ctx.strokeRect(-4, -4, 8, 8);
    ctx.restore();
  }
}

// Floating Golden Spice Clouds (Level 15 Dune Theme)
class SpiceCloud {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = Math.random() * 10 + 15;
    this.vy = 1.2;
    this.vx = Math.random() * 0.6 - 0.3;
    this.color = '#ffea00'; // Shimmering Gold
    this.phase = Math.random() * Math.PI;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.phase += 0.03;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(this.phase) * 0.15;
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Indestructible Monolith block shields (Level 14 - 2001 Space Odyssey)
class Monolith {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 50;
    this.height = 110; // Tall rectangular slab
    this.vy = 1.2;
    this.vx = 0;
    this.color = '#000'; // Completely Pitch Black!
  }

  update() {
    this.y += this.vy;
  }

  draw() {
    ctx.save();
    // High-tech thin cybernetic borders
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00f0ff';
    ctx.fillStyle = '#000000';
    ctx.lineWidth = 1.5;
    
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeRect(this.x, this.y, this.width, this.height);
    
    // Core glowing monolith central circuit strip
    ctx.fillStyle = '#ff003c';
    ctx.fillRect(this.x + this.width/2 - 1, this.y + 10, 2, this.height - 20);
    ctx.restore();
  }
}

// Side wall glowing defense turrets (Level 11 Trench Run)
class WallTurret {
  constructor(x, y, side = 'left') {
    this.x = x;
    this.y = y;
    this.side = side;
    this.width = 24;
    this.height = 36;
    this.color = '#39ff14'; // Neon Green
    this.shootTimer = 1000 + Math.random() * 2000;
  }

  update(dt) {
    this.y += 1.8; // Grid scroll speed match
    
    if (gameActive && !gamePaused) {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shoot();
        this.shootTimer = 1800 + Math.random() * 1500;
      }
    }
  }

  shoot() {
    if (this.y < 30 || this.y > CONFIG.height - 120) return;
    
    GameAudio.playBossLaserSound();
    // Fires horizontal laser beams sweeping from walls!
    const vxDir = this.side === 'left' ? 7.5 : -7.5;
    enemyLasers.push(new Laser(this.x + (this.side === 'left' ? 24 : -6), this.y + 18, vxDir, 0, '#ff003c'));
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.fillStyle = '#050c05';
    ctx.lineWidth = 2.0;

    ctx.beginPath();
    if (this.side === 'left') {
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + this.width, this.y + 10);
      ctx.lineTo(this.x + this.width, this.y + this.height - 10);
      ctx.lineTo(this.x, this.y + this.height);
    } else {
      ctx.moveTo(this.x + this.width, this.y);
      ctx.lineTo(this.x, this.y + 10);
      ctx.lineTo(this.x, this.y + this.height - 10);
      ctx.lineTo(this.x + this.width, this.y + this.height);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Turret cannon nozzle pointing inwards
    ctx.strokeStyle = '#ff003c';
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    if (this.side === 'left') {
      ctx.moveTo(this.x + this.width, this.y + 18);
      ctx.lineTo(this.x + this.width + 12, this.y + 18);
    } else {
      ctx.moveTo(this.x, this.y + 18);
      ctx.lineTo(this.x - 12, this.y + 18);
    }
    ctx.stroke();

    ctx.restore();
  }
}

// Floating Capsules Powerup
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

    if (type === 'TRIPLE_SHOT') { this.color = '#ffea00'; this.label = 'T'; }
    else if (type === 'SHIELD') { this.color = '#ff00aa'; this.label = 'S'; }
    else if (type === 'RAPID_FIRE') { this.color = '#00f0ff'; this.label = 'R'; }
    else if (type === 'BOMB') { this.color = '#8b00ff'; this.label = '💣'; }
  }

  update() {
    this.y += this.speed;
    this.phase += 0.05;
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
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
    this.vy += this.gravity;
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

// Floating Damage Numbers
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
function drawSynthwaveBackground() {
  const lvlData = LEVEL_DATABASE[currentLevel] || {};
  
  // Set backdrop colors based on level style
  if (lvlData.theme === 'spice') {
    ctx.fillStyle = '#0d0801'; // Gold Sand Orbit backdrop
  } else if (lvlData.theme === 'organic') {
    ctx.fillStyle = '#010603'; // Alien dark green nest backdrop
  } else {
    ctx.fillStyle = '#03010b';
  }
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

  // Render drifting stars
  stars.forEach(star => {
    star.y += star.speed;
    if (star.y > CONFIG.height) {
      star.y = 0;
      star.x = Math.random() * CONFIG.width;
    }
    
    if (lvlData.theme === 'spice') {
      ctx.fillStyle = '#ffea00'; // Gold star sand particles
    } else {
      ctx.fillStyle = star.color;
    }
    ctx.fillRect(star.x, star.y, star.size, star.size);
  });

  const horizonY = 220;

  // Interstellar central black hole event horizon
  if (lvlData.blackHole) {
    ctx.save();
    const cx = 400;
    const cy = horizonY;
    
    // Event horizon accretion disk radial swirl
    const swirl = ctx.createRadialGradient(cx, cy, 2, cx, cy, 140);
    swirl.addColorStop(0, '#000');
    swirl.addColorStop(0.2, '#000');
    swirl.addColorStop(0.28, '#ffea00'); // Accretion disk edge
    swirl.addColorStop(0.55, 'rgba(139, 0, 255, 0.15)');
    swirl.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.fillStyle = swirl;
    ctx.beginPath();
    ctx.arc(cx, cy, 140, 0, Math.PI * 2);
    ctx.fill();
    
    // Pitch black sphere center hole
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
  }

  // 2001 HAL 9000 glowing red sensor lens on horizon center
  if (lvlData.halEye) {
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff003c';
    ctx.fillStyle = '#ff003c';
    ctx.beginPath();
    ctx.arc(CONFIG.width / 2, horizonY - 10, 15 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.arc(CONFIG.width / 2, horizonY - 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Set grid lines colors
  let gridLineCol1 = 'rgba(255, 0, 170, 0.18)';
  let gridLineCol2 = 'rgba(0, 240, 255, ';
  
  if (lvlData.theme === 'spice') {
    gridLineCol1 = 'rgba(255, 183, 0, 0.2)';
    gridLineCol2 = 'rgba(255, 234, 0, ';
  } else if (lvlData.theme === 'organic') {
    gridLineCol1 = 'rgba(57, 255, 20, 0.15)';
    gridLineCol2 = 'rgba(0, 240, 255, ';
  }

  // Radial grid sky gradient glow
  if (!lvlData.blackHole) {
    const glowGrad = ctx.createRadialGradient(
      CONFIG.width / 2, horizonY, 0, 
      CONFIG.width / 2, horizonY, CONFIG.height - horizonY
    );
    if (lvlData.theme === 'spice') {
      glowGrad.addColorStop(0, 'rgba(255, 183, 0, 0.2)');
    } else {
      glowGrad.addColorStop(0, 'rgba(139, 0, 255, 0.25)');
    }
    glowGrad.addColorStop(0.5, 'rgba(255, 0, 170, 0.05)');
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, horizonY, CONFIG.width, CONFIG.height - horizonY);
  }

  // Grid offsets
  gridOffset += 1.8;
  if (gridOffset >= 60) gridOffset = 0;

  ctx.strokeStyle = gridLineCol1;
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
    const py = Math.pow(y / 14, 2.5) * (CONFIG.height - horizonY) + horizonY + gridOffset;
    if (py <= CONFIG.height && py >= horizonY) {
      const alpha = ((py - horizonY) / (CONFIG.height - horizonY)) * 0.28;
      ctx.strokeStyle = `${gridLineCol2}${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(CONFIG.width, py);
      ctx.stroke();
    }
  }

  // Draw Trench walls borders for Level 11 (Star Wars Conduit)
  if (lvlData.trenchWalls) {
    ctx.save();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#39ff14';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#39ff14';

    // Left wall
    ctx.beginPath();
    ctx.moveTo(200, 0);
    ctx.lineTo(200, CONFIG.height);
    ctx.stroke();

    // Right wall
    ctx.beginPath();
    ctx.moveTo(600, 0);
    ctx.lineTo(600, CONFIG.height);
    ctx.stroke();

    // Left wall horizontal cross indicators
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.25)';
    ctx.lineWidth = 1;
    for (let py = 0; py < CONFIG.height; py += 40) {
      ctx.beginPath();
      ctx.moveTo(0, py + (gridOffset % 40));
      ctx.lineTo(200, py + (gridOffset % 40));
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(600, py + (gridOffset % 40));
      ctx.lineTo(CONFIG.width, py + (gridOffset % 40));
      ctx.stroke();
    }

    ctx.restore();
  }

  // Horizon Line
  ctx.save();
  ctx.strokeStyle = lvlData.theme === 'spice' ? '#ffea00' : '#ff00aa';
  ctx.shadowBlur = 10;
  ctx.shadowColor = lvlData.theme === 'spice' ? '#ffea00' : '#ff00aa';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(CONFIG.width, horizonY);
  ctx.stroke();
  ctx.restore();
}

/* ----------------------------------------------------
   SPAWNING ENEMY WAVES & LEVELS SYSTEM
   ---------------------------------------------------- */
function handleWaveSpawning(dt) {
  // Level cleared checks
  if (enemies.length === 0 && asteroids.length === 0 && scrapItems.length === 0) {
    if (!inShop && !inIntro) {
      triggerLevelClear();
    }
  }

  // Random Asteroid drops check (Level 2, 8, 9)
  const lvlData = LEVEL_DATABASE[currentLevel] || {};
  if (lvlData.asteroidChance && gameActive && !gamePaused) {
    if (Math.random() < lvlData.asteroidChance) {
      const rx = Math.random() * (CONFIG.width - 80) + 40;
      asteroids.push(new Asteroid(rx, -40, 'large'));
    }
  }

  // Level 12 Creepy Egg pulser drops chance
  if (lvlData.hatchingPods && gameActive && !gamePaused && enemies.length < 5) {
    if (Math.random() < 0.005) {
      const rx = Math.random() * (CONFIG.width - 100) + 50;
      enemies.push(new HatchingPod(rx, -40));
    }
  }

  // Level 15 Spice Cloud spawners
  if (lvlData.spiceClouds && gameActive && !gamePaused) {
    if (Math.random() < 0.015) {
      const rx = Math.random() * (CONFIG.width - 60) + 30;
      powerUps.push(new SpiceCloud(rx, -40));
    }
  }

  // Trench Wall Turrets Spawning (Level 11)
  if (lvlData.trenchWalls && gameActive && !gamePaused) {
    if (Math.random() < 0.008) {
      const side = Math.random() > 0.5 ? 'left' : 'right';
      const rx = side === 'left' ? 176 : 600;
      wallTurrets.push(new WallTurret(rx, -40, side));
    }
  }
}

function triggerLevelClear() {
  gameActive = false;
  GameAudio.playLevelClearSound();
  
  // Save current stats to upgrade hangar
  document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;
  
  // Transition to Nanotech Upgrade Hangar Shop Modal
  setTimeout(() => {
    openUpgradeHangar();
  }, 1000);
}

function openUpgradeHangar() {
  inShop = true;
  document.getElementById('hud').classList.add('hidden');
  
  // Update shop text variables
  document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;
  updateHangarUI();
  
  document.getElementById('shop-menu').classList.remove('hidden');
}

function updateHangarUI() {
  // Update speed stats
  const speedLvl = playerUpgrades.speed;
  const speedCost = upgradeCosts.speed[speedLvl - 1] || 'MAX';
  document.getElementById('lvl-speed').innerText = `LVL ${speedLvl}`;
  document.getElementById('price-speed').innerText = speedLvl >= 5 ? 'MAXED' : `⚙️ ${speedCost}`;
  document.getElementById('btn-buy-speed').disabled = speedLvl >= 5 || scrapCredits < speedCost;

  // Update shield stats
  const shieldLvl = playerUpgrades.shield;
  const shieldCost = upgradeCosts.shield[shieldLvl - 1] || 'MAX';
  document.getElementById('lvl-shield').innerText = `LVL ${shieldLvl}`;
  document.getElementById('price-shield').innerText = shieldLvl >= 5 ? 'MAXED' : `⚙️ ${shieldCost}`;
  document.getElementById('btn-buy-shield').disabled = shieldLvl >= 5 || scrapCredits < shieldCost;

  // Update cooldown stats
  const cooldownLvl = playerUpgrades.cooldown;
  const cooldownCost = upgradeCosts.cooldown[cooldownLvl - 1] || 'MAX';
  document.getElementById('lvl-cooldown').innerText = `LVL ${cooldownLvl}`;
  document.getElementById('price-cooldown').innerText = cooldownLvl >= 5 ? 'MAXED' : `⚙️ ${cooldownCost}`;
  document.getElementById('btn-buy-cooldown').disabled = cooldownLvl >= 5 || scrapCredits < cooldownCost;

  // Update Homing Launcher stats
  const homingCost = upgradeCosts.homing;
  const unlocked = playerUpgrades.homing > 0;
  document.getElementById('lvl-homing').innerText = unlocked ? 'UNLOCKED' : 'LOCKED';
  document.getElementById('price-homing').innerText = unlocked ? 'MAXED' : `⚙️ ${homingCost}`;
  document.getElementById('btn-buy-homing').disabled = unlocked || scrapCredits < homingCost;
}

function exitHangarAndLaunch() {
  document.getElementById('shop-menu').classList.add('hidden');
  inShop = false;
  
  // Sector Level advance!
  currentLevel++;
  if (currentLevel > 15) {
    // Campaign victory loop reset harder
    currentLevel = 1;
  }
  
  loadAndStartLevel();
}

function loadAndStartLevel() {
  inIntro = true;
  
  const lvlData = LEVEL_DATABASE[currentLevel] || LEVEL_DATABASE[1];
  
  // Set Soundtrack BGM Theme
  GameAudio.setTheme(lvlData.theme);
  GameAudio.startBackgroundMusic();

  // Reset collections
  playerLasers = [];
  enemyLasers = [];
  enemies = [];
  powerUps = [];
  particles = [];
  floatingTexts = [];
  scrapItems = [];
  asteroids = [];
  homingMissiles = [];
  wallTurrets = [];

  // Reset player position
  if (player) {
    player.x = CONFIG.width / 2 - player.width / 2;
    player.vx = 0;
  }

  // Display Level Intro screen
  const introScreen = document.getElementById('level-intro-screen');
  document.getElementById('level-intro-title').innerText = lvlData.title;
  document.getElementById('level-intro-subtitle').innerText = lvlData.subtitle;
  document.getElementById('level-intro-quote').innerText = lvlData.quote;

  introScreen.classList.remove('hidden');

  setTimeout(() => {
    // Fade out intro, start combat loop
    introScreen.classList.add('hidden');
    inIntro = false;
    document.getElementById('hud').classList.remove('hidden');
    gameActive = true;
    gamePaused = false;
    
    spawnCampaignForces(lvlData);
  }, 3200);
}

function spawnCampaignForces(lvlData) {
  if (lvlData.bossType) {
    // Spawn designated sector boss Cruiser
    enemies.push(new Enemy(CONFIG.width / 2 - 80, -120, lvlData.bossType === 'sandworm' ? 'sandworm' : lvlData.bossType === 'cyber_commander' ? 'boss2' : 'boss'));
  } 
  else if (lvlData.enemyGrid) {
    const grid = lvlData.enemyGrid;
    const spacingX = 75;
    const spacingY = 55;
    const startX = CONFIG.width / 2 - ((grid.cols - 1) * spacingX) / 2;

    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const x = startX + c * spacingX;
        const y = 60 + r * spacingY;
        
        let type = 'scout';
        if (grid.phaseShips && Math.random() < 0.3) {
          type = 'phase';
        } else if (grid.heatSeekers && Math.random() < 0.25) {
          type = 'heatSeeker';
        } else if (grid.swarmers && r === 0) {
          type = 'swarmer';
        } else if (grid.kamikazes) {
          type = 'kamikaze';
        }

        enemies.push(new Enemy(x, y - 250, type, c * 0.45));
      }
    }
  }

  // Pre-spawn asteroid grids in high blitz levels
  if (currentLevel === 8) {
    asteroids.push(new Asteroid(150, -60, 'large'));
    asteroids.push(new Asteroid(450, -180, 'medium'));
    asteroids.push(new Asteroid(650, -100, 'large'));
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
  // trauma decay
  if (traumaLevel > 0) {
    traumaLevel -= 0.04;
    if (traumaLevel < 0) traumaLevel = 0;
  }

  // Update Player
  if (player) {
    player.update(dt);
  }

  // Update HUD HUD values
  document.getElementById('hud-score').innerText = String(score).padStart(6, '0');
  document.getElementById('hud-wave').innerText = currentLevel;
  document.getElementById('hud-scrap').innerText = `⚙️ ${String(scrapCredits).padStart(3, '0')}`;
  const highRecord = Math.max(score, highScore);
  document.getElementById('hud-high-score').innerText = String(highRecord).padStart(6, '0');

  // Update Health Bar UI
  const fill = document.getElementById('hud-health-fill');
  const healthPercent = (health / maxHealth) * 100;
  fill.style.width = `${healthPercent}%`;
  
  if (healthPercent > 50) {
    fill.className = 'hud-health-fill shield-active';
  } else if (healthPercent > 25) {
    fill.className = 'hud-health-fill warning';
  } else {
    fill.className = 'hud-health-fill critical';
  }

  // Update active powerups
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

  // Update Projectiles
  for (let i = playerLasers.length - 1; i >= 0; i--) {
    const laser = playerLasers[i];
    laser.update();
    if (laser.isOutOfBounds()) playerLasers.splice(i, 1);
  }

  for (let i = enemyLasers.length - 1; i >= 0; i--) {
    const laser = enemyLasers[i];
    laser.update();
    if (laser.isOutOfBounds()) enemyLasers.splice(i, 1);
  }

  // Update Homing Missiles
  for (let i = homingMissiles.length - 1; i >= 0; i--) {
    const missile = homingMissiles[i];
    missile.update();
    if (missile.isOutOfBounds()) homingMissiles.splice(i, 1);
  }

  // Update Asteroids
  for (let i = asteroids.length - 1; i >= 0; i--) {
    const ast = asteroids[i];
    ast.update();
    
    if (ast.y > CONFIG.height + 40) {
      asteroids.splice(i, 1);
      // Damaging structural base
      damagePlayer(10);
    }
  }

  // Update Wall Turrets
  for (let i = wallTurrets.length - 1; i >= 0; i--) {
    const turret = wallTurrets[i];
    turret.update(dt);
    if (turret.y > CONFIG.height + 40) {
      wallTurrets.splice(i, 1);
    }
  }

  // Update Nanotech scrap drops
  for (let i = scrapItems.length - 1; i >= 0; i--) {
    const scrap = scrapItems[i];
    scrap.update();
    if (scrap.y > CONFIG.height + 40) {
      scrapItems.splice(i, 1);
    }
  }

  // Update Enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    enemy.update(dt);
    
    if (enemy.y > CONFIG.height + 40) {
      enemies.splice(i, 1);
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
    if (txt.alpha <= 0) floatingTexts.splice(i, 1);
  }

  // Update Power-ups
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const pup = powerUps[i];
    pup.update();
    if (pup.y > CONFIG.height + 40) powerUps.splice(i, 1);
  }

  // Update Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    if (p.alpha <= 0) particles.splice(i, 1);
  }

  // Check Collisions
  if (gameActive) {
    handleCollisions();
    handleWaveSpawning(dt);
  }
}

/* ----------------------------------------------------
   COLLISIONS HANDLING ALGORITHMS
   ---------------------------------------------------- */
function handleCollisions() {
  if (!player) return;

  // 1. Player lasers vs Enemies / Eggs
  for (let l = playerLasers.length - 1; l >= 0; l--) {
    const laser = playerLasers[l];
    let hitSomething = false;

    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];

      if (laser.x + laser.width > enemy.x &&
          laser.x - laser.width < enemy.x + enemy.width &&
          laser.y + laser.height > enemy.y &&
          laser.y - laser.height < enemy.y + enemy.height) {
        
        playerLasers.splice(l, 1);
        hitSomething = true;
        
        const destroyed = enemy.takeDamage(1);
        spawnSparkParticles(laser.x, laser.y, enemy.color);

        if (destroyed) {
          enemies.splice(e, 1);
          score += enemy.scoreValue;
          GameAudio.playExplosionSound(enemy.type.startsWith('boss') ? 2.2 : 0.85);
          triggerScreenShake(enemy.type.startsWith('boss') ? 0.9 : 0.25);
          
          spawnExplosionParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, enemy.type.startsWith('boss') ? 60 : 15);

          // Egg Hatch facehugger drones! (Level 12 Alien)
          if (enemy instanceof HatchingPod) {
            spawnFacehuggerDrones(enemy.x + enemy.width/2, enemy.y + enemy.height/2);
          } 
          else {
            // Drop Nanotech scrap credits drops
            const dropCount = enemy.type.startsWith('boss') ? 12 : enemy.type === 'swarmer' ? 3 : 1;
            for (let d = 0; d < dropCount; d++) {
              scrapItems.push(new ScrapCredit(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2));
            }

            // Powerups drops chance
            if (Math.random() < 0.12) {
              const types = ['TRIPLE_SHOT', 'SHIELD', 'RAPID_FIRE', 'BOMB'];
              const randType = types[Math.floor(Math.random() * types.length)];
              powerUps.push(new PowerUp(enemy.x + enemy.width/2, enemy.y + enemy.height/2, randType));
            }
          }
        }
        break;
      }
    }

    if (hitSomething) continue;

    // Player lasers vs Asteroids
    for (let a = asteroids.length - 1; a >= 0; a--) {
      const ast = asteroids[a];
      const dist = Math.sqrt(Math.pow(laser.x - ast.x, 2) + Math.pow(laser.y - ast.y, 2));
      
      if (dist < ast.radius + laser.width) {
        playerLasers.splice(l, 1);
        
        const destroyed = ast.takeDamage(1);
        spawnSparkParticles(laser.x, laser.y, ast.color);

        if (destroyed) {
          asteroids.splice(a, 1);
          score += ast.scoreValue;
          GameAudio.playExplosionSound(ast.size === 'large' ? 1.4 : 0.8);
          triggerScreenShake(ast.size === 'large' ? 0.5 : 0.25);
          
          spawnExplosionParticles(ast.x, ast.y, ast.color, ast.size === 'large' ? 25 : 12);
          
          // Split asteroid physics
          if (ast.size === 'large') {
            asteroids.push(new Asteroid(ast.x - 15, ast.y, 'medium', -1.2, ast.vy + 0.3));
            asteroids.push(new Asteroid(ast.x + 15, ast.y, 'medium', 1.2, ast.vy + 0.3));
          } else if (ast.size === 'medium') {
            asteroids.push(new Asteroid(ast.x - 10, ast.y, 'small', -1.8, ast.vy + 0.5));
            asteroids.push(new Asteroid(ast.x + 10, ast.y, 'small', 1.8, ast.vy + 0.5));
          } else {
            // Drop credits on small ones
            scrapItems.push(new ScrapCredit(ast.x, ast.y));
          }
        }
        break;
      }
    }
  }

  // 2. Homing Missiles vs Enemies / Asteroids
  for (let m = homingMissiles.length - 1; m >= 0; m--) {
    const missile = homingMissiles[m];
    let exploded = false;

    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];
      
      if (missile.x > enemy.x && missile.x < enemy.x + enemy.width &&
          missile.y > enemy.y && missile.y < enemy.y + enemy.height) {
        
        homingMissiles.splice(m, 1);
        exploded = true;
        
        const destroyed = enemy.takeDamage(3); // Homing missile deals massive damage
        spawnExplosionParticles(missile.x, missile.y, '#ffea00', 8);

        if (destroyed) {
          enemies.splice(e, 1);
          score += enemy.scoreValue;
          GameAudio.playExplosionSound(enemy.type.startsWith('boss') ? 2.2 : 0.85);
          triggerScreenShake(enemy.type.startsWith('boss') ? 0.9 : 0.25);
          spawnExplosionParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, enemy.type.startsWith('boss') ? 60 : 15);
          
          if (enemy instanceof HatchingPod) {
            spawnFacehuggerDrones(enemy.x + enemy.width/2, enemy.y + enemy.height/2);
          } else {
            scrapItems.push(new ScrapCredit(enemy.x + enemy.width/2, enemy.y + enemy.height/2));
            scrapItems.push(new ScrapCredit(enemy.x + enemy.width/2, enemy.y + enemy.height/2));
          }
        }
        break;
      }
    }

    if (exploded) continue;

    // Homing Missile vs Asteroids
    for (let a = asteroids.length - 1; a >= 0; a--) {
      const ast = asteroids[a];
      const dist = Math.sqrt(Math.pow(missile.x - ast.x, 2) + Math.pow(missile.y - ast.y, 2));
      
      if (dist < ast.radius + 3) {
        homingMissiles.splice(m, 1);
        
        const destroyed = ast.takeDamage(3);
        spawnExplosionParticles(missile.x, missile.y, ast.color, 12);

        if (destroyed) {
          asteroids.splice(a, 1);
          score += ast.scoreValue;
          GameAudio.playExplosionSound(ast.size === 'large' ? 1.4 : 0.8);
          triggerScreenShake(ast.size === 'large' ? 0.5 : 0.25);
          spawnExplosionParticles(ast.x, ast.y, ast.color, ast.size === 'large' ? 25 : 12);
          
          if (ast.size === 'large') {
            asteroids.push(new Asteroid(ast.x - 15, ast.y, 'medium', -1.2, ast.vy + 0.3));
            asteroids.push(new Asteroid(ast.x + 15, ast.y, 'medium', 1.2, ast.vy + 0.3));
          } else if (ast.size === 'medium') {
            asteroids.push(new Asteroid(ast.x - 10, ast.y, 'small', -1.8, ast.vy + 0.5));
            asteroids.push(new Asteroid(ast.x + 10, ast.y, 'small', 1.8, ast.vy + 0.5));
          }
        }
        break;
      }
    }
  }

  // 3. Enemy Lasers vs Player
  for (let l = enemyLasers.length - 1; l >= 0; l--) {
    const laser = enemyLasers[l];
    
    if (laser.x + laser.width > player.x &&
        laser.x - laser.width < player.x + player.width &&
        laser.y + laser.height > player.y &&
        laser.y - laser.height < player.y + player.height) {
      
      enemyLasers.splice(l, 1);
      damagePlayer(15);
    }
  }

  // 4. Floating Scrap Capsule Collection
  for (let s = scrapItems.length - 1; s >= 0; s--) {
    const scrap = scrapItems[s];
    
    if (scrap.x + scrap.width > player.x &&
        scrap.x < player.x + player.width &&
        scrap.y + scrap.height > player.y &&
        scrap.y < player.y + player.height) {
      
      scrapItems.splice(s, 1);
      scrapCredits += 10;
      floatingTexts.push(new FloatingText(scrap.x, scrap.y - 10, "+10 ⚙️", '#39ff14'));
      GameAudio.playHitSound();
    }
  }

  // 5. Spice Clouds collections (Dune)
  for (let p = powerUps.length - 1; p >= 0; p--) {
    const pup = powerUps[p];
    if (pup instanceof SpiceCloud) {
      const dist = Math.sqrt(Math.pow(player.x + player.width/2 - pup.x, 2) + Math.pow(player.y + player.height/2 - pup.y, 2));
      if (dist < pup.radius + 18) {
        powerUps.splice(p, 1);
        GameAudio.playPowerUpSound();
        floatingTexts.push(new FloatingText(player.x + player.width/2, player.y - 15, "SPICE WEAPON OVERCHARGE!", '#ffea00'));
        activePowerUps['RAPID_FIRE'] = 4000;
        activePowerUps['TRIPLE_SHOT'] = 4000;
      }
    } 
    else if (player.x + player.width > pup.x &&
             player.x < pup.x + pup.width &&
             player.y + player.height > pup.y &&
             player.y < pup.y + pup.height) {
      
      powerUps.splice(p, 1);
      applyPowerUp(pup.type);
    }
  }

  // 6. Monolith Slabs Collide and Block Player/Lasers (HAL-9000 level 14)
  for (let m = asteroids.length - 1; m >= 0; m--) {
    const ast = asteroids[m];
    if (ast instanceof Monolith) {
      // Monolith vs Player lasers blocks
      for (let l = playerLasers.length - 1; l >= 0; l--) {
        const laser = playerLasers[l];
        if (laser.x > ast.x && laser.x < ast.x + ast.width &&
            laser.y > ast.y && laser.y < ast.y + ast.height) {
          playerLasers.splice(l, 1);
          spawnSparkParticles(laser.x, laser.y, '#ff003c');
          GameAudio.playHitSound();
        }
      }
      
      // Monolith vs Player Ship bounds collide
      if (player.x + player.width > ast.x && player.x < ast.x + ast.width &&
          player.y + player.height > ast.y && player.y < ast.y + ast.height) {
        damagePlayer(25);
        // Force bounce push-back
        player.vx = player.x + player.width/2 < ast.x + ast.width/2 ? -5 : 5;
      }
    }
  }

  // 7. Physical Asteroids Collisions vs Player / Enemies
  for (let a = asteroids.length - 1; a >= 0; a--) {
    const ast = asteroids[a];
    if (ast instanceof Monolith) continue;
    
    // Asteroid vs Player
    const distPlayer = Math.sqrt(Math.pow(player.x + player.width/2 - ast.x, 2) + Math.pow(player.y + player.height/2 - ast.y, 2));
    if (distPlayer < ast.radius + 18) {
      asteroids.splice(a, 1);
      spawnExplosionParticles(ast.x, ast.y, ast.color, 12);
      damagePlayer(ast.size === 'large' ? 35 : ast.size === 'medium' ? 22 : 12);
      continue;
    }

    // Asteroid vs Enemies physical crash (highly tactical and exciting!)
    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];
      if (enemy.type.startsWith('boss') || enemy.type === 'sandworm') continue;

      const distEnemy = Math.sqrt(Math.pow(enemy.x + enemy.width/2 - ast.x, 2) + Math.pow(enemy.y + enemy.height/2 - ast.y, 2));
      if (distEnemy < ast.radius + enemy.width/2) {
        asteroids.splice(a, 1);
        enemies.splice(e, 1);
        
        spawnExplosionParticles(ast.x, ast.y, ast.color, 10);
        spawnExplosionParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, 10);
        
        GameAudio.playExplosionSound(0.7);
        floatingTexts.push(new FloatingText(ast.x, ast.y, 'COLLISION DESTROY', '#ff003c'));
        break;
      }
    }
  }

  // 8. Wall Conduit Collisions (Trench Run)
  const lvlData = LEVEL_DATABASE[currentLevel] || {};
  if (lvlData.trenchWalls) {
    if (player.x < 205 || player.x + player.width > 595) {
      damagePlayer(2); // Trench wall thermal friction damage
      triggerScreenShake(0.08);
    }
  }
}

function spawnFacehuggerDrones(x, y) {
  GameAudio.playExplosionSound(0.6);
  floatingTexts.push(new FloatingText(x, y, 'HATCHED!', '#39ff14'));
  
  // Spawns 3 ultra-fast facehugger kamikazes charging from hatched egg
  enemies.push(new Enemy(x - 20, y, 'kamikaze'));
  enemies.push(new Enemy(x, y, 'kamikaze'));
  enemies.push(new Enemy(x + 20, y, 'kamikaze'));
}

function damagePlayer(amount) {
  if (player.invulnFrames > 0) return;

  if (CONFIG.playerShieldActive()) {
    delete activePowerUps['SHIELD'];
    floatingTexts.push(new FloatingText(player.x + player.width / 2, player.y - 15, 'SHIELD ABSORBED', '#ff00aa'));
    GameAudio.playPowerUpSound();
    player.invulnFrames = 30;
    return;
  }

  health = Math.max(0, health - amount);
  triggerScreenShake(0.5);
  GameAudio.playExplosionSound(0.8);
  spawnExplosionParticles(player.x + player.width / 2, player.y + player.height / 2, '#ff003c', 15);
  player.invulnFrames = 60;

  if (health <= 0) {
    triggerPlayerExplosion();
  }
}

function applyPowerUp(type) {
  GameAudio.playPowerUpSound();
  floatingTexts.push(new FloatingText(player.x + player.width / 2, player.y - 20, type.replace('_', ' '), '#39ff14'));
  
  if (type === 'BOMB') {
    triggerScreenShake(1.0);
    GameAudio.playBombSound();
    
    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];
      if (!enemy.type.startsWith('boss') && enemy.type !== 'sandworm') {
        enemies.splice(e, 1);
        score += enemy.scoreValue;
        spawnExplosionParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, 12);
        
        // Add credits
        scrapItems.push(new ScrapCredit(enemy.x + enemy.width/2, enemy.y + enemy.height/2));
      } else {
        enemy.takeDamage(25);
      }
    }
    enemyLasers = [];
  } 
  else {
    activePowerUps[type] = 8000;
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

  if (traumaLevel > 0) {
    const shakeX = (Math.random() * 2 - 1) * traumaLevel * 14;
    const shakeY = (Math.random() * 2 - 1) * traumaLevel * 14;
    ctx.translate(shakeX, shakeY);
  }

  // Draw scrolling backgrounds
  drawSynthwaveBackground();

  // Draw Wall Turrets (Trench Level)
  wallTurrets.forEach(turret => turret.draw());

  // Draw Enemy lasers
  enemyLasers.forEach(laser => laser.draw());

  // Draw Player lasers
  playerLasers.forEach(laser => laser.draw());

  // Draw Homing Missiles
  homingMissiles.forEach(missile => missile.draw());

  // Draw Powerups / clouds
  powerUps.forEach(pup => pup.draw());

  // Draw Nanotech credits drops
  scrapItems.forEach(scrap => scrap.draw());

  // Draw Enemies / Eggs
  enemies.forEach(enemy => enemy.draw());

  // Draw Asteroids / Monoliths
  asteroids.forEach(ast => ast.draw());

  // Draw Floating texts
  floatingTexts.forEach(txt => txt.draw());

  // Draw Particles
  particles.forEach(p => p.draw());

  // Draw Player ship
  if (player && health > 0) {
    player.draw();
  }

  ctx.restore();
}

/* ----------------------------------------------------
   GAME STATE CONTROL MACHINE & INTERACTIVE WIRINGS
   ---------------------------------------------------- */
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

  // Reset upgraded statistics to base
  score = 0;
  currentLevel = 1;
  scrapCredits = 0;
  maxHealth = 100;
  health = 100;
  
  playerUpgrades.speed = 1;
  playerUpgrades.shield = 1;
  playerUpgrades.cooldown = 1;
  playerUpgrades.homing = 0;

  CONFIG.playerSpeed = CONFIG.playerSpeedBase;
  CONFIG.laserCooldown = CONFIG.laserCooldownBase;

  player = new PlayerShip();
  
  const records = getLeaderboard();
  highScore = records.length > 0 ? records[0].score : 0;

  // Toggle Screen Views
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('game-over-screen').classList.add('hidden');
  document.getElementById('shop-menu').classList.add('hidden');
  
  loadAndStartLevel();
}

function togglePause() {
  if (!gameActive || inShop || inIntro) return;
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
  finalWaveEl.innerText = currentLevel;

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

// Window Event Listeners Wires
window.addEventListener('load', () => {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');

  canvas.width = CONFIG.width;
  canvas.height = CONFIG.height;

  window.addEventListener('keydown', e => {
    if (e.code === 'Space') e.preventDefault();
    keys[e.code] = true;

    if (e.code === 'KeyP') {
      togglePause();
    }
  });

  window.addEventListener('keyup', e => {
    keys[e.code] = false;
  });

  // UI Button listener hooks
  document.getElementById('btn-start').addEventListener('click', () => {
    startGame();
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
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

  document.getElementById('hud-pause-btn').addEventListener('click', () => {
    togglePause();
  });

  document.getElementById('btn-pause-resume').addEventListener('click', () => {
    togglePause();
  });

  document.getElementById('btn-pause-abort').addEventListener('click', () => {
    gameActive = false;
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
  });

  // High score submit
  document.getElementById('btn-submit-score').addEventListener('click', () => {
    const input = document.getElementById('pilot-name');
    const name = input.value.trim() || 'ACE';
    saveHighScore(name, score);
    document.getElementById('high-score-input-container').classList.add('hidden');
    
    document.getElementById('game-over-screen').classList.add('hidden');
    updateLeaderboardUI();
    document.getElementById('leaderboard-menu').classList.remove('hidden');
  });

  document.getElementById('pilot-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      document.getElementById('btn-submit-score').click();
    }
  });

  // Hangar shop upgrade click buttons triggers
  document.getElementById('btn-buy-speed').addEventListener('click', () => {
    const lvl = playerUpgrades.speed;
    const cost = upgradeCosts.speed[lvl - 1];
    if (scrapCredits >= cost && lvl < 5) {
      scrapCredits -= cost;
      playerUpgrades.speed++;
      
      // Permanently adjust ship properties
      CONFIG.playerSpeed = CONFIG.playerSpeedBase * (1.0 + playerUpgrades.speed * 0.15);
      
      GameAudio.playPowerUpSound();
      updateHangarUI();
      document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;
    }
  });

  document.getElementById('btn-buy-shield').addEventListener('click', () => {
    const lvl = playerUpgrades.shield;
    const cost = upgradeCosts.shield[lvl - 1];
    if (scrapCredits >= cost && lvl < 5) {
      scrapCredits -= cost;
      playerUpgrades.shield++;
      
      // Permanently adjust ship shielding pools
      maxHealth = 100 + (playerUpgrades.shield - 1) * 20;
      health = maxHealth; // Heal completely
      
      GameAudio.playPowerUpSound();
      updateHangarUI();
      document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;
    }
  });

  document.getElementById('btn-buy-cooldown').addEventListener('click', () => {
    const lvl = playerUpgrades.cooldown;
    const cost = upgradeCosts.cooldown[lvl - 1];
    if (scrapCredits >= cost && lvl < 5) {
      scrapCredits -= cost;
      playerUpgrades.cooldown++;
      
      // Permanently reduce fire CD
      CONFIG.laserCooldown = CONFIG.laserCooldownBase * (1.0 - (playerUpgrades.cooldown - 1) * 0.12);
      
      GameAudio.playPowerUpSound();
      updateHangarUI();
      document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;
    }
  });

  document.getElementById('btn-buy-homing').addEventListener('click', () => {
    const cost = upgradeCosts.homing;
    if (scrapCredits >= cost && playerUpgrades.homing === 0) {
      scrapCredits -= cost;
      playerUpgrades.homing = 1;
      
      GameAudio.playPowerUpSound();
      updateHangarUI();
      document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;
    }
  });

  // Hangar launch launch
  document.getElementById('btn-shop-launch').addEventListener('click', () => {
    exitHangarAndLaunch();
  });

  // Settings inputs
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

  requestAnimationFrame(gameTick);
});
