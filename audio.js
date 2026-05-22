/* ----------------------------------------------------
   NEON STRIKER - Web Audio API Sound Synthesizer Engine
   Zero-dependency, programmatically generated retro SFX
   and driving synthwave background music (BGM).
   ---------------------------------------------------- */

class SynthAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterMusicGain = null;
    this.masterSfxGain = null;
    
    // Volumes from 0.0 to 1.0
    this.musicVolume = 0.5;
    this.sfxVolume = 0.7;
    
    // Background Music (BGM) Sequencer State
    this.bgmInterval = null;
    this.bgmTempo = 110; // BPM
    this.currentStep = 0;
    
    // Pre-allocated noise buffer for explosion SFX
    this.noiseBuffer = null;
    
    // Synthwave Bass Sequence (C Minor scale chord progression)
    // C, Eb, Bb, G
    this.bassNotes = [
      65.41,  // C2
      77.78,  // Eb2
      58.27,  // Bb1
      49.00   // G1
    ];
    
    // Arpeggiation melody notes (C Minor chords: Cm, Eb, Bb, Gm)
    this.arpNotes = [
      [130.81, 155.56, 196.00, 261.63], // Cm (C3, Eb3, G3, C4)
      [155.56, 196.00, 233.08, 311.13], // Eb (Eb3, G3, Bb3, Eb4)
      [116.54, 146.83, 174.61, 233.08], // Bb (Bb2, D3, F3, Bb3)
      [98.00,  116.54, 146.83, 196.00]  // Gm (G2, Bb2, D3, G3)
    ];
  }

  // Initialize Audio Context on user gesture
  init() {
    if (this.ctx) return;
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("Web Audio API not supported in this browser.");
      return;
    }
    
    this.ctx = new AudioContextClass();
    
    // Create master gain nodes
    this.masterMusicGain = this.ctx.createGain();
    this.masterMusicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    this.masterMusicGain.connect(this.ctx.destination);
    
    this.masterSfxGain = this.ctx.createGain();
    this.masterSfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    this.masterSfxGain.connect(this.ctx.destination);
    
    // Generate white noise buffer
    this.createNoiseBuffer();
  }

  createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 1.5; // 1.5 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  setMusicVolume(volumePercentage) {
    this.musicVolume = volumePercentage / 100;
    if (this.masterMusicGain && this.ctx) {
      this.masterMusicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.05);
    }
  }

  setSfxVolume(volumePercentage) {
    this.sfxVolume = volumePercentage / 100;
    if (this.masterSfxGain && this.ctx) {
      this.masterSfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  // Resume context if suspended
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
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

    // Pitch sweep: fast decay from high to low
    osc.frequency.setValueAtTime(900 * pitchMultiplier, now);
    osc.frequency.exponentialRampToValueAtTime(100 * pitchMultiplier, now + duration);

    // Volume decay: fast decay
    gain.gain.setValueAtTime(0.3, now);
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

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  // Deeper laser fired by the giant boss
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

    // Deep heavy drone sweep
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.linearRampToValueAtTime(45, now + duration);

    gain.gain.setValueAtTime(0.4, now);
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
    
    // Lowpass filter creates heavy thudding sound
    filter.type = 'lowpass';
    // Higher intensity = deeper/wider sound
    filter.frequency.setValueAtTime(400 * intensity, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.5 * intensity);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterSfxGain);

    const now = this.ctx.currentTime;
    const duration = 0.45 * intensity;

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.start(now);
    source.stop(now + duration + 0.05);
  }

  // Power-up pick up sound: ascending futuristic arpeggio
  playPowerUpSound() {
    if (!this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // Ascending C major scales
    
    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + (index * 0.04));
      
      osc.connect(gain);
      gain.connect(this.masterSfxGain);
      
      gain.gain.setValueAtTime(0.15, now + (index * 0.04));
      gain.gain.exponentialRampToValueAtTime(0.001, now + (index * 0.04) + 0.12);
      
      osc.start(now + (index * 0.04));
      osc.stop(now + (index * 0.04) + 0.15);
    });
  }

  // Massive smart bomb explosion
  playBombSound() {
    if (!this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    
    // Bass drop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(this.masterSfxGain);
    
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 1.2);
    
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    
    osc.start(now);
    osc.stop(now + 1.25);

    // Dynamic noise rumble
    this.playExplosionSound(2.5);
  }

  /* ----------------------------------------------------
     BACKGROUND SYNTHWAVE MUSIC SEQUENCER (16-STEP GRID)
     ---------------------------------------------------- */
  
  startBackgroundMusic() {
    this.init();
    if (!this.ctx) return;
    this.stopBackgroundMusic();
    
    const stepDuration = 60 / this.bgmTempo / 2; // Eighth notes
    let nextNoteTime = this.ctx.currentTime;
    
    this.bgmInterval = setInterval(() => {
      const now = this.ctx.currentTime;
      while (nextNoteTime < now + 0.1) {
        this.scheduleSequencerStep(nextNoteTime);
        nextNoteTime += stepDuration;
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
    const chordIndex = Math.floor(this.currentStep / 16) % this.bassNotes.length;
    const stepInPattern = this.currentStep % 16;
    
    const bassFreq = this.bassNotes[chordIndex];
    const chords = this.arpNotes[chordIndex];
    
    // Play Driving Synthwave Bassline on 8th notes (steps 0, 2, 3, 5, 6, 8, 10, 11, 13, 14 etc.)
    const bassRhythm = [0, 2, 4, 6, 8, 10, 12, 14];
    if (bassRhythm.includes(stepInPattern)) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      
      // Octave pattern jumps for classic synthwave feel
      let freq = bassFreq;
      if (stepInPattern % 4 === 2) freq *= 2; // Jump up 1 octave on off-beats
      
      osc.frequency.setValueAtTime(freq, time);
      
      osc.connect(gain);
      gain.connect(this.masterMusicGain);
      
      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
      
      osc.start(time);
      osc.stop(time + 0.2);
    }
    
    // Synthesized Melodic Arpeggio Pattern (adds beautiful sci-fi backing theme)
    const arpSteps = {
      0: 0,  // chord root
      2: 1,  // third
      4: 2,  // fifth
      6: 3,  // octave
      8: 2,  // fifth
      10: 1, // third
      12: 3, // octave
      14: 2  // fifth
    };
    
    if (arpSteps[stepInPattern] !== undefined) {
      const noteToPlay = chords[arpSteps[stepInPattern]];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(noteToPlay * 2, time); // Play one octave higher
      
      osc.connect(gain);
      gain.connect(this.masterMusicGain);
      
      // Softer volume for background arpeggio
      gain.gain.setValueAtTime(0.05, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
      
      osc.start(time);
      osc.stop(time + 0.3);
    }

    // Progress sequencer
    this.currentStep++;
  }
}

// Instantiate global audio manager
const GameAudio = new SynthAudioEngine();
