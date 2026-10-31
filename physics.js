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
    const h = Math.max(0, Math.min(1, healthPct / 100));
    const cliff = TIRE_CLIFF_PCT / 100;
    const wearGrip = h > cliff ? 0.88 + 0.12 * h : 0.65 + 0.252 * h / cliff;
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
const HC_ARC  = { hb: 1.55, circleK: 0.38, slipMul: 1.90, steerAttack: 13.0, steerAttackSp: 4.0, steerCross: 25, yawK: 36, steerSpLoss: 0.02, thrRise: 7.0, brkRise: 9.0, lock: 3.8 };
const HC_REAL = { hb: 1.27, circleK: 0.80, slipMul: 1.30, steerAttack: 9.5,  steerAttackSp: 3.5, steerCross: 18, yawK: 25, steerSpLoss: 0.045, thrRise: 4.8, brkRise: 6.5, lock: 3.25 };
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
        this.character = this.spec.character;
        this.mass = this.character.mass;
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
        this.engineProfile = CAR_ENGINE_FAMILIES[this.spec.id] ? this.spec.id :
                              (this.spec.carClass === 'F1' ? 'f1_redbull' : 'aston_gt3');
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
        this.tireTemp = 75; this.wingDamage = 0; this.suspensionDamage = 0; this.bodyDamage = 0; this.engineDamage = 0; this.suspensionPull = 0; this.impactSpin = 0;
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
        this.aiBlockedTime = 0; this.aiRecoveryTime = 0;
        this.aiLane=0;this.aiMode="RACING";this.aiPassSide=0;this.aiDefenseUsed=false;this.aiDefenseLane=null;this.aiYieldUntil=0;this.aiNextMistake=0;this.aiErrorTime=0;
        this.hitCooldown = 0; this.slip = 0; this.braking = false; this.drsActive = false;
        this.timingStarted = true; this.progressAcc = 0; this.prevNorm = undefined;
        this.lastSampleIdx = -1; this.wearScale = 1; this.aiConf = 1; this.yawRate = 0;
        this.form = this.isPlayer ? 1 : (0.987 + Math.random() * 0.026);     // «форма дня»: ±1,3 % к темпу ИИ в каждой гонке
    }

    get wingDamage() {return Math.max(this.frontWingDamage||0,this.rearWingDamage||0);}
    set wingDamage(value) {this.frontWingDamage=value;this.rearWingDamage=value;}
    get aeroCondition() {return 1 - 0.45*this.frontWingDamage - 0.55*this.rearWingDamage;}
    get engineCondition() {return 1 - 0.55*this.engineDamage;}
    get damageLevel() {return Math.max(this.frontWingDamage,this.rearWingDamage,this.suspensionDamage,this.engineDamage,this.bodyDamage);}
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

        return { thr: this.smoothThrottle, brake: this.smoothBrake, handbrake: input.handbrake ? 1 : 0, steer: this.smoothSteer * (1 - hc.steerSpLoss * sp), manual: window.transmissionMode === 'MANUAL' };
    }

    // ИИ: ведёт по гоночной линии, считает тормозные точки и скорость в поворотах
    aiControls(dt, speedFactor = 1.0, override = null) {
        const N = totalSamples;
        const vms = Math.abs(this.velocity) * MS;
        const base = Math.max(0, this.lastSampleIdx);
        const offTrack = (this.dbgDist || 0) > CURB_OUTER_W;
        const ds = trackLengthPx / N;

        // точка, на которую целимся
        // Aim about one second ahead at speed so the bot starts setting up
        // before the corner rather than reacting at its entry.
        const lookPx = 90 + Math.abs(this.velocity) * 48;
        const look = Math.max(2, Math.round(lookPx / ds));
        const tIdx = (base + look) % N;
        const rl = dynamicRacingLinePoints[tIdx];
        const traffic=planRaceTraffic(this,dt);
        const lane=traffic.lane,followV=traffic.followV;
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
        const edgeCorrection=steer-diff*2.2;


        // скорость: минимум по всем впереди лежащим поворотам с учётом торможения
        const comp = TIRE_COMPOUNDS[this.compound];
        const tg = getTireGripMultiplier(this.tireHealth, this.tireTemp) * comp.gripMult;
        const skillUse = Math.min(0.99, (aiSettings.pace/100)**2 * 0.94 * (1 + ((this.botProfile.cornerMult || 1) - 1) * 0.5) + 0.03 * ((this.botProfile.aggression || 0.8) - 0.8)) * (this.spec.carClass === 'F1' ? 0.93 : 1) * (this.form || 1);
        // самонастройка: если машину выносит (шины на пределе / далеко от центра) — берём запас, на чистых участках возвращаем
        if (this.latUse > 0.92 || (this.dbgDist || 0) > CURB_OUTER_W - 6) this.aiConf = Math.max(0.70, (this.aiConf || 1) - 0.006);
        else this.aiConf = Math.min(1, (this.aiConf || 1) + 0.0007);
        const conf2 = (this.aiConf || 1) * (this.aiConf || 1);
        const hb = HC().hb;
        const surfaceGrip = (offTrack ? 0.55 : 1) * (1 - 0.25 * this.suspensionDamage);
        const gA = G * this.perf.grip * surfaceGrip * hb * tg * skillUse * conf2 * (1 - 0.15 * this.wingDamage);
        const gAero = G * this.perf.aero * 1.45 * this.character.aeroResponse * this.aeroCondition * surfaceGrip * hb * skillUse * conf2 * (this.spec.carClass === 'F1' ? 0.82 : 1);
        const vmax2 = this.vmaxMs * this.vmaxMs;
        const qNow = Math.min(1.2, vms * vms / vmax2);
        const lateralAuthority=(gA+gAero*qNow)/Math.max(vms,2.5);
        const desiredYaw=vms*(Math.sign(trackSamples[tIdx].curv||0)*trackSamples[tIdx].kappa/PX_M);
        const curvatureFeedForward=Math.max(-1,Math.min(1,desiredYaw/Math.max(.18,lateralAuthority)));
        steer=Math.max(-1,Math.min(1,diff*2.5+curvatureFeedForward*.22+edgeCorrection));
        this.smoothSteer+=(steer-this.smoothSteer)*Math.min(1,dt*8);

        const stoppedAtWall=vms<1.2&&(this.dbgDist||0)>ASPHALT_HALF_W+8;
        let progressDelta=0;
        if(this.aiLastProgressAcc!==undefined) {
            progressDelta=(this.progressAcc||0)-this.aiLastProgressAcc;
            if(progressDelta<-.5)progressDelta+=1;
        }
        const noProgress=this.aiLastProgressAcc!==undefined&&Math.abs(progressDelta)<0.000012;
        this.aiLastProgressAcc=this.progressAcc||0;
        if(vms<1.2&&(stoppedAtWall||(noProgress&&!traffic.blockedByCar)))this.aiStuckTime=(this.aiStuckTime||0)+dt;
        else this.aiStuckTime=Math.max(0,(this.aiStuckTime||0)-dt*2);
        if(this.aiStuckTime>2.2) {this.aiRecoveryTime=2.4;this.aiStuckTime=0;}
        if(this.aiRecoveryTime>0) {
            this.aiRecoveryTime-=dt;this.smoothThrottle=0;this.smoothBrake=1;
            const lateral=this.latOff||0;
            const recoverySteer=Math.abs(lateral)>14?-Math.sign(lateral)*.7:-steer*.65;
            return {thr:0,brake:1,steer:recoverySteer,manual:false,reverse:true};
        }
        const aBrCap = (this.brake0 + this.brakeAero * qNow) * tg * G * Math.sqrt(hb) * surfaceGrip;
        // Plan for only part of the available braking force. This leaves room
        // for steering, traffic, worn tires and the model's frame-by-frame delay.
        const aBr = (this.spec.carClass === 'F1' ? 0.42 : 0.48) * aBrCap;
        const vTop = this.vmaxMs * comp.speedMult;
        let vAllow = vTop;
        let reqDecel = 0;
        for (let j = 0; j < Math.min(N, 360); j++) {
            const idx = (base + j) % N;
            let dist = (sampleCumDist[idx] - sampleCumDist[base]); if (dist < 0) dist += trackLengthPx;
            if (dist * PX_M > 900) break;
            const kap = trackSamples[idx].kappa / PX_M;                // 1/м
            const denom = kap - gAero / vmax2;
            const rawCornerSpeed = denom > 1e-7 ? Math.sqrt(gA / denom) : vTop;
            const vc = rawCornerSpeed < vTop ? rawCornerSpeed * 0.92 : vTop;
            const dm = Math.max(dist * PX_M, 6);
            const vlim = Math.sqrt(vc * vc + 2 * aBr * dm);
            if (vlim < vAllow) vAllow = vlim;
            if (vms > vc) reqDecel = Math.max(reqDecel, (vms * vms - vc * vc) / (2 * dm));
        }
        vAllow = Math.min(vAllow * speedFactor * traffic.pace * (this.form || 1) * (1 - 0.14 * Math.min(1, edgeOver)), followV);
        if(!Number.isFinite(followV))vAllow=Math.max(vAllow,2.0);
        if (this.tireHealth < TIRE_CLIFF_PCT * 0.6) vAllow *= 0.94;

        vAllow=Math.min(vAllow,this.vmaxMs*Math.min(1,aiSettings.pace/100));
        this.dbgVAllow = vAllow;
        let thr = 0, brake = 0;
        if (reqDecel > 0.9 * aBr) brake = Math.min(1, 0.2 + reqDecel / (0.85 * aBrCap));
        else if (vms > vAllow + 0.8) brake = Math.min(1, 0.2 + (vms - vAllow) / 6);
        else if (vms < vAllow - 0.18) thr = Math.max(0.28,Math.min(1, (vAllow - vms) / 3 + 0.2));
        this.smoothThrottle = thr; this.smoothBrake = brake;
        return { thr, brake, steer, manual: false, aiSteer: true };
    }

    // ------------------------------------------------------------------
    // Пит-стопы (упрощённо: остановка на линии старта-финиша)
    // ------------------------------------------------------------------
    applyImpact(speedMs, frontWeight = 0.5, longitudinalSign = 1, wheelHit = false) {
        frontWeight=Math.max(0,Math.min(1,frontWeight));
        const severity = Math.max(0, speedMs - 3) ** 1.35 / 260;
        if(longitudinalSign >= 0) this.frontWingDamage=Math.min(1,this.frontWingDamage+severity*frontWeight);
        else this.rearWingDamage=Math.min(1,this.rearWingDamage+severity*frontWeight);
        this.suspensionDamage=Math.min(1,this.suspensionDamage+severity*((1-frontWeight)*0.65+(wheelHit?.8:0)));
        const engineExposure=this.character.enginePosition==='front'?(longitudinalSign>=0?.65:.12):this.character.enginePosition==='rear'?(longitudinalSign<0?.75:.08):(longitudinalSign<0?.6:.15);
        this.engineDamage=Math.min(1,this.engineDamage+severity*engineExposure*(0.5+frontWeight*.5));
        this.bodyDamage=Math.min(1,this.bodyDamage+severity*.5);
    }

    startPit(tire) {
        if (this.pitPhase !== 'none') return;
        this.pitPhase = 'entry';
        this.pendingTire = tire;
        this.pitRequested = false;
        this.pitNode = 0; this.pitRouteProgress = 0;
        this.pitSpeed = Math.abs(this.velocity) * MS;
        this.pitServiced = false;
        if (this.isPlayer) showRaceControl('Пит-лейн: автоматический проезд, лимит '+TRACKS_DB[selectedTrackIndex].pitSpeedLimit+' км/ч', '#38bdf8');
    }

    updatePit(dt) {
        const box = this.getTeamPitBox();
        if (this.pitPhase === 'service') {
            this.pitTimer -= dt;
            if (this.pitTimer <= 0) {
                this.compound = this.pendingTire;
                this.tireHealth = 100; this.tireTemp = 80;
                this.wingDamage = this.suspensionDamage = this.bodyDamage = this.engineDamage = 0;
                this.suspensionPull = this.impactSpin = 0;
                this.pitStopsDone++;
                const next = this.strategy?.stops[this.pitStopsDone];
                this.nextCompound = next ? next.tire : this.compound;
                this.pitServiced = true;
                this.pitPhase = 'exit';
            }
            this.velocity = this.dx = this.dy = 0;
            this.updateLapAndSectors();
            return;
        }
        const target = pitWaypoints[Math.min(this.pitNode + 1, pitWaypoints.length - 1)];
        const dx = target.x - this.x, dy = target.y - this.y;
        const distance = Math.hypot(dx, dy);
        const occupied = allCars.some(c => c !== this && c.specIndex === this.specIndex && c.pitPhase === 'service');
        const toBox = Math.hypot(box.x - this.x, box.y - this.y);
        const queuedAtBox=occupied&&!this.pitServiced&&this.pitNode>=box.node-2;
        if(queuedAtBox&&toBox<30&&this.pitSpeed<0.6) {
            this.pitSpeed=0;this.velocity=this.dx=this.dy=0;this.braking=true;
            this.updateLapAndSectors();
            return;
        }
        let limit = TRACKS_DB[selectedTrackIndex].pitSpeedLimit / 3.6;
        if (!this.pitServiced && this.pitNode >= box.node - 2) limit = Math.min(limit, Math.sqrt(2 * 3.8 * Math.max(0, (toBox - 3) * PX_M)));
        if (occupied && !this.pitServiced && this.pitNode >= box.node - 2) limit = 0;
        const merging = this.pitNode >= pitWaypoints.length - 3;
        if (merging && allCars.some(c => c !== this && c.pitPhase === 'none' && Math.hypot(c.x - target.x, c.y - target.y) < 130)) limit = 0;
        const speedError=limit-this.pitSpeed;
        const speedChange=Math.min(Math.abs(speedError),(speedError<0?4.2:2.4)*dt);
        this.pitSpeed=Math.max(0,this.pitSpeed+Math.sign(speedError)*speedChange);
        const move = Math.min(distance, this.pitSpeed * dt / PX_M);
        if (distance > 0) {
            this.dx = dx / distance * move; this.dy = dy / distance * move;
            this.x += this.dx; this.y += this.dy;
            this.pitRouteProgress=Math.max(0,Math.min(1,(pitCumDist[this.pitNode+1]-distance+move)/pitRouteLength));
            this.angle = Math.atan2(dx, -dy);
        }
        this.velocity = this.pitSpeed / MS;
        this.gear = this.pitSpeed > 1 ? 2 : 0;
        this.braking = this.pitSpeed < 1;
        if (!occupied && !this.pitServiced && this.pitNode >= box.node - 1 && toBox < 8) {
            this.x = box.x; this.y = box.y;
            this.pitPhase = 'service';
            const tireChangeSeconds = this.spec.carClass === 'F1' ? 2.6 : 4.5;
            const repairSeconds = Math.min(20,
                4 * this.frontWingDamage + 4 * this.rearWingDamage +
                8 * this.suspensionDamage + 4 * this.bodyDamage +
                20 * this.engineDamage);
            this.pitTimer = tireChangeSeconds + repairSeconds;
            this.velocity = this.dx = this.dy = 0;
            if (this.isPlayer) showRaceControl(`Обслуживание: ${this.pitTimer.toFixed(1)} с · шины и ремонт`, '#38bdf8');
        } else if (!queuedAtBox && distance <= move + 2) {
            this.pitNode++;
            if (this.pitNode >= pitWaypoints.length - 1) {
                this.pitPhase = 'none';
                const exitIndex=Math.round(TRACKS_DB[selectedTrackIndex].pitExitNorm*totalSamples)%totalSamples;
                const before=trackSamples[(exitIndex-4+totalSamples)%totalSamples],after=trackSamples[(exitIndex+4)%totalSamples];
                this.angle=Math.atan2(after.x-before.x,-(after.y-before.y));
                this.dx=Math.sin(this.angle)*this.velocity;
                this.dy=-Math.cos(this.angle)*this.velocity;
                this.lastSampleIdx=exitIndex;
                if (this.isPlayer) showRaceControl('Пит-лейн пройден. Управление возвращено', '#00e676');
            }
        }
        this.updateLapAndSectors();
    }

    // ------------------------------------------------------------------
    // Главный шаг физики
    // ------------------------------------------------------------------
    update(dt, input) {
        const frontPt = this.getFrontPoint();
        const frontInfo = getTrackInfo(frontPt.x, frontPt.y, this.lastSampleIdx);
        if(this.pitPhase!=='none') {
            const track=TRACKS_DB[selectedTrackIndex];
            frontInfo.normProgress=(track.pitEntryNorm+track.pitProgressSpan*this.pitRouteProgress)%1;
            frontInfo.index=Math.floor(frontInfo.normProgress*totalSamples);
        }
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

        this.drsActive = this.spec.carClass === 'F1' && raceState === 'RACING' && (this.lap >= 2 || currentSession==='TIME_TRIAL') &&
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

        let pitApproachTargetMs = null, pitApproachRemainingM = 0;
        if (currentSession === 'RACE' && this.pitPhase === 'none' && !this.finishedRace) {
            const scheduled = this.strategy?.stops[this.pitStopsDone];
            const due = scheduled && this.lap >= scheduled.lap;
            const needsTires = !this.isPlayer && this.tireHealth < 28;
            const needsRepair = !this.isPlayer && this.damageLevel > 0.60;
            const wantsPit = (this.pitRequested || due || needsTires || needsRepair) &&
                this.lap < (raceMode === 'LAPS' ? totalRaceLaps : Infinity);
            const toEntryPx = ((TRACKS_DB[selectedTrackIndex].pitEntryNorm-frontInfo.normProgress+1)%1)*trackLengthPx;
            pitApproachRemainingM = Math.max(0,toEntryPx-PIT_ENTRY_MARKER_DISTANCE_PX)*PX_M;
            if (wantsPit && toEntryPx >= PIT_ENTRY_MARKER_DISTANCE_PX &&
                toEntryPx-PIT_ENTRY_MARKER_DISTANCE_PX <= PIT_APPROACH_DISTANCE_PX) {
                const pitLimitMs=TRACKS_DB[selectedTrackIndex].pitSpeedLimit/3.6;
                pitApproachTargetMs=Math.sqrt(pitLimitMs*pitLimitMs+2*4.5*pitApproachRemainingM);
            }
            if (wantsPit && isPitEntryProgress(frontInfo.normProgress,this.prevNorm)) {
                this.startPit(this.isPlayer || this.pitRequested ? this.nextCompound : (scheduled?.tire || 'medium'));
            }
        }
        if (this.pitPhase !== 'none') { this.updatePit(dt); return; }

        // ---------- выбор источника управления ----------
        let ctl;
        if (this.isHumanControlled()) ctl = this.humanControls(dt, input);
        else ctl = this.aiControls(dt, this.finishedRace ? 0.55 : 1.0);

        // Brake toward the pit limiter over the approach zone. This keeps
        // regular vehicle inertia and avoids an abrupt speed clamp at entry.
        if (pitApproachTargetMs !== null) {
            if (vms > pitApproachTargetMs + 0.35) {
                const requiredDecel=(vms*vms-pitApproachTargetMs*pitApproachTargetMs)/
                    (2*Math.max(1,pitApproachRemainingM));
                ctl.thr=0;
                ctl.brake=Math.max(ctl.brake,Math.min(0.85,Math.max(0.08,requiredDecel/8)));
            } else if (vms >= pitApproachTargetMs - 0.35) {
                ctl.thr=0;
            }
        }

        const handbrake = Math.max(0, Math.min(1, ctl.handbrake || 0));
        this.dbgDist = frontInfo.dist;
        this.latOff = (frontPt.x - frontInfo.center.x) * (frontInfo.center.nx || 0) + (frontPt.y - frontInfo.center.y) * (frontInfo.center.ny || 0);
        this.updateGearbox(dt, ctl.thr, ctl.brake, ctl.manual);
        this.braking = ctl.brake > 0.05 || handbrake > 0.05 || this.pitPhase === 'service';

        // ---------- сцепление: механика + прижимная сила ----------
        const q = Math.min(1.4, (vms * vms) / (this.vmaxMs * this.vmaxMs));
        const wingLoss = this.aeroCondition;
        const surf = (offTrack ? 0.55 : 1.0) * (1 - 0.25 * this.suspensionDamage);
        const hc = HC();
        const gripG = (this.perf.grip * comp.gripMult * tireGrip * (1 - 0.28 * handbrake) + this.perf.aero * q * wingLoss * 1.45 * this.character.aeroResponse) * surf * hc.hb;
        const gripMax = Math.max(0.3, gripG) * G;                    // м/с²

        // ---------- продольная динамика ----------
        const lat = Math.min(1, this.latUse);
        const circle = Math.sqrt(Math.max(0.04, 1 - lat * lat));
        let aEng = 0, aBrk = 0, aEB = 0;
        const redline = this.rpm >= 1.0;
        if (!ctl.hold && ctl.thr > 0.01 && this.gear >= 1 && this.shiftCut <= 0 && vmsSigned >= -0.3 && !redline) {
            const P = this.powerWkg * this.engineCondition * powerCurve(this.rpm) * ctl.thr;     // Вт/кг
            aEng = Math.min(P / Math.max(vms, 5), 0.60 * gripMax * circle * this.character.traction);
        }
        if (this.gear >= 1 && ctl.thr < 0.05 && vms > 2) aEB = (1.2 + 3.6 * Math.min(1.1, this.rpm)) * (this.spec.carClass === 'F1' ? 0.9 : 1.0);
        if (redline && vms > 2) aEB = Math.max(aEB, 5);
        if (ctl.brake > 0.01 && vmsSigned > 0.3) {
            const bMax = (this.brake0 + this.brakeAero * q) * tireGrip * comp.gripMult * surf * G * Math.sqrt(hc.hb);
            aBrk = ctl.brake * Math.min(bMax, gripMax * 1.15) * circle;
        }
        // Rear-axle lock gives the car a short, controlled rotation under steering.
        if (handbrake > 0.01 && vmsSigned > 0.3) aBrk += handbrake * (2.2 + 1.8 * q) * circle;
        const dragMul = this.drsActive ? 0.80 : 1.0;
        let aDrag = this.dragK * dragMul * (1 + 0.12 * this.bodyDamage) * vms * vms + 0.12;
        if(Math.abs(this.impactSpin)>.1)aDrag+=Math.min(gripMax*.6,Math.abs(this.dx*Math.cos(this.angle)+this.dy*Math.sin(this.angle))*MS*.8);
        if (vms < 0.05) aDrag = 0;

        let newV;
        const wantReverse = (this.isPlayer || ctl.reverse) && !ctl.hold && this.pitPhase === 'none' && ctl.brake > 0.05 && ctl.thr < 0.05 && vms < 1.2;
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
        const steering=ctl.steer*this.character.rotation*(1-.18*this.frontWingDamage)*(1+.12*this.rearWingDamage*ctl.brake)*(1+ctl.brake*(1-this.character.brakeStability)*0.7)*(1+handbrake*0.25) + this.suspensionPull*this.suspensionDamage;
        const handbrakeYaw = ctl.steer * handbrake * Math.min(1, av / 8) * 0.28;
        const yawTarget = (Math.max(-1,Math.min(1,steering)) * omegaMax + handbrakeYaw) * (newV >= 0 ? 1 : -1);
        this.dbgSteer = ctl.steer; this.dbgOmega = omegaMax; this.dbgGripMax = gripMax; this.dbgBrake = Math.max(ctl.brake,handbrake);
        // кузов набирает скорость вращения с инерцией (≈0,08–0,1 с) — машина «живая», а не на рельсах
        this.yawRate += (yawTarget - this.yawRate) * Math.min(1, dt * (this.isPlayer ? hc.yawK : Math.max(14, hc.yawK)) * this.character.rotation * (1-.3*this.suspensionDamage));
        if (av < 0.3) this.yawRate *= 0.8;
        this.angle += (this.yawRate + this.impactSpin) * dt;
        this.impactSpin *= Math.exp(-dt*(1.5-.5*this.rearWingDamage));
        this.bodyRoll += (-(this.yawRate * av / G) * 0.9 - this.bodyRoll) * Math.min(1, dt * 8);
        this.aLat = av * Math.abs(this.yawRate + this.impactSpin);
        this.latUse = Math.min(1.2, this.aLat / gripMax);
        this.bodyPitch += (-(this.aLong / (G * 3)) - this.bodyPitch) * Math.min(1, dt * 10);

        // ---------- скольжение: вектор скорости догоняет направление кузова ----------
        const slipK = 1 - Math.exp(-dt * (18 + 9 * q) * tireGrip * (1 - 0.42 * handbrake) * surf * (this.spec.carClass === 'F1' ? 1.35 : 1) / (1+Math.abs(this.impactSpin)*.3));
        const targetDx = Math.sin(this.angle) * this.velocity;
        const targetDy = -Math.cos(this.angle) * this.velocity;
        this.slip = Math.hypot(targetDx - this.dx, targetDy - this.dy);
        this.dx += (targetDx - this.dx) * slipK;
        this.dy += (targetDy - this.dy) * slipK;
        this.x += this.dx; this.y += this.dy;

        // ---------- износ и нагрев шин ----------
        const speed = Math.hypot(this.dx, this.dy);
        if (speed > 0.5 && !this.finishedRace) {
            const style = 0.75 + 0.25 * Math.min(1, this.latUse) + 0.12 * Math.min(1, aBrk / (gripMax || 1)) +
                          0.10 * Math.min(1, this.slip / 3) + (this.tireTemp > 112 ? 0.30 : 0);
            const wearPct = (speed / trackLengthPx) * comp.wearPerLap * style / this.tireSave * (this.wearScale ?? 1);
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

        this.resolveWallContact(dt);

        this.updateLapAndSectors();
    }

    resolveWallContact(dt) {
        const info = getTrackInfo(this.x, this.y, this.lastSampleIdx);
        if (info.dist < 0.001) return;
        const nx = (this.x - info.center.x) / info.dist;
        const ny = (this.y - info.center.y) / info.dist;
        const fx = Math.sin(this.angle), fy = -Math.cos(this.angle);
        const front = fx * nx + fy * ny;
        const side = Math.cos(this.angle) * nx + Math.sin(this.angle) * ny;
        const extent = Math.abs(front) * this.height * 0.49 + Math.abs(side) * this.width * 0.48;
        const limit = WALL_HALF_W - extent;
        if (info.dist <= limit) return;
        if(this.isPlayer && currentSession==='TIME_TRIAL') invalidateTrialLap('Контакт с ограждением');
        this.x -= nx * (info.dist - limit);
        this.y -= ny * (info.dist - limit);
        const impact = Math.max(0, this.dx * nx + this.dy * ny);
        if (impact > 0) {
            // Keep longitudinal speed consistent with the surviving velocity vector.
            // Otherwise the engine restores the pre-impact speed on the next frame.
            const friction = Math.max(0, 1 - 5 * dt - 0.55 * Math.abs(front));
            this.dx = (this.dx - nx * impact) * friction;
            this.dy = (this.dy - ny * impact) * friction;
            this.velocity = this.dx * fx + this.dy * fy;
            this.yawRate *= friction;
            if (Math.abs(this.velocity) < 0.02) this.velocity = this.dx = this.dy = 0;
        }
        if (impact * MS > 3 && this.hitCooldown === 0) {
            this.hitCooldown = 30;
            this.applyImpact(impact * MS, Math.abs(front), front);
            this.suspensionPull=Math.sign(side)*.07;
            spawnSparks(this.x, this.y, 8);
            if (this.isPlayer) {
                showRaceControl('Удар об ограждение. '+bindingLabel('brake')+' — отъехать назад', '#ff8b7a');
                if (typeof sfxImpact === 'function') sfxImpact(Math.min(1, impact / 8));
            }
        }
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
            if ((currentSession === 'QUALI' || currentSession === 'TIME_TRIAL') && !this.timingStarted) {
                this.timingStarted = true;
                this.lapStartTime = simTimeMs;
                this.sectorsPassed = [false, false, false];
                if(currentSession==='TIME_TRIAL'&&this.isPlayer)beginTrialLap(this);
            }
            return;
        }

        const now = simTimeMs;
        const rawLap = now - this.lapStartTime;
        this.lastLapTime = rawLap;
        const valid=currentSession==='TIME_TRIAL'&&this.isPlayer?finishTrialLap(this,rawLap):true;
        if(valid){if (this.bestLapTime === null || rawLap < this.bestLapTime) this.bestLapTime = rawLap;
        registerLapForGlobalBest(this, rawLap);}

        const finishedLap = this.lap;
        this.lap++;
        this.lapStartTime = now;
        this.sectorsPassed = [false, false, false];

        if (currentSession === 'QUALI') {
            this.frontWingDamage = this.rearWingDamage = 0;
            this.suspensionDamage = this.bodyDamage = this.engineDamage = 0;
            this.suspensionPull = this.impactSpin = 0;
            this.hitCooldown = 0;
            if (qualifyingTimeExpired) qualifyingFinishers.add(this);
        }

        if (currentSession === 'RACE') {
            const timeUp = (raceMode === 'TIMED') && (now - raceStartTimestamp >= raceDurationMs);
            if ((raceMode === 'LAPS' && this.lap > totalRaceLaps) || timeUp) {
                this.finishedRace = true;
                this.finishTotalTimeMs = now - raceStartTimestamp;
                if (this.isPlayer) { finalizeAllCarsForPostRaceReview(now); finishRaceModal(); }
                return;
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
        ctx.rotate(this.angle);
        if (this.pitPhase === 'service') ctx.globalAlpha = 0.85;
        drawCarSpriteTop(ctx, this);
        ctx.restore();
    }
}

// Oriented rectangles: side-by-side cars do not collide as oversized circles.
function resolveContourCarCollision(a, b) {
    if (a.pitPhase !== 'none' || b.pitPhase !== 'none') return;
    if (Math.hypot(a.x - b.x, a.y - b.y) > a.height + b.height) return;
    const pa = a.getContourPoints(), pb = b.getContourPoints();
    let depth = Infinity, normal;
    for (const car of [a, b]) for (const axis of [{x: Math.cos(car.angle), y: Math.sin(car.angle)}, {x: Math.sin(car.angle), y: -Math.cos(car.angle)}]) {
        const ap = pa.map(p => p.x * axis.x + p.y * axis.y);
        const bp = pb.map(p => p.x * axis.x + p.y * axis.y);
        const overlap = Math.min(Math.max(...ap), Math.max(...bp)) - Math.max(Math.min(...ap), Math.min(...bp));
        if (overlap <= 0) return;
        if (overlap < depth) { depth = overlap; normal = axis; }
    }
    if ((b.x - a.x) * normal.x + (b.y - a.y) * normal.y < 0) { normal.x *= -1; normal.y *= -1; }
    a.x -= normal.x * depth / 2; a.y -= normal.y * depth / 2;
    b.x += normal.x * depth / 2; b.y += normal.y * depth / 2;
    const closing = (a.dx - b.dx) * normal.x + (a.dy - b.dy) * normal.y;
    if(closing <= 0) return;
    const support=(points,sign)=>{
        const dots=points.map(p=>(p.x*normal.x+p.y*normal.y)*sign),best=Math.max(...dots);
        const edge=points.filter((_,i)=>best-dots[i]<.01);
        return {x:edge.reduce((n,p)=>n+p.x,0)/edge.length,y:edge.reduce((n,p)=>n+p.y,0)/edge.length};
    };
    const ca=support(pa,1),cb=support(pb,-1),contact={x:(ca.x+cb.x)/2,y:(ca.y+cb.y)/2};
    const invA=1/a.mass,invB=1/b.mass;
    // Race cars should lose speed through contact, not bounce apart like balls.
    // A small restitution preserves a little rebound while dissipating most of the
    // closing speed through the chassis and tires.
    const impulse=0.12*closing/(invA+invB);
    const tangent={x:-normal.y,y:normal.x};
    const slide=(a.dx-b.dx)*tangent.x+(a.dy-b.dy)*tangent.y;
    const friction=Math.max(-impulse*.16,Math.min(impulse*.16,slide/(invA+invB)));
    for(const [c,sign,inv] of [[a,-1,invA],[b,1,invB]]) {
        const ix=sign*(normal.x*impulse+tangent.x*friction),iy=sign*(normal.y*impulse+tangent.y*friction);
        c.dx+=ix*inv;c.dy+=iy*inv;
        c.velocity=c.dx*Math.sin(c.angle)-c.dy*Math.cos(c.angle);
        const rx=contact.x-c.x,ry=contact.y-c.y;
        const inertia=c.mass*(c.width*c.width+c.height*c.height)/12;
        const localLong=rx*Math.sin(c.angle)-ry*Math.cos(c.angle);
        const front=(sign*-normal.x)*Math.sin(c.angle)-(sign*-normal.y)*Math.cos(c.angle);
        const wheelHit=c.spec.carClass==='F1' && Math.abs(front)<.6 && Math.abs(localLong)>c.height*.15 && closing*MS>3;
        const spin=(rx*iy-ry*ix)*60/inertia;
        c.impactSpin=Math.max(-4.8,Math.min(4.8,c.impactSpin+spin*(wheelHit?0.55:0.35)));
        if(c.hitCooldown===0) {
            c.applyImpact(closing*MS,Math.abs(front),front,wheelHit);
            c.suspensionPull=Math.sign(rx*Math.cos(c.angle)+ry*Math.sin(c.angle))*.07;
            c.hitCooldown=12;
        }
    }
    if(closing*MS>3)spawnSparks(contact.x,contact.y,6);
    if ((a.isPlayer || b.isPlayer) && typeof sfxImpact === 'function') sfxImpact(Math.min(1,closing/8));

}
