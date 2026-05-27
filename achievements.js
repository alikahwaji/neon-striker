/* ----------------------------------------------------
   NEON STRIKER - Achievements System
   ----------------------------------------------------
   Local-only achievement tracking. Each definition has a check()
   predicate that runs against an event payload + accumulated state;
   first time check returns true the achievement unlocks and a toast
   appears. Unlocked IDs and cross-run counters persist to localStorage.

   Game code wires in via Achievements.notify(eventName, payload). The
   module owns its own state — callers don't need to know which counters
   feed which achievement.
   ---------------------------------------------------- */

const ACHIEVEMENTS_STORAGE_KEY = 'neon_striker_achievements_v1';

// Each achievement is a self-contained def: visible metadata + a
// pure-ish check() that reads (event, payload, state) and returns
// true the moment its condition is satisfied. Order in this array
// is also the display order in the panel.
const ACHIEVEMENT_DEFS = [
  {
    id: 'first_blood',
    icon: '🩸',
    name: 'First Blood',
    description: 'Destroy your first enemy.',
    check: (e, p, s) => e === 'enemy_destroyed' && s.cumulative.enemiesDestroyed >= 1
  },
  {
    id: 'sharpshooter',
    icon: '💯',
    name: 'Sharpshooter',
    description: 'Destroy 100 enemies across all runs.',
    check: (e, p, s) => e === 'enemy_destroyed' && s.cumulative.enemiesDestroyed >= 100
  },
  {
    id: 'untouchable',
    icon: '🛡️',
    name: 'Untouchable',
    description: 'Complete any level without taking damage.',
    check: (e, p, s) => e === 'level_cleared' && s.perRun.damageTakenThisLevel === 0
  },
  {
    id: 'cadet_wings',
    icon: '🌱',
    name: 'Cadet Wings',
    description: 'Beat Level 5 on any difficulty.',
    check: (e, p, s) => e === 'level_cleared' && p && p.level >= 5
  },
  {
    id: 'sector_cleared',
    icon: '🌌',
    name: 'Sector Cleared',
    description: 'Beat Level 10.',
    check: (e, p, s) => e === 'level_cleared' && p && p.level >= 10
  },
  {
    id: 'champion',
    icon: '👑',
    name: 'Cybernetic Champion',
    description: 'Beat all 20 campaign levels.',
    check: (e, p, s) => e === 'level_cleared' && p && p.level >= 20
  },
  {
    id: 'elite_pilot',
    icon: '💀',
    name: 'Elite Pilot',
    description: 'Beat any level on Elite difficulty.',
    check: (e, p, s) => e === 'level_cleared' && s.perRun.difficulty === 'elite'
  },
  {
    id: 'fully_loaded',
    icon: '🚀',
    name: 'Fully Loaded',
    description: 'Buy 5 different upgrade types in one run.',
    check: (e, p, s) => e === 'upgrade_purchased' && s.perRun.upgradeTypes.size >= 5
  },
  {
    id: 'art_collector',
    icon: '🎨',
    name: 'Art Collector',
    description: 'Try all 5 paint skins.',
    // The 5 painted skins (saucer is a cheat-unlocked bonus, not counted).
    check: (e, p, s) => e === 'skin_selected' && ['default', 'toxic', 'solar', 'void', 'rainbow'].every(k => s.skinsTried.has(k))
  },
  {
    id: 'cheat_engaged',
    icon: '🤖',
    name: 'Cheat Engaged',
    description: 'Discover any cheat code.',
    check: (e, p, s) => e === 'cheat_entered'
  },
  {
    id: 'magnet_master',
    icon: '🧲',
    name: 'Magnet Master',
    description: 'Collect 500 scrap credits in one run.',
    check: (e, p, s) => e === 'scrap_collected' && s.perRun.scrapCollected >= 500
  },
  {
    id: 'beyond_twenty',
    icon: '♾️',
    name: 'Beyond Sector 20',
    description: 'Reach endless mode (Sector 21+).',
    check: (e, p, s) => e === 'level_started' && p && p.level > 20
  },
  {
    id: 'daily_pilot',
    icon: '🌙',
    name: 'Daily Pilot',
    description: 'Submit a daily challenge score.',
    check: (e, p, s) => e === 'daily_score_submitted'
  }
];

const Achievements = (function () {
  // Cross-run cumulative + per-run scratch state. Cross-run pieces get
  // persisted; perRun is reset by startRun().
  const state = {
    unlocked: new Set(),
    cumulative: { enemiesDestroyed: 0 },
    skinsTried: new Set(),
    perRun: {
      enemiesDestroyed: 0,
      damageTakenThisLevel: 0,
      scrapCollected: 0,
      difficulty: 'hero',
      upgradeTypes: new Set()
    }
  };

  function persist() {
    try {
      const payload = {
        unlocked: [...state.unlocked],
        cumulative: state.cumulative,
        skinsTried: [...state.skinsTried]
      };
      localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to persist achievements:', e);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.unlocked)) {
        parsed.unlocked.forEach(id => state.unlocked.add(id));
      }
      if (parsed && parsed.cumulative && typeof parsed.cumulative.enemiesDestroyed === 'number') {
        state.cumulative.enemiesDestroyed = parsed.cumulative.enemiesDestroyed;
      }
      if (parsed && Array.isArray(parsed.skinsTried)) {
        parsed.skinsTried.forEach(s => state.skinsTried.add(s));
      }
    } catch (e) {
      console.warn('Failed to load achievements:', e);
    }
  }

  // Update state from an event, then check every locked achievement
  // against the new state. Returns the list of newly unlocked defs (the
  // toast renderer in ui.js subscribes via the 'unlocked' callback below).
  function notify(eventName, payload) {
    // Counter / set bookkeeping per event.
    if (eventName === 'enemy_destroyed') {
      state.cumulative.enemiesDestroyed++;
      state.perRun.enemiesDestroyed++;
    } else if (eventName === 'damage_taken') {
      state.perRun.damageTakenThisLevel += (payload && payload.amount) || 1;
    } else if (eventName === 'scrap_collected') {
      state.perRun.scrapCollected += (payload && payload.amount) || 1;
    } else if (eventName === 'skin_selected') {
      if (payload && payload.skin) state.skinsTried.add(payload.skin);
    } else if (eventName === 'upgrade_purchased') {
      if (payload && payload.type) state.perRun.upgradeTypes.add(payload.type);
    }

    const newlyUnlocked = [];
    for (const def of ACHIEVEMENT_DEFS) {
      if (state.unlocked.has(def.id)) continue;
      let triggered = false;
      try {
        triggered = !!def.check(eventName, payload, state);
      } catch (e) { /* defensive — never let a check crash gameplay */ }
      if (triggered) {
        state.unlocked.add(def.id);
        newlyUnlocked.push(def);
      }
    }

    if (newlyUnlocked.length > 0) {
      persist();
      newlyUnlocked.forEach(def => emit('unlocked', def));
    } else if (eventName === 'enemy_destroyed' || eventName === 'scrap_collected') {
      // Cumulative counters need to be saved even when no achievement fires,
      // otherwise refreshes wipe progress toward Sharpshooter etc.
      persist();
    }
    return newlyUnlocked;
  }

  // Reset per-run scratch state at the start of a new game session.
  function startRun(difficulty) {
    state.perRun.enemiesDestroyed = 0;
    state.perRun.damageTakenThisLevel = 0;
    state.perRun.scrapCollected = 0;
    state.perRun.difficulty = difficulty || 'hero';
    state.perRun.upgradeTypes = new Set();
  }

  // Reset per-level damage counter (called at the start of each level so
  // Untouchable's check sees clean state when level_cleared fires).
  function startLevel() {
    state.perRun.damageTakenThisLevel = 0;
  }

  // Tiny event-bus so ui.js can subscribe to unlock events for the toast.
  const listeners = {};
  function on(evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
  }
  function emit(evt, payload) {
    (listeners[evt] || []).forEach(fn => {
      try { fn(payload); } catch (e) { console.warn('Achievement listener threw:', e); }
    });
  }

  function getDefs() { return ACHIEVEMENT_DEFS; }
  function getUnlocked() { return state.unlocked; }
  function isUnlocked(id) { return state.unlocked.has(id); }

  // Initialise on script load so saved progress is available before any
  // notify() calls (the rAF loop hasn't started yet at this point).
  load();

  return { notify, startRun, startLevel, on, getDefs, getUnlocked, isUnlocked };
})();

// Expose for ui.js / main.js / collisions.js (classic-script scope).
window.Achievements = Achievements;
