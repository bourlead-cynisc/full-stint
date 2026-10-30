let selectedTrackIndex = 0;
let controlPoints = [];
let trackSamples = [];
let totalSamples = 0;
let sfDirX = 0, sfDirY = -1, sfNormX = 1, sfNormY = 0, START_ANGLE = 0;

let pitWaypoints = [], pitCumDist = [], pitRouteLength = 1;
let pitLaneStartPt = {x: 0, y: 0}, pitLaneEndPt = {x: 0, y: 0};
let pitWallStartPt = {x: 0, y: 0}, pitWallEndPt = {x: 0, y: 0};
let teamPitBoxes = [];
let drsMarkerLines = [];
let dynamicRacingLinePoints = [];

let minX = 0, maxX = 1, minY = 0, maxY = 1;
let trackLengthPx = 1;
let sampleCumDist = [];

const ASPHALT_HALF_W   = 72;
const CURB_OUTER_W     = 84;
const WALL_HALF_W      = 122;
const PIT_WALL_INNER_W = 345;
const PIT_CORRIDOR_OFFSET = 202;

function getSplinePoint(p0, p1, p2, p3, fraction) {
    // Centripetal knots prevent loops where sparse survey points meet dense corners.
    const t0=0, t1=Math.sqrt(Math.hypot(p1.x-p0.x,p1.y-p0.y))+1e-6;
    const t2=t1+Math.sqrt(Math.hypot(p2.x-p1.x,p2.y-p1.y))+1e-6;
    const t3=t2+Math.sqrt(Math.hypot(p3.x-p2.x,p3.y-p2.y))+1e-6;
    const t=t1+(t2-t1)*fraction;
    const mix=(a,b,lo,hi)=>({x:((hi-t)*a.x+(t-lo)*b.x)/(hi-lo),y:((hi-t)*a.y+(t-lo)*b.y)/(hi-lo)});
    const a1=mix(p0,p1,t0,t1), a2=mix(p1,p2,t1,t2), a3=mix(p2,p3,t2,t3);
    return mix(mix(a1,a2,t0,t2),mix(a2,a3,t1,t3),t1,t2);
}

function buildActiveTrackGeometry() {
    const trk = TRACKS_DB[selectedTrackIndex];
    const ref = trk.rawPoints[0];
    controlPoints = trk.rawPoints.map(p => ({
        x: (p.x - ref.x) * trk.scale,
        y: (p.y - ref.y) * trk.scale
    }));

    trackSamples = [];
    for (let i = 0; i < controlPoints.length; i++) {
        const p0 = controlPoints[(i - 1 + controlPoints.length) % controlPoints.length];
        const p1 = controlPoints[i];
        const p2 = controlPoints[(i + 1) % controlPoints.length];
        const p3 = controlPoints[(i + 2) % controlPoints.length];
        const samplesPerSegment = Math.max(4, Math.ceil(Math.hypot(p2.x-p1.x,p2.y-p1.y)/20));
        for (let s = 0; s < samplesPerSegment; s++) {
            const pt = getSplinePoint(p0, p1, p2, p3, s / samplesPerSegment);
            trackSamples.push({ x: pt.x, y: pt.y, z: 0, slopeDeg: 0, nx: 0, ny: 0, curv: 0 });
        }
    }
    trackSamples = resampleCenterline(trackSamples, 24);
    // Filter only sub-road-width ripples in every layout before deriving normals.
    // Asphalt, kerbs, walls and the racing line then share the same clean centerline.
    trackSamples = smoothCenterlineSamples(trackSamples);
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

    // Filter small survey/spline wiggles before using curvature for the visual
    // racing line or AI braking. A short cyclic Gaussian preserves real corners.
    const signedCurv = trackSamples.map(p => p.curv);
    const curvatureKernel = [1, 2, 3, 4, 3, 2, 1];
    const curvatureWeight = curvatureKernel.reduce((a, b) => a + b, 0);
    for (let i = 0; i < totalSamples; i++) {
        let smooth = 0;
        for (let k = -3; k <= 3; k++) smooth += signedCurv[(i + k + totalSamples) % totalSamples] * curvatureKernel[k + 3];
        trackSamples[i].curv = smooth / curvatureWeight;
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

        const apexOffset = 15 * Math.tanh(cur.curv * 8);
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
        rawK[i] = k6 * 0.8 + k3 * 0.2;
    }
    for (let i = 0; i < totalSamples; i++) {
        let sum = 0;
        for (let d = -4; d <= 4; d++) sum += rawK[(i + d + totalSamples) % totalSamples] * (5 - Math.abs(d));
        trackSamples[i].kappa = sum / 25;
    }

    const prevPt = trackSamples[(totalSamples - 8) % totalSamples];
    const nextPt = trackSamples[8];
    const vx = nextPt.x - prevPt.x; const vy = nextPt.y - prevPt.y;
    const vLen = Math.hypot(vx, vy) || 1;
    sfDirX = vx / vLen; sfDirY = vy / vLen;
    sfNormX = (-sfDirY) * trk.pitSideSign; sfNormY = ( sfDirX) * trk.pitSideSign;
    START_ANGLE = Math.atan2(sfDirX, -sfDirY);

    const mapped=trk.realPitPoints.map(p=>({...p}));
    let entry=getTrackInfo(mapped[0].x,mapped[0].y,-1),exit=getTrackInfo(mapped.at(-1).x,mapped.at(-1).y,-1);
    if((exit.normProgress-entry.normProgress+1)%1>.45) {mapped.reverse();[entry,exit]=[exit,entry];}
    trk.pitEntryNorm=entry.normProgress;trk.pitExitNorm=exit.normProgress;
    trk.pitProgressSpan=(exit.normProgress-entry.normProgress+1)%1;
    pitWaypoints=sampleOpenPitPath([{x:entry.center.x,y:entry.center.y},...mapped,{x:exit.center.x,y:exit.center.y}],81);
    pitCumDist=[0];
    for(let i=1;i<pitWaypoints.length;i++)pitCumDist.push(pitCumDist[i-1]+Math.hypot(pitWaypoints[i].x-pitWaypoints[i-1].x,pitWaypoints[i].y-pitWaypoints[i-1].y));
    pitRouteLength=pitCumDist.at(-1);
    pitLaneStartPt=pitWaypoints[8];pitLaneEndPt=pitWaypoints.at(-9);
    pitWallStartPt=pitWaypoints[12];pitWallEndPt=pitWaypoints.at(-12);

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

}

function buildTeamPitBoxes() {
    const catalog = (typeof getActiveCatalog === 'function') ? getActiveCatalog() : F1_CATALOG;
    teamPitBoxes = [];
    for (let i = 0; i < catalog.length; i++) {
        const spec = catalog[i];
        const node = Math.round(81*(.25+.38*i/Math.max(1,catalog.length-1)));
        const pt = pitWaypoints[node];
        teamPitBoxes.push({teamIndex: i, shortName: spec.shortName, color: spec.livery.primary,
            node, x: pt.x, y: pt.y, garageX: pt.x + sfNormX * 70, garageY: pt.y + sfNormY * 70});
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
    return { dist: Math.sqrt(minDistSq), center: closestPt, index: closestIdx, normProgress: (sampleCumDist[closestIdx] + bestT * Math.hypot(trackSamples[(closestIdx+1)%N].x-trackSamples[closestIdx].x, trackSamples[(closestIdx+1)%N].y-trackSamples[closestIdx].y)) / trackLengthPx };
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
    const span = Math.min(Math.floor((N-1)/2), 180);
    ctx.beginPath();
    const firstIdx = (centerIdx - span + N) % N;
    const first = trackSamples[firstIdx], prev = trackSamples[(firstIdx-1+N)%N];
    ctx.moveTo((prev.x+first.x)/2 + offsetX, (prev.y+first.y)/2 + offsetY);
    for (let i=0; i<=span*2; i++) {
        const pt=trackSamples[(firstIdx+i)%N], next=trackSamples[(firstIdx+i+1)%N];
        ctx.quadraticCurveTo(pt.x+offsetX,pt.y+offsetY,(pt.x+next.x)/2+offsetX,(pt.y+next.y)/2+offsetY);
    }
    return firstIdx;
}

function drawTrack(ctx) {
    const centerIdx = playerCar && playerCar.lastSampleIdx >= 0 ? playerCar.lastSampleIdx : 0;
    drawBackgroundWorld(ctx, playerCar ? playerCar.x : 0, playerCar ? playerCar.y : 0);

    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const upX = 0;
    const upY = 0;
    const elevScale = 0;

    traceVisibleTrack(ctx, centerIdx, 0, 0, elevScale, upX, upY);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = (WALL_HALF_W + 16) * 2; ctx.stroke();

    traceVisibleTrack(ctx, centerIdx, 0, 0, elevScale, upX, upY);
    ctx.strokeStyle = '#14532d'; ctx.lineWidth = WALL_HALF_W * 2; ctx.stroke();

    // Поребрики: красно-белые полосы. Фаза привязана к расстоянию вдоль трассы, поэтому не «ползёт».
    const curbFirst = traceVisibleTrack(ctx, centerIdx, 0, 0, elevScale, upX, upY);
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = CURB_OUTER_W * 2; ctx.stroke();
    traceVisibleTrack(ctx, centerIdx, 0, 0, elevScale, upX, upY);
    ctx.lineCap = 'butt';
    ctx.setLineDash([34, 34]); ctx.lineDashOffset = sampleCumDist[curbFirst] % 68;
    ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = CURB_OUTER_W * 2; ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0;

    traceVisibleTrack(ctx, centerIdx, 0, 0, elevScale, upX, upY);
    ctx.strokeStyle = '#262c36'; ctx.lineWidth = ASPHALT_HALF_W * 2; ctx.stroke();

    drawPitLane(ctx);
    drawTrackMarkings(ctx, centerIdx, upX, upY, elevScale);

    // Отрисовка динамической траектории по клавише H
    if (window.showRacingLine && dynamicRacingLinePoints.length > 0) {
        ctx.save();
        const N = dynamicRacingLinePoints.length;
        ctx.lineWidth=3; ctx.lineCap='round';
        for (let j=-180; j<180; j++) {
            const i=(centerIdx+j+N)%N;
            const prev=dynamicRacingLinePoints[(i-1+N)%N], pt=dynamicRacingLinePoints[i], next=dynamicRacingLinePoints[(i+1)%N];
            ctx.strokeStyle=pt.color;
            ctx.beginPath();ctx.moveTo((prev.x+pt.x)/2,(prev.y+pt.y)/2);
            ctx.quadraticCurveTo(pt.x,pt.y,(pt.x+next.x)/2,(pt.y+next.y)/2);ctx.stroke();
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

function drawPitLane(ctx) {
    ctx.save();
    ctx.beginPath();
    pitWaypoints.forEach((pt,i) => i ? ctx.lineTo(pt.x,pt.y) : ctx.moveTo(pt.x,pt.y));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 65; ctx.stroke();
    ctx.strokeStyle = '#3b4654'; ctx.lineWidth = 58; ctx.stroke();
    ctx.setLineDash([12,12]); ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2; ctx.stroke();
    ctx.setLineDash([]);
    for (const box of teamPitBoxes) {
        ctx.fillStyle = box.color; ctx.fillRect(box.x - 10,box.y - 10,20,20);
        ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText(String(box.teamIndex+1),box.x+14,box.y);
    }
    ctx.fillStyle = '#facc15'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText('PIT '+TRACKS_DB[selectedTrackIndex].pitSpeedLimit,pitWaypoints[5].x,pitWaypoints[5].y-35);
    ctx.restore();
}

function getTrackPointAtProgress(norm) {
    const distance = ((norm % 1 + 1) % 1) * trackLengthPx;
    let lo = 0, hi = totalSamples - 1;
    while (lo < hi) {const mid = Math.ceil((lo+hi)/2); if (sampleCumDist[mid] <= distance) lo=mid; else hi=mid-1;}
    const a=trackSamples[lo], b=trackSamples[(lo+1)%totalSamples];
    const length=Math.hypot(b.x-a.x,b.y-a.y) || 1;
    const t=(distance-sampleCumDist[lo])/length;
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,nx:a.nx,ny:a.ny};
}

function smoothCenterlineSamples(points) {
    return points.map((p,i)=>{
        const a=points[(i-1+points.length)%points.length],b=points[(i+1)%points.length];
        return {...p,x:(a.x+2*p.x+b.x)/4,y:(a.y+2*p.y+b.y)/4};
    });
}

function resampleCenterline(points, spacing) {
    const distances=[0];
    for(let i=0;i<points.length;i++) distances.push(distances[i]+Math.hypot(points[(i+1)%points.length].x-points[i].x,points[(i+1)%points.length].y-points[i].y));
    const length=distances[points.length], count=Math.max(32,Math.ceil(length/spacing));
    let segment=0;
    return Array.from({length:count},(_,i)=>{
        const distance=i*length/count;
        while(segment<points.length-1 && distances[segment+1]<=distance) segment++;
        const a=points[segment], b=points[(segment+1)%points.length];
        const t=(distance-distances[segment])/Math.max(1e-9,distances[segment+1]-distances[segment]);
        return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:0,slopeDeg:0,nx:0,ny:0,curv:0};
    });
}

function sampleOpenPitPath(points,count) {
    const dense=[];
    for(let i=0;i<points.length-1;i++) for(let j=0;j<8;j++) dense.push(getSplinePoint(points[Math.max(0,i-1)],points[i],points[i+1],points[Math.min(points.length-1,i+2)],j/8));
    dense.push(points.at(-1));
    const distances=[0];
    for(let i=1;i<dense.length;i++) distances.push(distances[i-1]+Math.hypot(dense[i].x-dense[i-1].x,dense[i].y-dense[i-1].y));
    let segment=0;return Array.from({length:count},(_,i)=>{
        const d=distances.at(-1)*i/(count-1);
        while(segment<dense.length-2&&distances[segment+1]<d)segment++;
        const t=(d-distances[segment])/Math.max(1e-9,distances[segment+1]-distances[segment]);
        return {x:dense[segment].x+(dense[segment+1].x-dense[segment].x)*t,y:dense[segment].y+(dense[segment+1].y-dense[segment].y)*t};
    });
}
function isPitEntryProgress(norm) {
    const delta=(norm-TRACKS_DB[selectedTrackIndex].pitEntryNorm+1.5)%1-.5;
    return Math.abs(delta)<=150/trackLengthPx;
}
