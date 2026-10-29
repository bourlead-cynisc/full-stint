// ============================================================================
// topview.js — вид сверху с двумя вариантами камеры:
//   • «на машине»  — камера следует за игроком (рисует track.js → drawTrack)
//   • «на трассе»  — камера неподвижна, вся трасса целиком, машины — увеличенные значки
// ============================================================================

const trackFitCache = {};

// Подбирает поворот трассы так, чтобы она максимально заполнила экран
function getTrackFit(W, H) {
    const key = selectedTrackIndex + '_' + Math.round(trackLengthPx) + '_' + W + 'x' + H;
    if (trackFitCache[key]) return trackFitCache[key];
    const areaW = W - 170, areaH = H - 250;
    let best = null;
    for (let deg = 0; deg < 180; deg += 3) {
        const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
        let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
        for (let i = 0; i < trackSamples.length; i += 3) {
            const p = trackSamples[i];
            const x = p.x * ca - p.y * sa, y = p.x * sa + p.y * ca;
            if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y;
        }
        const w = mxx - mnx + 360, h = mxy - mny + 360;
        const sc = Math.min(areaW / w, areaH / h);
        if (!best || sc > best.sc) best = { sc, a, cx: (mnx + mxx) / 2, cy: (mny + mxy) / 2 };
    }
    best.sx = W / 2; best.sy = 76 + areaH / 2 + 30;
    return (trackFitCache[key] = best);
}

function fitToScreen(fit, x, y) {
    const ca = Math.cos(fit.a), sa = Math.sin(fit.a);
    return [fit.sx + ((x * ca - y * sa) - fit.cx) * fit.sc, fit.sy + ((x * sa + y * ca) - fit.cy) * fit.sc];
}

function trackPath(ctx) {
    ctx.beginPath();
    for (let i = 0; i < trackSamples.length; i++) {
        const p = trackSamples[i];
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
}

// Рисует всю трассу в мировых координатах (вызывать после настройки трансформации)
function drawTrackOverview(ctx, fit) {
    const E = 2.2;                                   // значки и ширина трассы чуть увеличены для читаемости
    const minW = (px) => px / fit.sc;
    ctx.lineJoin = 'round'; ctx.lineCap = 'butt';

    trackPath(ctx); ctx.strokeStyle = '#2a5d30'; ctx.lineWidth = Math.max(WALL_HALF_W * 2 * E, minW(18)); ctx.stroke();
    ctx.lineCap = 'round';
    trackPath(ctx); ctx.strokeStyle = '#b9a77a'; ctx.lineWidth = Math.max((CURB_OUTER_W * 2 + 24) * E, minW(13)); ctx.stroke();
    trackPath(ctx); ctx.strokeStyle = '#d62828'; ctx.lineWidth = Math.max(CURB_OUTER_W * 2 * E, minW(10)); ctx.stroke();
    ctx.lineCap = 'butt';
    trackPath(ctx); ctx.setLineDash([minW(7), minW(7)]); ctx.strokeStyle = '#f5f7fa'; ctx.lineWidth = Math.max(CURB_OUTER_W * 2 * E, minW(10)); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineCap = 'round';
    trackPath(ctx); ctx.strokeStyle = '#323844'; ctx.lineWidth = Math.max(ASPHALT_HALF_W * 2 * E, minW(7.5)); ctx.stroke();
    trackPath(ctx); ctx.setLineDash([minW(9), minW(11)]); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = minW(1.2); ctx.stroke(); ctx.setLineDash([]);

    drawPitLane(ctx);

    // зоны DRS (только Ф-1)
    if (selectedCarClass === 'F1') {
        const N = trackSamples.length;
        for (const z of TRACKS_DB[selectedTrackIndex].drsZones) {
            let i0 = Math.floor(z.start * N), i1 = Math.floor(z.end * N);
            if (i1 < i0) i1 += N;
            ctx.beginPath();
            for (let i = i0; i <= i1; i++) { const p = trackSamples[i % N]; if (i === i0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
            ctx.strokeStyle = 'rgba(0,230,118,0.55)'; ctx.lineWidth = Math.max(ASPHALT_HALF_W * 0.7 * E, minW(4)); ctx.stroke();
        }
    }

    // оптимальная траектория (H)
    if (window.showRacingLine) {
        const N = dynamicRacingLinePoints.length;
        ctx.lineWidth = minW(2.2);
        for (let i = 0; i < N; i += 2) {
            const p1 = dynamicRacingLinePoints[i], p2 = dynamicRacingLinePoints[(i + 2) % N];
            ctx.strokeStyle = p1.color; ctx.globalAlpha = 0.75;
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // линия старта-финиша
    const s0 = trackSamples[0], s2 = trackSamples[2];
    const dx = s2.x - s0.x, dy = s2.y - s0.y, dl = Math.hypot(dx, dy) || 1;
    const nx = -dy / dl, ny = dx / dl, half = ASPHALT_HALF_W * E;
    const cells = 8;
    for (let i = 0; i < cells; i++) {
        const t0 = -half + (i / cells) * half * 2, t1 = -half + ((i + 1) / cells) * half * 2;
        ctx.fillStyle = i % 2 ? '#0b0f17' : '#f8fafc';
        const w = minW(5);
        ctx.beginPath();
        ctx.moveTo(s0.x + nx * t0, s0.y + ny * t0); ctx.lineTo(s0.x + nx * t1, s0.y + ny * t1);
        ctx.lineTo(s0.x + nx * t1 + dx / dl * w, s0.y + ny * t1 + dy / dl * w); ctx.lineTo(s0.x + nx * t0 + dx / dl * w, s0.y + ny * t0 + dy / dl * w);
        ctx.closePath(); ctx.fill();
    }
}

// Кадр: вся трасса, камера неподвижна
function renderTopTrack(ctx, W, H) {
    const fit = getTrackFit(W, H);
    ctx.fillStyle = '#2f6e35'; ctx.fillRect(0, 0, W, H);
    // лёгкий узор «кошения» для глубины
    ctx.fillStyle = 'rgba(0,0,0,0.045)';
    for (let x = -40; x < W; x += 120) ctx.fillRect(x, 0, 60, H);

    ctx.save();
    ctx.translate(fit.sx, fit.sy);
    ctx.scale(fit.sc, fit.sc);
    ctx.translate(-fit.cx, -fit.cy);
    ctx.rotate(fit.a);
    drawTrackOverview(ctx, fit);

    // машины — значки покрупнее: ~30 px длиной на экране
    topZoomNow = fit.sc;
    const sorted = [...allCars].sort((a, b) => (a === playerCar) - (b === playerCar));
    for (const c of sorted) {
        const hh = c.height * 1.16;
        const mul = Math.max(1, (c.isPlayer ? 34 : 28) / (hh * fit.sc));
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.angle);
        ctx.scale(mul, mul);
        topZoomNow = fit.sc * mul;
        drawCarSpriteTop(ctx, c, 1);
        ctx.restore();
    }
    ctx.restore();

    // подсветка игрока и подписи — в экранных координатах, чтобы текст не поворачивался
    ctx.save();
    ctx.font = '700 10px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    const t = performance.now() / 1000;
    const used = [];
    const order = [...allCars].sort((a, b) => (b.isPlayer - a.isPlayer));       // игрок рисуется первым — его подпись не вытесняется
    for (const c of order) {
        const [sx, sy] = fitToScreen(fit, c.x, c.y);
        if (c.isPlayer) {
            ctx.strokeStyle = `rgba(255,59,78,${0.55 + 0.35 * Math.sin(t * 5)})`; ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.arc(sx, sy, 22 + 2 * Math.sin(t * 5), 0, Math.PI * 2); ctx.stroke();
        }
        // подписи не накладываем друг на друга
        if (used.some(u => Math.abs(u[0] - sx) < 30 && Math.abs(u[1] - sy) < 13)) continue;
        used.push([sx, sy]);
        const nm = (c.baseName || c.driverName).replace(/\s*\(.*\)/, '').split(' ').pop().slice(0, 3).toUpperCase();
        ctx.fillStyle = 'rgba(8,12,18,0.72)'; ctx.fillRect(sx - 14, sy - 31, 28, 12);
        ctx.fillStyle = c.isPlayer ? '#ff6b7a' : (c.isTeammate ? '#38bdf8' : '#e5e7eb');
        ctx.fillText(nm, sx, sy - 21);
    }
    // подпись режима
    ctx.textAlign = 'left'; ctx.font = '700 11px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`🗺️ Камера зафиксирована на трассе: ${TRACKS_DB[selectedTrackIndex].shortName}   ·   C — вернуть на машину`, 22, H - 100);
    ctx.restore();
    topZoomNow = 1;
}
