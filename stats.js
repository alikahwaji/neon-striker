/* ----------------------------------------------------
   NEON STRIKER - Pilot Stats Tracker
   ----------------------------------------------------
   Cross-run statistics for the PILOT PROFILE panel. Persists to
   localStorage so totals accumulate across sessions. Wired into the
   game via Stats.notify(event, payload) calls + Stats.tickPlaytime()
   from the main loop.

   Tracked metrics:
     totalKills        cumulative enemies destroyed
     totalScrap        cumulative scrap credits collected
     totalPlaytime     seconds the game has been actively running
                       (excludes paused, intro, and menu time)
     runsStarted       number of times a new run has begun
     runsCompleted     runs where the player beat Level 20
     longestRunLevel   deepest sector reached (campaign or endless)
     bestCombo         highest combo multiplier reached
     skinUsage         { skin: timesPicked } — feeds 'favourite skin'
   ---------------------------------------------------- */

const STATS_STORAGE_KEY = 'neon_striker_stats_v1';

const Stats = (function () {
  const data = {
    totalKills: 0,
    totalScrap: 0,
    totalPlaytime: 0,
    runsStarted: 0,
    runsCompleted: 0,
    longestRunLevel: 0,
    bestCombo: 1,
    skinUsage: {}
  };

  // Used to throttle persistence — every save hits localStorage which
  // serialises the whole object, so we don't want to write on every frame.
  let dirty = false;
  let lastFlushMs = 0;

  function persist() {
    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(data));
      dirty = false;
    } catch (e) {
      console.warn('Failed to persist stats:', e);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STATS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.keys(data).forEach(k => {
          if (k in parsed) data[k] = parsed[k];
        });
      }
    } catch (e) {
      console.warn('Failed to load stats:', e);
    }
  }

  function notify(eventName, payload) {
    if (eventName === 'enemy_destroyed') {
      data.totalKills++;
      if (payload && typeof payload.combo === 'number' && payload.combo > 0) {
        // bestCombo tracks the highest combo *multiplier* not raw count;
        // reuse the threshold ladder so a combo of 20 records as ×5.
        const m = payload.combo >= 20 ? 5
                : payload.combo >= 12 ? 4
                : payload.combo >= 7 ? 3
                : payload.combo >= 3 ? 2 : 1;
        if (m > data.bestCombo) data.bestCombo = m;
      }
      dirty = true;
    } else if (eventName === 'scrap_collected') {
      data.totalScrap += (payload && payload.amount) || 0;
      dirty = true;
    } else if (eventName === 'run_started') {
      data.runsStarted++;
      if (payload && payload.skin) {
        data.skinUsage[payload.skin] = (data.skinUsage[payload.skin] || 0) + 1;
      }
      dirty = true;
      persist(); // flush immediately so a crash mid-run doesn't lose the count
    } else if (eventName === 'level_completed') {
      const lv = (payload && payload.level) || 0;
      if (lv > data.longestRunLevel) data.longestRunLevel = lv;
      // Beating Level 20 = full campaign completion.
      if (lv >= 20) data.runsCompleted++;
      dirty = true;
      persist();
    }
  }

  // Called every frame the player is actively playing. dt is in ms.
  function tickPlaytime(dtMs) {
    data.totalPlaytime += dtMs / 1000;
    dirty = true;
    // Flush at most every 10 seconds to avoid hot-path localStorage cost.
    const now = Date.now();
    if (now - lastFlushMs > 10000) {
      lastFlushMs = now;
      persist();
    }
  }

  function getSnapshot() {
    return Object.assign({}, data);
  }

  // Resolve favourite skin from skinUsage map; ties broken by insertion order.
  function getFavouriteSkin() {
    let best = null;
    let bestCount = 0;
    Object.keys(data.skinUsage).forEach(k => {
      if (data.skinUsage[k] > bestCount) {
        best = k;
        bestCount = data.skinUsage[k];
      }
    });
    return best;
  }

  // Format seconds as 'Xh Ym' or 'Ym Zs' — for the playtime card.
  function formatPlaytime(secs) {
    if (secs >= 3600) {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      return `${h}h ${m}m`;
    }
    if (secs >= 60) {
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return `${m}m ${s}s`;
    }
    return `${Math.floor(secs)}s`;
  }

  // Window-unload safety net — flush any pending writes.
  window.addEventListener('beforeunload', () => {
    if (dirty) persist();
  });

  load();

  return { notify, tickPlaytime, getSnapshot, getFavouriteSkin, formatPlaytime };
})();

window.Stats = Stats;
