// audio.js: all the sound for the 3D page. It needs no audio files:
//   - the cap's rolling sound (rumble + grit + metal rattle from the cap's teeth) is generated live from its speed
//   - the ambient music is an original slow pad with distant bells, also generated live
// Optional: drop your own royalty-free loop at MUSIC_FILE and it is used instead of the generated music.
// Browsers only allow sound after the visitor clicks or presses a key, so everything starts on the first interaction.

const MUSIC_FILE = 'assets/home pg/audio/ambient.mp3';
const STORE = 'portfolio-sound';
const CAP_TEETH = 21, CAP_RADIUS = 0.23;                 // a bottle cap has about 21 crimps: one rattle each as it rolls

let ctx = null, master, sfxBus, musicBus, reverb;
let enabled = true;
try { enabled = localStorage.getItem(STORE) !== 'off'; } catch (e) {}
const vol = { music: 0.5, sfx: 0.6 };
const rand = (a, b) => a + Math.random() * (b - a);
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------
const cap = {};
let burstBuf;

function noiseBuffer(seconds, brown) {
    const n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
}

function impulse(seconds, decay) {
    const n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
}

function loopSource(buf, rate = 1) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(); return s; }

function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = enabled ? 1 : 0;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = vol.music * 0.4; musicBus.connect(master);
    reverb = ctx.createConvolver(); reverb.buffer = impulse(4.5, 2.2);
    const wet = ctx.createGain(); wet.gain.value = 0.9; reverb.connect(wet); wet.connect(musicBus);

    // Cap: low rumble (concrete), mid grit (concrete again), a ringing band (metal). All run silently; the cap's speed opens them.
    burstBuf = noiseBuffer(0.2, false);
    cap.rumbleSrc = loopSource(noiseBuffer(2, true));
    const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 220;
    cap.rumble = ctx.createGain(); cap.rumble.gain.value = 0; cap.rumbleSrc.connect(low); low.connect(cap.rumble); cap.rumble.connect(sfxBus);

    const white = noiseBuffer(2, false);
    cap.gritFilter = ctx.createBiquadFilter(); cap.gritFilter.type = 'bandpass'; cap.gritFilter.frequency.value = 1200; cap.gritFilter.Q.value = 0.8;
    cap.grit = ctx.createGain(); cap.grit.gain.value = 0; loopSource(white, 0.9).connect(cap.gritFilter); cap.gritFilter.connect(cap.grit); cap.grit.connect(sfxBus);

    const ring = ctx.createBiquadFilter(); ring.type = 'bandpass'; ring.frequency.value = 3300; ring.Q.value = 6;
    cap.ring = ctx.createGain(); cap.ring.gain.value = 0; loopSource(white, 1.1).connect(ring); ring.connect(cap.ring); cap.ring.connect(sfxBus);
}

// ---------------------------------------------------------------------------
// Cap sounds
// ---------------------------------------------------------------------------
let tickAcc = 0, rolling = false;

function capRoll(v, dt) {
    if (!ctx || !enabled) return;
    if (v <= 0.01 && !rolling) return;                    // nothing to do while it is still
    rolling = v > 0.01;
    const level = Math.min(1, v / 3), t = ctx.currentTime;
    cap.rumble.gain.setTargetAtTime(0.9 * level, t, 0.06);
    cap.grit.gain.setTargetAtTime(0.32 * level, t, 0.06);
    cap.gritFilter.frequency.setTargetAtTime(900 + 1500 * level, t, 0.08);
    cap.ring.gain.setTargetAtTime(0.09 * level, t, 0.06);
    cap.rumbleSrc.playbackRate.setTargetAtTime(0.7 + 0.8 * level, t, 0.1);
    if (v > 0.05 && dt > 0) {                              // one metallic rattle per tooth passing the floor
        tickAcc += CAP_TEETH * v / (2 * Math.PI * CAP_RADIUS) * dt;
        let n = 0; while (tickAcc >= 1 && n < 3) { tick(level); tickAcc -= 1; n++; }
        if (tickAcc > 3) tickAcc = 0;
    }
}

function tick(level) {
    const t = ctx.currentTime, s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = burstBuf; bp.type = 'bandpass'; bp.frequency.value = rand(2500, 5000); bp.Q.value = 2;
    g.gain.setValueAtTime(0.2 * level * rand(0.5, 1.3), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    s.connect(bp); bp.connect(g); g.connect(sfxBus); s.start(t, rand(0, 0.1)); s.stop(t + 0.04);
}

function capKick() {                                        // the little "tink" when the cap is pushed
    if (!ctx || !enabled) return;
    const t = ctx.currentTime, f = rand(1500, 2200);
    [1, 2.76, 4.1].forEach((r, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f * r;
        g.gain.setValueAtTime(0.14 / (i + 1), t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.4 / (i + 1));
        o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.45);
    });
    tick(1);
}

// ---------------------------------------------------------------------------
// Music: original, generated. A slow minor pad (four chords, 14 s each), a low drone and sparse bells, all through a long reverb.
// ---------------------------------------------------------------------------
const CHORDS = [[50, 53, 57, 60, 64], [46, 50, 53, 57, 60], [43, 46, 50, 53, 57], [45, 52, 57, 59, 62]];   // Dm9, Bbmaj7, Gm7, Asus
const BELLS = [];   // bell notes (MIDI numbers). Empty = no bells. For bells use: [74, 77, 79, 81, 84, 86]
let session = null, musicOn = false;

function stopMusic() {
    if (!musicOn) return;
    musicOn = false;
    const s = session; session = null; if (!s) return;
    s.timers.forEach(clearTimeout);
    s.mus.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    if (s.el) s.el.pause();
    setTimeout(() => { try { s.mus.disconnect(); } catch (e) {} s.drone.forEach(o => { try { o.stop(); } catch (e) {} }); }, 900);
}

async function startMusic() {
    if (musicOn || !ctx) return;
    musicOn = true;
    const s = session = { timers: [], drone: [], el: null, mus: ctx.createGain() };
    s.mus.connect(musicBus); s.mus.connect(reverb);
    let file = false;
    try { const r = await fetch(MUSIC_FILE, { method: 'HEAD' }); file = r.ok && /audio|octet-stream/.test(r.headers.get('content-type') || ''); } catch (e) {}
    if (session !== s) return;                              // muted while checking
    if (file) {
        s.el = new Audio(MUSIC_FILE); s.el.loop = true;
        ctx.createMediaElementSource(s.el).connect(s.mus); s.el.play().catch(() => {});
        return;
    }
    // drone: a low D and A that slowly breathe
    [[38, 0.05], [45, 0.025]].forEach(([m, a], i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        o.type = 'sine'; o.frequency.value = mtof(m); g.gain.value = a;
        lfo.frequency.value = 0.07 + i * 0.03; lg.gain.value = a * 0.5; lfo.connect(lg); lg.connect(g.gain);
        o.connect(g); g.connect(s.mus); o.start(); lfo.start(); s.drone.push(o, lfo);
    });
    let ci = 0;
    const chord = () => { if (session !== s) return; padChord(s, CHORDS[ci++ % CHORDS.length]); s.timers.push(setTimeout(chord, 12000)); };
    const bell = () => { if (session !== s || !BELLS.length) return; ringBell(s); s.timers.push(setTimeout(bell, rand(3500, 9000))); };
    chord(); s.timers.push(setTimeout(bell, 2500));
}

function padChord(s, notes) {
    const t = ctx.currentTime, dur = 15;
    notes.forEach((m, i) => [-7, 7].forEach(det => {
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = i < 2 ? 'sine' : 'triangle'; o.frequency.value = mtof(m); o.detune.value = det;
        f.type = 'lowpass'; f.frequency.value = rand(700, 1200);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.04, t + 5); g.gain.setValueAtTime(0.04, t + dur - 6); g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
        o.connect(f); f.connect(g); g.connect(s.mus); o.start(t); o.stop(t + dur + 1.6);
    }));
}

function ringBell(s) {
    const t = ctx.currentTime, f = mtof(BELLS[Math.floor(Math.random() * BELLS.length)]), pan = ctx.createStereoPanner();
    pan.pan.value = rand(-0.8, 0.8); pan.connect(s.mus);
    [1, 2.76, 5.4].forEach((r, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f * r;
        g.gain.setValueAtTime(0.07 / (i + 1), t); g.gain.exponentialRampToValueAtTime(0.0005, t + 4 / (i + 1));
        o.connect(g); g.connect(pan); o.start(t); o.stop(t + 4.2);
    });
}

// ---------------------------------------------------------------------------
// On / off, volumes, first-interaction unlock
// ---------------------------------------------------------------------------
function apply() {
    if (!ctx) return;
    if (enabled) {
        ctx.resume(); master.gain.setTargetAtTime(1, ctx.currentTime, 0.1); startMusic();
    } else {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.1); stopMusic();
        setTimeout(() => { if (!enabled && ctx) ctx.suspend(); }, 700);
    }
}

function unlock() { if (!ctx && enabled) { build(); apply(); } else if (ctx && enabled && ctx.state === 'suspended') ctx.resume(); }
['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, unlock, { passive: true }));
document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (enabled) ctx.resume(); });

function setVolumes(music, sfx) {
    if (music === vol.music && sfx === vol.sfx) return;
    vol.music = music; vol.sfx = sfx;
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(music * 0.4, ctx.currentTime, 0.1);
    sfxBus.gain.setTargetAtTime(sfx, ctx.currentTime, 0.1);
}

// Small sound on/off button, bottom-left (sits under the overlays, so cards cover it)
const style = document.createElement('style');
style.textContent = '#soundToggle{position:fixed;left:14px;bottom:14px;z-index:90;font:inherit;font-family:var(--font,monospace);font-size:.8rem;padding:6px 10px;color:#e6e2d6;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.25);border-radius:6px;cursor:pointer;opacity:.8}#soundToggle:hover,#soundToggle:focus-visible{opacity:1}';
document.head.append(style);
const btn = document.createElement('button');
btn.type = 'button'; btn.id = 'soundToggle';
const paint = () => { btn.textContent = enabled ? '\u266A sound on' : '\u266A sound off'; btn.setAttribute('aria-pressed', String(enabled)); };
btn.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(STORE, enabled ? 'on' : 'off'); } catch (e) {}
    if (enabled && !ctx) build();
    apply(); paint();
});
paint(); document.body.append(btn);

export const sound = { capRoll, capKick, setVolumes };
