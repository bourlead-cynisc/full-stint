// ============================================================================
// main.js — управление, меню, сессии, HUD, игровой цикл
// ============================================================================

const viewportEl = document.getElementById('viewportContainer');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimapCanvas');
const mCtx = minimapCanvas.getContext('2d');

let camZoom = 1;

let selectedCarClass = 'GT3';
let selectedCarIndex = 0;
let selectedTeammateSlot = 0;
let totalRaceLaps = 3;                 // для F1: выбранное число кругов
let selectedStrategyIndex = 1; // сбалансированный план по умолчанию; примеры не выбираются

let raceMode = 'TIMED';                // TIMED (WEC, 20 мин) | LAPS (F1)
let raceDurationMs = ENDURANCE_MINUTES * 60000;
const QUALIFYING_DURATION_MS = 5 * 60 * 1000;
let qualifyingTimeExpired = false;
let qualifyingFinishers = new Set();

window.showRacingLine = true;
window.transmissionMode = 'AUTO';
window.handlingMode = 'ARCADE';           // ARCADE | REAL
let topFollow = 'CAR';                    // вид сверху: CAR — на машине, TRACK — вся трасса, камера неподвижна
let topZoom = 1.0;
window.shiftUpPressed = false; window.shiftDownPressed = false;

let mobileSteer = 0, mobileThrottle = 0, mobileBrake = 0, mobileHandbrake = 0;
let useGyroscope = false, gyroGamma = 0;

let playerCar = null, aiCars = [], allCars = [];
let isPaused = false;
let currentSession = 'MENU';          // MENU | QUALI | RACE | FINISHED
let raceState = 'RACING';             // LIGHTS | RACING
let raceStartTimestamp = 0;
let simTimeMs = 0;                    // игровое время (на паузе не идёт)
let sessionBestLap = { time: null, driverName: '---', carName: '' };
let gridOrder = null;
let finishRows = [];
let raceRecorded = false, timeUpAnnounced = false;
const keys = { w: false, a: false, s: false, d: false, space: false };

const STEP = 1 / 60;

function getActiveCatalog() { return selectedCarClass === 'F1' ? F1_CATALOG : (selectedCarClass === 'ROAD' ? ROAD_CATALOG : GT3_CATALOG); }
const DRIVETRAIN_LABELS={FWD:'Передний · FWD',RWD:'Задний · RWD',AWD:'Полный · AWD'};
const ENGINE_LAYOUT_LABELS={FR:'Передний мотор',MR:'Средний мотор',RR:'Задний мотор'};

// Число кругов, под которое строятся тактики
function getPlannedLaps() {
    if (selectedCarClass === 'GT3') {
        return Math.max(3, Math.round(ENDURANCE_MINUTES * 60 / (EST_LAP_SEC.GT3[selectedTrackIndex] || 140)));
    }
    return totalRaceLaps;
}

function formatTime(ms) {
    if (ms === null || ms === undefined || !isFinite(ms)) return '--:--.---';
    const t = Math.max(0, Math.round(ms));
    const m = Math.floor(t / 60000), s = Math.floor((t % 60000) / 1000), r = t % 1000;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(r).padStart(3, '0');
}
function formatClock(ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}

// ============================================================================
// ПОДСКАЗКИ ГОНОЧНОГО КОНТРОЛЯ
// ============================================================================
let raceControlTimer = null;
function showRaceControl(text, color = '#f39c12') {
    const el = document.getElementById('race-control');
    if (!el) return;
    el.textContent = text;
    el.style.borderLeftColor = color;
    el.style.opacity = 1;
    clearTimeout(raceControlTimer);
    raceControlTimer = setTimeout(() => { el.style.opacity = 0; }, 2800);
}

function registerLapForGlobalBest(car, lapMs) {
    if (sessionBestLap.time === null || lapMs < sessionBestLap.time) {
        sessionBestLap = { time: lapMs, driverName: car.driverName, carName: car.spec.shortName };
        if (car.isPlayer) showRaceControl(`🟣 Лучший круг сессии: ${formatTime(lapMs)}`, '#c084fc');
    } else if (car.isPlayer) {
        showRaceControl(`Круг ${car.lap}: ${formatTime(lapMs)}`, '#38bdf8');
    }
}

// ============================================================================
// НАСТРОЙКИ: коробка, камера, круги, класс
// ============================================================================
window.setTransmissionMode = function (mode) {
    if(currentSession==='TIME_TRIAL')return;
    window.transmissionMode = mode;
    document.getElementById('btnGearAuto').classList.toggle('active', mode === 'AUTO');
    document.getElementById('btnGearManual').classList.toggle('active', mode === 'MANUAL');
};

function refreshOptionButtons() {
    document.querySelectorAll('[data-tf]').forEach(b => b.classList.toggle('active', b.dataset.tf === topFollow));
    document.querySelectorAll('[data-hm]').forEach(b => b.classList.toggle('active', b.dataset.hm === window.handlingMode));
}
window.setTopFollow = function (mode) { topFollow = mode; refreshOptionButtons(); };
window.setHandling = function (mode) {
    if(currentSession==='TIME_TRIAL')return;
    window.handlingMode = mode; refreshOptionButtons();
    if (currentSession === 'QUALI' || currentSession === 'RACE' || currentSession === 'TIME_TRIAL') showRaceControl(mode === 'ARCADE' ? '🎮 Управление: Аркада' : '🏁 Управление: Реализм', '#38bdf8');
};

window.setLaps = function (laps) {
    if (selectedCarClass === 'GT3') return;       // в WEC число кругов не выбирается
    totalRaceLaps = laps;
    selectedStrategyIndex = 1;
    document.querySelectorAll('.lap-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.laps) === laps));
    renderStrategyCards();
};

function teamLocked() { return selectedCarClass === 'F1' && season && seasonStarted() && !seasonDone(); }

function applyClassMode() {
    const f1 = selectedCarClass === 'F1',road=selectedCarClass==='ROAD',gt3=selectedCarClass==='GT3';
    raceMode = gt3 ? 'TIMED' : 'LAPS';
    document.getElementById('classBtnGT3').classList.toggle('active', gt3);
    document.getElementById('classBtnF1').classList.toggle('active', f1);
    document.getElementById('classBtnRoad').classList.toggle('active', road);
    document.getElementById('lapSection').style.display = gt3 ? 'none' : 'flex';
    const note = document.getElementById('enduranceNote');
    note.style.display = gt3 ? 'block' : 'none';
    note.textContent = `⏱ Гонка на выживание: ${ENDURANCE_MINUTES} минут после квалификации. Финиш на первом круге после окончания времени.`;
    document.getElementById('seasonPanel').style.display = f1 ? 'block' : 'none';
    if (f1) {
        ensureSeason();
        selectedTrackIndex = seasonNextTrack();
        if (teamLocked()) { selectedCarIndex = season.team; selectedTeammateSlot = season.seat; }
    }
}

window.selectCarClass = function (cls) {
    selectedCarClass = cls;
    selectedCarIndex = 0; selectedTeammateSlot = 0; selectedStrategyIndex = 1;
    applyClassMode();
    buildActiveTrackGeometry();
    renderGarageUI();
};

function selectNextTire(compKey) {
    if (!playerCar || currentSession !== 'RACE') return;
    if (playerCar.pitPhase === 'service') return;
    playerCar.nextCompound = compKey;
    if (playerCar.pitPhase === 'entry') playerCar.pendingTire = compKey;
    showRaceControl(`Шины на следующий пит-стоп: ${TIRE_COMPOUNDS[compKey].name}`, TIRE_COMPOUNDS[compKey].color);
}

function requestPitStop() {
    if (!playerCar || currentSession !== 'RACE' || playerCar.pitPhase !== 'none') return;
    playerCar.pitRequested = !playerCar.pitRequested;
    showRaceControl(playerCar.pitRequested
        ? `🛠️ Заезд в боксы на этом круге: ${TIRE_COMPOUNDS[playerCar.nextCompound].name}`
        : 'Заезд в боксы отменён', '#38bdf8');
}

// ============================================================================
// УПРАВЛЕНИЕ: клавиатура (по физическим клавишам — работает в любой раскладке)
// ============================================================================
function clearInputs() {
    keys.w = keys.a = keys.s = keys.d = keys.space = false;
    mobileSteer = mobileThrottle = mobileBrake = mobileHandbrake = 0;
    pressedCodes.clear();
    window.shiftUpPressed = window.shiftDownPressed = false;
}
function releaseFocus() {
    // после клика по кнопке меню фокус остаётся на ней: Пробел/Enter тогда повторно «нажимали» бы её
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    window.focus();
}

function onKeyDown(e) {
    if(handleBindingCapture(e)) return;
    initAudio();
    const c=e.code;
    const playing=currentSession==='QUALI'||currentSession==='RACE'||currentSession==='TIME_TRIAL';
    if(bindingMatches('settings',c)) {e.preventDefault();if(!e.repeat)openControls();return;}
    if(bindingMatches('pause',c)) {if(playing){e.preventDefault();if(!e.repeat)togglePauseMenu();}return;}
    if(isPaused||!playing) return;
    // Space always controls the car while racing, even if a HUD button retained focus.
    if(e.target instanceof Element && e.target.closest('button') && c==='Enter')return;
    if(Object.keys(keyBindings).some(action=>bindingMatches(action,c))) e.preventDefault();
    pressedCodes.add(c);syncKeyboardInputs();
    if(!e.repeat) {
        if(bindingMatches('shiftUp',c))window.shiftUpPressed=true;
        if(bindingMatches('shiftDown',c))window.shiftDownPressed=true;
        if(bindingMatches('camera',c)){topFollow=topFollow==='CAR'?'TRACK':'CAR';refreshOptionButtons();}
        if(bindingMatches('zoomIn',c))topZoom=Math.min(2.2,topZoom*1.15);
        if(bindingMatches('zoomOut',c))topZoom=Math.max(0.45,topZoom/1.15);
        if(bindingMatches('line',c))window.showRacingLine=!window.showRacingLine;
        if(bindingMatches('sound',c))toggleSound();
        if(bindingMatches('pit',c))requestPitStop();
        for(const tire of ['soft','medium','hard'])if(bindingMatches(tire,c))selectNextTire(tire);
    }
}
function onKeyUp(e) {pressedCodes.delete(e.code);syncKeyboardInputs();}
// слушаем и window, и document: в некоторых встроенных просмотрщиках событие приходит только на одно из них
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('blur', clearInputs);
window.addEventListener('wheel', (e) => { if (currentSession === 'MENU' || topFollow !== 'CAR') return; topZoom = Math.max(0.45, Math.min(2.2, topZoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))); }, { passive: true });
window.addEventListener('pointerdown', () => { initAudio(); });
canvas.addEventListener('pointerdown', () => canvas.focus());
document.addEventListener('visibilitychange', () => {
    if (document.hidden && !isPaused && (currentSession === 'QUALI' || currentSession === 'RACE' || currentSession === 'TIME_TRIAL')) togglePauseMenu();
});

// ---------- Мобильное управление ----------
function initMobileTouchControls() {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobileDevice) return;
    document.body.classList.add('is-mobile');
    const overlay = document.createElement('div');
    overlay.id = 'mobileControlsOverlay';
    overlay.innerHTML = `
        <div class="mob-btn" id="mobSteerLeft">◀</div>
        <div class="mob-btn" id="mobSteerRight">▶</div>
        <div class="mob-btn" id="mobBrake">ТОРМОЗ</div>
        <div class="mob-btn" id="mobHandbrake">РУЧНИК</div>
        <div class="mob-btn" id="mobThrottle">ГАЗ</div>
        <div class="mob-btn" id="mobTireSoft">SOFT</div>
        <div class="mob-btn" id="mobTireMed">MED</div>
        <div class="mob-btn" id="mobTireHard">HARD</div>
        <div class="mob-btn" id="mobPit">БОКСЫ</div><div class="mob-btn" id="mobPause">ПАУЗА</div><div class="mob-btn" id="mobGyroToggle">ГИРОСКОП: ВЫКЛ</div>`;
    viewportEl.appendChild(overlay);
    overlay.style.display = 'block';

    const bindHold = (id, onDown, onUp) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('touchstart', (e) => { e.preventDefault(); initAudio(); onDown(); }, { passive: false });
        el.addEventListener('touchend', (e) => { e.preventDefault(); onUp(); }, { passive: false });
        el.addEventListener('touchcancel', () => onUp());
        el.addEventListener('mousedown', (e) => { e.preventDefault(); onDown(); });
        el.addEventListener('mouseup', (e) => { e.preventDefault(); onUp(); });
    };
    bindHold('mobSteerLeft',  () => { mobileSteer = -1; }, () => { if (mobileSteer < 0) mobileSteer = 0; });
    bindHold('mobSteerRight', () => { mobileSteer = 1; },  () => { if (mobileSteer > 0) mobileSteer = 0; });
    bindHold('mobBrake',      () => { mobileBrake = 1; },  () => { mobileBrake = 0; });
    bindHold('mobHandbrake',  () => { mobileHandbrake = 1; }, () => { mobileHandbrake = 0; });
    bindHold('mobThrottle',   () => { mobileThrottle = 1; }, () => { mobileThrottle = 0; });
    document.getElementById('mobPit').addEventListener('click', requestPitStop);
    document.getElementById('mobPause').addEventListener('click', togglePauseMenu);
    document.getElementById('mobTireSoft').addEventListener('click', () => selectNextTire('soft'));
    document.getElementById('mobTireMed').addEventListener('click', () => selectNextTire('medium'));
    document.getElementById('mobTireHard').addEventListener('click', () => selectNextTire('hard'));
    document.getElementById('mobGyroToggle').addEventListener('click', () => window.toggleGyroscope());
}

window.toggleGyroscope = function () {
    useGyroscope = !useGyroscope;
    const btn = document.getElementById('mobGyroToggle');
    if (useGyroscope) {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().then(r => {
                if (r === 'granted') { window.addEventListener('deviceorientation', handleOrientation); if (btn) btn.textContent = 'ГИРОСКОП: ВКЛ'; }
                else useGyroscope = false;
            }).catch(() => { useGyroscope = false; });
        } else {
            window.addEventListener('deviceorientation', handleOrientation);
            if (btn) btn.textContent = 'ГИРОСКОП: ВКЛ';
        }
    } else {
        window.removeEventListener('deviceorientation', handleOrientation);
        if (btn) btn.textContent = 'ГИРОСКОП: ВЫКЛ';
        mobileSteer = 0;
    }
};
function handleOrientation(e) {
    if (!useGyroscope) return;
    gyroGamma = e.gamma || 0;
    mobileSteer = Math.max(-1, Math.min(1, gyroGamma / 32));
}

// Геймпад опрашивается каждый кадр, в том числе в паузе и меню: так работают настройки и навигация.
let lastGamepadButtons=[], gamepadNavPrev={up:false,down:false,left:false,right:false};
function gamepadButtonValue(gp,index) {
    const button=gp.buttons[index];
    return button ? Math.max(0,Math.min(1,Number.isFinite(button.value)?button.value:(button.pressed?1:0))) : 0;
}
function gamepadBindingValue(gp,action) {
    const binding=gamepadBindings[action];
    if(!binding)return 0;
    if(binding.type==='axis')return gp.axes[binding.axis]||0;
    return gamepadButtonValue(gp,binding.button);
}
function gamepadBindingDown(gp,action) {return gamepadBindingValue(gp,action)>0.55;}
function visibleGamepadModal() {
    for(const id of ['controlsModal','pauseModal','finishModal','garageModal']) {
        const element=document.getElementById(id);
        if(element && element.getClientRects().length && getComputedStyle(element).display!=='none')return element;
    }
    return null;
}
function moveGamepadFocus(modal,direction) {
    const candidates=[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]')]
        .filter(el=>el.getClientRects().length && !el.closest('[hidden]'));
    if(!candidates.length)return;
    const current=candidates.indexOf(document.activeElement);
    const step=(direction==='up'||direction==='left')?-1:1;
    const next=current<0?(step>0?0:candidates.length-1):(current+step+candidates.length)%candidates.length;
    candidates[next].focus();
}
function activateGamepadFocus(modal) {
    const active=document.activeElement;
    if(active && modal.contains(active) && typeof active.click==='function')active.click();
}
function handleGamepadNavigation(gp,justPressed) {
    const modal=visibleGamepadModal();
    if(!modal)return false;
    if(modal.id==='controlsModal' && gamepadTabActive() && isGamepadBindingCaptureActive()) {
        captureGamepadBinding(gp,justPressed);
        return true;
    }
    const axisX=gp.axes[0]||0,axisY=gp.axes[1]||0;
    const dirs={
        up:!!justPressed[12]||axisY<-.55,
        down:!!justPressed[13]||axisY>.55,
        left:!!justPressed[14]||axisX<-.55,
        right:!!justPressed[15]||axisX>.55
    };
    for(const dir of ['up','down','left','right']) {
        if(dirs[dir]&&!gamepadNavPrev[dir])moveGamepadFocus(modal,dir);
        gamepadNavPrev[dir]=dirs[dir];
    }
    if(justPressed[0])activateGamepadFocus(modal);
    if(justPressed[1]) {
        if(modal.id==='controlsModal')closeControls();
        else if(modal.id==='pauseModal')document.getElementById('btnResumeGame').click();
    }
    return true;
}
function dispatchGamepadAction(action) {
    if(action==='settings') {openControls();return;}
    if(action==='pause') {
        if(['QUALI','RACE','TIME_TRIAL'].includes(currentSession))togglePauseMenu();
        return;
    }
    if(isPaused || !['QUALI','RACE','TIME_TRIAL'].includes(currentSession))return;
    if(action==='shiftUp')window.shiftUpPressed=true;
    if(action==='shiftDown')window.shiftDownPressed=true;
    if(action==='camera'){topFollow=topFollow==='CAR'?'TRACK':'CAR';refreshOptionButtons();}
    if(action==='zoomIn')topZoom=Math.min(2.2,topZoom*1.15);
    if(action==='zoomOut')topZoom=Math.max(0.45,topZoom/1.15);
    if(action==='line')window.showRacingLine=!window.showRacingLine;
    if(action==='sound')toggleSound();
    if(action==='pit')requestPitStop();
    if(['soft','medium','hard'].includes(action))selectNextTire(action);
}
function pollGamepad() {
    const pads=navigator.getGamepads?navigator.getGamepads():[];
    const connected=Array.from(pads).filter(p=>p&&p.connected);
    const gp=connected.find(p=>Array.from(p.buttons).some(button=>button&&(button.pressed||(button.value||0)>0.2))||(p.axes||[]).some(axis=>Math.abs(axis)>0.2))||connected[0];
    if(!gp) {
        lastGamepadButtons=[];gamepadNavPrev={up:false,down:false,left:false,right:false};
        updateGamepadStatus(null);
        return {throttle:0,brake:0,handbrake:0,steer:0};
    }
    updateGamepadStatus(gp);
    const down=Array.from(gp.buttons,button=>!!button && (button.pressed || (button.value||0)>0.55));
    const justPressed=down.map((pressed,index)=>pressed&&!lastGamepadButtons[index]);
    lastGamepadButtons=down;
    if(document.getElementById('controlsModal').style.display==='flex') {
        if(gamepadTabActive() && isGamepadBindingCaptureActive())captureGamepadBinding(gp,justPressed);
        else handleGamepadNavigation(gp,justPressed);
    } else if(visibleGamepadModal()) {
        handleGamepadNavigation(gp,justPressed);
    } else {
        for(const action of GAMEPAD_ACTIONS) {
            if(action==='steer'||action==='throttle'||action==='brake'||action==='handbrake')continue;
            if(justPressed[gamepadBindings[action].button])dispatchGamepadAction(action);
        }
    }
    let steer=gamepadBindingValue(gp,'steer');
    if(Math.abs(steer)<0.12)steer=0;
    const throttle=gamepadBindingValue(gp,'throttle'),brake=gamepadBindingValue(gp,'brake');
    return {throttle,brake,handbrake:gamepadBindingDown(gp,'handbrake')?1:0,steer};
}

// Единый ввод: клавиатура, геймпад и сенсорные кнопки складываются (берётся максимум)
function collectInput(gp) {
    const kSteer = (keys.a ? -1 : 0) + (keys.d ? 1 : 0);
    return {
        throttle: Math.max(keys.w ? 1 : 0, gp.throttle, mobileThrottle),
        brake: Math.max(keys.s ? 1 : 0, gp.brake, mobileBrake),
        handbrake: Math.max(keys.space ? 1 : 0,gp.handbrake,mobileHandbrake),
        steer: kSteer !== 0 ? kSteer : (gp.steer !== 0 ? gp.steer : mobileSteer)
    };
}

// ============================================================================
// ГАРАЖ
// ============================================================================
function tireChip(key, text) {
    const t = TIRE_COMPOUNDS[key];
    return `<span class="tire-chip" style="background:${t.color}">${t.shortTag} ${text}</span>`;
}

function renderStrategyCards() {
    const grid = document.getElementById('strategyGrid');
    const rules = document.getElementById('strategyRules');
    const laps = getPlannedLaps();
    const list = getStrategyPresetsForLaps(laps);
    selectedStrategyIndex = 1;
    rules.innerHTML = `По умолчанию стартуем со сбалансированным планом. Ниже — примеры темпа и остановок; план гонки будет показан в HUD «Пит-стоп».`;
    grid.innerHTML = list.map(s => {
        const stints = analyzeStrategy(laps, s);
        const plan = stints.map((st, k) => {
            let h = tireChip(st.tire, `${st.laps} кр.`);
            if (k < stints.length - 1) h += `<span class="tire-arrow">→ пит (конец кр. ${st.toLap}) →</span>`;
            return h;
        }).join('');
        const nStops = s.stops.length;
        const wear = stints.map(st => `${TIRE_COMPOUNDS[st.tire].shortTag} ${st.endHealth}%${st.cliff ? ' ⚠' : ''}`).join(' · ');
        const riskCls = s.risk === 'Низкий' ? 'risk-low' : (s.risk === 'Высокий' ? 'risk-high' : 'risk-mid');
        return `
        <article class="strategy-card strategy-example-card">
            <div class="strategy-title"><span>${s.name}</span><span class="risk-badge ${riskCls}">риск: ${s.risk.toLowerCase()}</span></div>
            <div class="strategy-plan">${plan}</div>
            <div class="strategy-idea">${s.idea}</div>
            <div class="strategy-stats">Остановок: ${nStops}${nStops ? ` (потеря ≈${nStops * getPitStopLossEstimate()} с)` : ''} · Шины к концу: ${wear}</div>
        </article>`;
    }).join('');
}

function drawCarThumb(canvasEl, spec) {
    const c = canvasEl.getContext('2d');
    c.clearRect(0, 0, canvasEl.width, canvasEl.height);
    const img = spriteImgs[spec.id];
    c.save();
    c.translate(canvasEl.width / 2, canvasEl.height / 2);
    if (img) {
        const h = canvasEl.height - 4, w = h * img.width / img.height;
        c.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
        c.scale(1.05, 1.05);
        renderCarBody(c, spec, spec.livery, 'soft', false, false, 1);
    }
    c.restore();
}

function renderSeasonPanel() {
    ensureSeason();
    const done = seasonDone();
    document.getElementById('seasonTitle').textContent = `🏆 СЕЗОН ${season.number}`;
    document.getElementById('seasonSub').textContent = done ? '— завершён' : `— раунд ${season.results.length + 1} из ${season.order.length}`;
    const cal = document.getElementById('seasonCalendar'); cal.innerHTML = '';
    season.order.forEach((ti, i) => {
        const chip = document.createElement('div');
        const isDone = i < season.results.length, isNext = i === season.results.length && !done;
        chip.className = 'cal-chip' + (isDone ? ' done' : (isNext ? ' next' : ''));
        chip.textContent = `R${i + 1} · ${TRACKS_DB[ti].name}${isDone ? ' ✓' : (isNext ? ' ◀ следующая' : '')}`;
        cal.appendChild(chip);
    });
}

function updateStartButtons() {
    const blocked = selectedCarClass === 'F1' && season && seasonDone();
    for (const id of ['btnStartQuali', 'btnDirectRace']) {
        const b = document.getElementById(id);
        b.disabled = !!blocked; b.style.opacity = blocked ? 0.4 : 1;
    }
    document.getElementById('btnDirectRace').textContent = selectedCarClass === 'GT3' ? 'Сразу в гонку 20 мин ▶' : 'Гонка со старта ▶';
    document.getElementById('btnStartQuali').textContent = selectedCarClass === 'GT3' ? '⏱️ Квалификация → гонка 20 мин' : '⏱️ Квалификация';
}

function drawGarageTrackPreview(canvasEl,track) {
    const points=track.rawPoints;
    if(!points||points.length<3)return;
    const c=canvasEl.getContext('2d'),W=canvasEl.width,H=canvasEl.height;
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
    const scale=Math.min((W-20)/Math.max(1,maxx-minx),(H-16)/Math.max(1,maxy-miny));
    const ox=(W-(maxx-minx)*scale)/2,oy=(H-(maxy-miny)*scale)/2;
    c.clearRect(0,0,W,H);
    c.lineJoin='round';c.lineCap='round';
    c.beginPath();
    points.forEach((p,i)=>{const x=(p.x-minx)*scale+ox,y=(p.y-miny)*scale+oy;i?c.lineTo(x,y):c.moveTo(x,y)});
    c.closePath();c.strokeStyle='#4c5d64';c.lineWidth=6;c.stroke();
    c.strokeStyle='#dce6e6';c.lineWidth=3;c.stroke();
    c.strokeStyle='#f2b76b';c.lineWidth=1;c.stroke();
}
function renderGarageUI() {
    const f1 = selectedCarClass === 'F1';
    const locked = teamLocked();
    if (f1) renderSeasonPanel();

    // трассы
    const trkGrid = document.getElementById('trackSelectorGrid'); trkGrid.innerHTML = '';
    trkGrid.classList.remove('locked');
    document.getElementById('trackLockHint').textContent = f1 ? '— для призрака любая трасса; гонка сезона: '+TRACKS_DB[seasonNextTrack()].shortName : '';
    TRACKS_DB.forEach((tObj, tIdx) => {
        const card = document.createElement('div');
        card.tabIndex = 0; card.setAttribute('role','button');
        card.className = 'track-card' + (tIdx === selectedTrackIndex ? ' active' : '');
        card.innerHTML = `<canvas class="track-card-preview" width="96" height="76" aria-hidden="true"></canvas><div class="track-card-copy"><div class="track-info-title">${tObj.name}</div><div class="track-info-sub">${tObj.desc || ''}</div></div>`;
        drawGarageTrackPreview(card.querySelector('canvas'),tObj);
        const selectTrack=()=>{
            const previousTrackIndex=selectedTrackIndex;
            selectedTrackIndex=tIdx;
            try {
                buildActiveTrackGeometry();
            } catch(error) {
                selectedTrackIndex=previousTrackIndex;
                console.error('Unable to select track '+tObj.id,error);
                renderGarageUI();
                return;
            }
            renderGarageUI();
        };
        let pointerStart=null;
        card.addEventListener('pointerdown',e=>{if(e.button===0)pointerStart={x:e.clientX,y:e.clientY,id:e.pointerId};});
        card.addEventListener('pointerup',e=>{
            const start=pointerStart;pointerStart=null;
            if(start&&start.id===e.pointerId&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<8)selectTrack();
        });
        card.addEventListener('pointercancel',()=>{pointerStart=null;});
        card.addEventListener('click',selectTrack);
        trkGrid.appendChild(card);
    });

    // машины
    const catalog = getActiveCatalog();
    const best = k => Math.max(...catalog.map(c => c.perf[k]));
    const score = (v, k) => Math.max(1, Math.min(100, Math.round(v / (best(k) || 1) * 100)));
    const grid = document.getElementById('carSelectorGrid'); grid.innerHTML = '';
    grid.classList.remove('locked');
    document.getElementById('teamLockHint').textContent = locked ? '— в сезоне команда фиксирована, для призрака выбор свободный' : '';
    catalog.forEach((car, idx) => {
        const card = document.createElement('div');
        card.tabIndex = 0; card.setAttribute('role','button');
        card.className = 'car-item' + (idx === selectedCarIndex ? ' selected' : '');
        const p = car.perf;
        const bar = (lbl, key) => {
            const value = score(p[key], key);
            return `<div class="car-stat-bar" title="${lbl}: ${value}% от лучшего показателя класса"><span>${lbl}</span><b>${value}%</b><span class="stat-track"><span class="stat-fill" style="width:${value}%"></span></span></div>`;
        };
        card.innerHTML = `<canvas class="car-thumb" width="52" height="86"></canvas>
            <div class="car-item-title">${car.shortName}</div>
            <div class="car-item-sub">Скорость ${score(p.vmax, 'vmax')}% · разгон ${score(p.power, 'power')}%</div>
            <div class="car-note">${DRIVETRAIN_LABELS[car.drivetrain]||'Задний · RWD'} · ${ENGINE_LAYOUT_LABELS[car.engineLayout]||'Средний мотор'} · ${p.note}</div>
            <div class="car-character">${characterSummary(car)}</div>
            <div class="car-stats-grid" aria-label="Характеристики в процентах от лучшего значения в классе">${bar('Сцепление', 'grip')}${bar('Прижим', 'aero')}${bar('Тормоза', 'brake')}${bar('Ресурс шин', 'tire')}</div>`;
        drawCarThumb(card.querySelector('canvas'), car);
        card.addEventListener('click', () => { selectedCarIndex = idx; selectedTeammateSlot = 0; renderGarageUI(); });
        grid.appendChild(card);
    });

    // пилоты команды
    const team = catalog[selectedCarIndex];
    const pills = document.getElementById('driverPills'); pills.innerHTML = '';
    if (selectedTeammateSlot >= team.drivers.length) selectedTeammateSlot = 0;
    document.getElementById('driverBar').classList.remove('driver-bar-locked');
    team.drivers.forEach((d, i) => {
        const b = document.createElement('button');
        b.className = 'driver-pill' + (i === selectedTeammateSlot ? ' active' : '');
        b.textContent = `#${d.number} ${d.name}`;
        b.addEventListener('click', () => { selectedTeammateSlot = i; renderGarageUI(); });
        pills.appendChild(b);
    });
    document.getElementById('driverHint').textContent = team.drivers.length > 1
        ? `${team.teamName}: второй пилот — ваш напарник (ИИ).`
        : `${team.teamName}: в команде один пилот.`;

    renderStrategyCards();
    updateStartButtons();
    const bestGhost=loadGhost(trialKey());
    document.getElementById("ghostRecordHint").textContent=bestGhost?"Личный рекорд: "+formatTime(bestGhost.time):"Гонка с призраком: первый чистый круг запишет рекорд";
}

// ============================================================================
// СОСТАВ УЧАСТНИКОВ
// ============================================================================
function buildWeekendRoster() {
    buildActiveTrackGeometry();
    const catalog = getActiveCatalog();
    const strategies = getStrategyPresetsForLaps(getPlannedLaps());
    sessionBestLap = { time: null, driverName: '---', carName: '' };

    const team = catalog[selectedCarIndex];
    const seat = Math.min(selectedTeammateSlot, team.drivers.length - 1);
    const pd = team.drivers[seat];
    playerCar = new Car(pd.name + ' (ВЫ)', pd.number, selectedCarIndex, true, false, pd, 0);
    playerCar.baseName = pd.name;
    playerCar.assignStrategy(strategies[selectedStrategyIndex % strategies.length]);

    aiCars = [];
    let slot = 1;
    catalog.forEach((tm, ti) => {
        tm.drivers.forEach((d, di) => {
            if (ti === selectedCarIndex && di === seat) return;
            const bot = new Car(d.name, d.number, ti, false, ti === selectedCarIndex, d, slot);
            bot.baseName = d.name;
            bot.assignStrategy(strategies[slot % strategies.length]);
            aiCars.push(bot);
            slot++;
        });
    });
    allCars = [playerCar, ...aiCars];
    gridOrder = null;

    document.getElementById('hudCarTitle').textContent = team.teamName.toUpperCase();
    document.getElementById('hudDriverName').textContent = `#${pd.number} ${pd.name} · ${team.name}`;
    document.getElementById('hudTrackName').textContent = TRACKS_DB[selectedTrackIndex].shortName;
    document.getElementById('pitSpeedBadge').textContent = TRACKS_DB[selectedTrackIndex].pitSpeedLimit+' км/ч';
}

function resetEffects() { skidMarks.length = 0; sparks.length = 0; }

function hideAllModals() {
    for (const id of ['garageModal', 'pauseModal', 'finishModal']) document.getElementById(id).style.display = 'none';
}

function startQualifyingSession() {
    initAudio();
    hideAllModals();
    currentSession = 'QUALI'; raceState = 'RACING'; isPaused = false; simTimeMs = 0;
    qualifyingTimeExpired = false; qualifyingFinishers = new Set();
    clearInputs(); resetEffects(); releaseFocus();
    sessionBestLap = { time: null, driverName: '---', carName: '' };
    allCars.forEach((car, idx) => {
        car.placeForQualifying(idx, allCars.length);
        car.compound = 'soft'; car.wearScale = 0.12;     // в квалификации шины почти не изнашиваются
    });
    rebuildEngineVoices();
    document.getElementById('sessionLabel').textContent = 'КВАЛИФИКАЦИЯ';
    document.getElementById('start-lights').style.opacity = 0;
    showRaceControl('Квалификация: быстрые круги. '+bindingLabel('pause')+' → завершение квалификации', '#38bdf8');
}

// ---- огни старта ----
let lightsPhase = 0, lightsT = 0, lightsHold = 1;
function buildStartLights() {
    const el = document.getElementById('start-lights');
    el.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const pod = document.createElement('div'); pod.className = 'light-pod';
        pod.innerHTML = '<div class="light-bulb"></div><div class="light-bulb"></div>';
        el.appendChild(pod);
    }
}
function setLights(count, green) {
    document.querySelectorAll('#start-lights .light-pod').forEach((pod, i) => {
        pod.querySelectorAll('.light-bulb').forEach(b => {
            b.classList.toggle('on', !green && i < count);
            b.classList.toggle('green', !!green);
        });
    });
}
function stepStartLights(dt) {
    if (raceState !== 'LIGHTS') return;
    lightsT += dt;
    if (lightsPhase < 5) {
        if (lightsT >= (lightsPhase + 1) * 0.9) { lightsPhase++; setLights(lightsPhase, false); sfxBeep(520, 0.2); }
    } else if (lightsT >= 4.5 + lightsHold) {
        raceState = 'RACING';
        raceStartTimestamp = simTimeMs;
        allCars.forEach(c => { c.lapStartTime = simTimeMs; });
        setLights(5, true); sfxBeep(880, 0.5);
        showRaceControl('🟢 СТАРТ!', '#00e676');
        setTimeout(() => { document.getElementById('start-lights').style.opacity = 0; }, 1000);
    }
}

function startRaceSessionFromGrid(order) {
    initAudio();
    hideAllModals();
    currentSession = 'RACE'; isPaused = false; simTimeMs = 0; raceStartTimestamp = 0;
    raceMode = selectedCarClass === 'GT3' ? 'TIMED' : 'LAPS';
    raceDurationMs = ENDURANCE_MINUTES * 60000;
    raceRecorded = false; timeUpAnnounced = false;
    clearInputs(); resetEffects(); releaseFocus();
    sessionBestLap = { time: null, driverName: '---', carName: '' };

    let grid = order;
    if (!grid) {
        // без квалификации: решётка по классу пилота с заметным случайным разбросом (ИИ почти не обгоняет, поэтому порядок на старте важен)
        const noisy = new Map(aiCars.map(c => [c, c.botSkill + (Math.random() - 0.5) * 0.05]));
        const bots = [...aiCars].sort((a, b) => noisy.get(b) - noisy.get(a));
        grid = [...bots];
        grid.splice(Math.min(5, grid.length), 0, playerCar);
    }
    grid.forEach((car, idx) => car.placeOnGrid(idx));
    rebuildEngineVoices();

    raceState = 'LIGHTS'; lightsPhase = 0; lightsT = 0; lightsHold = 0.5 + Math.random() * 1.3;
    setLights(0, false);
    document.getElementById('start-lights').style.opacity = 1;
    document.getElementById('sessionLabel').textContent = raceMode === 'TIMED' ? 'ГОНКА · 20 МИН' : 'ГОНКА';
    const startPos = grid.indexOf(playerCar) + 1;
    showRaceControl(`Старт с позиции P${startPos}. ${window.transmissionMode === 'MANUAL' ? 'Ручная КПП: Shift — включить 1-ю передачу из нейтрали.' : 'Держите газ — на старте включится 1-я передача.'}`, '#38bdf8');
}

function endQualifyingStartRace() {
    const ranked = [...allCars].sort((a, b) => {
        if (a.bestLapTime === null && b.bestLapTime === null) return 0;
        if (a.bestLapTime === null) return 1;
        if (b.bestLapTime === null) return -1;
        return a.bestLapTime - b.bestLapTime;
    });
    gridOrder = ranked;
    startRaceSessionFromGrid(gridOrder);
}

// ============================================================================
// ФИНИШ, ОЧКИ, ТАБЛИЦЫ
// ============================================================================
function finalizeAllCarsForPostRaceReview(now) {
    finishRows = [...allCars].sort((a, b) => b.getContinuousTrackDistance() - a.getContinuousTrackDistance());
    currentSession = 'FINISHED';
    clearInputs();
}

function lapsDone(c) { return c.finishedRace ? c.lap - 1 : Math.max(0, Math.floor(c.progressAcc || 0)); }

function gapText(c, leader) {
    if (c === leader) {
        return raceMode === 'TIMED' ? `${lapsDone(c)} кр. · ${formatTime(c.finishTotalTimeMs)}` : formatTime(c.finishTotalTimeMs);
    }
    const diff = lapsDone(leader) - lapsDone(c);
    if (c.finishedRace && diff <= 0) return '+' + ((c.finishTotalTimeMs - leader.finishTotalTimeMs) / 1000).toFixed(3) + ' с';
    return '+' + Math.max(1, diff) + ' кр.';
}

let finishTab = 'RACE';
let finishHasRace = false;

function finishRaceModal() {
    finishHasRace = true;
    finishTab = 'RACE';
    if (selectedCarClass === 'F1' && !raceRecorded && !seasonDone()) {
        const rows = finishRows.map((c, i) => ({
            name: c.baseName || c.driverName, team: c.spec.teamName, pos: i + 1,
            pts: F1_POINTS[i] || 0, isPlayer: c.isPlayer
        }));
        if (!seasonStarted()) { season.team = selectedCarIndex; season.seat = selectedTeammateSlot; }
        recordSeasonRace(rows);
        raceRecorded = true;
    }
    openFinishModal();
    document.getElementById('start-lights').style.opacity = 0;
}

function openStandingsModal() {
    finishHasRace = false;
    finishTab = 'DRIVERS';
    openFinishModal();
}

function openFinishModal() {
    const f1 = selectedCarClass === 'F1';
    const hasSeason = f1 && season && season.results.length > 0;
    document.getElementById('tabRace').style.display = finishHasRace ? '' : 'none';
    document.getElementById('finishTabs').style.display = (hasSeason ? 'flex' : 'none');
    document.getElementById('tabDrivers').style.display = hasSeason ? '' : 'none';
    document.getElementById('tabTeams').style.display = hasSeason ? '' : 'none';

    const pos = finishRows.indexOf(playerCar) + 1;
    if (finishHasRace) {
        document.getElementById('finishTitle').textContent = pos === 1 ? '🏆 ПОБЕДА!' : `🏁 ФИНИШ — P${pos}`;
        document.getElementById('finishSub').textContent = f1
            ? `${TRACKS_DB[selectedTrackIndex].shortName} · ${totalRaceLaps} кр. · раунд ${season.results.length} из ${season.order.length}`
            : selectedCarClass==='ROAD' ? `${TRACKS_DB[selectedTrackIndex].shortName} · трек-день · ${totalRaceLaps} кр.` :
              `${TRACKS_DB[selectedTrackIndex].shortName} · гонка на выживание ${ENDURANCE_MINUTES} мин`;
    } else {
        document.getElementById('finishTitle').textContent = '📊 ТАБЛИЦЫ СЕЗОНА';
        document.getElementById('finishSub').textContent = `Сезон ${season.number} · гонок: ${season.results.length} из ${season.order.length}`;
    }
    const lastRace = hasSeason && finishHasRace;
    document.getElementById('btnFinishRestart').style.display = (f1 && finishHasRace) ? 'none' : (finishHasRace ? '' : 'none');
    document.getElementById('btnFinishNext').style.display = (f1 && hasSeason && !seasonDone()) ? '' : 'none';
    renderFinishTab();
    document.getElementById('finishModal').style.display = 'flex';
}

function setFinishTab(tab) { finishTab = tab; renderFinishTab(); }

function renderFinishTab() {
    const f1 = selectedCarClass === 'F1';
    const head = document.getElementById('finishTableHead');
    const body = document.getElementById('finishTableBody');
    const banner = document.getElementById('finishBanner');
    for (const [id, t] of [['tabRace', 'RACE'], ['tabDrivers', 'DRIVERS'], ['tabTeams', 'TEAMS']]) document.getElementById(id).classList.toggle('active', finishTab === t);
    body.innerHTML = ''; banner.style.display = 'none';
    const rounds = season ? season.results.length : 0;
    const roundCols = (arr) => Array.from({ length: rounds }, (_, i) => `<td class="num">${arr && arr[i] !== undefined ? arr[i] : '—'}</td>`).join('');
    const roundHead = Array.from({ length: rounds }, (_, i) => `<th class="num">R${i + 1}</th>`).join('');

    if (finishTab === 'RACE') {
        head.innerHTML = `<tr><th>#</th><th>Пилот</th><th>Команда</th><th>Лучший круг</th><th>Итог</th>${f1 ? '<th class="num">Очки</th>' : ''}</tr>`;
        const leader = finishRows[0];
        finishRows.forEach((c, i) => {
            const tr = document.createElement('tr');
            if (c.isPlayer) tr.className = 'player-row'; else if (c.isTeammate) tr.className = 'teammate-row';
            const pts = f1 ? (F1_POINTS[i] || 0) : 0;
            tr.innerHTML = `<td>${i + 1}</td><td>#${c.driverNumber} ${c.driverName}</td><td><span class="team-dot" style="background:${c.livery.primary}"></span>${c.spec.teamName}</td><td>${formatTime(c.bestLapTime)}</td><td>${gapText(c, leader)}</td>${f1 ? `<td class="num">${pts ? '+' + pts : '—'}</td>` : ''}`;
            body.appendChild(tr);
        });
        const pos = finishRows.indexOf(playerCar) + 1;
        if (f1) {
            const pts = F1_POINTS[pos - 1] || 0;
            banner.style.display = 'block';
            banner.textContent = pts ? `Вы набрали ${pts} очк. за P${pos}.` : `P${pos} — без очков (очки получают первые 10).`;
        }
    } else if (finishTab === 'DRIVERS') {
        head.innerHTML = `<tr><th>#</th><th>Пилот</th><th>Команда</th>${roundHead}<th class="num">Очки</th></tr>`;
        driverStandings().forEach((d, i) => {
            const tr = document.createElement('tr');
            if (d.isPlayer) tr.className = 'player-row';
            tr.innerHTML = `<td>${i + 1}</td><td>${d.name}${d.isPlayer ? ' (ВЫ)' : ''}</td><td><span class="team-dot" style="background:${teamColorByName(d.team)}"></span>${d.team}</td>${roundCols(d.perRound)}<td class="num"><b>${d.pts}</b></td>`;
            body.appendChild(tr);
        });
    } else {
        head.innerHTML = `<tr><th>#</th><th>Команда</th>${roundHead}<th class="num">Очки</th></tr>`;
        constructorStandings().forEach((t, i) => {
            const tr = document.createElement('tr');
            if (t.hasPlayer) tr.className = 'player-row';
            tr.innerHTML = `<td>${i + 1}</td><td><span class="team-dot" style="background:${teamColorByName(t.team)}"></span>${t.team}</td>${roundCols(t.perRound)}<td class="num"><b>${t.pts}</b></td>`;
            body.appendChild(tr);
        });
    }

    if (season && seasonDone() && f1 && finishTab !== 'RACE') {
        const champ = driverStandings()[0], cons = constructorStandings()[0];
        banner.style.display = 'block';
        banner.textContent = `🏆 Сезон завершён. Чемпион среди гонщиков: ${champ.name} (${champ.pts} очк.) · Кубок конструкторов: ${cons.team} (${cons.pts} очк.)`;
    } else if (season && seasonDone() && f1 && finishTab === 'RACE') {
        const champ = driverStandings()[0], cons = constructorStandings()[0];
        banner.style.display = 'block';
        banner.textContent = `🏆 Сезон завершён! Чемпион: ${champ.name} (${champ.pts}) · Конструкторы: ${cons.team} (${cons.pts}). Смотрите вкладки с кубками.`;
    }
}

// ============================================================================
// ПАУЗА И КНОПКИ МЕНЮ
// ============================================================================
function togglePauseMenu() {
    isPaused = !isPaused;
    clearInputs();
    document.getElementById('pauseModal').style.display = isPaused ? 'flex' : 'none';
    document.getElementById('btnEndQuali').style.display = currentSession === 'QUALI' ? '' : 'none';
    document.getElementById('btnRestartTrial').style.display=currentSession==='TIME_TRIAL'?'':'none';
    if (!isPaused) releaseFocus();
}

function backToGarage() {
    const leavingTrial=currentSession==='TIME_TRIAL';
    isPaused = true; currentSession = 'MENU'; clearInputs();
    document.getElementById('pauseModal').style.display = 'none';
    document.getElementById('finishModal').style.display = 'none';
    document.getElementById('start-lights').style.opacity = 0;
    if (selectedCarClass === 'F1' && !leavingTrial) { applyClassMode(); }
    document.getElementById('garageModal').style.display = 'flex';
    renderGarageUI();
}

document.getElementById('btnStartQuali').addEventListener('click', () => { prepareSeasonSelection();buildWeekendRoster(); startQualifyingSession(); });
document.getElementById('btnDirectRace').addEventListener('click', () => { prepareSeasonSelection();buildWeekendRoster(); startRaceSessionFromGrid(null); });
document.getElementById('btnGhostRace').addEventListener('click',()=>{buildWeekendRoster();startTimeTrialSession();});
document.getElementById('btnResumeGame').addEventListener('click', () => { isPaused = false; document.getElementById('pauseModal').style.display = 'none'; releaseFocus(); });
document.getElementById('btnRestartTrial').addEventListener('click',()=>{buildWeekendRoster();startTimeTrialSession();});
document.getElementById('btnEndQuali').addEventListener('click', endQualifyingStartRace);
document.getElementById('btnBackToGarage').addEventListener('click', backToGarage);
document.getElementById('btnFinishGarage').addEventListener('click', backToGarage);
document.getElementById('btnFinishRestart').addEventListener('click', () => { buildWeekendRoster(); startRaceSessionFromGrid(null); });
document.getElementById('btnFinishNext').addEventListener('click', backToGarage);
document.getElementById('tabRace').addEventListener('click', () => setFinishTab('RACE'));
document.getElementById('tabDrivers').addEventListener('click', () => setFinishTab('DRIVERS'));
document.getElementById('tabTeams').addEventListener('click', () => setFinishTab('TEAMS'));
document.getElementById('btnNewSeason').addEventListener('click', () => {
    if (seasonStarted() && !seasonDone() && !window.confirm('Начать новый сезон? Очки текущего сезона будут потеряны.')) return;
    newSeason();
    selectedTrackIndex = seasonNextTrack();
    selectedCarIndex = 0; selectedTeammateSlot = 0;
    buildActiveTrackGeometry();
    renderGarageUI();
});
document.getElementById('btnSeasonTable').addEventListener('click', () => {
    if (!season.results.length) { window.alert('В этом сезоне ещё не было гонок. Таблицы появятся после первой гонки.'); return; }
    openStandingsModal();
});

// ============================================================================
// HUD и миникарта
// ============================================================================
function standingsOrder() {
    if (currentSession === 'QUALI' || currentSession === 'TIME_TRIAL') {
        return [...allCars].sort((a, b) => {
            if (a.bestLapTime === null && b.bestLapTime === null) return b.getContinuousTrackDistance() - a.getContinuousTrackDistance();
            if (a.bestLapTime === null) return 1;
            if (b.bestLapTime === null) return -1;
            return a.bestLapTime - b.bestLapTime;
        });
    }
    return [...allCars].sort((a, b) => b.getContinuousTrackDistance() - a.getContinuousTrackDistance());
}

const shiftLightEls = [];
function buildShiftLights() {
    const el = document.getElementById('shiftLights');
    for (let i = 0; i < 10; i++) { const d = document.createElement('div'); d.className = 'sl'; el.appendChild(d); shiftLightEls.push(d); }
}
function updateShiftLights(rpm) {
    const lit = Math.max(0, Math.min(10, Math.round((rpm - 0.78) / 0.20 * 10)));
    const flash = rpm > 0.985 && Math.floor(performance.now() / 70) % 2 === 0;
    shiftLightEls.forEach((d, i) => {
        d.className = 'sl';
        if (i < lit || (rpm > 0.985 && flash)) d.classList.add(i < 4 ? 'on-g' : (i < 8 ? 'on-r' : 'on-b'));
    });
}

function updateHUD() {
    if (!playerCar) return;
    const p = playerCar;
    const standings = standingsOrder();
    const playerPos = standings.indexOf(p) + 1;
    const isRace = currentSession === 'RACE' || currentSession === 'FINISHED';

    document.getElementById('topPosCounter').textContent = `P${playerPos} / ${allCars.length}`;
    document.getElementById('topLapCounter').textContent = (isRace && raceMode === 'LAPS') ? `КРУГ ${Math.min(p.lap, totalRaceLaps)} / ${totalRaceLaps}` : `КРУГ ${p.lap}`;
    let curTime = formatTime(simTimeMs - p.lapStartTime);
    if (raceState === 'LIGHTS') curTime = '--:--.---';
    else if (currentSession === 'QUALI' && !p.timingStarted) curTime = 'ВЫЕЗД';
    document.getElementById('topCurTime').textContent = curTime;

    // часы: остаток времени (WEC) или время гонки
    const clockLbl = document.getElementById('topClockLabel'), clockVal = document.getElementById('topRaceClock');
    if (currentSession === 'RACE' || currentSession === 'FINISHED') {
        const el = raceState === 'LIGHTS' ? 0 : simTimeMs - raceStartTimestamp;
        if (raceMode === 'TIMED') {
            const left = raceDurationMs - el;
            if (left > 0) { clockLbl.textContent = 'ОСТАЛОСЬ'; clockVal.textContent = formatClock(left); clockVal.style.color = left < 60000 ? '#ff4757' : '#fff'; }
            else { clockLbl.textContent = 'ФИНИШ'; clockVal.textContent = '🏁'; clockVal.style.color = '#fff'; }
        } else { clockLbl.textContent = 'ВРЕМЯ ГОНКИ'; clockVal.textContent = formatClock(el); clockVal.style.color = '#fff'; }
    } else if (currentSession === 'QUALI') { const left = Math.max(0, QUALIFYING_DURATION_MS - simTimeMs); clockLbl.textContent = 'КВАЛИФИКАЦИЯ'; clockVal.textContent = formatClock(left); clockVal.style.color = left < 60000 ? '#ff4757' : '#fff'; } else { clockLbl.textContent = 'СЕССИЯ'; clockVal.textContent = formatClock(simTimeMs); clockVal.style.color = '#fff'; }

    document.getElementById('cpStatus').textContent = `${p.getCurrentSectorNumber()} / 4`;
    document.getElementById('lastTime').textContent = formatTime(p.lastLapTime);
    document.getElementById('bestTime').textContent = formatTime(p.bestLapTime);
    document.getElementById('sessionBestTime').textContent = formatTime(sessionBestLap.time);

    const kmh = Math.round(Math.hypot(p.dx, p.dy) * KMH_FACTOR);
    document.getElementById('dashSpeed').innerHTML = `${kmh} <small>км/ч</small>`;
    document.getElementById('dashGear').textContent = p.velocity < -0.1 ? 'R' : (p.gear === 0 ? 'N' : String(p.gear));
    document.getElementById('dashRpmFill').style.width = Math.round(Math.min(1, p.rpm) * 100) + '%';
    document.getElementById('dashRpm').innerHTML = `${Math.round(p.rpmReal / 10) * 10} <small>об/мин</small>`;
    updateShiftLights(p.rpm);

    const comp = TIRE_COMPOUNDS[p.compound];
    const compEl = document.getElementById('dashCompound');
    compEl.textContent = ({soft:'Мягкие · S',medium:'Средние · M',hard:'Жёсткие · H'})[p.compound]; compEl.style.color = comp.color;
    const hEl = document.getElementById('dashTireHealth');
    hEl.innerHTML = `${Math.round(p.tireHealth)}<small>%</small>`;
    hEl.classList.toggle('hud-tire-warn', p.tireHealth <= TIRE_CLIFF_PCT);
    document.getElementById('dashTireTemp').textContent = `${Math.round(p.tireTemp)}°C`;
    document.getElementById('dashWingDmg').textContent = `${Math.round(p.damageLevel * 100)}%`;
    updateDamageHUD(p);
    const drsEl = document.getElementById('dashDRS');
    if (p.spec.carClass === 'F1') { drsEl.textContent = p.drsActive ? 'ОТКР.' : 'ЗАКР.'; drsEl.style.color = p.drsActive ? '#00e676' : '#64748b'; }
    else { drsEl.textContent = '—'; drsEl.style.color = '#64748b'; }
    const aeroEl=document.getElementById('dashAero');
    const f1=p.spec.carClass==='F1';
    const driveName=DRIVETRAIN_LABELS[p.drivetrain]||'Задний · RWD';
    document.getElementById('hudDriveType').textContent=driveName;
    document.getElementById('hudEngineLayout').textContent=ENGINE_LAYOUT_LABELS[p.engineLayout]||'Средний мотор';
    const hb=document.getElementById('hudHandbrake');
    hb.textContent=p.handbrakeActive?'ЗАЖАТ':'ОТПУЩЕН';
    hb.classList.toggle('active',!!p.handbrakeActive);
    const towPct=Math.round((p.slipstream||0)*(f1?3.5:2.2));
    const dirtyPct=Math.round((p.dirtyAir||0)*(f1?20:12));
    const aeroParts=[];
    if(towPct>=1)aeroParts.push(`СЛИП +${towPct}%`);
    if(dirtyPct>=1)aeroParts.push(`ПРИЖИМ −${dirtyPct}%`);
    aeroEl.textContent=aeroParts.join(' · ')||'ЧИСТЫЙ';
    aeroEl.style.color=dirtyPct>towPct?'#f0b76b':(towPct?'#75d7bc':'#9aa4b2');
    aeroEl.title='Слипстрим снижает сопротивление и повышает максимальную скорость. Грязный воздух уменьшает прижим и сцепление в поворотах.';

    let plan = '—';
    if (currentSession === 'RACE') {
        const sched = p.strategy && p.strategy.stops && p.strategy.stops[p.pitStopsDone];
        if (p.pitPhase !== 'none') plan = p.pitPhase === 'service' ? `Обслуживание · ${Math.max(0,p.pitTimer).toFixed(1)} с` : (p.pitPhase === 'entry' ? `Въезд · ${TRACKS_DB[selectedTrackIndex].pitSpeedLimit} км/ч` : 'Выезд · ждём безопасное окно');
        else if (p.pitRequested) plan = 'Пит запрошен · подъезжаем к линии ограничения';
        else if (sched) plan = `Плановый пит · после круга ${sched.lap}`;
        else plan = p.tireHealth < 40 ? 'Шины изношены · рекомендуется пит' : 'Нет планового пита · остановку можно запросить вручную';
    }
    document.getElementById('pitPlanText').textContent = plan;
    const strategyBox = document.getElementById('raceStrategyPlan');
    if (p.strategy) {
        const stints = analyzeStrategy(getPlannedLaps(), p.strategy);
        const timeline = stints.map(st => `<span class="race-plan-stint"><b>Кр. ${st.fromLap}–${st.toLap}</b><i style="background:${TIRE_COMPOUNDS[st.tire].color}">${TIRE_COMPOUNDS[st.tire].shortTag}</i></span>`).join('<span class="race-plan-arrow">›</span>');
        const nextStop = p.strategy.stops[p.pitStopsDone];
        const nextLine = nextStop ? `Пит после круга ${nextStop.lap} · ${TIRE_COMPOUNDS[nextStop.tire].name}` : 'Без планового пита · остановка по износу, повреждению или запросу';
        strategyBox.innerHTML = `<div class="race-plan-name">${p.strategy.name}</div><div class="race-plan-timeline">${timeline}</div><div class="race-plan-next">${nextLine}</div>`;
    } else strategyBox.textContent = 'План будет рассчитан на старте';
    document.getElementById('pit-assistant').hidden=currentSession!=='RACE';
    const nextLabel={soft:'Мягкие',medium:'Средние',hard:'Жёсткие'}[p.nextCompound];
    document.getElementById('nextTireSummary').textContent='Поставят: '+nextLabel;
    for(const button of document.querySelectorAll('[data-next-tire]')) {
        const selected=button.dataset.nextTire===p.nextCompound;
        button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
        button.disabled=p.pitPhase==='service';
    }
    const pitButton=document.getElementById('btnPitRequest');
    pitButton.disabled=p.pitPhase!=='none';
    pitButton.textContent=(p.pitRequested?'Отменить заезд':'Запросить заезд')+' · '+combinedBindingLabel('pit');


    let html = '';
    const rowHtml = (c, idx) => {
        const val = currentSession === 'QUALI' ? formatTime(c.bestLapTime) : '';
        return `<div class="standings-mini-row" style="color:${c.isPlayer ? '#ff3b4e' : (c.isTeammate ? '#38bdf8' : '#dcdde1')}"><span>P${idx + 1} ${c.driverName}</span><span>${val}</span></div>`;
    };
    standings.slice(0, 5).forEach((c, idx) => { html += rowHtml(c, idx); });
    if (playerPos > 5) html += rowHtml(p, playerPos - 1);
    document.getElementById('liveTower').innerHTML = html;
    updateTrialHUD();
}

let minimapCache = null, minimapKey = '';
let minimapScale = 1, minimapOffX = 0, minimapOffY = 0;
function buildMinimapCache() {
    const W = minimapCanvas.width, H = minimapCanvas.height, pad = 16;
    minimapCache = document.createElement('canvas'); minimapCache.width = W; minimapCache.height = H;
    const c = minimapCache.getContext('2d');
    c.fillStyle = 'rgba(10,14,21,0.80)'; c.beginPath(); c.roundRect(0, 0, W, H, 10); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 1; c.stroke();
    // Fit the entire lap including pit entrance and exit.
    const allMapPoints=trackSamples.concat(pitWaypoints);
    const mapMinX=Math.min(...allMapPoints.map(p=>p.x)),mapMaxX=Math.max(...allMapPoints.map(p=>p.x));
    const mapMinY=Math.min(...allMapPoints.map(p=>p.y)),mapMaxY=Math.max(...allMapPoints.map(p=>p.y));
    minimapScale = Math.min((W - pad * 2) / Math.max(1,mapMaxX-mapMinX), (H - pad * 2) / Math.max(1,mapMaxY-mapMinY));
    minimapOffX = (W - (mapMaxX-mapMinX) * minimapScale) / 2 - mapMinX * minimapScale;
    minimapOffY = (H - (mapMaxY-mapMinY) * minimapScale) / 2 - mapMinY * minimapScale;
    c.lineJoin = 'round'; c.lineCap = 'round';
    const path = () => {
        c.beginPath();
        trackSamples.forEach((s, i) => { const x = s.x * minimapScale + minimapOffX, y = s.y * minimapScale + minimapOffY; if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); });
        c.closePath();
    };
    path(); c.strokeStyle = '#475569'; c.lineWidth = 6; c.stroke();
    path(); c.strokeStyle = '#94a3b8'; c.lineWidth = 2.2; c.stroke();
    // Complete pit route (including ingress and exit), separate from the racing line.
    if(pitWaypoints.length){
        c.beginPath();
        pitWaypoints.forEach((p,i)=>i?c.lineTo(p.x*minimapScale+minimapOffX,p.y*minimapScale+minimapOffY):c.moveTo(p.x*minimapScale+minimapOffX,p.y*minimapScale+minimapOffY));
        c.strokeStyle='#fbbf24';c.lineWidth=2.2;c.stroke();
        // Garage location markers.
        c.fillStyle='#f8fafc';
        for(const p of teamPitBoxes)c.fillRect(p.x*minimapScale+minimapOffX-1.5,p.y*minimapScale+minimapOffY-1.5,3,3);
    }
    for(let i=0;i<3;i++){
        const p=trackSamples[Math.floor(i*trackSamples.length/3)];
        c.fillStyle=['#f3a45b','#6edbbc','#88b7f6'][i];
        c.beginPath();c.arc(p.x*minimapScale+minimapOffX,p.y*minimapScale+minimapOffY,2.8,0,Math.PI*2);c.fill();
    }
    const s0 = trackSamples[0];
    c.fillStyle = '#fff'; c.fillRect(s0.x * minimapScale + minimapOffX - 3, s0.y * minimapScale + minimapOffY - 3, 6, 6);
}

function drawMinimap() {
    const key = selectedTrackIndex + '_' + Math.round(trackLengthPx);
    if (!minimapCache || minimapKey !== key) { buildMinimapCache(); minimapKey = key; }
    mCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    mCtx.drawImage(minimapCache, 0, 0);
    for (const c of allCars) {
        if (c === playerCar) continue;
        mCtx.fillStyle = c.isTeammate ? '#38bdf8' : c.livery.primary;
        mCtx.beginPath(); mCtx.arc(c.x * minimapScale + minimapOffX, c.y * minimapScale + minimapOffY, 3, 0, Math.PI * 2); mCtx.fill();
    }
    if (playerCar) {
        const px = playerCar.x * minimapScale + minimapOffX, py = playerCar.y * minimapScale + minimapOffY;
        mCtx.fillStyle = '#ff3b4e'; mCtx.strokeStyle = '#fff'; mCtx.lineWidth = 1.5;
        mCtx.beginPath(); mCtx.arc(px, py, 5, 0, Math.PI * 2); mCtx.fill(); mCtx.stroke();
    }
}

function resizeViewport() {
    const s = Math.min(window.innerWidth / 1284, window.innerHeight / 794, 1.6);
    viewportEl.style.transform = `scale(${s})`;
}
window.addEventListener('resize', resizeViewport);

// ============================================================================
// ИГРОВОЙ ЦИКЛ (фиксированный шаг физики 60 Гц)
// ============================================================================
function stepSimulation(input) {
    simTimeMs += STEP * 1000;
    stepStartLights(STEP);
    for (const c of allCars) c.update(STEP, c.isPlayer ? input : null);
    for (let i = 0; i < allCars.length; i++) {
        for (let j = i + 1; j < allCars.length; j++) resolveContourCarCollision(allCars[i], allCars[j]);
    }
    recordTrialFrame();
    for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx; s.y += s.vy; s.vx *= 0.92; s.vy *= 0.92; s.life -= 0.05;
        if (s.life <= 0) sparks.splice(i, 1);
    }
    for (let i = skidMarks.length - 1; i >= 0; i--) {
        skidMarks[i].life -= 0.0012;
        if (skidMarks[i].life <= 0) skidMarks.splice(i, 1);
    }
    if (currentSession === 'RACE' && raceMode === 'TIMED' && raceState === 'RACING' && !timeUpAnnounced && simTimeMs - raceStartTimestamp >= raceDurationMs) {
        timeUpAnnounced = true;
        showRaceControl('🏁 Время вышло! Финиш — на ближайшем круге', '#ffffff');
    }
    if (currentSession === 'QUALI' && simTimeMs >= QUALIFYING_DURATION_MS) {
        if (!qualifyingTimeExpired) {
            qualifyingTimeExpired = true;
            showRaceControl('⏱ Время квалификации вышло. Завершите текущий круг.', '#ffffff');
        }
        if (allCars.length && allCars.every(c => qualifyingFinishers.has(c))) endQualifyingStartRace();
    }
}

function drawEffects2D(ctx) {
    ctx.save();
    for (const m of skidMarks) {
        ctx.save();
        ctx.translate(m.x, m.y); ctx.rotate(m.a);
        ctx.fillStyle = `rgba(8,8,10,${Math.min(0.55, m.life * 0.55)})`;
        ctx.fillRect(-9, 6, 3, 5); ctx.fillRect(6, 6, 3, 5);
        ctx.restore();
    }
    for (const s of sparks) {
        ctx.fillStyle = `rgba(255,${Math.round(150 + 100 * s.life)},60,${s.life})`;
        ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    }
    ctx.restore();
}

let lastFrameTime = performance.now();
let accumulator = 0;

function gameLoop(now) {
    const frameDt = Math.min(0.1, (now - lastFrameTime) / 1000);
    lastFrameTime = now;
    const gpInput=pollGamepad();

    if (currentSession !== 'MENU' && playerCar) {
        if (!isPaused && currentSession !== 'FINISHED') {
            const input = collectInput(gpInput);
            accumulator += frameDt;
            let steps = 0;
            while (accumulator >= STEP && steps < 5) { stepSimulation(input); accumulator -= STEP; steps++; }
            if (steps === 5) accumulator = 0;

            const targetZoom = topZoom;
            camZoom += (targetZoom - camZoom) * (1 - Math.exp(-frameDt * 3));
        }

        if (topFollow === 'TRACK') {
            renderTopTrack(ctx, canvas.width, canvas.height);
        } else {
            topZoomNow = camZoom;
            ctx.fillStyle = '#122419';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(camZoom, camZoom);
            ctx.translate(-playerCar.x, -playerCar.y);
            drawTrack(ctx);
            drawEffects2D(ctx);
            drawTrialGhost(ctx);
            for (const car of allCars) if (car !== playerCar) car.draw(ctx);
            playerCar.draw(ctx);
            ctx.restore();
        }

        minimapCanvas.style.display = '';
        drawMinimap();
        updateHUD();
    } else {
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    updateAudio(frameDt);
    requestAnimationFrame(gameLoop);
}

// ============================================================================
// ЗАПУСК
// ============================================================================
resizeViewport();
loadSprites();
ensureSeason();
applyClassMode();
buildActiveTrackGeometry();
buildStartLights();
buildShiftLights();
renderGarageUI();
initMobileTouchControls();
refreshOptionButtons();
// спрайты подгружаются асинхронно — перерисуем карточки машин, когда они будут готовы
setTimeout(() => { if (currentSession === 'MENU') renderGarageUI(); }, 400);
requestAnimationFrame(gameLoop);

document.addEventListener('keydown',e=>{if((e.code==='Enter'||e.code==='Space') && e.target.matches('.track-card,.car-item')){e.preventDefault();e.target.click();}});

for(const button of document.querySelectorAll('[data-next-tire]')) button.addEventListener('click',()=>{selectNextTire(button.dataset.nextTire);updateHUD();releaseFocus();});
document.getElementById('btnPitRequest').addEventListener('click',()=>{requestPitStop();updateHUD();releaseFocus();});
for(const button of document.querySelectorAll('[data-open-controls]'))button.addEventListener('click',openControls);
for(const button of document.querySelectorAll('[data-controls-tab]'))button.addEventListener('click',()=>setControlsTab(button.dataset.controlsTab));
document.getElementById('btnCloseControls').addEventListener('click',closeControls);
document.getElementById('btnResetBindings').addEventListener('click',()=>{keyBindings=JSON.parse(JSON.stringify(DEFAULT_BINDINGS));capturingBinding=null;clearInputs();saveBindings();renderBindings();document.getElementById('bindingMessage').textContent='Стандартные клавиши восстановлены.';});
document.getElementById('btnResetGamepadBindings').addEventListener('click',()=>{gamepadBindings=JSON.parse(JSON.stringify(DEFAULT_GAMEPAD_BINDINGS));capturingGamepadBinding=null;gamepadCaptureArmed=false;clearInputs();saveGamepadBindings();renderGamepadBindings();document.getElementById('bindingMessage').textContent='Стандартные назначения геймпада восстановлены.';});
updateControlHints();

function prepareSeasonSelection() {
 if(selectedCarClass!=='F1')return;
 selectedTrackIndex=seasonNextTrack();
 if(teamLocked()){selectedCarIndex=season.team;selectedTeammateSlot=season.seat;}
}
function updateDamageHUD(car) {
 document.getElementById('damageRepairHint').textContent=currentSession==='TIME_TRIAL'?'Сброс повреждений — на новом круге':'Ремонт выполняется на пит-стопе';
 const parts=[['front',car.frontWingDamage,'Теряется передний прижим'],['rear',car.rearWingDamage,'Меньше заднего прижима и устойчивости'],['suspension',car.suspensionDamage,'Падает сцепление, машину тянет в сторону'],['engine',car.engineDamage,'Мощность −'+Math.round((1-car.engineCondition)*100)+'%'],['body',car.bodyDamage,'Выше сопротивление воздуха']];
 for(const [name,damage,effect] of parts){const el=document.querySelector('[data-damage="'+name+'"]');el.querySelector('b').textContent=Math.round(damage*100)+'%';el.classList.toggle('damaged',damage>.05);el.title=effect;}
 const worst=parts.reduce((a,b)=>a[1]>b[1]?a:b);
 document.getElementById('damageEffect').textContent=worst[1]>.05?(worst[1]>.45?'Нужен ремонт: ':'')+worst[2]:'Все узлы исправны';
}
for(const input of document.querySelectorAll('[data-ai-setting]')) input.addEventListener('input',()=>setAiSetting(input.dataset.aiSetting,input.value));
setAiSetting('pace',aiSettings.pace);setAiSetting('aggression',aiSettings.aggression);

function getPitStopLossEstimate() {
 const track=TRACKS_DB[selectedTrackIndex];
 const lapEstimate=(EST_LAP_SEC[selectedCarClass]||EST_LAP_SEC.GT3)[selectedTrackIndex]||140;
 const laneSeconds=pitRouteLength*PX_M/(track.pitSpeedLimit/3.6);
 return Math.max(8,Math.round(laneSeconds+(selectedCarClass==='F1'?2.6:12)-track.pitProgressSpan*lapEstimate));
}
