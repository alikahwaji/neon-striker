/* ----------------------------------------------------
   NEON STRIKER - Upgraded Web Audio API Synthesizer
   Features programmatic SFX (lasers, explosions, level clears)
   and a dynamic 16-step sequencer supporting unique movie themes:
   - Star Wars: Aggressive high-speed driving octaves.
   - Alien: Spooky deep-resonance organic drone.
   - Interstellar: Majestic church-organ style sine arpeggios.
   - Dune: Exotic desert micro-harmonic gold sand sweeps.
   ---------------------------------------------------- */

class SynthAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterMusicGain = null;
    this.masterSfxGain = null;
    
    // Volumes from 0.0 to 1.0
    this.musicVolume = 0.5;
    this.sfxVolume = 0.7;
    // Quick-mute state — when true, master gains are forced to 0 regardless
    // of musicVolume / sfxVolume so the player can silence the game with M
    // without losing their slider positions.
    this.muted = false;

    // BGM Sequencer state
    this.bgmInterval = null;
    this.bgmTempo = 110; // BPM
    this.currentStep = 0;
    
    // Pre-allocated noise buffer for explosions
    this.noiseBuffer = null;
    
    // Soundtrack active theme: 'standard', 'trench', 'organic', 'gargantua', 'spice'
    this.activeTheme = 'standard';
    
    // --- Chord and Scale Settings for Movie Soundtracks ---
    // 1. STANDARD THEME (C Minor scale)
    this.bassStandard = [65.41, 77.78, 58.27, 49.00]; // C2, Eb2, Bb1, G1
    this.arpStandard = [
      [130.81, 155.56, 196.00, 261.63], // Cm
      [155.56, 196.00, 233.08, 311.13], // Eb
      [116.54, 146.83, 174.61, 233.08], // Bb
      [98.00,  116.54, 146.83, 196.00]  // Gm
    ];

    // 2. TRENCH RUN - STAR WARS (D Minor aggressive battle tempo)
    this.bassTrench = [73.42, 87.31, 65.41, 55.00]; // D2, F2, C2, A1
    this.arpTrench = [
      [146.83, 174.61, 220.00, 293.66], // Dm
      [174.61, 220.00, 261.63, 349.23], // F
      [130.81, 164.81, 196.00, 261.63], // C
      [110.00, 138.59, 164.81, 220.00]  // Am
    ];

    // 3. XENOMORPH HIVE - ALIEN (E Locrian creepy low tension)
    this.bassAlien = [82.41, 87.31, 73.42, 61.74]; // E2, F2, D2, B1
    this.arpAlien = [
      [164.81, 174.61, 207.65, 329.63], // Creepy dissonant
      [174.61, 220.00, 246.94, 349.23],
      [146.83, 174.61, 196.00, 293.66],
      [123.47, 146.83, 164.81, 246.94]
    ];

    // 4. GARGANTUA - INTERSTELLAR (A Minor slow grand organ arpeggio)
    this.bassGargantua = [55.00, 65.41, 73.42, 49.00]; // A1, C2, D2, B1
    this.arpGargantua = [
      [220.00, 261.63, 329.63, 440.00], // Am (A3, C4, E4, A4)
      [261.63, 329.63, 392.00, 523.25], // C
      [293.66, 349.23, 440.00, 587.33], // Dm
      [246.94, 293.66, 392.00, 493.88]  // G
    ];

    // 5. SPICE ORBIT - DUNE (G Double Harmonic - exotic micro-tonal desert scale)
    this.bassSpice = [49.00, 51.91, 58.27, 49.00]; // G1, Ab1, B1, G1
    this.arpSpice = [
      [196.00, 207.65, 246.94, 293.66], // G Double-Harmonic chord
      [207.65, 261.63, 311.13, 415.30], // Ab major
      [233.08, 293.66, 349.23, 466.16], // B minor
      [196.00, 246.94, 293.66, 392.00]  // G
    ];

    // 6. TRON GRID - TRON (E Minor high-energy cyber synth)
    this.bassTron = [82.41, 98.00, 73.42, 82.41]; // E2, G2, D2, E2
    this.arpTron = [
      [164.81, 196.00, 246.94, 329.63], // Em
      [196.00, 246.94, 293.66, 392.00], // G
      [146.83, 174.61, 220.00, 293.66], // D
      [164.81, 220.00, 246.94, 329.63]  // Em9
    ];

    // 7. MATRIX - THE MATRIX (A Minor mechanical cyber beat)
    this.bassMatrix = [55.00, 58.27, 55.00, 61.74]; // A1, A#1, A1, B1
    this.arpMatrix = [
      [110.00, 130.81, 164.81, 220.00], // Am
      [116.54, 146.83, 174.61, 233.08], // A#m
      [110.00, 130.81, 164.81, 220.00], // Am
      [123.47, 155.56, 185.00, 246.94]  // Bm
    ];

    // 8. WEYLAND SENTRY - ALIENS (F# Minor military metal industrial)
    this.bassSentry = [92.50, 77.78, 82.41, 69.30]; // F#2, D#2, E2, C#2
    this.arpSentry = [
      [185.00, 220.00, 277.18, 369.99], // F#m
      [155.56, 196.00, 233.08, 311.13], 
      [164.81, 196.00, 246.94, 329.63],
      [138.59, 164.81, 207.65, 277.18]
    ];

    // 9. DEATH STAR CORE - STAR WARS CORE (G Minor dramatic orchestral)
    this.bassDsCore = [49.00, 39.00, 43.65, 49.00]; // G1, D#1, E1, G1
    this.arpDsCore = [
      [98.00, 116.54, 146.83, 196.00], // Gm
      [77.78, 98.00,  116.54, 155.56], // Eb
      [87.31, 110.00, 130.81, 174.61], // F
      [98.00, 116.54, 146.83, 196.00]  // Gm
    ];

    // 10. UNICRON MEGA BOSS - TRANSFORMERS (Distorted heavy metal arpeggiator)
    this.bassUnicron = [55.00, 48.99, 41.20, 55.00]; // A1, G1, E1, A1
    this.arpUnicron = [
      [110.00, 138.59, 164.81, 220.00], // A Triad
      [97.99,  123.47, 146.83, 195.99], // G Major
      [82.41,  103.83, 123.47, 164.81], // E Major
      [110.00, 138.59, 164.81, 220.00]  // A
    ];
  }

  // Initialize context on user interaction
  init() {
    if (this.ctx) return;
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    
    this.ctx = new AudioContextClass();
    
    // Create master gain nodes
    this.masterMusicGain = this.ctx.createGain();
    this.masterMusicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    this.masterMusicGain.connect(this.ctx.destination);
    
    this.masterSfxGain = this.ctx.createGain();
    this.masterSfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    this.masterSfxGain.connect(this.ctx.destination);
    
    this.createNoiseBuffer();
  }

  createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2.0; // 2.0 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  setMusicVolume(volumePercentage) {
    this.musicVolume = volumePercentage / 100;
    if (this.masterMusicGain && this.ctx && !this.muted) {
      this.masterMusicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.05);
    }
  }

  setSfxVolume(volumePercentage) {
    this.sfxVolume = volumePercentage / 100;
    if (this.masterSfxGain && this.ctx && !this.muted) {
      this.masterSfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * Flip the global mute state. Slider positions are preserved so unmute
   * restores the same volume the player picked. Returns the new muted
   * state so the caller (ui.js) can update the visual indicator.
   */
  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      const target = this.muted ? 0 : this.musicVolume;
      const sfxTarget = this.muted ? 0 : this.sfxVolume;
      if (this.masterMusicGain) {
        this.masterMusicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
      }
      if (this.masterSfxGain) {
        this.masterSfxGain.gain.setTargetAtTime(sfxTarget, this.ctx.currentTime, 0.02);
      }
    }
    return this.muted;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setTheme(themeName) {
    this.activeTheme = themeName;
    
    // Adjust tempo based on active theme
    if (themeName === 'standard') this.bgmTempo = 110;
    else if (themeName === 'trench') this.bgmTempo = 132;
    else if (themeName === 'organic') this.bgmTempo = 92;
    else if (themeName === 'gargantua') this.bgmTempo = 72; // Majestic, slow Church Organ pace
    else if (themeName === 'spice') this.bgmTempo = 100;
    else if (themeName === 'tron') this.bgmTempo = 138;
    else if (themeName === 'matrix') this.bgmTempo = 108;
    else if (themeName === 'wey_sentry') this.bgmTempo = 115;
    else if (themeName === 'ds_core') this.bgmTempo = 88;
    else if (themeName === 'unicron') this.bgmTempo = 148;
    
    // Restart BGM seamlessly if currently playing
    if (this.bgmInterval) {
      this.startBackgroundMusic();
    }
  }

  /* ----------------------------------------------------
     SOUND EFFECTS SYNTHESIZERS (ZERO FILES REQUIRED)
     ---------------------------------------------------- */
  
  // Tactical player laser shot
  playLaserSound(pitchMultiplier = 1.0) {
    if (!this.ctx) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(this.masterSfxGain);

    const now = this.ctx.currentTime;
    const duration = 0.15;

    osc.frequency.setValueAtTime(900 * pitchMultiplier, now);
    osc.frequency.exponentialRampToValueAtTime(100 * pitchMultiplier, now + duration);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  // Homing missile launch sound: rapid frequency pitch sweep ascending
  playHomingLaunchSound() {
    if (!this.ctx) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(this.masterSfxGain);

    const now = this.ctx.currentTime;
    const duration = 0.22;

    // Pitch sweep: fast sweep up like a rocket thruster
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + duration);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  // Hit sound when player strikes an enemy
  playHitSound() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(this.masterSfxGain);

    const now = this.ctx.currentTime;
    const duration = 0.06;

    osc.frequency.setValueAtTime(350, now);
    osc.frequency.setValueAtTime(120, now + duration);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  // Deep heavy drone sweep
  playBossLaserSound() {
    if (!this.ctx) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(this.masterSfxGain);

    const now = this.ctx.currentTime;
    const duration = 0.35;

    osc.frequency.setValueAtTime(250, now);
    osc.frequency.linearRampToValueAtTime(45, now + duration);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  // Custom retro white-noise explosion
  playExplosionSound(intensity = 1.0) {
    if (!this.ctx || !this.noiseBuffer) return;
    this.resume();

    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    source.buffer = this.noiseBuffer;
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400 * intensity, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.5 * intensity);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterSfxGain);

    const now = this.ctx.currentTime;
    const duration = 0.45 * intensity;

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.start(now);
    source.stop(now + duration + 0.05);
  }

  // Power-up pick up sound: ascending major scales
  playPowerUpSound() {
    if (!this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    
    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + (index * 0.04));
      
      osc.connect(gain);
      gain.connect(this.masterSfxGain);
      
      gain.gain.setValueAtTime(0.12, now + (index * 0.04));
      gain.gain.exponentialRampToValueAtTime(0.001, now + (index * 0.04) + 0.12);
      
      osc.start(now + (index * 0.04));
      osc.stop(now + (index * 0.04) + 0.15);
    });
  }

  // Epic Major Chord synth chime on clearing a level
  playLevelClearSound() {
    if (!this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    // Epic major C triad chord (C4, E4, G4, C5)
    const chord = [261.63, 329.63, 392.00, 523.25];
    
    chord.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // Warm pulse wave approximation using triangle
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      
      osc.connect(gain);
      gain.connect(this.masterSfxGain);
      
      // Delay and decay C major chime
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2 + (i * 0.15));
      
      osc.start(now);
      osc.stop(now + 1.5 + (i * 0.15));
    });
  }

  // Massive smart bomb explosion
  playBombSound() {
    if (!this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(this.masterSfxGain);
    
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 1.2);
    
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    
    osc.start(now);
    osc.stop(now + 1.25);

    this.playExplosionSound(2.5);
  }

  /* ----------------------------------------------------
     DYNAMIC MOVIE-THEMED BACKGROUND MUSIC SEQUENCER
     ---------------------------------------------------- */
  
  startBackgroundMusic() {
    this.init();
    if (!this.ctx) return;
    this.stopBackgroundMusic();

    const stepDuration = 60 / this.bgmTempo / 2; // 8th notes
    let nextNoteTime = this.ctx.currentTime;

    this.bgmInterval = setInterval(() => {
      const now = this.ctx.currentTime;

      // If the tab was backgrounded, setInterval throttles to ~1Hz. The
      // ctx clock keeps running, so nextNoteTime can fall 30+ seconds
      // behind real time. Without a guard, this while-loop would schedule
      // hundreds of overlapping notes the instant the tab regains focus.
      // Snap forward when we detect a large gap so we resume cleanly.
      if (now - nextNoteTime > 0.5) {
        nextNoteTime = now;
      }

      // Hard cap on how many notes a single tick can schedule, so any
      // hitch (debugger pause, GC, etc.) can't burst-fire the synth.
      let scheduled = 0;
      while (nextNoteTime < now + 0.1 && scheduled < 8) {
        this.scheduleSequencerStep(nextNoteTime);
        nextNoteTime += stepDuration;
        scheduled++;
      }
    }, 50);
  }

  stopBackgroundMusic() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  scheduleSequencerStep(time) {
    let bassNotes = this.bassStandard;
    let arpNotes = this.arpStandard;
    let synthType = 'sawtooth';
    let arpeggiatorType = 'triangle';
    let bassVolume = 0.12;
    let arpVolume = 0.05;

    // Shift sequencer parameters depending on the active movie theme
    switch (this.activeTheme) {
      case 'trench': // Star Wars
        bassNotes = this.bassTrench;
        arpNotes = this.arpTrench;
        synthType = 'sawtooth';
        arpeggiatorType = 'sawtooth'; // Aggressive military saw notes
        bassVolume = 0.14;
        break;
      case 'organic': // Alien
        bassNotes = this.bassAlien;
        arpNotes = this.arpAlien;
        synthType = 'triangle'; // Smooth spooky pulse
        arpeggiatorType = 'sine'; // Whispering sine clicks
        bassVolume = 0.16;
        arpVolume = 0.04;
        break;
      case 'gargantua': // Interstellar
        bassNotes = this.bassGargantua;
        arpNotes = this.arpGargantua;
        synthType = 'sine'; // Pipe organ approximation
        arpeggiatorType = 'sine';
        bassVolume = 0.18; // Heavy massive drones
        arpVolume = 0.07;
        break;
      case 'spice': // Dune
        bassNotes = this.bassSpice;
        arpNotes = this.arpSpice;
        synthType = 'sawtooth';
        arpeggiatorType = 'triangle';
        bassVolume = 0.12;
        arpVolume = 0.06;
        break;
      case 'tron': // TRON Grid
        bassNotes = this.bassTron;
        arpNotes = this.arpTron;
        synthType = 'triangle';
        arpeggiatorType = 'sawtooth';
        bassVolume = 0.13;
        arpVolume = 0.06;
        break;
      case 'matrix': // Matrix rain
        bassNotes = this.bassMatrix;
        arpNotes = this.arpMatrix;
        synthType = 'sawtooth';
        arpeggiatorType = 'sine';
        bassVolume = 0.14;
        arpVolume = 0.04;
        break;
      case 'wey_sentry': // Aliens Colony
        bassNotes = this.bassSentry;
        arpNotes = this.arpSentry;
        synthType = 'sawtooth';
        arpeggiatorType = 'triangle';
        bassVolume = 0.15;
        arpVolume = 0.05;
        break;
      case 'ds_core': // Death Star
        bassNotes = this.bassDsCore;
        arpNotes = this.arpDsCore;
        synthType = 'triangle';
        arpeggiatorType = 'sine';
        bassVolume = 0.16;
        arpVolume = 0.06;
        break;
      case 'unicron': // Final Boss
        bassNotes = this.bassUnicron;
        arpNotes = this.arpUnicron;
        synthType = 'sawtooth';
        arpeggiatorType = 'sawtooth';
        bassVolume = 0.18;
        arpVolume = 0.07;
        break;
      default: // Standard
        bassNotes = this.bassStandard;
        arpNotes = this.arpStandard;
        synthType = 'sawtooth';
        arpeggiatorType = 'triangle';
        break;
    }

    const chordIndex = Math.floor(this.currentStep / 16) % bassNotes.length;
    const stepInPattern = this.currentStep % 16;
    
    const bassFreq = bassNotes[chordIndex];
    const chords = arpNotes[chordIndex];
    
    // Play Driving Synthwave Bassline on 8th notes
    const bassRhythm = [0, 2, 4, 6, 8, 10, 12, 14];
    if (bassRhythm.includes(stepInPattern)) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = synthType;
      
      // Octave pattern jumps for classic synthwave feel
      let freq = bassFreq;
      if (this.activeTheme === 'trench') {
        // Fast triple military rhythm
        if (stepInPattern % 4 !== 0) freq *= 2;
      } else {
        if (stepInPattern % 4 === 2) freq *= 2; // Jump up 1 octave on off-beats
      }
      
      osc.frequency.setValueAtTime(freq, time);
      
      osc.connect(gain);
      gain.connect(this.masterMusicGain);
      
      gain.gain.setValueAtTime(bassVolume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + (this.activeTheme === 'gargantua' ? 0.35 : 0.18));
      
      osc.start(time);
      osc.stop(time + (this.activeTheme === 'gargantua' ? 0.4 : 0.2));
    }
    
    // Interstellar / Organs use customized majestic arpeggio step models
    let arpeggioSteps = [0, 2, 4, 6, 8, 10, 12, 14];
    if (this.activeTheme === 'gargantua') {
      // Slow majestic church organ sweeping steps
      arpeggioSteps = [0, 4, 8, 12];
    }
    
    if (arpeggioSteps.includes(stepInPattern)) {
      let chordStep = 0;
      if (this.activeTheme === 'gargantua') {
        chordStep = (stepInPattern / 4) % chords.length;
      } else {
        const arpStepsMap = { 0: 0, 2: 1, 4: 2, 6: 3, 8: 2, 10: 1, 12: 3, 14: 2 };
        chordStep = arpStepsMap[stepInPattern];
      }

      const noteToPlay = chords[chordStep];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = arpeggiatorType;
      osc.frequency.setValueAtTime(noteToPlay * 2, time); // Play one octave higher
      
      osc.connect(gain);
      gain.connect(this.masterMusicGain);
      
      gain.gain.setValueAtTime(arpVolume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + (this.activeTheme === 'gargantua' ? 0.45 : 0.25));
      
      osc.start(time);
      osc.stop(time + (this.activeTheme === 'gargantua' ? 0.5 : 0.3));
    }

    // Progress sequencer
    this.currentStep++;
  }
}

// Instantiate global audio manager
const GameAudio = new SynthAudioEngine();
