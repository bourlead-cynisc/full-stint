// ============================================================================
// audio.js — звук двигателя по циклам зажигания (а не «пила + фильтр»)
//
// Как это устроено:
//   1. Для каждого типа двигателя при первом запуске генерируются 5 зацикленных
//      сэмплов на разных оборотах. Каждая вспышка в цилиндре — короткий затухающий
//      импульс выхлопа (низкий «хлопок» + резонанс трубы + шум сгорания) со случайным
//      разбросом по амплитуде, а порядок вспышек задаёт характер: V8 с неравномерным
//      «бурчанием», V10 ровный и звонкий, оппозитная шестёрка, F1 — высокий и чистый.
//   2. В игре два соседних сэмпла плавно смешиваются, а скорость проигрывания
//      подстраивает высоту под реальные обороты машины.
//   3. Газ открывает фильтр и громкость, сброс газа — «закрывает» и даёт хлопки в выхлопе.
// ============================================================================

let audioCtx = null, masterGain = null, noiseBuffer = null, soundOn = true;
let engineVoices = [];
let squealGain = null, squealFilter = null, windGain = null, rumbleGain = null;
const engineBanks = {};

const ENGINE_PROFILES = {
    V8:  { cyl: 8,  redline: 7800,  f1: 105, tau1: 0.011, f2: 430,  tau2: 0.0035, noise: 0.45, uneven: 0.16, lp: 0.34, turbo: false, bright: 0.9 },
    V8F: { cyl: 8,  redline: 8200,  f1: 120, tau1: 0.009, f2: 520,  tau2: 0.0030, noise: 0.40, uneven: 0.02, lp: 0.42, turbo: false, bright: 1.1 },
    V8T: { cyl: 8,  redline: 7600,  f1: 96,  tau1: 0.013, f2: 360,  tau2: 0.0040, noise: 0.50, uneven: 0.10, lp: 0.28, turbo: true,  bright: 0.8 },
    V10: { cyl: 10, redline: 8400,  f1: 118, tau1: 0.008, f2: 640,  tau2: 0.0028, noise: 0.35, uneven: 0.00, lp: 0.46, turbo: false, bright: 1.2 },
    V6:  { cyl: 6,  redline: 8000,  f1: 140, tau1: 0.009, f2: 520,  tau2: 0.0030, noise: 0.45, uneven: 0.05, lp: 0.32, turbo: true,  bright: 1.0 },
    I6:  { cyl: 6,  redline: 7600,  f1: 120, tau1: 0.011, f2: 460,  tau2: 0.0035, noise: 0.38, uneven: 0.00, lp: 0.30, turbo: true,  bright: 0.9 },
    F6:  { cyl: 6,  redline: 8400,  f1: 150, tau1: 0.008, f2: 700,  tau2: 0.0025, noise: 0.50, uneven: 0.00, lp: 0.40, turbo: false, bright: 1.15 },
    F1:  { cyl: 6,  redline: 15000, f1: 210, tau1: 0.0045, f2: 1250, tau2: 0.0016, noise: 0.40, uneven: 0.00, lp: 0.50, turbo: true,  bright: 1.3 }
};
const ANCHORS = [0.16, 0.32, 0.52, 0.74, 0.96];

function synthEngineLoop(sr, prof, rpm) {
    const cycleT = 120 / rpm;                                  // 4-тактный цикл = 2 оборота
    const N = Math.max(1, Math.round(1.1 / cycleT));
    const len = Math.round(N * cycleT * sr);
    const out = new Float32Array(len);
    const pLen = Math.min(len - 1, Math.floor(sr * 0.034));
    const tpl = new Float32Array(pLen);
    for (let i = 0; i < pLen; i++) {
        const t = i / sr;
        tpl[i] = Math.exp(-t / prof.tau1) * Math.sin(2 * Math.PI * prof.f1 * t)
               + 0.55 * prof.bright * Math.exp(-t / prof.tau2) * Math.sin(2 * Math.PI * prof.f2 * t + 0.6)
               + 0.22 * Math.exp(-t / (prof.tau1 * 1.8)) * Math.sin(2 * Math.PI * prof.f1 * 2.01 * t);
    }
    const nLen = Math.min(pLen, Math.floor(sr * 0.007));
    for (let c = 0; c < N; c++) {
        for (let i = 0; i < prof.cyl; i++) {
            let phase = i / prof.cyl;
            if (prof.uneven) phase += (i % 2 ? 1 : -1) * prof.uneven * 0.5 / prof.cyl;
            const pos = Math.round((c + phase) * cycleT * sr);
            const amp = 0.85 + Math.random() * 0.3 + ((i % 2) ? prof.uneven * 0.6 : 0);
            for (let j = 0; j < pLen; j++) out[(pos + j) % len] += tpl[j] * amp;
            for (let j = 0; j < nLen; j++) out[(pos + j) % len] += (Math.random() * 2 - 1) * prof.noise * Math.exp(-j / (nLen * 0.4)) * amp;
        }
    }
    // сглаживание, мягкое ограничение (гармоники), нормализация
    // фильтры гоняем по кольцу дважды (первый проход — прогрев), чтобы конец петли плавно переходил в начало
    const tmp = new Float32Array(len);
    let y = 0, dc = 0, peak = 0;
    for (let pass = 0; pass < 3; pass++) for (let i = 0; i < len; i++) { y += (out[i] - y) * prof.lp; if (pass === 2) tmp[i] = y; }
    for (let pass = 0; pass < 3; pass++) for (let i = 0; i < len; i++) { dc += (tmp[i] - dc) * 0.002; if (pass === 2) { out[i] = tmp[i] - dc; peak = Math.max(peak, Math.abs(out[i])); } }
    const g = 1.6 / (peak || 1);
    for (let i = 0; i < len; i++) out[i] = Math.tanh(out[i] * g) * 0.7;
    return out;
}

function getEngineBank(profName) {
    if (engineBanks[profName]) return engineBanks[profName];
    const prof = ENGINE_PROFILES[profName] || ENGINE_PROFILES.V8;
    const sr = audioCtx.sampleRate;
    const anchors = ANCHORS.map(a => {
        const rpm = a * prof.redline;
        const data = synthEngineLoop(sr, prof, rpm);
        const buf = audioCtx.createBuffer(1, data.length, sr);
        buf.getChannelData(0).set(data);
        return { rpm, buf };
    });
    return (engineBanks[profName] = { prof, anchors });
}

class EngineVoice {
    constructor(ac, dest, profName) {
        this.ac = ac; this.profName = profName;
        const bank = getEngineBank(profName);
        this.prof = bank.prof;
        this.out = ac.createGain(); this.out.gain.value = 0;
        this.lp = ac.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 0.8; this.lp.frequency.value = 1500;
        this.body = ac.createBiquadFilter(); this.body.type = 'lowshelf'; this.body.frequency.value = 160; this.body.gain.value = 4;
        this.pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
        this.lp.connect(this.body); this.body.connect(this.out);
        if (this.pan) { this.out.connect(this.pan); this.pan.connect(dest); } else this.out.connect(dest);

        this.layers = bank.anchors.map(a => {
            const src = ac.createBufferSource(); src.buffer = a.buf; src.loop = true;
            src.playbackRate.value = 1;
            const g = ac.createGain(); g.gain.value = 0;
            src.connect(g); g.connect(this.lp);
            src.start(0, Math.random() * a.buf.duration);
            return { src, g, rpm: a.rpm };
        });

        // впуск
        this.noise = ac.createBufferSource(); this.noise.buffer = noiseBuffer; this.noise.loop = true;
        this.nBand = ac.createBiquadFilter(); this.nBand.type = 'bandpass'; this.nBand.Q.value = 0.7; this.nBand.frequency.value = 900;
        this.nGain = ac.createGain(); this.nGain.gain.value = 0;
        this.noise.connect(this.nBand); this.nBand.connect(this.nGain); this.nGain.connect(this.out);
        this.noise.start(0, Math.random() * 1.5);

        // турбо / свист гибридной установки
        this.whine = null;
        if (this.prof.turbo) {
            this.whine = ac.createOscillator(); this.whine.type = 'sine'; this.whine.frequency.value = 2000;
            this.wGain = ac.createGain(); this.wGain.gain.value = 0;
            this.whine.connect(this.wGain); this.wGain.connect(this.out); this.whine.start();
        }
        this.popT = 0;
    }

    update(car, vol, pan, pitchMul) {
        const ac = this.ac, t = ac.currentTime;
        const prof = this.prof;
        const rpm01 = Math.max(0.05, Math.min(1.06, car.rpm || 0.15));
        const thr = car.smoothThrottle || 0;
        const rpmReal = rpm01 * prof.redline * pitchMul;

        // смешиваем два ближайших слоя по логарифму оборотов
        let wsum = 0;
        const ws = this.layers.map(l => {
            const d = Math.abs(Math.log(rpmReal / l.rpm));
            const w = Math.max(0, 1 - d / 0.62);
            wsum += w * w; return w;
        });
        // Below the first anchor (idle), keep the nearest sample audible.
        // The triangular windows otherwise all become zero at low RPM.
        if (wsum === 0) {
            let nearest = 0;
            this.layers.forEach((l, i) => {
                if (Math.abs(Math.log(rpmReal / l.rpm)) < Math.abs(Math.log(rpmReal / this.layers[nearest].rpm))) nearest = i;
            });
            ws[nearest] = 1;
            wsum = 1;
        }
        const norm = 1 / Math.sqrt(wsum);
        this.layers.forEach((l, i) => {
            l.src.playbackRate.setTargetAtTime(Math.max(0.3, Math.min(2.4, rpmReal / l.rpm)), t, 0.025);
            l.g.gain.setTargetAtTime(ws[i] * norm, t, 0.03);
        });

        // газ: открывает фильтр и громкость; сброс — глухо и тише
        const open = 0.18 + 0.82 * Math.pow(thr, 0.8);
        this.lp.frequency.setTargetAtTime((900 + 4200 * open + 2200 * rpm01) * prof.bright, t, 0.05);
        let g = vol * (0.20 + 0.50 * open + 0.22 * rpm01);
        if (rpm01 > 0.985 && thr > 0.5 && Math.floor(t * 26) % 2) g *= 0.55;      // отсечка
        if (car.shiftCut > 0) g *= 0.35;                                           // провал при переключении
        this.out.gain.setTargetAtTime(g, t, 0.035);

        this.nBand.frequency.setTargetAtTime(700 + 2200 * rpm01, t, 0.06);
        this.nGain.gain.setTargetAtTime(0.03 + 0.10 * thr * rpm01, t, 0.06);
        if (this.whine) {
            this.whine.frequency.setTargetAtTime(1600 + rpm01 * (prof.redline > 10000 ? 5200 : 3200), t, 0.05);
            this.wGain.gain.setTargetAtTime(0.004 + 0.010 * thr * rpm01, t, 0.06);
        }
        if (this.pan) this.pan.pan.setTargetAtTime(pan, t, 0.05);
    }

    silence() { this.out.gain.setTargetAtTime(0, this.ac.currentTime, 0.05); }

    dispose() {
        try {
            this.layers.forEach(l => { l.src.stop(); l.src.disconnect(); l.g.disconnect(); });
            this.noise.stop(); this.noise.disconnect();
            if (this.whine) { this.whine.stop(); this.whine.disconnect(); }
            this.out.disconnect();
        } catch (e) { /* уже остановлено */ }
    }
}

function resumeAudio() {
    if (audioCtx && audioCtx.state !== 'running' && audioCtx.state !== 'closed') {
        // Autoplay can reject this until the next user gesture; allow a retry.
        audioCtx.resume().catch(() => {});
    }
}

function initAudio() {
    if (audioCtx) { resumeAudio(); return; }
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AC();
        masterGain = audioCtx.createGain(); masterGain.gain.value = 0;
        const comp = audioCtx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4;
        masterGain.connect(comp); comp.connect(audioCtx.destination);

        const len = audioCtx.sampleRate * 2;
        noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
        const d = noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

        // визг шин
        const sq = audioCtx.createBufferSource(); sq.buffer = noiseBuffer; sq.loop = true;
        squealFilter = audioCtx.createBiquadFilter(); squealFilter.type = 'bandpass'; squealFilter.Q.value = 3.5; squealFilter.frequency.value = 2200;
        squealGain = audioCtx.createGain(); squealGain.gain.value = 0;
        sq.connect(squealFilter); squealFilter.connect(squealGain); squealGain.connect(masterGain); sq.start(0, 0.3);
        // ветер
        const wn = audioCtx.createBufferSource(); wn.buffer = noiseBuffer; wn.loop = true;
        const wf = audioCtx.createBiquadFilter(); wf.type = 'highpass'; wf.frequency.value = 600;
        windGain = audioCtx.createGain(); windGain.gain.value = 0;
        wn.connect(wf); wf.connect(windGain); windGain.connect(masterGain); wn.start(0, 0.9);
        // гул гравия/травы
        const rn = audioCtx.createBufferSource(); rn.buffer = noiseBuffer; rn.loop = true;
        const rf = audioCtx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 220;
        rumbleGain = audioCtx.createGain(); rumbleGain.gain.value = 0;
        rn.connect(rf); rf.connect(rumbleGain); rumbleGain.connect(masterGain); rn.start(0, 0.5);
        resumeAudio();
    } catch (e) { audioCtx = null; }
}

// Создаёт голоса под текущий состав (вызывается при старте сессии)
function rebuildEngineVoices() {
    if (!audioCtx || !playerCar) return;
    engineVoices.forEach(v => v.dispose());
    engineVoices = [];
    engineVoices.push(new EngineVoice(audioCtx, masterGain, playerCar.engineProfile));
    const rivalProf = (selectedCarClass === 'F1') ? 'F1' : 'V8';
    for (let i = 0; i < 3; i++) engineVoices.push(new EngineVoice(audioCtx, masterGain, rivalProf));
}

function carPitchTweak(car) { return 0.965 + ((car.driverNumber * 37) % 100) / 100 * 0.07; }

function updateAudio(frameDt) {
    if (!audioCtx || !masterGain) return;
    if (!engineVoices.length && playerCar && (currentSession === 'QUALI' || currentSession === 'RACE')) rebuildEngineVoices();
    const t = audioCtx.currentTime;
    const active = soundOn && !isPaused && (currentSession === 'QUALI' || currentSession === 'RACE') && playerCar && engineVoices.length;
    masterGain.gain.setTargetAtTime(active ? 0.9 : 0, t, 0.08);
    if (!active) return;

    engineVoices[0].update(playerCar, 1.0, 0, 1.0);

    // три ближайших соперника: панорама + допплер
    const near = [];
    for (const c of allCars) {
        if (c === playerCar) continue;
        const dx = c.x - playerCar.x, dy = c.y - playerCar.y, d = Math.hypot(dx, dy);
        if (d < 1000) near.push({ c, dx, dy, d });
    }
    near.sort((a, b) => a.d - b.d);
    for (let i = 1; i < engineVoices.length; i++) {
        const n = near[i - 1];
        if (!n) { engineVoices[i].silence(); continue; }
        const vol = Math.pow(Math.max(0, 1 - n.d / 1000), 2) * 0.55;
        const rx = n.dx;
        const pan = Math.max(-1, Math.min(1, rx / 420)) * 0.85;
        const ux = n.dx / (n.d || 1), uy = n.dy / (n.d || 1);
        const radial = (n.c.dx - playerCar.dx) * ux + (n.c.dy - playerCar.dy) * uy;
        const pitch = Math.max(0.92, Math.min(1.08, 1 - radial * 0.005)) * carPitchTweak(n.c);
        engineVoices[i].update(n.c, vol, pan, pitch);
    }

    // шины / ветер / трава
    const speed = Math.hypot(playerCar.dx, playerCar.dy);
    const sq = (speed > 2.5) ? Math.max(0, Math.min(1, (playerCar.slip - 1.6) / 3.2)) : 0;
    squealGain.gain.setTargetAtTime(sq * 0.045, t, 0.05);
    squealFilter.frequency.setTargetAtTime(1800 + sq * 700, t, 0.1);
    const sr = Math.min(1.2, speed / (playerCar.baseMaxSpeed || 12));
    windGain.gain.setTargetAtTime(sr * sr * 0.035, t, 0.15);
    const off = (playerCar.dbgDist || 0) > CURB_OUTER_W + 1 ? Math.min(1, speed / 6) : 0;
    rumbleGain.gain.setTargetAtTime(off * 0.22, t, 0.08);

    // хлопки в выхлопе при сбросе газа на высоких оборотах
    if (playerCar.smoothThrottle < 0.05 && playerCar.rpm > 0.55 && playerCar.gear >= 2 && Math.random() < 0.05) sfxPop();
}

function sfxNoiseBurst(freq, type, vol, dur, q = 0.8) {
    if (!audioCtx || !soundOn || !noiseBuffer) return;
    const t = audioCtx.currentTime;
    const src = audioCtx.createBufferSource(); src.buffer = noiseBuffer;
    const f = audioCtx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(masterGain);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}
function sfxPop() { sfxNoiseBurst(650 + Math.random() * 500, 'bandpass', 0.16, 0.07, 1.2); }
function sfxImpact(strength = 0.5) {
    if (!audioCtx || !soundOn) return;
    sfxNoiseBurst(900, 'lowpass', 0.25 + strength * 0.55, 0.45);
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.3);
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0.5 * (0.4 + strength), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + 0.35);
}
function sfxShift() {
    sfxNoiseBurst(400, 'bandpass', 0.10, 0.07, 1.5);
    if (!audioCtx || !soundOn) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.08);
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + 0.1);
}
function sfxBeep(freq, dur) {
    if (!audioCtx || !soundOn) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0.10, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + dur + 0.02);
}

window.toggleSound = function () {
    soundOn = !soundOn;
    const b = document.getElementById('btnSound');
    if (b) { b.textContent = soundOn ? '🔊 Вкл' : '🔇 Выкл'; b.classList.toggle('active', soundOn); }
    initAudio();
};
