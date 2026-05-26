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
  homing: 0,     // 0 = Locked, 1 = Unlocked
  wingman: 0,    // 0 = Locked, 1 = Unlocked
  emp: 0         // 0 = Locked, 1 = Unlocked
};

const upgradeCosts = {
  speed: [100, 150, 220, 300, 400],
  shield: [150, 220, 300, 400, 500],
  cooldown: [200, 280, 380, 500, 650],
  homing: 300,
  wingman: 350,
  emp: 400
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
let wingmanDrones = [];
let empShockwaves = [];
let debrisList = [];
let empCooldownTimer = 0;
let bulletTimeActive = false;
let matrixStreams = [];
let isWarping = false;
let warpTimer = 0;
let dsLaserState = 'off';
let dsLaserTimer = 4000;

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
  },
  16: {
    title: "LEVEL 16",
    subtitle: "THE TRON GRID",
    theme: "tron",
    quote: "Grid override active. Avoid light cycle trails. Program deletion imminent.",
    enemyGrid: { rows: 3, cols: 5, scouts: true, swarmers: false, kamikazes: false, lightCycles: true }
  },
  17: {
    title: "LEVEL 17",
    subtitle: "MATRIX CODE RAIN",
    theme: "matrix",
    quote: "Wake up, Neo... Time dilation active. Hold [SHIFT] or [E] to manipulate bullet-time streams.",
    enemyGrid: { rows: 3, cols: 6, scouts: true, swarmers: true, kamikazes: true, shieldBlockers: true, snipers: true }
  },
  18: {
    title: "LEVEL 18",
    subtitle: "COLONY SECURITY SENTRY",
    theme: "wey_sentry",
    quote: "Weyland perimeter perimeter alert. Sentry searchlights scanning quadrants. Evade or destroy lock-on cones.",
    enemyGrid: { rows: 2, cols: 4, scouts: true, swarmers: false, kamikazes: false, sentries: true, snipers: true }
  },
  19: {
    title: "LEVEL 19",
    subtitle: "DEATH STAR SUPERLASER",
    theme: "ds_core",
    quote: "Reactor stabilizer barriers online. Superlaser charge sequence active. Evade bisecting beams.",
    dsCoreLaser: true,
    enemyGrid: { rows: 2, cols: 5, scouts: true, swarmers: true, kamikazes: false, shieldBlockers: true }
  },
  20: {
    title: "LEVEL 20",
    subtitle: "UNICRON WORLD DEVOURER",
    theme: "unicron",
    quote: "⚠️ DECISIVE BOSS BATTLE ⚠️\nPlanetary devouring singularity core warping in. Destroy Unicron's structural engine.",
    bossType: "unicron"
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
  board.push({ name: name.toUpperCase().slice(0, 12), score: scoreVal });
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
    this.vy = 0;
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
    if (keys['ArrowUp'] || keys['KeyW']) {
      this.vy -= CONFIG.playerSpeed * 0.15;
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
      this.vy += CONFIG.playerSpeed * 0.15;
    }

    // Apply smooth inertia friction
    this.vx *= CONFIG.playerFriction;
    this.x += this.vx;
    this.vy *= CONFIG.playerFriction;
    this.y += this.vy;

    // Apply level specific physical constraint borders
    let minX = 15;
    let maxX = CONFIG.width - this.width - 15;
    let minY = 220; // Stop exactly at the horizontal horizon line
    let maxY = CONFIG.height - this.height - 15;
    
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
    if (this.y < minY) {
      this.y = minY;
      this.vy = 0;
    }
    if (this.y > maxY) {
      this.y = maxY;
      this.vy = 0;
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
      
      GameAudio.playLaserSound(activePowerUps['RAPID_FIRE'] ? 1.3 : 1.0);

      const tier = playerUpgrades.cooldown;
      if (activePowerUps['TRIPLE_SHOT']) {
        if (tier === 1) {
          playerLasers.push(new Laser(this.x + this.width / 2, this.y, 0, -CONFIG.laserSpeed, '#ffea00', 1, 4, 16));
          playerLasers.push(new Laser(this.x + 5, this.y + 10, -2.5, -CONFIG.laserSpeed + 1, '#ffea00', 1, 4, 16));
          playerLasers.push(new Laser(this.x + this.width - 5, this.y + 10, 2.5, -CONFIG.laserSpeed + 1, '#ffea00', 1, 4, 16));
        } else if (tier === 2) {
          playerLasers.push(new Laser(this.x + this.width / 2, this.y, 0, -CONFIG.laserSpeed, '#0088ff', 1.3, 6, 18));
          playerLasers.push(new Laser(this.x + 5, this.y + 10, -2.5, -CONFIG.laserSpeed + 1, '#0088ff', 1.3, 6, 18));
          playerLasers.push(new Laser(this.x + this.width - 5, this.y + 10, 2.5, -CONFIG.laserSpeed + 1, '#0088ff', 1.3, 6, 18));
        } else if (tier === 3) {
          playerLasers.push(new Laser(this.x + this.width / 2, this.y, 0, -CONFIG.laserSpeed, '#00ff88', 1.2, 4, 16));
          playerLasers.push(new Laser(this.x + 5, this.y + 5, -2, -CONFIG.laserSpeed, '#00ff88', 1.2, 4, 16));
          playerLasers.push(new Laser(this.x + this.width - 5, this.y + 5, 2, -CONFIG.laserSpeed, '#00ff88', 1.2, 4, 16));
          playerLasers.push(new Laser(this.x + 5, this.y + 10, -4, -CONFIG.laserSpeed + 1, '#00ff88', 1.2, 4, 16));
          playerLasers.push(new Laser(this.x + this.width - 5, this.y + 10, 4, -CONFIG.laserSpeed + 1, '#00ff88', 1.2, 4, 16));
        } else if (tier === 4) {
          playerLasers.push(new Laser(this.x + this.width / 2 - 12, this.y, 0, -CONFIG.laserSpeed, '#ff003c', 1.4, 4, 16));
          playerLasers.push(new Laser(this.x + this.width / 2 + 12, this.y, 0, -CONFIG.laserSpeed, '#ff003c', 1.4, 4, 16));
          playerLasers.push(new Laser(this.x + 5, this.y + 10, -2.5, -CONFIG.laserSpeed + 1, '#ff003c', 1.4, 4, 16));
          playerLasers.push(new Laser(this.x + this.width - 5, this.y + 10, 2.5, -CONFIG.laserSpeed + 1, '#ff003c', 1.4, 4, 16));
        } else {
          playerLasers.push(new Laser(this.x + this.width / 2, this.y, 0, -CONFIG.laserSpeed, '#bd00ff', 4.0, 28, 32, true));
          playerLasers.push(new Laser(this.x + 5, this.y + 10, -1.5, -CONFIG.laserSpeed, '#bd00ff', 4.0, 28, 32, true));
          playerLasers.push(new Laser(this.x + this.width - 5, this.y + 10, 1.5, -CONFIG.laserSpeed, '#bd00ff', 4.0, 28, 32, true));
        }
      } else {
        if (tier === 1) {
          playerLasers.push(new Laser(this.x + 12, this.y, 0, -CONFIG.laserSpeed, '#00f0ff', 1, 4, 16));
          playerLasers.push(new Laser(this.x + this.width - 12, this.y, 0, -CONFIG.laserSpeed, '#00f0ff', 1, 4, 16));
        } else if (tier === 2) {
          playerLasers.push(new Laser(this.x + 10, this.y, 0, -CONFIG.laserSpeed, '#0088ff', 1.3, 6, 18));
          playerLasers.push(new Laser(this.x + this.width - 10, this.y, 0, -CONFIG.laserSpeed, '#0088ff', 1.3, 6, 18));
        } else if (tier === 3) {
          playerLasers.push(new Laser(this.x + this.width / 2, this.y, 0, -CONFIG.laserSpeed, '#00ff88', 1.2, 4, 16));
          playerLasers.push(new Laser(this.x + 5, this.y + 5, -1.8, -CONFIG.laserSpeed, '#00ff88', 1.2, 4, 16));
          playerLasers.push(new Laser(this.x + this.width - 5, this.y + 5, 1.8, -CONFIG.laserSpeed, '#00ff88', 1.2, 4, 16));
        } else if (tier === 4) {
          playerLasers.push(new Laser(this.x + 4, this.y, 0, -CONFIG.laserSpeed, '#ff003c', 1.4, 4, 16));
          playerLasers.push(new Laser(this.x + 12, this.y, 0, -CONFIG.laserSpeed, '#ff003c', 1.4, 4, 16));
          playerLasers.push(new Laser(this.x + this.width - 12, this.y, 0, -CONFIG.laserSpeed, '#ff003c', 1.4, 4, 16));
          playerLasers.push(new Laser(this.x + this.width - 4, this.y, 0, -CONFIG.laserSpeed, '#ff003c', 1.4, 4, 16));
        } else {
          playerLasers.push(new Laser(this.x + this.width / 2, this.y - 8, 0, -CONFIG.laserSpeed, '#bd00ff', 4.0, 28, 32, true));
        }
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
  constructor(x, y, vx, vy, color = '#00f0ff', damage = 1, width = 4, height = 16, piercing = false) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.damage = damage;
    this.width = width;
    this.height = height;
    this.piercing = piercing;
  }

  update(isPlayerLaser = false) {
    let mult = 1.0;
    if (bulletTimeActive && !isPlayerLaser) {
      mult = 0.4;
    }
    this.x += this.vx * mult;
    this.y += this.vy * mult;
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
    this.stunTimer = 0;
    
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
    } else if (type === 'shieldBlocker') {
      this.maxHealth = 4;
      this.scoreValue = 400;
      this.color = '#00f0ff';
      this.width = 34;
      this.height = 28;
      this.speed = 1.0;
    } else if (type === 'sniper') {
      this.maxHealth = 2;
      this.scoreValue = 500;
      this.color = '#ff003c';
      this.width = 32;
      this.height = 26;
      this.speed = 0.7;
      this.chargeTimer = 0;
    } else if (type === 'lightCycle') {
      this.maxHealth = 2;
      this.scoreValue = 300;
      this.color = '#00f0ff';
      this.width = 32;
      this.height = 24;
      this.speed = 1.8;
      this.directionX = (Math.random() < 0.5 ? -1 : 1);
      this.trail = [];
      this.trailTimer = 0;
    } else if (type === 'sentry') {
      this.maxHealth = 3;
      this.scoreValue = 400;
      this.color = '#ffea00';
      this.width = 36;
      this.height = 20;
      this.speed = 0;
      this.angle = Math.PI / 2;
      this.sweepDirection = 1;
      this.shootCooldown = 0;
    } else if (type === 'unicron') {
      this.maxHealth = 300;
      this.scoreValue = 30000;
      this.color = '#ffea00';
      this.width = 220;
      this.height = 140;
      this.speed = 0.8;
      this.bossDirection = 1;
      this.phase2 = false;
    }

    this.health = this.maxHealth;
  }

  update(dt) {
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      return;
    }

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
    else if (this.type === 'shieldBlocker') {
      this.y += this.speed * 0.7;
    } 
    else if (this.type === 'sniper') {
      if (this.y < 120) {
        this.y += this.speed * 1.2;
      }
      if (player) {
        const targetDx = player.x + player.width / 2 - (this.x + this.width / 2);
        this.x += Math.sign(targetDx) * 0.9;
      }
      let mult = bulletTimeActive ? 0.4 : 1.0;
      this.chargeTimer += dt * mult;
      if (this.chargeTimer >= 1800) {
        this.shoot();
        this.chargeTimer = 0;
      }
    } 
    else if (this.type === 'lightCycle') {
      let mult = bulletTimeActive ? 0.4 : 1.0;
      this.y += this.speed * 0.5 * mult;
      this.x += this.speed * this.directionX * 1.5 * mult;
      if (this.x < 15) {
        this.x = 15;
        this.directionX = 1;
      }
      if (this.x > CONFIG.width - this.width - 15) {
        this.x = CONFIG.width - this.width - 15;
        this.directionX = -1;
      }
    } 
    else if (this.type === 'sentry') {
      let mult = bulletTimeActive ? 0.4 : 1.0;
      const sweepSpeed = 0.008 * mult;
      this.angle += sweepSpeed * this.sweepDirection;
      if (this.angle > (Math.PI * 3) / 4) {
        this.angle = (Math.PI * 3) / 4;
        this.sweepDirection = -1;
      }
      if (this.angle < Math.PI / 4) {
        this.angle = Math.PI / 4;
        this.sweepDirection = 1;
      }
    } 
    else if (this.type === 'unicron') {
      let mult = bulletTimeActive ? 0.4 : 1.0;
      this.x += this.speed * this.bossDirection * mult;
      if (this.x < 40) {
        this.x = 40;
        this.bossDirection = 1;
      }
      if (this.x > CONFIG.width - this.width - 40) {
        this.x = CONFIG.width - this.width - 40;
        this.bossDirection = -1;
      }
      this.y = 80 + Math.sin(this.phase * 0.5) * 8;
      
      if (this.health <= this.maxHealth / 2) {
        this.phase2 = true;
        this.color = '#ff003c';
        this.speed = 1.3;
      }
      
      if (this.phase2 && player && gameActive && !gamePaused) {
        const mx = this.x + this.width / 2;
        const my = this.y + this.height * 0.7;
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const dx = mx - px;
        const dy = my - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 20) {
          const pullStrength = 0.08 * mult;
          player.vx += (dx / dist) * pullStrength;
          if (player.y > 220) {
            player.y += (dy / dist) * pullStrength * 1.5;
          }
        }
      }
    }

    // Firing checks
    if (gameActive && this.type !== 'kamikaze' && this.type !== 'sniper' && this.type !== 'sentry') {
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
    else if (this.type === 'sniper') {
      GameAudio.playLaserSound(0.5); // deep charge shot
      const sx = this.x + this.width / 2;
      const sy = this.y + this.height - 4;
      enemyLasers.push(new Laser(sx, sy, 0, 11, '#ff003c', 2, 8, 22));
      for (let i = 0; i < 8; i++) {
        const spark = new Particle(sx, sy, '#ff003c');
        spark.vy = Math.random() * -3 - 1;
        particles.push(spark);
      }
    }
    else if (this.type === 'unicron') {
      GameAudio.playBossLaserSound();
      const centerX = this.x + this.width / 2;
      const bottomY = this.y + this.height - 15;
      
      if (!this.phase2) {
        const bulletCount = 7;
        const speed = 6.5;
        const spreadAngle = Math.PI / 1.5;
        for (let i = 0; i < bulletCount; i++) {
          const angle = Math.PI / 2 - spreadAngle / 2 + (i / (bulletCount - 1)) * spreadAngle;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          enemyLasers.push(new Laser(centerX, bottomY, vx, vy, '#ffea00'));
        }
        
        if (player) {
          const dx = player.x + player.width/2 - centerX;
          const dy = player.y + player.height/2 - bottomY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 0) {
            enemyLasers.push(new Laser(centerX, bottomY, (dx / dist) * 5.5, (dy / dist) * 5.5, '#8b00ff'));
          }
        }
      } else {
        const bulletCount = 9;
        const speed = 7.5;
        const spreadAngle = Math.PI / 1.2;
        for (let i = 0; i < bulletCount; i++) {
          const angle = Math.PI / 2 - spreadAngle / 2 + (i / (bulletCount - 1)) * spreadAngle;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          enemyLasers.push(new Laser(centerX, bottomY, vx, vy, '#ff003c'));
        }
        
        if (asteroids.length < 12) {
          asteroids.push(new Asteroid(centerX + (Math.random() * 40 - 20), bottomY + 20, 'medium', Math.random() * 2.4 - 1.2, 3));
        }
      }
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
    else if (this.type === 'shieldBlocker') {
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, this.y + this.height);
      ctx.lineTo(this.x + this.width, this.y + 4);
      ctx.lineTo(this.x + this.width - 6, this.y);
      ctx.lineTo(this.x + 6, this.y);
      ctx.lineTo(this.x, this.y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.save();
      ctx.strokeStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height + 6, this.width / 2 + 4, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.restore();
    }
    else if (this.type === 'sniper') {
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, this.y + this.height);
      ctx.lineTo(this.x + this.width, this.y);
      ctx.lineTo(this.x, this.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x + this.width / 2 - 3, this.y + this.height, 6, 6);
      
      if (player && gameActive && !gamePaused) {
        ctx.save();
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const sx = this.x + this.width / 2;
        const sy = this.y + this.height;
        
        const progress = this.chargeTimer / 1800;
        ctx.strokeStyle = `rgba(255, ${Math.floor(255 * progress)}, ${Math.floor(60 * progress)}, ${0.15 + progress * 0.65})`;
        ctx.shadowColor = '#ff003c';
        ctx.shadowBlur = progress * 10;
        ctx.lineWidth = 1 + progress * 2.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.restore();
      }
    }
    else if (this.type === 'lightCycle') {
      if (this.trail && this.trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(this.trail[0].x, this.trail[0].y);
        for (let t = 1; t < this.trail.length; t++) {
          ctx.lineTo(this.trail[t].x, this.trail[t].y);
        }
        ctx.lineTo(this.x + this.width / 2, this.y + this.height / 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(this.x + 8, this.y + this.height / 2, 6, 0, Math.PI * 2);
      ctx.arc(this.x + this.width - 8, this.y + this.height / 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(this.x + 6, this.y + 6);
      ctx.lineTo(this.x + this.width - 6, this.y + 6);
      ctx.lineTo(this.x + this.width - 2, this.y + this.height - 6);
      ctx.lineTo(this.x + 2, this.y + this.height - 6);
      ctx.closePath();
      ctx.stroke();
    }
    else if (this.type === 'sentry') {
      const sx = this.x + this.width / 2;
      const sy = this.y + this.height / 2;
      
      ctx.fillStyle = '#1c1a27';
      ctx.fillRect(this.x, this.y, this.width, 6);
      ctx.strokeRect(this.x, this.y, this.width, 6);
      
      ctx.beginPath();
      ctx.moveTo(sx - 4, this.y + 6);
      ctx.lineTo(sx - 4, sy);
      ctx.lineTo(sx + 4, sy);
      ctx.lineTo(sx + 4, this.y + 6);
      ctx.stroke();
      
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(this.angle);
      
      const coneLength = 320;
      const coneHalfSpread = Math.PI / 12;
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(coneHalfSpread) * coneLength, Math.sin(coneHalfSpread) * coneLength);
      ctx.lineTo(Math.cos(-coneHalfSpread) * coneLength, Math.sin(-coneHalfSpread) * coneLength);
      ctx.closePath();
      
      const isLocked = this.detected;
      let coneGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, coneLength);
      if (isLocked) {
        coneGrad.addColorStop(0, 'rgba(255, 0, 60, 0.45)');
        coneGrad.addColorStop(1, 'rgba(255, 0, 60, 0.0)');
        ctx.fillStyle = coneGrad;
      } else {
        coneGrad.addColorStop(0, 'rgba(255, 234, 0, 0.22)');
        coneGrad.addColorStop(1, 'rgba(255, 234, 0, 0.0)');
        ctx.fillStyle = coneGrad;
      }
      ctx.fill();
      
      ctx.restore();
      
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(this.angle);
      ctx.strokeStyle = this.color;
      ctx.fillStyle = '#0f0c1b';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(0, -2, 14, 4);
      ctx.strokeRect(0, -2, 14, 4);
      ctx.restore();
    }
    else if (this.type === 'unicron') {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height * 0.4;
      const radius = 62;
      
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx - 30, cy - radius + 15);
      ctx.quadraticCurveTo(cx - 85, cy - radius - 20, cx - 110, cy - radius + 25);
      ctx.quadraticCurveTo(cx - 80, cy - radius + 10, cx - radius + 4, cy - 20);
      
      ctx.moveTo(cx + 30, cy - radius + 15);
      ctx.quadraticCurveTo(cx + 85, cy - radius - 20, cx + 110, cy - radius + 25);
      ctx.quadraticCurveTo(cx + 80, cy - radius + 10, cx + radius - 4, cy - 20);
      ctx.stroke();
      
      ctx.fillStyle = '#100b1d';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.save();
      ctx.strokeStyle = this.phase2 ? '#ff003c' : '#ff7a00';
      ctx.shadowColor = this.phase2 ? '#ff003c' : '#ff7a00';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy - radius + 5);
      ctx.lineTo(cx - 20, cy + radius - 25);
      ctx.moveTo(cx + 20, cy - radius + 5);
      ctx.lineTo(cx + 20, cy + radius - 25);
      ctx.moveTo(cx - radius + 10, cy - 15);
      ctx.lineTo(cx + radius - 10, cy - 15);
      ctx.moveTo(cx - radius + 10, cy + 15);
      ctx.lineTo(cx + radius - 10, cy + 15);
      ctx.stroke();
      ctx.restore();
      
      const mawRadius = this.phase2 ? 24 + Math.sin(this.phase * 5) * 5 : 14 + Math.sin(this.phase * 2) * 2;
      ctx.save();
      ctx.fillStyle = this.phase2 ? '#ff003c' : '#ff7a00';
      ctx.shadowColor = this.phase2 ? '#ff003c' : '#ff7a00';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(cx, cy + 25, mawRadius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy + 25, mawRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      
      if (this.phase2) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 0, 60, 0.7)';
        ctx.shadowColor = '#ff003c';
        ctx.shadowBlur = 20;
        ctx.lineWidth = 2.0;
        const voidRing = (Date.now() / 15) % 110;
        ctx.beginPath();
        ctx.arc(cx, cy + 25, voidRing, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
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
    if (this.type === 'boss' || this.type === 'boss2' || this.type === 'sandworm' || this.type === 'unicron') {
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

// Vector Debris polygonal shard explosion particle
class Debris {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3.2 + 1.2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    
    this.points = [];
    const sides = Math.floor(Math.random() * 3) + 3; // 3 to 5 sides
    const size = Math.random() * 8 + 4;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
      this.points.push({
        x: Math.cos(a) * size,
        y: Math.sin(a) * size
      });
    }
    
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.15;
    this.alpha = 1.0;
    this.decay = Math.random() * 0.012 + 0.01;
  }

  update(dt) {
    let mult = 1.0;
    if (bulletTimeActive) mult = 0.4;
    
    this.x += this.vx * mult;
    this.y += this.vy * mult;
    this.rotation += this.rotSpeed * mult;
    this.alpha -= this.decay * mult;
  }

  draw() {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.strokeStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.5;
    
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    
    ctx.restore();
  }
}

// Orbiting escort fighter drone wingman
class WingmanDrone {
  constructor(angleOffset = 0) {
    this.angle = angleOffset;
    this.width = 14;
    this.height = 14;
    this.color = '#bd00ff';
    this.lastFireTime = 0;
    this.x = 0;
    this.y = 0;
  }

  update(dt) {
    if (!player) return;
    
    let rotationSpeed = 0.04;
    if (bulletTimeActive) rotationSpeed *= 0.4;
    this.angle += rotationSpeed;
    
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    this.x = px + Math.cos(this.angle) * 45 - this.width / 2;
    this.y = py + Math.sin(this.angle) * 45 - this.height / 2;
    
    const now = Date.now();
    if (now - this.lastFireTime > 450) {
      this.fire();
      this.lastFireTime = now;
    }
  }

  fire() {
    if (!gameActive || gamePaused) return;
    playerLasers.push(new Laser(
      this.x + this.width / 2 - 2, 
      this.y - 4, 
      0, 
      -9, 
      '#bd00ff',
      1.1,
      4,
      16,
      false
    ));
    GameAudio.playLaserSound(1.4);
  }

  draw() {
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.fillStyle = '#110121';
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    ctx.moveTo(this.x + this.width / 2, this.y);
    ctx.lineTo(this.x + this.width, this.y + this.height);
    ctx.lineTo(this.x, this.y + this.height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x + this.width / 2, this.y + this.height * 0.65, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

// Expanding high-voltage tactical electromagnetic pulse shockwave ring
class EMPShockwave {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.maxRadius = 350;
    this.speed = 12;
    this.damage = 2;
    this.hitEnemies = new Set();
    
    GameAudio.playBombSound();
    traumaLevel = Math.min(1.0, traumaLevel + 0.4);
    
    // Trigger CSS glitch effect on game container for game juice!
    const container = document.getElementById('game-container');
    container.classList.add('hit-flash');
    setTimeout(() => container.classList.remove('hit-flash'), 400);
  }

  update(dt) {
    let mult = 1.0;
    if (bulletTimeActive) mult = 0.4;
    
    this.radius += this.speed * mult;
    
    // Clear active hostile energy bolts inside expanding ring
    for (let i = enemyLasers.length - 1; i >= 0; i--) {
      const laser = enemyLasers[i];
      const dx = laser.x - this.x;
      const dy = laser.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.radius) {
        for (let j = 0; j < 3; j++) {
          particles.push(new Particle(laser.x, laser.y, laser.color || '#ff00aa'));
        }
        enemyLasers.splice(i, 1);
      }
    }
    
    // Stunning and damaging close enemies
    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];
      if (this.hitEnemies.has(enemy)) continue;
      
      const ex = enemy.x + enemy.width / 2;
      const ey = enemy.y + enemy.height / 2;
      const dx = ex - this.x;
      const dy = ey - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= this.radius) {
        this.hitEnemies.add(enemy);
        const destroyed = enemy.takeDamage(this.damage);
        
        for (let j = 0; j < 6; j++) {
          const spark = new Particle(ex + (Math.random() * 20 - 10), ey + (Math.random() * 20 - 10), '#00f0ff');
          spark.vy -= 1;
          particles.push(spark);
        }
        
        if (destroyed) {
          destroyEnemy(enemy, e);
        } else {
          enemy.stunTimer = 1800; // 1.8 seconds stun
        }
      }
    }
  }

  draw() {
    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#00f0ff';
    ctx.lineWidth = 4 * (1.0 - this.radius / this.maxRadius) + 1;
    ctx.globalAlpha = 1.0 - this.radius / this.maxRadius;
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    
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
  } else if (lvlData.theme === 'matrix') {
    ctx.fillStyle = '#000802'; // Dark Matrix green backdrop
  } else if (lvlData.theme === 'tron') {
    ctx.fillStyle = '#02000c'; // TRON dark neon purple/blue backdrop
  } else if (lvlData.theme === 'ds_core') {
    ctx.fillStyle = '#0a0a0f'; // Grey reactor backdrop
  } else if (lvlData.theme === 'unicron') {
    ctx.fillStyle = '#0f0502'; // Orange circuit board backdrop
  } else {
    ctx.fillStyle = '#03010b';
  }
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

  // Render drifting stars
  stars.forEach(star => {
    let currentSpeed = star.speed;
    if (isWarping) currentSpeed *= 15;
    
    star.y += currentSpeed;
    if (star.y > CONFIG.height) {
      star.y = 0;
      star.x = Math.random() * CONFIG.width;
    }
    
    if (lvlData.theme === 'spice') {
      ctx.fillStyle = '#ffea00'; // Gold star sand particles
    } else {
      ctx.fillStyle = star.color;
    }
    
    if (isWarping) {
      let starLength = star.speed * 12;
      ctx.fillRect(star.x, star.y, star.size, starLength);
    } else {
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
  });

  // Matrix digital code rain in background
  if (lvlData.theme === 'matrix') {
    if (matrixStreams.length === 0) {
      const cols = Math.floor(CONFIG.width / 16);
      for (let i = 0; i < cols; i++) {
        matrixStreams.push({
          x: i * 16,
          y: Math.random() * -CONFIG.height,
          speed: Math.random() * 3 + 2,
          length: Math.floor(Math.random() * 15) + 10
        });
      }
    }
    
    ctx.save();
    ctx.font = '14px monospace';
    matrixStreams.forEach(stream => {
      let speedMult = bulletTimeActive ? 0.4 : 1.0;
      stream.y += stream.speed * speedMult;
      if (stream.y - stream.length * 16 > CONFIG.height) {
        stream.y = Math.random() * -200;
        stream.speed = Math.random() * 3 + 2;
        stream.length = Math.floor(Math.random() * 15) + 10;
      }
      
      for (let j = 0; j < stream.length; j++) {
        const cy = stream.y - j * 16;
        if (cy < 0 || cy > CONFIG.height) continue;
        
        const charCode = 0x30A0 + Math.floor(Math.random() * 96);
        const char = String.fromCharCode(charCode);
        
        const isLeading = j === 0;
        if (isLeading) {
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#00ff41';
          ctx.shadowBlur = 10;
        } else {
          ctx.fillStyle = `rgba(0, 255, 65, ${1.0 - j / stream.length})`;
          ctx.shadowBlur = 0;
        }
        ctx.fillText(char, stream.x, cy);
      }
    });
    ctx.restore();
  }

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
  } else if (lvlData.theme === 'tron') {
    gridLineCol1 = 'rgba(0, 240, 255, 0.35)'; // Bright cyan
    gridLineCol2 = 'rgba(0, 240, 255, ';
  } else if (lvlData.theme === 'matrix') {
    gridLineCol1 = 'rgba(0, 255, 65, 0.08)'; // Dim green
    gridLineCol2 = 'rgba(0, 255, 65, ';
  } else if (lvlData.theme === 'wey_sentry') {
    gridLineCol1 = 'rgba(100, 100, 120, 0.15)';
    gridLineCol2 = 'rgba(100, 100, 120, ';
  } else if (lvlData.theme === 'ds_core') {
    gridLineCol1 = 'rgba(57, 255, 20, 0.2)'; // Green power conduits
    gridLineCol2 = 'rgba(57, 255, 20, ';
  } else if (lvlData.theme === 'unicron') {
    gridLineCol1 = 'rgba(255, 68, 0, 0.22)'; // Orange circuit board
    gridLineCol2 = 'rgba(255, 68, 0, ';
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

  // Update Wingman stats
  const wingmanCost = upgradeCosts.wingman;
  const wingmanUnlocked = playerUpgrades.wingman > 0;
  document.getElementById('lvl-wingman').innerText = wingmanUnlocked ? 'UNLOCKED' : 'LOCKED';
  document.getElementById('price-wingman').innerText = wingmanUnlocked ? 'MAXED' : `⚙️ ${wingmanCost}`;
  document.getElementById('btn-buy-wingman').disabled = wingmanUnlocked || scrapCredits < wingmanCost;

  // Update EMP stats
  const empCost = upgradeCosts.emp;
  const empUnlocked = playerUpgrades.emp > 0;
  document.getElementById('lvl-emp').innerText = empUnlocked ? 'UNLOCKED' : 'LOCKED';
  document.getElementById('price-emp').innerText = empUnlocked ? 'MAXED' : `⚙️ ${empCost}`;
  document.getElementById('btn-buy-emp').disabled = empUnlocked || scrapCredits < empCost;
}

function exitHangarAndLaunch() {
  document.getElementById('shop-menu').classList.add('hidden');
  inShop = false;
  
  // Sector Level advance!
  currentLevel++;
  if (currentLevel > 20) {
    // Campaign victory loop reset harder
    currentLevel = 1;
  }
  
  loadAndStartLevel();
}

function loadAndStartLevel() {
  inIntro = true;
  
  const lvlData = LEVEL_DATABASE[currentLevel] || LEVEL_DATABASE[1];
  
  if (window.logAnalyticsEvent) {
    window.logAnalyticsEvent('level_start', { level: currentLevel, theme: lvlData.theme });
  }
  
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
  wingmanDrones = [];
  empShockwaves = [];
  debrisList = [];
  matrixStreams = [];
  dsLaserState = 'off';
  dsLaserTimer = 4000;
  empCooldownTimer = 0;

  // Reset player position
  if (player) {
    player.x = CONFIG.width / 2 - player.width / 2;
    player.y = CONFIG.height - 80;
    player.vx = 0;
    player.vy = 0;
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
        } else if (grid.lightCycles && Math.random() < 0.38) {
          type = 'lightCycle';
        } else if (grid.shieldBlockers && Math.random() < 0.28) {
          type = 'shieldBlocker';
        } else if (grid.snipers && Math.random() < 0.25) {
          type = 'sniper';
        } else if (grid.sentries && r === 0) {
          type = 'sentry';
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
  const lvlData = LEVEL_DATABASE[currentLevel] || {};

  // Bullet-Time active checks in Level 17 Matrix theme:
  if (lvlData.theme === 'matrix' && gameActive && !gamePaused) {
    bulletTimeActive = keys['ShiftLeft'] || keys['ShiftRight'] || keys['KeyE'] || keys['KeyQ'];
  } else {
    bulletTimeActive = false;
  }

  // trauma decay
  if (traumaLevel > 0) {
    traumaLevel -= 0.04;
    if (traumaLevel < 0) traumaLevel = 0;
  }

  // Warp drive scrolling timer update
  if (isWarping) {
    let mult = bulletTimeActive ? 0.4 : 1.0;
    warpTimer -= dt * mult;
    if (warpTimer <= 0) {
      isWarping = false;
    }
  }

  // Update Player
  if (player) {
    player.update(dt);

    // Active EMP Shockwave trigger
    if (playerUpgrades.emp > 0 && gameActive && !gamePaused) {
      if ((keys['KeyE'] || keys['ShiftLeft'] || keys['ShiftRight']) && empCooldownTimer <= 0) {
        triggerPlayerEMP();
      }
    }
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

  // Update EMP cooldown and HUD elements
  if (playerUpgrades.emp > 0) {
    const empContainer = document.getElementById('hud-emp-container');
    if (empContainer) {
      empContainer.classList.remove('hidden');
    }
    
    if (empCooldownTimer > 0) {
      let mult = bulletTimeActive ? 0.4 : 1.0;
      empCooldownTimer -= dt * mult;
      if (empCooldownTimer < 0) empCooldownTimer = 0;
    }
    
    const empFill = document.getElementById('hud-emp-fill');
    if (empFill) {
      const fillPct = empCooldownTimer > 0 ? (1.0 - empCooldownTimer / 8000) * 100 : 100;
      empFill.style.width = `${fillPct}%`;
      if (empCooldownTimer <= 0) {
        empFill.classList.add('emp-ready');
      } else {
        empFill.classList.remove('emp-ready');
      }
    }
  } else {
    const empContainer = document.getElementById('hud-emp-container');
    if (empContainer) {
      empContainer.classList.add('hidden');
    }
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
    laser.update(true); // Player lasers are NOT slowed down by bullet-time
    if (laser.isOutOfBounds()) playerLasers.splice(i, 1);
  }

  for (let i = enemyLasers.length - 1; i >= 0; i--) {
    const laser = enemyLasers[i];
    laser.update(false); // Enemy lasers ARE slowed down by bullet-time
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

  // Update Escort Wingman Drones if active
  if (player && playerUpgrades.wingman > 0) {
    if (wingmanDrones.length === 0) {
      wingmanDrones.push(new WingmanDrone(0));
      wingmanDrones.push(new WingmanDrone(Math.PI)); // Double escorts!
    }
    wingmanDrones.forEach(drone => drone.update(dt));
  } else {
    wingmanDrones = [];
  }

  // Update EMP Shockwaves
  for (let i = empShockwaves.length - 1; i >= 0; i--) {
    const emp = empShockwaves[i];
    emp.update(dt);
    if (emp.radius >= emp.maxRadius) {
      empShockwaves.splice(i, 1);
    }
  }

  // Update Vector Debris
  for (let i = debrisList.length - 1; i >= 0; i--) {
    const debris = debrisList[i];
    debris.update(dt);
    if (debris.alpha <= 0) {
      debrisList.splice(i, 1);
    }
  }

  // Death Star Superlaser Core updates (Level 19)
  if (lvlData.dsCoreLaser && gameActive && !gamePaused) {
    let mult = bulletTimeActive ? 0.4 : 1.0;
    dsLaserTimer -= dt * mult;
    if (dsLaserTimer <= 0) {
      if (dsLaserState === 'off') {
        dsLaserState = 'charging';
        dsLaserTimer = 2200; // charge for 2.2 seconds
        GameAudio.playLaserSound(0.5); // heavy charging hum sound
      } else if (dsLaserState === 'charging') {
        dsLaserState = 'firing';
        dsLaserTimer = 1600; // fire for 1.6 seconds
        GameAudio.playBombSound(); // massive laser blast
        triggerScreenShake(0.8);
      } else if (dsLaserState === 'firing') {
        dsLaserState = 'off';
        dsLaserTimer = Math.random() * 5000 + 4000; // cool down, fire again in 4 to 9 seconds
      }
    }

    // If firing, check collision with player ship!
    if (dsLaserState === 'firing' && player) {
      const centerX = CONFIG.width / 2;
      const laserW = 90; // massive 90px wide laser!
      if (player.x + player.width > centerX - laserW / 2 && player.x < centerX + laserW / 2) {
        damagePlayer(1.5); // continuous heavy damage
        triggerScreenShake(0.15);
      }
    }
  }

  // Update Enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    
    // Custom logic for Light Cycles
    if (enemy.type === 'lightCycle') {
      let mult = bulletTimeActive ? 0.4 : 1.0;
      
      // Update light cycle trail
      if (!enemy.trailTimer) enemy.trailTimer = 0;
      enemy.trailTimer += dt * mult;
      if (enemy.trailTimer >= 100) {
        if (!enemy.trail) enemy.trail = [];
        enemy.trail.push({
          x: enemy.x + enemy.width / 2,
          y: enemy.y + enemy.height / 2,
          birth: Date.now()
        });
        enemy.trailTimer = 0;
      }
      
      // Filter out segments older than 4 seconds
      const now = Date.now();
      if (enemy.trail) {
        enemy.trail = enemy.trail.filter(pt => now - pt.birth < 4000);
      }
      
      // Collide trail with player ship
      if (player && enemy.trail) {
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        for (let t = 0; t < enemy.trail.length - 1; t++) {
          const p1 = enemy.trail[t];
          const p2 = enemy.trail[t + 1];
          if (getDistanceToSegment(px, py, p1.x, p1.y, p2.x, p2.y) < 18) {
            damagePlayer(0.35); // continuous trail damage
            triggerScreenShake(0.06);
            if (Math.random() < 0.1) {
              particles.push(new Particle(px, py, '#00ffff'));
            }
          }
        }
      }
    }
    
    // Custom logic for Ceiling Sentries
    if (enemy.type === 'sentry') {
      let mult = bulletTimeActive ? 0.4 : 1.0;
      
      if (player && gameActive && !gamePaused) {
        const sx = enemy.x + enemy.width / 2;
        const sy = enemy.y + enemy.height / 2;
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const dx = px - sx;
        const dy = py - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angleToPlayer = Math.atan2(dy, dx);
        
        let diff = angleToPlayer - enemy.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        if (dist < 450 && Math.abs(diff) < Math.PI / 12) {
          enemy.detected = true;
          if (!enemy.shootCooldown) enemy.shootCooldown = 0;
          enemy.shootCooldown -= dt * mult;
          if (enemy.shootCooldown <= 0) {
            const vx = Math.cos(angleToPlayer) * 7.5;
            const vy = Math.sin(angleToPlayer) * 7.5;
            enemyLasers.push(new Laser(sx, sy, vx, vy, '#ffea00'));
            enemy.shootCooldown = 180; // fire every 180ms
            GameAudio.playLaserSound(1.8);
          }
        } else {
          enemy.detected = false;
        }
      }
    }

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
function getDistanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  const closestX = x1 + clampedT * dx;
  const closestY = y1 + clampedT * dy;
  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
}

function spawnDebris(x, y, color) {
  const count = Math.floor(Math.random() * 5) + 6; // 6 to 10 shards
  for (let i = 0; i < count; i++) {
    debrisList.push(new Debris(x, y, color));
  }
}

function triggerPlayerEMP() {
  if (!player) return;
  empShockwaves.push(new EMPShockwave(player.x + player.width / 2, player.y + player.height / 2));
  empCooldownTimer = 8000; // 8 seconds cooldown
}

function destroyEnemy(enemy, eIndex) {
  enemies.splice(eIndex, 1);
  score += enemy.scoreValue;
  GameAudio.playExplosionSound(enemy.type.startsWith('boss') || enemy.type === 'unicron' ? 2.2 : 0.85);
  triggerScreenShake(enemy.type.startsWith('boss') || enemy.type === 'unicron' ? 0.9 : 0.25);
  
  spawnExplosionParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, enemy.type.startsWith('boss') || enemy.type === 'unicron' ? 60 : 15);
  spawnDebris(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color);

  // Egg Hatch facehugger drones! (Level 12 Alien)
  if (enemy instanceof HatchingPod) {
    spawnFacehuggerDrones(enemy.x + enemy.width/2, enemy.y + enemy.height/2);
  } 
  else {
    // Drop Nanotech scrap credits drops
    const dropCount = enemy.type.startsWith('boss') || enemy.type === 'unicron' ? 12 : enemy.type === 'swarmer' ? 3 : 1;
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
        
        // Frontal deflection check for blockers
        if (enemy.type === 'shieldBlocker' && laser.vy < 0) {
          if (laser.piercing) {
            if (!laser.hitEnemies) laser.hitEnemies = new Set();
            if (!laser.hitEnemies.has(enemy)) {
              laser.hitEnemies.add(enemy);
              floatingTexts.push(new FloatingText(laser.x, laser.y - 10, "DEFLECTED", '#00f0ff'));
              GameAudio.playHitSound();
            }
            continue;
          } else {
            playerLasers.splice(l, 1);
            hitSomething = true;
            floatingTexts.push(new FloatingText(laser.x, laser.y - 10, "DEFLECTED", '#00f0ff'));
            GameAudio.playHitSound();
            break;
          }
        }

        if (laser.piercing) {
          if (!laser.hitEnemies) laser.hitEnemies = new Set();
          if (laser.hitEnemies.has(enemy)) continue;
          laser.hitEnemies.add(enemy);
        } else {
          playerLasers.splice(l, 1);
          hitSomething = true;
        }
        
        const destroyed = enemy.takeDamage(laser.damage || 1);
        spawnSparkParticles(laser.x, laser.y, enemy.color);

        if (destroyed) {
          destroyEnemy(enemy, e);
        }
        if (!laser.piercing) break;
      }
    }

    if (hitSomething) continue;

    // Player lasers vs Asteroids
    for (let a = asteroids.length - 1; a >= 0; a--) {
      const ast = asteroids[a];
      const dist = Math.sqrt(Math.pow(laser.x - ast.x, 2) + Math.pow(laser.y - ast.y, 2));
      
      if (dist < ast.radius + laser.width) {
        if (laser.piercing) {
          if (!laser.hitAsteroids) laser.hitAsteroids = new Set();
          if (laser.hitAsteroids.has(ast)) continue;
          laser.hitAsteroids.add(ast);
        } else {
          playerLasers.splice(l, 1);
        }
        
        const destroyed = ast.takeDamage(laser.damage || 1);
        spawnSparkParticles(laser.x, laser.y, ast.color);

        if (destroyed) {
          asteroids.splice(a, 1);
          score += ast.scoreValue;
          GameAudio.playExplosionSound(ast.size === 'large' ? 1.4 : 0.8);
          triggerScreenShake(ast.size === 'large' ? 0.5 : 0.25);
          
          spawnExplosionParticles(ast.x, ast.y, ast.color, ast.size === 'large' ? 25 : 12);
          spawnDebris(ast.x, ast.y, ast.color);
          
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
        if (!laser.piercing) break;
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
          destroyEnemy(enemy, e);
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
          spawnDebris(ast.x, ast.y, ast.color);
          
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
      if (enemy.type.startsWith('boss') || enemy.type === 'sandworm' || enemy.type === 'unicron') continue;

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

  const lvlData = LEVEL_DATABASE[currentLevel] || {};

  // Draw Death Star Reactor Beam (Level 19)
  if (lvlData.dsCoreLaser && (dsLaserState === 'charging' || dsLaserState === 'firing')) {
    ctx.save();
    const centerX = CONFIG.width / 2; // screen-bisecting massive vertical beam
    
    if (dsLaserState === 'charging') {
      // Pulsing warning thin targeting lines
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 1.5 + Math.sin(Date.now() / 30) * 1.0;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#39ff14';
      ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 50) * 0.3;
      
      // Draw 2 thin charging bounds lines
      ctx.beginPath();
      ctx.moveTo(centerX - 45, 0);
      ctx.lineTo(centerX - 45, CONFIG.height);
      ctx.moveTo(centerX + 45, 0);
      ctx.lineTo(centerX + 45, CONFIG.height);
      ctx.stroke();
      
      // Pulsing energy spark particles charging inside the column
      ctx.fillStyle = '#39ff14';
      for (let i = 0; i < 4; i++) {
        const ry = Math.random() * CONFIG.height;
        const rx = centerX + (Math.random() * 90 - 45);
        ctx.beginPath();
        ctx.arc(rx, ry, Math.random() * 3 + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (dsLaserState === 'firing') {
      // A massive screen-bisecting white-hot green reactor beam
      ctx.fillStyle = '#39ff14';
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#39ff14';
      
      ctx.fillRect(centerX - 45, 0, 90, CONFIG.height);
      
      // White-hot core
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(centerX - 20, 0, 40, CONFIG.height);
      
      // Spark particles along the column during the firing state
      ctx.fillStyle = '#39ff14';
      for (let i = 0; i < 8; i++) {
        const ry = Math.random() * CONFIG.height;
        const rx = centerX + (Math.random() * 130 - 65);
        ctx.beginPath();
        ctx.arc(rx, ry, Math.random() * 4 + 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Draw Wall Turrets (Trench Level)
  wallTurrets.forEach(turret => turret.draw());

  // Draw Vector Debris under ships/lasers for clean layering
  debrisList.forEach(debris => debris.draw());

  // Draw EMP Shockwaves
  empShockwaves.forEach(emp => emp.draw());

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

  // Draw Wingman Drones next to player ship
  wingmanDrones.forEach(drone => drone.draw());

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
  playerUpgrades.wingman = 0;
  playerUpgrades.emp = 0;

  CONFIG.playerSpeed = CONFIG.playerSpeedBase;
  CONFIG.laserCooldown = CONFIG.laserCooldownBase;

  player = new PlayerShip();
  
  const records = getLeaderboard();
  highScore = records.length > 0 ? records[0].score : 0;

  // Toggle Screen Views
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('game-over-screen').classList.add('hidden');
  document.getElementById('shop-menu').classList.add('hidden');
  
  if (window.logAnalyticsEvent) {
    window.logAnalyticsEvent('game_start', { timestamp: Date.now() });
  }
  
  loadAndStartLevel();
}

function continueGame() {
  GameAudio.init();
  GameAudio.resume();

  // Reset health to full and score to 0 (classic arcade style)
  health = maxHealth;
  score = 0;
  
  // Re-create player ship
  player = new PlayerShip();

  // Hide Game Over Screen
  document.getElementById('game-over-screen').classList.add('hidden');
  
  if (window.logAnalyticsEvent) {
    window.logAnalyticsEvent('game_start', { timestamp: Date.now(), mode: 'continue', level: currentLevel });
  }

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
  
  if (window.logAnalyticsEvent) {
    window.logAnalyticsEvent('game_over', { score: score, level_reached: currentLevel });
  }
  
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

  // Handle Continue button visibility
  const btnContinue = document.getElementById('btn-continue');
  if (currentLevel > 1) {
    btnContinue.innerText = `CONTINUE SECTOR ${currentLevel}`;
    btnContinue.classList.remove('hidden');
  } else {
    btnContinue.classList.add('hidden');
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
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
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

  document.getElementById('btn-continue').addEventListener('click', () => {
    continueGame();
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
    if (window.logAnalyticsEvent) {
      window.logAnalyticsEvent('submit_score', { pilot: name, score: score });
    }
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
      
      if (window.logAnalyticsEvent) {
        window.logAnalyticsEvent('purchase_upgrade', { type: 'speed', level: playerUpgrades.speed });
      }
      
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
      
      if (window.logAnalyticsEvent) {
        window.logAnalyticsEvent('purchase_upgrade', { type: 'shield', level: playerUpgrades.shield });
      }
      
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
      
      if (window.logAnalyticsEvent) {
        window.logAnalyticsEvent('purchase_upgrade', { type: 'cooldown', level: playerUpgrades.cooldown });
      }
      
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
      
      if (window.logAnalyticsEvent) {
        window.logAnalyticsEvent('purchase_upgrade', { type: 'homing', level: playerUpgrades.homing });
      }
      
      GameAudio.playPowerUpSound();
      updateHangarUI();
      document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;
    }
  });

  document.getElementById('btn-buy-wingman').addEventListener('click', () => {
    const cost = upgradeCosts.wingman;
    if (scrapCredits >= cost && playerUpgrades.wingman === 0) {
      scrapCredits -= cost;
      playerUpgrades.wingman = 1;
      
      if (window.logAnalyticsEvent) {
        window.logAnalyticsEvent('purchase_upgrade', { type: 'wingman', level: playerUpgrades.wingman });
      }
      
      GameAudio.playPowerUpSound();
      updateHangarUI();
      document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;
    }
  });

  document.getElementById('btn-buy-emp').addEventListener('click', () => {
    const cost = upgradeCosts.emp;
    if (scrapCredits >= cost && playerUpgrades.emp === 0) {
      scrapCredits -= cost;
      playerUpgrades.emp = 1;
      
      if (window.logAnalyticsEvent) {
        window.logAnalyticsEvent('purchase_upgrade', { type: 'emp', level: playerUpgrades.emp });
      }
      
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

  const toggleBezel = document.getElementById('toggle-bezel');
  if (toggleBezel) {
    toggleBezel.addEventListener('change', e => {
      const container = document.getElementById('game-container');
      if (e.target.checked) {
        container.classList.add('crt-bezel-active');
      } else {
        container.classList.remove('crt-bezel-active');
      }
    });
    
    // Set initial state
    const container = document.getElementById('game-container');
    if (toggleBezel.checked) {
      container.classList.add('crt-bezel-active');
    } else {
      container.classList.remove('crt-bezel-active');
    }
  }

  requestAnimationFrame(gameTick);
});
