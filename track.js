let selectedTrackIndex = 0;
let controlPoints = [];
let trackSamples = [];
let totalSamples = 0;
let sfDirX = 0, sfDirY = -1, sfNormX = 1, sfNormY = 0, START_ANGLE = 0;

let pitWaypoints = [];
let pitLaneStartPt = {x: 0, y: 0}, pitLaneEndPt = {x: 0, y: 0};
let pitWallStartPt = {x: 0, y: 0}, pitWallEndPt = {x: 0, y: 0};
let teamPitBoxes = [];
let drsMarkerLines = [];
let envDecorations = [];
let dynamicRacingLinePoints = [];

let minX = 0, maxX = 1, minY = 0, maxY = 1;
let trackLengthPx = 1;
let sampleCumDist = [];

const ASPHALT_HALF_W   = 72;
const CURB_OUTER_W     = 84;
const WALL_HALF_W      = 122;
const PIT_WALL_INNER_W = 345;
const PIT_CORRIDOR_OFFSET = 202;

function getSplinePoint(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return {
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
}

function buildActiveTrackGeometry() {
    const trk = TRACKS_DB[selectedTrackIndex];
    const ref = trk.rawPoints[0];
    controlPoints = trk.rawPoints.map(p => ({
        x: (p.x - ref.x) * trk.scale,
        y: (p.y - ref.y) * trk.scale
    }));

    trackSamples = [];
    const samplesPerSegment = 26;
    for (let i = 0; i < controlPoints.length; i++) {
        const p0 = controlPoints[(i - 1 + controlPoints.length) % controlPoints.length];
        const p1 = controlPoints[i];
        const p2 = controlPoints[(i + 1) % controlPoints.length];
        const p3 = controlPoints[(i + 2) % controlPoints.length];
        for (let s = 0; s < samplesPerSegment; s++) {
            const pt = getSplinePoint(p0, p1, p2, p3, s / samplesPerSegment);
            trackSamples.push({ x: pt.x, y: pt.y, z: 0, slopeDeg: 0, nx: 0, ny: 0, curv: 0 });
        }
    }
    totalSamples = trackSamples.length;

    for (let i = 0; i < totalSamples; i++) {
        const norm = i / totalSamples;
        trackSamples[i].z = trk.evalElevation ? trk.evalElevation(norm) : 0;
    }

    for (let i = 0; i < totalSamples; i++) {
        const prev = trackSamples[(i - 1 + totalSamples) % totalSamples];
        const cur  = trackSamples[i];
        const next = trackSamples[(i + 1) % totalSamples];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        cur.nx = -dy / len;
        cur.ny =  dx / len;

        const dz = next.z - prev.z;
        cur.slopeDeg = Math.max(-18, Math.min(18, (dz / (len * 0.14)) * 12));

        const pPrev = trackSamples[(i - 6 + totalSamples) % totalSamples];
        const pNext = trackSamples[(i + 6) % totalSamples];
        const a1 = Math.atan2(cur.y - pPrev.y, cur.x - pPrev.x);
        const a2 = Math.atan2(pNext.y - cur.y, pNext.x - cur.x);
        let dAng = a2 - a1;
        while (dAng > Math.PI) dAng -= Math.PI * 2;
        while (dAng < -Math.PI) dAng += Math.PI * 2;
        cur.curv = dAng;
    }

    dynamicRacingLinePoints = [];
    for (let i = 0; i < totalSamples; i++) {
        const cur = trackSamples[i];
        let maxFutCurv = 0;
        for (let f = 0; f < 14; f++) {
            maxFutCurv = Math.max(maxFutCurv, Math.abs(trackSamples[(i + f) % totalSamples].curv));
        }
        cur.futCurv = maxFutCurv;
        let color = '#22c55e';
        if (maxFutCurv > 0.14) color = '#ef4444';
        else if (maxFutCurv > 0.07) color = '#facc15';

        const apexOffset = (Math.abs(cur.curv) > 0.08) ? (cur.curv >= 0 ? 15 : -15) : 0;
        dynamicRacingLinePoints.push({
            x: cur.x + cur.nx * apexOffset,
            y: cur.y + cur.ny * apexOffset,
            z: cur.z,
            color
        });
    }

    trackLengthPx = 0; sampleCumDist = [];
    for (let i = 0; i < totalSamples; i++) {
        const a = trackSamples[i], b = trackSamples[(i + 1) % totalSamples];
        sampleCumDist.push(trackLengthPx);
        trackLengthPx += Math.hypot(b.x - a.x, b.y - a.y);
    }

    // Кривизна (1/px) для планирования скорости ИИ: угол поворота на дуге ≈ половине хорды 12 сэмплов
    const rawK = new Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
        const a = (i - 6 + totalSamples) % totalSamples, b = (i + 6) % totalSamples;
        let L = sampleCumDist[b] - sampleCumDist[a];
        if (L < 0) L += trackLengthPx;
        const k6 = Math.abs(trackSamples[i].curv) / Math.max(1, L / 2);
        // короткая база (±3 сэмпла): ловит шиканы и S-образные повороты, которые усредняются на длинной базе
        const p1 = trackSamples[(i - 3 + totalSamples) % totalSamples], p2 = trackSamples[i], p3 = trackSamples[(i + 3) % totalSamples];
        let d = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p2.y - p1.y, p2.x - p1.x);
        while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        let L3 = sampleCumDist[(i + 3) % totalSamples] - sampleCumDist[(i - 3 + totalSamples) % totalSamples]; if (L3 < 0) L3 += trackLengthPx;
        const k3 = Math.abs(d) / Math.max(1, L3 / 2);
        rawK[i] = Math.max(k6, k3);
    }
    for (let i = 0; i < totalSamples; i++) {
        let sum = 0;
        for (let d = -2; d <= 2; d++) sum += rawK[(i + d + totalSamples) % totalSamples];
        trackSamples[i].kappa = sum / 5;
    }

    const prevPt = trackSamples[(totalSamples - 8) % totalSamples];
    const nextPt = trackSamples[8];
    const vx = nextPt.x - prevPt.x; const vy = nextPt.y - prevPt.y;
    const vLen = Math.hypot(vx, vy) || 1;
    sfDirX = vx / vLen; sfDirY = vy / vLen;
    sfNormX = (-sfDirY) * trk.pitSideSign; sfNormY = ( sfDirX) * trk.pitSideSign;
    START_ANGLE = Math.atan2(sfDirX, -sfDirY);

    const entryEdgePt = { x: controlPoints[0].x - sfDirX * 1120 + sfNormX * (ASPHALT_HALF_W - 14), y: controlPoints[0].y - sfDirY * 1120 + sfNormY * (ASPHALT_HALF_W - 14) };
    const pitEntryRampPt = { x: controlPoints[0].x - sfDirX * 820 + sfNormX * (PIT_CORRIDOR_OFFSET * 0.62), y: controlPoints[0].y - sfDirY * 820 + sfNormY * (PIT_CORRIDOR_OFFSET * 0.62) };
    pitLaneStartPt = { x: controlPoints[0].x - sfDirX * 560 + sfNormX * PIT_CORRIDOR_OFFSET, y: controlPoints[0].y - sfDirY * 560 + sfNormY * PIT_CORRIDOR_OFFSET };
    pitLaneEndPt = { x: controlPoints[0].x + sfDirX * 580 + sfNormX * PIT_CORRIDOR_OFFSET, y: controlPoints[0].y + sfDirY * 580 + sfNormY * PIT_CORRIDOR_OFFSET };
    const pitExitRampPt = { x: controlPoints[0].x + sfDirX * 840 + sfNormX * (PIT_CORRIDOR_OFFSET * 0.62), y: controlPoints[0].y + sfDirY * 840 + sfNormY * (PIT_CORRIDOR_OFFSET * 0.62) };
    const exitEdgePt = { x: controlPoints[0].x + sfDirX * 1120 + sfNormX * (ASPHALT_HALF_W - 14), y: controlPoints[0].y + sfDirY * 1120 + sfNormY * (ASPHALT_HALF_W - 14) };

    pitWaypoints = [entryEdgePt, pitEntryRampPt, pitLaneStartPt, pitLaneEndPt, pitExitRampPt, exitEdgePt];
    pitWallStartPt = { x: controlPoints[0].x - sfDirX * 600 + sfNormX * 138, y: controlPoints[0].y - sfDirY * 600 + sfNormY * 138 };
    pitWallEndPt = { x: controlPoints[0].x + sfDirX * 620 + sfNormX * 138, y: controlPoints[0].y + sfDirY * 620 + sfNormY * 138 };

    buildTeamPitBoxes();

    drsMarkerLines = [];
    const makeLineAtNorm = (normPos, typeLabel, colorHex) => {
        const idx = Math.floor(((normPos % 1 + 1) % 1) * totalSamples);
        const pA = trackSamples[idx]; const pB = trackSamples[(idx + 2) % totalSamples];
        const dx = pB.x - pA.x, dy = pB.y - pA.y; const len = Math.hypot(dx, dy) || 1;
        return { x: pA.x, y: pA.y, z: pA.z, nx: -dy / len, ny: dx / len, angle: Math.atan2(dx, -dy), label: typeLabel, color: colorHex };
    };
    for (const z of trk.drsZones) {
        drsMarkerLines.push(makeLineAtNorm(z.detect, 'DRS DETECT', '#facc15'));
        drsMarkerLines.push(makeLineAtNorm(z.start,  'DRS ZONE',   '#00e676'));
        drsMarkerLines.push(makeLineAtNorm(z.end,    'DRS END',    '#ff4757'));
    }

    minX = Infinity; maxX = -Infinity; minY = Infinity; maxY = -Infinity;
    for (const p of trackSamples) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }

    generateTrackEnvironment();
}

function buildTeamPitBoxes() {
    const catalog = (typeof getActiveCatalog === 'function') ? getActiveCatalog() : F1_CATALOG;
    teamPitBoxes = [];
    for (let i = 0; i < catalog.length; i++) {
        const spec = catalog[i];
        const along = -450 + i * 82;
        teamPitBoxes.push({
            teamIndex: i, shortName: spec.shortName, color: spec.livery.primary,
            x: controlPoints[0].x + sfDirX * along + sfNormX * (PIT_CORRIDOR_OFFSET + 24),
            y: controlPoints[0].y + sfDirY * along + sfNormY * (PIT_CORRIDOR_OFFSET + 24),
            garageX: controlPoints[0].x + sfDirX * along + sfNormX * (PIT_CORRIDOR_OFFSET + 92),
            garageY: controlPoints[0].y + sfDirY * along + sfNormY * (PIT_CORRIDOR_OFFSET + 92)
        });
    }
}

function generateTrackEnvironment() {
    envDecorations = [];
    let seed = 1234567 + selectedTrackIndex * 7919;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const N = totalSamples;
    const SPONSORS = [['#dc2626', '#fff'], ['#2563eb', '#fde047'], ['#16a34a', '#fff'], ['#f59e0b', '#111827'], ['#7c3aed', '#fff'], ['#e11d48', '#fde68a'], ['#0ea5e9', '#0b1220']];
    const place = (type, idx, side, off, extra) => {
        const s = trackSamples[idx];
        const x = s.x + s.nx * off * side, y = s.y + s.ny * off * side;
        // не ставим объект, если рядом другая часть трассы
        const info = getTrackInfo(x, y, -1);
        if (info.dist < Math.abs(off) * 0.85) return;
        envDecorations.push(Object.assign({ type, idx, side, off, x, y, z: s.z, tx: s.ny, ty: -s.nx }, extra));
    };
    for (let i = 0; i < N; i++) {
        for (const side of [-1, 1]) {
            if (rnd() < 0.55) place('tree', i, side, 175 + rnd() * 330, { h: 34 + rnd() * 34, shade: Math.floor(rnd() * 3) });
            if (rnd() < 0.30) place('tree', i, side, 150 + rnd() * 160, { h: 26 + rnd() * 24, shade: Math.floor(rnd() * 3) });
        }
        if (i % 7 === 0) { const sp = SPONSORS[Math.floor(rnd() * SPONSORS.length)]; place('board', i, (i / 7) % 2 ? 1 : -1, 134, { c1: sp[0], c2: sp[1] }); }
        if (i % 5 === 2) place('lamp', i, (i / 5 | 0) % 2 ? 1 : -1, 136, {});
        if (i % 46 === 11) place('stand', i, rnd() < 0.5 ? 1 : -1, 170 + rnd() * 30, { hue: Math.floor(rnd() * 360) });
    }
}

function isSampleInDrsZone(sampleIdx) {
    if (sampleIdx < 0 || totalSamples === 0) return false;
    const norm = sampleIdx / totalSamples;
    for (const z of TRACKS_DB[selectedTrackIndex].drsZones) {
        if (z.start <= z.end ? (norm >= z.start && norm <= z.end) : (norm >= z.start || norm <= z.end)) return true;
    }
    return false;
}

function getPitLaneDist(px, py) {
    let minDist = Infinity;
    for (let i = 0; i < pitWaypoints.length - 1; i++) {
        const a = pitWaypoints[i], b = pitWaypoints[i + 1];
        const abx = b.x - a.x, aby = b.y - a.y;
        let t = Math.max(0, Math.min(1, ((px - a.x) * abx + (py - a.y) * aby) / (abx * abx + aby * aby)));
        minDist = Math.min(minDist, Math.hypot(px - (a.x + abx * t), py - (a.y + aby * t)));
    }
    return minDist;
}

function isPitStraightSample(idx) { return (idx >= totalSamples - 68 || idx <= 65); }

function getTrackInfo(px, py, hintIdx = -1) {
    let minDistSq = Infinity;
    let closestPt = {x: 0, y: 0, z: 0, slopeDeg: 0};
    let closestIdx = 0; let bestT = 0;
    const N = trackSamples.length;
    const searchAll = (hintIdx < 0);
    const range = searchAll ? N : 68;
    const startI = searchAll ? 0 : (hintIdx - 34 + N) % N;

    for (let step = 0; step < range; step++) {
        const i = (startI + step) % N;
        const a = trackSamples[i], b = trackSamples[(i + 1) % N];
        const abx = b.x - a.x, aby = b.y - a.y;
        const abLenSq = abx * abx + aby * aby;
        let t = abLenSq > 0 ? ((px - a.x) * abx + (py - a.y) * aby) / abLenSq : 0;
        t = Math.max(0, Math.min(1, t));
        const cx = a.x + abx * t, cy = a.y + aby * t;
        const dSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);
        if (dSq < minDistSq) {
            minDistSq = dSq;
            closestPt = { x: cx, y: cy, z: a.z + (b.z - a.z) * t, slopeDeg: a.slopeDeg + (b.slopeDeg - a.slopeDeg) * t, nx: a.nx, ny: a.ny };
            closestIdx = i; bestT = t;
        }
    }
    if (!searchAll && minDistSq > 520 * 520) return getTrackInfo(px, py, -1);
    return { dist: Math.sqrt(minDistSq), center: closestPt, index: closestIdx, normProgress: (closestIdx + bestT) / N };
}

function drawBackgroundWorld(ctx, camCenterX, camCenterY) {
    const trk = TRACKS_DB[selectedTrackIndex];
    const theme = trk.theme || { grassBase: '#163520', grassAlt: '#122b1a' };
    const stripeW = 180;
    const startX = Math.floor((camCenterX - 2400) / stripeW) * stripeW;
    const startY = Math.floor((camCenterY - 2400) / stripeW) * stripeW;
    for (let gx = startX; gx < camCenterX + 2400; gx += stripeW) {
        ctx.fillStyle = Math.abs(Math.floor(gx / stripeW)) % 2 === 0 ? theme.grassBase : theme.grassAlt;
        ctx.fillRect(gx, startY, stripeW, 4800);
    }
}

function traceVisibleTrack(ctx, centerIdx, offsetX = 0, offsetY = 0, elevLiftScale = 0, upX = 0, upY = 0) {
    const N = trackSamples.length;
    const span = cameraViewMode === 'CHASE' ? 88 : 65;
    ctx.beginPath();
    const firstIdx = (centerIdx - span + N) % N;
    const refZ = trackSamples[centerIdx].z;
    const firstLift = (trackSamples[firstIdx].z - refZ) * elevLiftScale;
    ctx.moveTo(trackSamples[firstIdx].x + offsetX + upX * firstLift, trackSamples[firstIdx].y + offsetY + upY * firstLift);
    for (let s = -span + 1; s <= span; s++) {
        const idx = (centerIdx + s + N) % N;
        const lift = (trackSamples[idx].z - refZ) * elevLiftScale;
        ctx.lineTo(trackSamples[idx].x + offsetX + upX * lift, trackSamples[idx].y + offsetY + upY * lift);
    }
    return firstIdx;
}

function drawTrack(ctx) {
    const centerIdx = playerCar && playerCar.lastSampleIdx >= 0 ? playerCar.lastSampleIdx : 0;
    drawBackgroundWorld(ctx, playerCar ? playerCar.x : 0, playerCar ? playerCar.y : 0);

    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const upX = cameraViewMode === 'CHASE' ? Math.sin(smoothCamAngle) : 0;
    const upY = cameraViewMode === 'CHASE' ? -Math.cos(smoothCamAngle) : 0;
    const elevScale = cameraViewMode === 'CHASE' ? 1.55 : 0.25;

    traceVisibleTrack(ctx, centerIdx, 0, 0, elevScale, upX, upY);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = (WALL_HALF_W + 16) * 2; ctx.stroke();

    traceVisibleTrack(ctx, centerIdx, 0, 0, elevScale, upX, upY);
    ctx.strokeStyle = '#14532d'; ctx.lineWidth = WALL_HALF_W * 2; ctx.stroke();

    // Поребрики: красно-белые полосы. Фаза привязана к расстоянию вдоль трассы, поэтому не «ползёт».
    const curbFirst = traceVisibleTrack(ctx, centerIdx, 0, 0, elevScale, upX, upY);
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = CURB_OUTER_W * 2; ctx.stroke();
    traceVisibleTrack(ctx, centerIdx, 0, 0, elevScale, upX, upY);
    ctx.setLineDash([34, 34]); ctx.lineDashOffset = sampleCumDist[curbFirst] % 68;
    ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = CURB_OUTER_W * 2; ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0;

    traceVisibleTrack(ctx, centerIdx, 0, 0, elevScale, upX, upY);
    ctx.strokeStyle = '#262c36'; ctx.lineWidth = ASPHALT_HALF_W * 2; ctx.stroke();

    drawTrackMarkings(ctx, centerIdx, upX, upY, elevScale);

    // Отрисовка динамической траектории по клавише H
    if (window.showRacingLine && dynamicRacingLinePoints.length > 0) {
        ctx.save();
        const N = dynamicRacingLinePoints.length;
        const refZ = trackSamples[centerIdx].z;
        for (let s = -88; s < 88; s++) {
            const p1 = dynamicRacingLinePoints[(centerIdx + s + N) % N];
            const p2 = dynamicRacingLinePoints[(centerIdx + s + 1 + N) % N];
            ctx.strokeStyle = p1.color; ctx.lineWidth = 4.5;
            ctx.beginPath();
            ctx.moveTo(p1.x + upX * ((p1.z - refZ) * elevScale), p1.y + upY * ((p1.z - refZ) * elevScale));
            ctx.lineTo(p2.x + upX * ((p2.z - refZ) * elevScale), p2.y + upY * ((p2.z - refZ) * elevScale));
            ctx.stroke();
        }
        ctx.restore();
    }
}

// Линия старта/финиша и метки DRS (метки DRS — только в классе F1)
function drawTrackMarkings(ctx, centerIdx, upX, upY, elevScale) {
    const refZ = trackSamples[centerIdx].z;
    const cx = playerCar ? playerCar.x : 0, cy = playerCar ? playerCar.y : 0;
    const drawAcross = (x, y, nx, ny, z, width, color, dash) => {
        if (Math.hypot(x - cx, y - cy) > 2400) return;
        const lift = (z - refZ) * elevScale;
        const ox = x + upX * lift, oy = y + upY * lift;
        ctx.beginPath();
        ctx.moveTo(ox - nx * ASPHALT_HALF_W, oy - ny * ASPHALT_HALF_W);
        ctx.lineTo(ox + nx * ASPHALT_HALF_W, oy + ny * ASPHALT_HALF_W);
        ctx.strokeStyle = color; ctx.lineWidth = width;
        ctx.setLineDash(dash || []);
        ctx.stroke();
        ctx.setLineDash([]);
    };

    ctx.save();
    ctx.lineCap = 'butt';
    // Старт/финиш: шахматная линия
    const s0 = trackSamples[0], s2 = trackSamples[2];
    const dx = s2.x - s0.x, dy = s2.y - s0.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    drawAcross(s0.x, s0.y, nx, ny, s0.z, 18, '#f8fafc');
    drawAcross(s0.x, s0.y, nx, ny, s0.z, 18, '#0b0f17', [9, 9]);

    if (typeof selectedCarClass !== 'undefined' && selectedCarClass === 'F1') {
        ctx.globalAlpha = 0.75;
        for (const m of drsMarkerLines) drawAcross(m.x, m.y, m.nx, m.ny, m.z || 0, 5, m.color);
    }
    ctx.restore();
}
