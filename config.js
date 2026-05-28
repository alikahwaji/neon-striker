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

// True when a SCORING-advantage cheat was active during the current run:
//   * god mode (invincibility) — set at run start if cheatGod is on
//   * DEATH BLOSSOM (Konami 8-way burst) — set when triggered mid-run
// Purely cosmetic cheats (rainbow lasers, matrix backdrop, saucer skin)
// do NOT taint a run. Tainted runs still save a LOCAL high score but are
// withheld from the global + daily Firestore leaderboards so cheats can't
// pad the shared boards. Reset at the top of each fresh run (startGame).
let runTainted = false;

// Boss Rush mode — fight the four campaign bosses back-to-back with no
// shop interludes, no continues, single score. bossRushIndex advances
// through BOSS_RUSH_SEQUENCE; when it exceeds the array, the run ends.
let bossRushMode = false;
let bossRushIndex = 0;
const BOSS_RUSH_SEQUENCE = [
  { title: 'BOSS RUSH 1/4', subtitle: 'DREADNOUGHT CRUISER', theme: 'standard', bossType: 'dreadnought',
    quote: '⚠️ BOSS RUSH INITIATED ⚠️\nFour titans, no shops, no continues. Survive.' },
  { title: 'BOSS RUSH 2/4', subtitle: 'THE CYBER COMMANDER', theme: 'trench', bossType: 'cyber_commander',
    quote: 'Cyber Commander warps in. The flagship\'s orbital bullet hell awaits.' },
  { title: 'BOSS RUSH 3/4', subtitle: 'ARRAKIS SANDWORM', theme: 'spice', bossType: 'sandworm',
    quote: 'Serpentine titan rises from the spice orbit. Mind the shield rings.' },
  { title: 'BOSS RUSH 4/4', subtitle: 'UNICRON THE DEVOURER', theme: 'unicron', bossType: 'unicron',
    quote: 'Final boss. Survive his phase-2 singularity and the gauntlet is yours.' }
];

// Daily Challenge globals — when dailyMode is true, Math.random is
// overridden with a Mulberry32 PRNG seeded by today's UTC date so every
// player faces the same enemy spawn timings, asteroid drops, and power-up
// rolls. Difficulty is locked to 'hero'. dailyDate holds the seed key
// (YYYY-MM-DD UTC) so scores can be tagged correctly on submission.
let dailyMode = false;
let dailyDate = null;
// Stash the original Math.random so deactivateDailySeed() can restore it
// cleanly when the run ends or the player aborts.
const realMathRandom = Math.random;

// Compute the current UTC date as YYYY-MM-DD. Used as both the PRNG seed
// and the Firestore document field for daily leaderboard scoping.
function todayDateUTC() {
  const d = new Date();
  return d.getUTCFullYear() + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0');
}

// Mulberry32 PRNG — small, fast, decent distribution. Seeded by hashing
// the date string with FNV-1a so seeds differ meaningfully day-to-day.
function activateDailySeed(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let seed = h >>> 0;
  Math.random = function dailySeededRandom() {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deactivateDailySeed() {
  Math.random = realMathRandom;
}

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

// Countdown (ms) between critical-health heartbeat beeps. Driven from
// updateGame; reset to 0 whenever health exits the critical band so the
// first re-entry into low-health territory beeps immediately.
let criticalHeartbeatTimer = 0;

// Shared per-frame timestamp. Set once at the top of gameTick() to
// Date.now(), then read by every per-frame draw / update that needs a
// time-based effect (rainbow hue cycling, invuln blink, saucer light
// spin, shield bubble pulse, light-cycle trail expiry, etc.). Replaces
// the dozens of inline Date.now() calls that were peppering the hot
// path. Bonus: every effect within a single frame uses the SAME timestamp,
// so cross-effect animations stay phase-locked. */
let frameNow = 0;

// Monotonic ID counter for entities that need cheap O(1) dedup keys.
// Used by piercing-laser collision tracking: instead of allocating a
// new Set() per pierce-laser to remember "did I hit this enemy already?",
// the laser keeps a plain Object.create(null) keyed by entity.id. Set
// allocation + .has()/.add() overhead is replaced by a single property
// lookup. Numeric ids never collide because each entity ctor bumps the
// counter exactly once.
let nextEntityId = 0;

// Score combo multiplier state. Each consecutive kill within COMBO_WINDOW_MS
// of the previous bumps comboKills; the multiplier is derived from
// comboKills (3 kills → ×2, 7 → ×3, 12 → ×4, 20 → ×5). Reset to 0 on any
// damage taken or when comboTimer expires. Score added on destroyEnemy is
// multiplied by getComboMultiplier() at award time.
let comboKills = 0;
let comboTimer = 0;
const COMBO_WINDOW_MS = 2000;

function getComboMultiplier() {
  if (comboKills >= 20) return 5;
  if (comboKills >= 12) return 4;
  if (comboKills >= 7) return 3;
  if (comboKills >= 3) return 2;
  return 1;
}

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
