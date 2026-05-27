/* ----------------------------------------------------
   NEON STRIKER - Game Configuration & Shared State
   Static config + mutable global state shared across modules.
   Loaded first via <script> tag so all sibling scripts see
   these top-level let/const bindings in the shared script scope.
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
// One-shot keypress edges, populated by the keydown handler in ui.js and
// cleared by updateGame() each frame. Used for actions that must fire on
// press (e.g. EMP) so holding the key doesn't auto-retrigger every frame.
let keysPressed = {};
let gameActive = false;
let gamePaused = false;
let inShop = false;
let inIntro = false;
let score = 0;
let highScore = 0;
let currentLevel = 1;

// All-Ages Expansion globals
let selectedDifficulty = 'hero'; // 'cadet', 'hero', 'elite'
let selectedSkin = 'default';    // 'default', 'toxic', 'solar', 'void', 'saucer'
let cheatRainbow = false;
let cheatGod = false;
let cheatMatrix = false;

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
  emp: 0,        // 0 = Locked, 1 = Unlocked
  magnet: 0      // 0 = Locked, 1 = Unlocked
};

const upgradeCosts = {
  speed: [100, 150, 220, 300, 400],
  shield: [150, 220, 300, 400, 500],
  cooldown: [200, 280, 380, 500, 650],
  homing: 300,
  wingman: 350,
  emp: 400,
  magnet: 250
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

// Level Data - 20 Structured Sectors
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
   CONFIG/GETTER METHODS
   ---------------------------------------------------- */
CONFIG.playerShieldActive = function() {
  return activePowerUps['SHIELD'] && activePowerUps['SHIELD'] > 0;
};
