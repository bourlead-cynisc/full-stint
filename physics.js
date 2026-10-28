// ============================================================================
// physics.js — реалистичная модель машины
//   • продольная динамика: мощность двигателя ↔ сопротивление воздуха ↔ тяга шин
//   • прижимная сила растёт со скоростью², «круг трения» делит сцепление между
//     торможением/разгоном и поворотом
//   • реальные обороты и передачи: мощность зависит от оборотов, отсечка, провал при переключении
//   • износ и нагрев шин, пит-стопы, ИИ с расчётом тормозных точек
// Шаг физики фиксирован (1/60 с).
// ============================================================================

const skidMarks = [];
const sparks = [];

const MS = 5.5556;          // м/с на 1 px/кадр (KMH_FACTOR=20 → 1 px/кадр = 20 км/ч)
const PX_M = 0.0926;        // метров в одном пикселе мира
const G = 9.81;

function spawnSparks(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 5.5;
        sparks.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1.0 });
    }
}

function getTireGripMultiplier(healthPct, tempC) {
    const h = healthPct / 100;
    const cliff = TIRE_CLIFF_PCT / 100;
    let wearGrip = 0.92 + 0.08 * Math.min(1, h);
    if (h <= cliff) wearGrip = 0.45 + 0.27 * (h / cliff);
    const tempGrip = (tempC < 65) ? (0.78 + 0.22 * (tempC / 65)) : Math.max(0.65, 1.0 - Math.max(0, tempC - 110) * 0.012);
    return wearGrip * tempGrip;
}

// Нормированная мощность двигателя от оборотов r (1 = красная зона)
const POWER_PTS = [[0, 0.10], [0.14, 0.20], [0.30, 0.46], [0.50, 0.73], [0.70, 0.92], [0.85, 1.00], [0.95, 0.96], [1.00, 0.90]];
function powerCurve(r) {
    if (r >= 1.0) return r > 1.02 ? 0 : 0.9;
    for (let i = 1; i < POWER_PTS.length; i++) {
        if (r <= POWER_PTS[i][0]) {
            const [r0, p0] = POWER_PTS[i - 1], [r1, p1] = POWER_PTS[i];
            return p0 + (p1 - p0) * (r - r0) / (r1 - r0);
        }
    }
    return 0.9;
}

// Поведение машины: «Аркада» — больше сцепления и мгновенная реакция, «Реализм» — честная физика
const HC_ARC  = { hb: 1.32, circleK: 0.38, slipMul: 1.90, steerAttack: 10.0, steerAttackSp: 3.0, steerCross: 20, yawK: 30, steerSpLoss: 0.04, thrRise: 7.0, brkRise: 9.0, lock: 3.2 };
const HC_REAL = { hb: 1.00, circleK: 0.80, slipMul: 1.30, steerAttack: 6.0,  steerAttackSp: 2.5, steerCross: 13, yawK: 16, steerSpLoss: 0.10, thrRise: 4.8, brkRise: 6.5, lock: 2.7 };
function HC() { return (window.handlingMode === 'REAL') ? HC_REAL : HC_ARC; }

class Car {
    constructor(driverName, driverNumber, specIndex, isPlayer, isTeammate, botProfile = null, botSlot = 0) {
        this.driverName = driverName; this.driverNumber = driverNumber || 1;
        this.specIndex = specIndex; this.isPlayer = isPlayer; this.isTeammate = isTeammate;
        this.botProfile = botProfile || { tier: 'PLAYER', skill: 1.0, cornerMult: 1.0, aggression: 0.85 };
        this.botSkill = this.botProfile.skill; this.botSlot = botSlot;
        this.lastSampleIdx = -1;
        this.applySpec(specIndex);
    }

    applySpec(specIndex) {
        const catalog = getActiveCatalog();
        this.spec = catalog[specIndex % catalog.length];
        this.livery = this.spec.livery;
        this.width = this.spec.width; this.height = this.spec.height;
        this.cfg = CLASS_CFG[this.spec.carClass] || CLASS_CFG.GT3;
        this.perf = this.spec.perf || { power: 300, vmax: 255, grip: 1.55, aero: 0.9, brake: 1.7, tire: 1.0 };
        this.gearFrac = this.cfg.gearFrac;
        this.maxGears = this.gearFrac.length;
        // Класс пилота влияет на мощность и порог сцепления, который использует ИИ
        const sk = this.isPlayer ? 1.0 : this.botSkill;
        this.powerWkg = this.perf.power * (this.isPlayer ? 1.0 : (0.985 + 0.015 * sk * 1.0));
        this.vmaxMs = (this.perf.vmax / 3.6) * (this.isPlayer ? 1.0 : (0.99 + 0.01 * sk));
        this.baseMaxSpeed = this.vmaxMs / MS;                      // px/кадр
        this.dragK = this.perf.power * 0.93 / Math.pow(this.perf.vmax / 3.6, 3);
        this.tireSave = this.perf.tire || 1.0;
        this.brake0 = this.perf.brake;
        this.brakeAero = this.cfg.brakeAero;
        this.idle01 = this.cfg.idle / this.cfg.redline;
        this.launch01 = this.spec.carClass === 'F1' ? 0.62 : 0.55;
        this.engineProfile = ({ lambo_gt3: 'V10', audi_gt3: 'V10', porsche_gt3: 'F6', bmw_gt3: 'I6', ferrari_gt3: 'V6', mclaren_gt3: 'V8T', mercedes_gt3: 'V8', corvette_gt3: 'V8F' })[this.spec.id] ||
                              (this.spec.carClass === 'F1' ? 'F1' : 'V8');
    }

    getTeamPitBox() {
        return (teamPitBoxes && teamPitBoxes[this.specIndex]) ? teamPitBoxes[this.specIndex] : { x: controlPoints[0].x, y: controlPoints[0].y };
    }

    getFrontPoint() {
        return {
            x: this.x + Math.sin(this.angle) * (this.height * 0.51),
            y: this.y - Math.cos(this.angle) * (this.height * 0.51)
        };
    }

    assignStrategy(stratObj) {
        this.strategy = JSON.parse(JSON.stringify(stratObj));
        this.compound = this.strategy.start || 'soft';
        this.nextCompound = this.strategy.stops?.length ? this.strategy.stops[0].tire : this.compound;
    }

    getContourPoints() {
        const cosA = Math.cos(this.angle), sinA = Math.sin(this.angle);
        const hw = this.width * 0.48, hh = this.height * 0.49;
        return [{x: -hw, y: -hh}, {x: hw, y: -hh}, {x: hw, y: hh}, {x: -hw, y: hh}].map(p => ({
            x: this.x + (p.x * cosA - p.y * sinA), y: this.y + (p.x * sinA + p.y * cosA)
        }));
    }

    syncProgress() {
        const info = getTrackInfo(this.x, this.y, -1);
        this.lastSampleIdx = info.index;
        this.frontNormProgress = info.normProgress;
        this.prevNorm = info.normProgress;
        this.progressAcc = info.normProgress > 0.5 ? info.normProgress - 1 : info.normProgress;
        this.elevationM = info.center.z || 0;
    }

    placeOnGrid(gridPosIndex) {
        const gridBack = -90 - gridPosIndex * 66;
        const gridSide = (gridPosIndex % 2 === 0) ? -29 : 29;
        this.x = controlPoints[0].x + sfDirX * gridBack + sfNormX * gridSide;
        this.y = controlPoints[0].y + sfDirY * gridBack + sfNormY * gridSide;
        this.angle = START_ANGLE; this.resetSessionDynamicState();
        this.syncProgress();
    }

    placeForQualifying(slotIndex, totalCarsCount) {
        const idx = (totalSamples - 12 - slotIndex * 5 + totalSamples * 4) % totalSamples;
        const pt = trackSamples[idx];
        this.x = pt.x + pt.nx * (((slotIndex % 3) - 1) * 26);
        this.y = pt.y + pt.ny * (((slotIndex % 3) - 1) * 26);
        const nx = trackSamples[(idx + 3) % totalSamples];
        this.angle = Math.atan2(nx.x - pt.x, -(nx.y - pt.y));
        this.resetSessionDynamicState();
        this.velocity = 38 / MS;                      // выезжаем на ходу ≈ 140 км/ч
        this.dx = Math.sin(this.angle) * this.velocity;
        this.dy = -Math.cos(this.angle) * this.velocity;
        this.gear = 3; this.rpm = 0.55;
        this.syncProgress();
        this.timingStarted = false;
    }

    resetSessionDynamicState() {
        this.velocity = 0; this.dx = 0; this.dy = 0;
        this.smoothThrottle = 0; this.smoothBrake = 0; this.smoothSteer = 0;
        this.tireTemp = 35; this.wingDamage = 0;
        this.gear = 0;                   // 0 = нейтраль (N)
        this.rpm = this.idle01;          // 0..1 от красной зоны
        this.shiftCut = 0; this.shiftTimer = 0;
        this.aLat = 0; this.aLong = 0; this.latUse = 0;
        this.bodyRoll = 0; this.bodyPitch = 0;
        this.lap = 1; this.sectorsPassed = [false, false, false];
        this.lapStartTime = simTimeMs; this.lastLapTime = null; this.bestLapTime = null;
        this.warnings = 0; this.penaltySeconds = 0; this.finishedRace = false;
        this.finishTotalTimeMs = 0;
        this.compound = this.strategy ? this.strategy.start : 'soft';
        this.nextCompound = (this.strategy && this.strategy.stops && this.strategy.stops.length) ? this.strategy.stops[0].tire : this.compound;
        this.tireHealth = 100; this.pitStopsDone = 0;
        this.pitPhase = 'none'; this.pitTimer = 0; this.pitRequested = false; this.pendingTire = null;
        this.hitCooldown = 0; this.slip = 0; this.braking = false; this.drsActive = false;
        this.timingStarted = true; this.progressAcc = 0; this.prevNorm = undefined;
        this.lastSampleIdx = -1; this.wearScale = 1; this.aiConf = 1; this.yawRate = 0;
        this.form = this.isPlayer ? 1 : (0.987 + Math.random() * 0.026);     // «форма дня»: ±1,3 % к темпу ИИ в каждой гонке
    }

    get rpmReal() { return this.rpm * this.cfg.redline; }

    // ------------------------------------------------------------------
    // Коробка передач и обороты
    // ------------------------------------------------------------------
    rpmFromSpeed(gear, vms) {
        if (gear < 1) return this.idle01;
        return vms / (this.vmaxMs * this.gearFrac[gear - 1]);
    }

    doShift(newGear) {
        this.gear = newGear;
        this.shiftCut = this.cfg.shiftTime;
        this.shiftTimer = 0.45;
        if (this.isPlayer && typeof sfxShift === 'function') sfxShift();
    }

    updateGearbox(dt, thr, brake, manual) {
        const vms = Math.abs(this.velocity) * MS;
        if (this.shiftCut > 0) this.shiftCut -= dt;
        if (this.shiftTimer > 0) this.shiftTimer -= dt;

        if (manual) {
            if (window.shiftUpPressed) {
                window.shiftUpPressed = false;
                if (this.gear < this.maxGears) this.doShift(this.gear + 1);
            }
            if (window.shiftDownPressed) {
                window.shiftDownPressed = false;
                if (this.gear > 0) this.doShift(this.gear - 1);
            }
        } else {
            if (this.gear === 0) {
                if (thr > 0.05) this.gear = 1;
            } else {
                const r = this.rpmFromSpeed(this.gear, vms);
                if (this.shiftTimer <= 0) {
                    if (this.gear < this.maxGears && r > this.cfg.upRpm * (0.90 + 0.10 * Math.min(1, thr * 1.3))) {
                        this.doShift(this.gear + 1);
                    } else if (this.gear > 1) {
                        const rDown = this.rpmFromSpeed(this.gear - 1, vms);
                        if (rDown < 0.90 && (r < 0.42 || brake > 0.25 || (thr > 0.85 && r < 0.58))) this.doShift(this.gear - 1);
                    }
                }
                if (vms < 1.5 && thr < 0.02 && brake < 0.02) this.gear = 0;
            }
        }

        // Обороты с инерцией двигателя; на старте — пробуксовка сцепления
        let target;
        if (this.gear === 0) {
            target = this.idle01 + thr * (1 - this.idle01) * 0.92;
        } else {
            const rs = this.rpmFromSpeed(this.gear, vms);
            target = Math.max(rs, this.idle01);
            if (thr > 0.15 && rs < this.launch01 * 0.85) target = Math.max(target, this.idle01 + (this.launch01 - this.idle01) * Math.min(1, thr * 1.2));
            if (this.shiftCut > 0) target = Math.max(this.idle01, target * 0.92);
            target = Math.min(target, 1.04);
        }
        this.rpm += (target - this.rpm) * Math.min(1, dt * (target > this.rpm ? 11 : 7));
    }

    // ------------------------------------------------------------------
    // Управление → (газ, тормоз, руль)
    // ------------------------------------------------------------------
    isHumanControlled() {
        return this.isPlayer && !this.finishedRace && this.pitPhase === 'none';
    }

    humanControls(dt, input) {
        const sp = Math.min(1, Math.abs(this.velocity) * MS / this.vmaxMs);

        // Газ: сразу «подхватывает» (≈30 %), дальше плавно нарастает; сброс быстрый
        const tIn = input.throttle;
        if (tIn > this.smoothThrottle) {
            if (this.smoothThrottle < 0.30 * tIn) this.smoothThrottle = 0.30 * tIn;
            this.smoothThrottle = Math.min(tIn, this.smoothThrottle + dt * HC().thrRise);
        } else this.smoothThrottle = Math.max(tIn, this.smoothThrottle - dt * 11);

        // Тормоз: резкий старт (≈45 %) и быстрое нарастание, как у нажатой педали
        const bIn = input.brake;
        if (bIn > this.smoothBrake) {
            if (this.smoothBrake < 0.45 * bIn) this.smoothBrake = 0.45 * bIn;
            this.smoothBrake = Math.min(bIn, this.smoothBrake + dt * HC().brkRise);
        } else this.smoothBrake = Math.max(bIn, this.smoothBrake - dt * 13);

        // Руль: клавиша = цель ±1. Нарастает за ≈0,25 с, возвращается и перекладывается быстрее
        const sTarget = input.steer;
        const crossing = Math.sign(sTarget) !== Math.sign(this.smoothSteer) || sTarget === 0;
        const hc = HC();
        const rate = crossing ? hc.steerCross : (hc.steerAttack + hc.steerAttackSp * (1 - sp));
        const d = sTarget - this.smoothSteer;
        this.smoothSteer += Math.sign(d) * Math.min(Math.abs(d), rate * dt);

        return { thr: this.smoothThrottle, brake: this.smoothBrake, steer: this.smoothSteer * (1 - hc.steerSpLoss * sp), manual: window.transmissionMode === 'MANUAL' };
    }

    // ИИ: ведёт по гоночной линии, считает тормозные точки и скорость в поворотах
    aiControls(dt, speedFactor = 1.0, override = null) {
        const N = totalSamples;
        const vms = Math.abs(this.velocity) * MS;
        const base = Math.max(0, this.lastSampleIdx);
        const ds = trackLengthPx / N;

        // точка, на которую целимся
        const lookPx = 110 + Math.abs(this.velocity) * 30;
        const look = Math.max(2, Math.round(lookPx / ds));
        const tIdx = (base + look) % N;
        const rl = dynamicRacingLinePoints[tIdx];
        let lane = (((this.botSlot * 7) % 5) - 2) * 7;

        const fx = Math.sin(this.angle), fy = -Math.cos(this.angle);
        const rxv = Math.cos(this.angle), ryv = Math.sin(this.angle);
        let followV = Infinity;
        for (let k = 0; k < allCars.length; k++) {
            const o = allCars[k];
            if (o === this || o.pitPhase === 'service') continue;
            const ox = o.x - this.x, oy = o.y - this.y;
            const fwd = ox * fx + oy * fy;
            if (fwd <= 0 || fwd > 170) continue;
            const lat = ox * rxv + oy * ryv;
            if (Math.abs(lat) < 40) {
                lane += (lat >= 0 ? -1 : 1) * 24 * (1 - fwd / 170);
                if (fwd < 75 && Math.abs(lat) < 26) followV = Math.min(followV, Math.max(0, o.velocity) * MS * 0.99);
            }
        }
        lane = Math.max(-ASPHALT_HALF_W * 0.6, Math.min(ASPHALT_HALF_W * 0.6, lane));
        const tx = rl.x + trackSamples[tIdx].nx * lane;
        const ty = rl.y + trackSamples[tIdx].ny * lane;
        const desired = Math.atan2(tx - this.x, -(ty - this.y));
        let diff = desired - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        let steer = diff * 2.2;
        // у края трассы подруливаем к центру, чтобы не уйти в отбойник
        const edge = ASPHALT_HALF_W * 0.78;
        const lo = this.latOff || 0;
        let edgeOver = 0;
        if (Math.abs(lo) > edge) {
            edgeOver = Math.min(1.4, (Math.abs(lo) - edge) / (WALL_HALF_W - edge));
            steer -= Math.sign(lo) * Math.min(1.3, edgeOver * 2.6);
        }
        steer = Math.max(-1, Math.min(1, steer));
        this.smoothSteer += (steer - this.smoothSteer) * 0.35;

        // скорость: минимум по всем впереди лежащим поворотам с учётом торможения
        const comp = TIRE_COMPOUNDS[this.compound];
        const tg = getTireGripMultiplier(this.tireHealth, this.tireTemp) * comp.gripMult;
        const skillUse = Math.min(0.95, 0.87 * (1 + ((this.botProfile.cornerMult || 1) - 1) * 0.5) + 0.03 * ((this.botProfile.aggression || 0.8) - 0.8)) * (this.spec.carClass === 'F1' ? 0.93 : 1) * (this.form || 1);
        // самонастройка: если машину выносит (шины на пределе / далеко от центра) — берём запас, на чистых участках возвращаем
        if (this.latUse > 0.92 || (this.dbgDist || 0) > CURB_OUTER_W - 6) this.aiConf = Math.max(0.70, (this.aiConf || 1) - 0.006);
        else this.aiConf = Math.min(1, (this.aiConf || 1) + 0.0007);
        const conf2 = (this.aiConf || 1) * (this.aiConf || 1);
        const hb = HC().hb;
        const gA = G * this.perf.grip * hb * tg * skillUse * conf2 * (1 - 0.15 * this.wingDamage);
        const gAero = G * this.perf.aero * hb * skillUse * conf2 * (this.spec.carClass === 'F1' ? 0.82 : 1);
        const vmax2 = this.vmaxMs * this.vmaxMs;
        const qNow = Math.min(1.2, vms * vms / vmax2);
        const aBrCap = (this.brake0 + this.brakeAero * qNow) * tg * G * Math.sqrt(hb);       // что реально может тормоз
        const aBr = (this.spec.carClass === 'F1' ? 0.52 : 0.62) * aBrCap;       // планируем с запасом
        const vTop = this.vmaxMs * comp.speedMult;
        let vAllow = vTop;
        let reqDecel = 0;
        for (let j = 0; j < 44; j++) {
            const idx = (base + j) % N;
            let dist = (sampleCumDist[idx] - sampleCumDist[base]); if (dist < 0) dist += trackLengthPx;
            const kap = trackSamples[idx].kappa / PX_M;                // 1/м
            const denom = kap - gAero / vmax2;
            const vc = denom > 1e-7 ? Math.min(vTop, Math.sqrt(gA / denom)) : vTop;
            const dm = Math.max(dist * PX_M, 6);
            const vlim = Math.sqrt(vc * vc + 2 * aBr * dm);
            if (vlim < vAllow) vAllow = vlim;
            if (vms > vc) reqDecel = Math.max(reqDecel, (vms * vms - vc * vc) / (2 * dm));
        }
        vAllow = Math.min(vAllow * speedFactor * (this.form || 1) * (1 - 0.14 * Math.min(1, edgeOver)), followV);
        if (this.tireHealth < TIRE_CLIFF_PCT * 0.6) vAllow *= 0.94;

        this.dbgVAllow = vAllow;
        let thr = 0, brake = 0;
        if (reqDecel > 0.9 * aBr) brake = Math.min(1, 0.2 + reqDecel / (0.85 * aBrCap));
        else if (vms > vAllow + 0.8) brake = Math.min(1, 0.2 + (vms - vAllow) / 6);
        else if (vms < vAllow - 0.5) thr = Math.min(1, (vAllow - vms) / 3 + 0.2);
        this.smoothThrottle = thr; this.smoothBrake = brake;
        return { thr, brake, steer, manual: false, aiSteer: true };
    }

    // ------------------------------------------------------------------
    // Пит-стопы (упрощённо: остановка на линии старта-финиша)
    // ------------------------------------------------------------------
    startPit(tire) {
        this.pitPhase = 'braking';
        this.pendingTire = tire;
        this.pitRequested = false;
        if (this.isPlayer) showRaceControl(`🛠️ ПИТ-СТОП: ${TIRE_COMPOUNDS[tire].name}`, TIRE_COMPOUNDS[tire].color);
    }

    pitControls(dt) {
        const vms = Math.abs(this.velocity) * MS;
        if (this.pitPhase === 'braking') {
            if (vms < 1.2) {
                this.velocity = 0; this.dx = 0; this.dy = 0;
                this.pitPhase = 'service';
                this.pitTimer = 5.0 + 3.0 * this.wingDamage;
                this.gear = 0;
                return { thr: 0, brake: 1, steer: 0, manual: false, hold: true };
            }
            const c = this.aiControls(dt, 0.0);        // плавно тормозим по линии
            return { thr: 0, brake: 0.75, steer: c.steer, manual: false, aiSteer: true };
        }
        if (this.pitPhase === 'service') {
            this.velocity = 0; this.dx = 0; this.dy = 0; this.braking = true;
            this.pitTimer -= dt;
            if (this.isPlayer && Math.ceil(this.pitTimer) !== this._lastPitSec) {
                this._lastPitSec = Math.ceil(this.pitTimer);
                if (this._lastPitSec > 0) showRaceControl(`🛠️ Смена шин... ${this._lastPitSec} с`, '#38bdf8');
            }
            if (this.pitTimer <= 0) {
                this.compound = this.pendingTire || this.compound;
                this.tireHealth = 100; this.tireTemp = 75; this.wingDamage = 0;
                this.pitStopsDone++;
                const nxt = this.strategy && this.strategy.stops && this.strategy.stops[this.pitStopsDone];
                this.nextCompound = nxt ? nxt.tire : this.compound;
                this.pitPhase = 'exit'; this.pitTimer = 2.2;
                this.gear = 1;
                if (this.isPlayer) showRaceControl(`✅ Новые шины: ${TIRE_COMPOUNDS[this.compound].name}. Поехали!`, '#00e676');
            }
            return { thr: 0, brake: 1, steer: 0, manual: false, hold: true };
        }
        // 'exit': разгон до ограничителя пит-лейна 80 км/ч
        this.pitTimer -= dt;
        if (this.pitTimer <= 0) this.pitPhase = 'none';
        const c = this.aiControls(dt, 0.35);
        return { thr: vms < 22 ? 1 : 0, brake: 0, steer: c.steer, manual: false, aiSteer: true };
    }

    // ------------------------------------------------------------------
    // Главный шаг физики
    // ------------------------------------------------------------------
    update(dt, input) {
        const frontPt = this.getFrontPoint();
        const frontInfo = getTrackInfo(frontPt.x, frontPt.y, this.lastSampleIdx);
        this.lastSampleIdx = frontInfo.index;
        this.frontNormProgress = frontInfo.normProgress;
        this.elevationM = frontInfo.center.z || 0;
        this.slopeDeg = frontInfo.center.slopeDeg || 0;

        if (this.prevNorm !== undefined) {
            let d = frontInfo.normProgress - this.prevNorm;
            if (d < -0.5) d += 1; else if (d > 0.5) d -= 1;
            this.progressAcc += d;
        } else {
            this.progressAcc = frontInfo.normProgress > 0.5 ? frontInfo.normProgress - 1 : frontInfo.normProgress;
        }
        if (this.hitCooldown > 0) this.hitCooldown--;

        const comp = TIRE_COMPOUNDS[this.compound];
        const tireGrip = getTireGripMultiplier(this.tireHealth, this.tireTemp);
        const offTrack = frontInfo.dist > CURB_OUTER_W;
        const vmsSigned = this.velocity * MS;
        const vms = Math.abs(vmsSigned);

        this.drsActive = this.spec.carClass === 'F1' && raceState === 'RACING' && this.lap >= 2 &&
            isSampleInDrsZone(this.lastSampleIdx) && this.smoothThrottle > 0.9 && !this.braking;

        // ---------- огни старта: стоим, двигатель можно раскручивать ----------
        if (raceState !== 'RACING') {
            this.velocity = 0; this.dx = 0; this.dy = 0;
            const thr = this.isPlayer ? input.throttle : 0;
            this.smoothThrottle += (thr - this.smoothThrottle) * Math.min(1, dt * 7.5);
            this.smoothBrake = 0;
            this.updateGearbox(dt, this.smoothThrottle, 0, window.transmissionMode === 'MANUAL' && this.isPlayer);
            if (!this.isPlayer && this.gear === 0) this.gear = 1;
            this.prevNorm = frontInfo.normProgress;
            return;
        }

        // ---------- выбор источника управления ----------
        let ctl;
        if (this.pitPhase !== 'none') ctl = this.pitControls(dt);
        else if (this.isHumanControlled()) ctl = this.humanControls(dt, input);
        else ctl = this.aiControls(dt, this.finishedRace ? 0.55 : 1.0);

        this.dbgDist = frontInfo.dist;
        this.latOff = (frontPt.x - frontInfo.center.x) * (frontInfo.center.nx || 0) + (frontPt.y - frontInfo.center.y) * (frontInfo.center.ny || 0);
        this.updateGearbox(dt, ctl.thr, ctl.brake, ctl.manual);
        this.braking = ctl.brake > 0.05 || this.pitPhase === 'service';

        // ---------- сцепление: механика + прижимная сила ----------
        const q = Math.min(1.4, (vms * vms) / (this.vmaxMs * this.vmaxMs));
        const wingLoss = 1 - 0.5 * this.wingDamage;
        const surf = offTrack ? 0.55 : 1.0;
        const hc = HC();
        const gripG = (this.perf.grip * comp.gripMult * tireGrip + this.perf.aero * q * wingLoss) * surf * hc.hb;
        const gripMax = Math.max(0.3, gripG) * G;                    // м/с²

        // ---------- продольная динамика ----------
        const lat = Math.min(1, this.latUse);
        const circle = Math.sqrt(Math.max(0.04, 1 - lat * lat));
        let aEng = 0, aBrk = 0, aEB = 0;
        const redline = this.rpm >= 1.0;
        if (!ctl.hold && ctl.thr > 0.01 && this.gear >= 1 && this.shiftCut <= 0 && vmsSigned >= -0.3 && !redline) {
            const P = this.powerWkg * powerCurve(this.rpm) * ctl.thr;     // Вт/кг
            aEng = Math.min(P / Math.max(vms, 5), 0.60 * gripMax * circle);
        }
        if (this.gear >= 1 && ctl.thr < 0.05 && vms > 2) aEB = (1.2 + 3.6 * Math.min(1.1, this.rpm)) * (this.spec.carClass === 'F1' ? 0.9 : 1.0);
        if (redline && vms > 2) aEB = Math.max(aEB, 5);
        if (ctl.brake > 0.01 && vmsSigned > 0.3) {
            const bMax = (this.brake0 + this.brakeAero * q) * tireGrip * comp.gripMult * surf * G * Math.sqrt(hc.hb);
            aBrk = ctl.brake * Math.min(bMax, gripMax * 1.15) * circle;
        }
        const dragMul = this.drsActive ? 0.80 : 1.0;
        let aDrag = this.dragK * dragMul * vms * vms + 0.12;
        if (vms < 0.05) aDrag = 0;

        let newV;
        const wantReverse = this.isPlayer && !ctl.hold && this.pitPhase === 'none' && ctl.brake > 0.05 && ctl.thr < 0.05 && vms < 1.2;
        if (wantReverse || (vmsSigned < -0.05 && ctl.thr < 0.05 && ctl.brake > 0.05)) {
            newV = Math.max(-3.2, vmsSigned - 3.0 * ctl.brake * dt);        // задний ход
        } else if (vmsSigned < -0.05) {
            newV = Math.min(0, vmsSigned + 6 * dt * (1 + 3 * ctl.thr));      // гасим задний ход
        } else {
            newV = vmsSigned + (aEng - aDrag - aEB - aBrk) * dt;
            if (newV < 0) newV = 0;
        }
        this.aLong = (newV - vmsSigned) / dt;
        // потолок скорости (DRS/шины слегка влияют)
        const topMs = this.vmaxMs * comp.speedMult * (this.drsActive ? 1.03 : 1.0) * (1 - 0.06 * this.wingDamage);
        if (newV > topMs) newV = newV + (topMs - newV) * 0.2;
        this.velocity = newV / MS;

        // ---------- поперечная динамика (руль ограничен сцеплением) ----------
        const aLatMax = gripMax * Math.sqrt(Math.max(0.04, 1 - Math.min(1, Math.abs(this.aLong) / gripMax) ** 2 * hc.circleK));
        const av = Math.abs(newV);
        const omegaLock = Math.min(hc.lock, av / 5.0);
        const omegaGrip = aLatMax / Math.max(av, 2.5);
        const omegaMax = Math.min(omegaLock, omegaGrip);
        const yawTarget = ctl.steer * omegaMax * (newV >= 0 ? 1 : -1);
        this.dbgSteer = ctl.steer; this.dbgOmega = omegaMax; this.dbgGripMax = gripMax; this.dbgBrake = ctl.brake;
        // кузов набирает скорость вращения с инерцией (≈0,08–0,1 с) — машина «живая», а не на рельсах
        this.yawRate += (yawTarget - this.yawRate) * Math.min(1, dt * (this.isPlayer ? hc.yawK : Math.max(14, hc.yawK)));
        if (av < 0.3) this.yawRate *= 0.8;
        this.angle += this.yawRate * dt;
        this.bodyRoll += (-(this.yawRate * av / G) * 0.9 - this.bodyRoll) * Math.min(1, dt * 8);
        this.aLat = av * Math.abs(this.yawRate);
        this.latUse = Math.min(1.2, this.aLat / gripMax);
        this.bodyPitch += (-(this.aLong / (G * 3)) - this.bodyPitch) * Math.min(1, dt * 10);

        // ---------- скольжение: вектор скорости догоняет направление кузова ----------
        const slipK = Math.max(0.07, Math.min(0.36, (0.10 + 0.07 * tireGrip * comp.gripMult * surf) * hc.slipMul));
        const targetDx = Math.sin(this.angle) * this.velocity;
        const targetDy = -Math.cos(this.angle) * this.velocity;
        this.slip = Math.hypot(targetDx - this.dx, targetDy - this.dy);
        this.dx += (targetDx - this.dx) * slipK;
        this.dy += (targetDy - this.dy) * slipK;
        this.x += this.dx; this.y += this.dy;

        // ---------- износ и нагрев шин ----------
        const speed = Math.hypot(this.dx, this.dy);
        if (speed > 0.5 && !this.finishedRace) {
            const style = 0.62 + 0.95 * Math.min(1, this.latUse) + 0.45 * Math.min(1, aBrk / (gripMax || 1)) +
                          0.10 * Math.min(1, this.slip / 3) + (this.tireTemp > 112 ? 0.30 : 0);
            const wearPct = (speed / trackLengthPx) * comp.wearPerLap * style / this.tireSave * (this.wearScale || 1) * hc.hb;
            this.tireHealth = Math.max(0, this.tireHealth - wearPct);
            const target = 38 + 22 * Math.min(1, vms / this.vmaxMs) + 48 * Math.min(1, this.latUse) + 22 * Math.min(1, aBrk / (gripMax || 1)) + 12 * Math.min(1, this.slip / 2.5);
            this.tireTemp += (Math.min(150, target) - this.tireTemp) * Math.min(1, dt * 0.35);
        } else {
            this.tireTemp += (30 - this.tireTemp) * Math.min(1, dt * 0.05);
        }

        if (this.isPlayer && this.slip > 1.9 && speed > 2) {
            skidMarks.push({ x: this.x, y: this.y, a: this.angle, life: 1 });
            if (skidMarks.length > 500) skidMarks.shift();
        }

        // ---------- стена ----------
        const ptInfo = getTrackInfo(this.x, this.y, this.lastSampleIdx);
        if (ptInfo.dist > WALL_HALF_W) {
            const nx = (this.x - ptInfo.center.x) / ptInfo.dist;
            const ny = (this.y - ptInfo.center.y) / ptInfo.dist;
            this.x -= nx * (ptInfo.dist - WALL_HALF_W);
            this.y -= ny * (ptInfo.dist - WALL_HALF_W);
            const impact = Math.max(0, this.dx * nx + this.dy * ny);
            this.dx -= nx * impact * 1.1; this.dy -= ny * impact * 1.1;
            this.velocity *= 0.95;
            if (impact > 2.0 && this.hitCooldown === 0) {
                this.hitCooldown = 45;
                this.velocity *= 0.7;
                this.wingDamage = Math.min(1.0, this.wingDamage + Math.min(0.25, impact * 0.025));
                spawnSparks(this.x, this.y, 8);
                if (this.isPlayer) {
                    showRaceControl(`💥 УДАР! Повреждение крыла: ${Math.round(this.wingDamage * 100)}%`, '#ff4757');
                    if (typeof sfxImpact === 'function') sfxImpact(Math.min(1, impact / 8));
                }
            }
        }

        this.updateLapAndSectors();
    }

    updateLapAndSectors() {
        const norm = this.frontNormProgress;
        const prev = this.prevNorm;
        this.prevNorm = norm;

        if (raceState !== 'RACING' || this.finishedRace) return;

        if (norm > 0.18 && norm < 0.40) this.sectorsPassed[0] = true;
        if (norm > 0.42 && norm < 0.65) this.sectorsPassed[1] = true;
        if (norm > 0.68 && norm < 0.92) this.sectorsPassed[2] = true;

        const crossed = prev !== undefined && prev > 0.85 && norm < 0.15;
        if (!crossed) return;

        const allSectors = this.sectorsPassed[0] && this.sectorsPassed[1] && this.sectorsPassed[2];
        if (!allSectors) {
            if (currentSession === 'QUALI' && !this.timingStarted) {
                this.timingStarted = true;
                this.lapStartTime = simTimeMs;
                this.sectorsPassed = [false, false, false];
            }
            return;
        }

        const now = simTimeMs;
        const rawLap = now - this.lapStartTime;
        this.lastLapTime = rawLap;
        if (this.bestLapTime === null || rawLap < this.bestLapTime) this.bestLapTime = rawLap;
        registerLapForGlobalBest(this, rawLap);

        const finishedLap = this.lap;
        this.lap++;
        this.lapStartTime = now;
        this.sectorsPassed = [false, false, false];

        if (currentSession === 'RACE') {
            const timeUp = (raceMode === 'TIMED') && (now - raceStartTimestamp >= raceDurationMs);
            if ((raceMode === 'LAPS' && this.lap > totalRaceLaps) || timeUp) {
                this.finishedRace = true;
                this.finishTotalTimeMs = now - raceStartTimestamp;
                if (this.isPlayer) { finalizeAllCarsForPostRaceReview(now); finishRaceModal(); }
                return;
            }
            const sched = this.strategy && this.strategy.stops && this.strategy.stops[this.pitStopsDone];
            if (sched && sched.lap === finishedLap) {
                this.startPit(this.isPlayer ? this.nextCompound : sched.tire);
            } else if (this.pitRequested) {
                this.startPit(this.nextCompound);
            } else if (raceMode === 'TIMED' && !this.isPlayer && this.tireHealth < 26 && (now - raceStartTimestamp) < raceDurationMs - 100000) {
                this.startPit('medium');            // в гонке на время ИИ меняет изношенные шины сверх плана
            }
        }
    }

    getCurrentSectorNumber() {
        if (this.frontNormProgress < 0.25) return 1;
        if (this.frontNormProgress < 0.50) return 2;
        if (this.frontNormProgress < 0.75) return 3;
        return 4;
    }

    getContinuousTrackDistance() {
        // финишировавшие впереди: больше кругов, затем меньшее время
        if (this.finishedRace) return 1000 + (this.lap - 1) - this.finishTotalTimeMs / 1e8;
        return this.progressAcc || 0;
    }

    draw(ctx) {
        // 2D-вид сверху: спрайт машины (см. sprites.js) или векторный запасной вариант
        const refZ = playerCar ? playerCar.elevationM : 0;
        const relElev = (this.elevationM - refZ) * 0.25;
        ctx.save();
        ctx.translate(this.x, this.y - relElev * 0.0);
        ctx.rotate(this.angle + (this.bodyRoll * 0.05));
        if (this.pitPhase === 'service') ctx.globalAlpha = 0.85;
        drawCarSpriteTop(ctx, this);
        ctx.restore();
    }
}

function resolveContourCarCollision(c1, c2) {
    if (c1.pitPhase === 'service' || c2.pitPhase === 'service' || c1.pitPhase === 'braking' || c2.pitPhase === 'braking') return;
    const ddx = c2.x - c1.x, ddy = c2.y - c1.y;
    const dist = Math.hypot(ddx, ddy);
    if (dist < 46 && dist > 0.001) {
        const nx = ddx / dist, ny = ddy / dist;
        const push = (46 - dist) * 0.5;
        c1.x -= nx * push; c1.y -= ny * push;
        c2.x += nx * push; c2.y += ny * push;
        c1.velocity *= 0.99; c2.velocity *= 0.99;
        const rel = Math.hypot(c1.dx - c2.dx, c1.dy - c2.dy);
        if (rel > 3.0 && c1.hitCooldown === 0 && c2.hitCooldown === 0) {
            c1.hitCooldown = c2.hitCooldown = 40;
            c1.wingDamage = Math.min(1.0, c1.wingDamage + 0.04);
            c2.wingDamage = Math.min(1.0, c2.wingDamage + 0.04);
            spawnSparks((c1.x + c2.x) * 0.5, (c1.y + c2.y) * 0.5, 6);
            if ((c1.isPlayer || c2.isPlayer) && typeof sfxImpact === 'function') sfxImpact(Math.min(1, rel / 8));
        }
    }
}
