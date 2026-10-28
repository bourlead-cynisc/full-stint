// ============================================================================
// render3d.js — спрайты машин и перспективная 3D-камера «из-за машины»
//   • вид сверху (2D): спрайты с тенью
//   • вид погони (3D): трасса строится полигонами в перспективе с рельефом,
//     тонкий отбойник, полосатые поребрики, трава с полосами кошения, зона вылета,
//     деревья / щиты / трибуны / фонари вдоль трассы, небо с горизонтом,
//     машины — ваши спрайты, «выдавленные» слоями по высоте, с мягкой тенью
// ============================================================================

const spriteImgs = {};
const spriteTint = {};            // id -> [тёмный, средний, светлый] оттенки для боков

function loadSprites() {
    if (typeof SPRITE_DATA === 'undefined') return;
    for (const id in SPRITE_DATA) {
        const img = new Image();
        img.onload = () => {
            const tints = [0.58, 0.47, 0.37, 0.27, 0.16].map(a => {
                const c = document.createElement('canvas');
                c.width = img.width; c.height = img.height;
                const g = c.getContext('2d');
                g.drawImage(img, 0, 0);
                g.globalCompositeOperation = 'source-atop';
                g.fillStyle = `rgba(6,8,14,${a})`;
                g.fillRect(0, 0, c.width, c.height);
                return c;
            });
            spriteTint[id] = tints;
            spriteImgs[id] = img;
        };
        img.src = SPRITE_DATA[id];
    }
}

function spriteDims(car) {
    const img = spriteImgs[car.spec.id];
    const h = car.height * 1.16;
    return { img, h, w: h * img.width / img.height };
}

// ---------- 2D (вид сверху) ----------
// Спрайт заранее уменьшается до нужного размера в несколько проходов (по 2 раза) — так картинка остаётся
// чёткой, а не «мылится» при резком сжатии. Размер подбирается под текущий масштаб камеры.
const scaledCache = {};
let topZoomNow = 1;

function getScaledSprite(id, tintIdx, tw, th) {
    const key = id + ':' + tintIdx + ':' + tw + 'x' + th;
    if (scaledCache[key]) return scaledCache[key];
    let src = tintIdx < 0 ? spriteImgs[id] : spriteTint[id][tintIdx];
    let cw = src.width, ch = src.height;
    while (cw / 2 >= tw && ch / 2 >= th) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(cw / 2)); c.height = Math.max(1, Math.round(ch / 2));
        const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(src, 0, 0, c.width, c.height);
        src = c; cw = c.width; ch = c.height;
    }
    const out = document.createElement('canvas');
    out.width = tw; out.height = th;
    const g = out.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, tw, th);
    scaledCache[key] = out;
    return out;
}

// Контекст уже в центре машины и повёрнут носом вверх. scaleMul — увеличение значка (в режиме «вся трасса»).
function drawCarSpriteTop(ctx, car, scaleMul = 1) {
    const img = spriteImgs[car.spec.id];
    if (!img) {
        renderCarBody(ctx, car.spec, car.livery, car.compound, car.braking, car.drsActive, car.driverNumber);
        return;
    }
    const { h, w } = spriteDims(car);
    const dpr = window.devicePixelRatio || 1;
    const z = Math.max(0.05, topZoomNow) * scaleMul * dpr;
    const tw = Math.max(12, Math.round(w * z / 4) * 4), th = Math.max(24, Math.round(h * z / 4) * 4);
    const spr = getScaledSprite(car.spec.id, -1, tw, th);

    // мягкая тень (градиент), а не смещённая копия
    ctx.save();
    const sg = ctx.createRadialGradient(2, 3, 2, 2, 3, h * 0.62);
    sg.addColorStop(0, 'rgba(0,0,0,0.30)'); sg.addColorStop(0.6, 'rgba(0,0,0,0.13)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(2, 3, w * 0.8, h * 0.58, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(spr, -w / 2, -h / 2, w, h);

    if (car.braking) {
        const gl = ctx.createRadialGradient(0, h / 2, 0, 0, h / 2, w * 0.9);
        gl.addColorStop(0, 'rgba(255,50,40,0.55)'); gl.addColorStop(1, 'rgba(255,50,40,0)');
        ctx.fillStyle = gl; ctx.fillRect(-w, h / 2 - 8, w * 2, 22);
        ctx.fillStyle = 'rgba(255,60,50,0.95)';
        ctx.fillRect(-w * 0.34, h / 2 - 2.6, w * 0.2, 2.4); ctx.fillRect(w * 0.14, h / 2 - 2.6, w * 0.2, 2.4);
    }
    if (car.wingDamage > 0.2) {
        ctx.fillStyle = `rgba(20,20,20,${car.wingDamage * 0.7})`;
        ctx.beginPath(); ctx.arc(0, -h * 0.42, 4, 0, Math.PI * 2); ctx.fill();
    }
}

// ---------- 3D камера ----------
const CAM3D = { F: 760, cx: 640, cy: 346, pitch: 0.27, H: 140, back: 215, near: 40, ZS: 6, ARMCO_H: 9 };
const cam = { x: 0, y: 0, z: 0, fx: 0, fy: -1, rx: 1, ry: 0, sinP: 0, cosP: 1, horizon: 170, yaw: 0, roll: 0, sp: 0 };
const _p = { x: 0, y: 0, d: 0, k: 1, ok: false };
const _q = { x: 0, y: 0, d: 0, k: 1, ok: false };
const _r = { x: 0, y: 0, d: 0, k: 1, ok: false };

function setCamera(car) {
    const a = smoothCamAngle;
    const fx = Math.sin(a), fy = -Math.cos(a);
    const sp = Math.min(1, Math.hypot(car.dx, car.dy) / (car.baseMaxSpeed || 12));
    const brake = car.braking ? 1 : 0;
    cam.sp += (sp - cam.sp) * 0.1;
    cam.brake = (cam.brake || 0) + (brake - (cam.brake || 0)) * 0.12;
    const back = CAM3D.back + 55 * cam.sp - 12 * cam.brake;
    const H = CAM3D.H + 16 * cam.sp;
    cam.x = car.x - fx * back; cam.y = car.y - fy * back;
    cam.z = (car.elevationM || 0) * CAM3D.ZS + H;
    cam.fx = fx; cam.fy = fy; cam.rx = Math.cos(a); cam.ry = Math.sin(a);
    const p = CAM3D.pitch - 0.025 * cam.sp + 0.03 * cam.brake;
    cam.sinP = Math.sin(p); cam.cosP = Math.cos(p);
    cam.horizon = CAM3D.cy - CAM3D.F * Math.tan(p);
    cam.yaw = a;
    // крен камеры в повороте
    const targetRoll = Math.max(-0.045, Math.min(0.045, -(car.yawRate || 0) * cam.sp * 0.09));
    cam.roll += (targetRoll - cam.roll) * 0.12;
}

function proj(wx, wy, wz, o) {
    const dx = wx - cam.x, dy = wy - cam.y;
    const fwd = dx * cam.fx + dy * cam.fy;
    const lat = dx * cam.rx + dy * cam.ry;
    const up = wz - cam.z;
    const depth = fwd * cam.cosP - up * cam.sinP;
    const yc = fwd * cam.sinP + up * cam.cosP;
    o.d = depth;
    if (depth < CAM3D.near) { o.ok = false; o.x = 0; o.y = 0; o.k = 0; return o; }
    const k = CAM3D.F / depth;
    o.x = CAM3D.cx + lat * k; o.y = CAM3D.cy - yc * k; o.k = k; o.ok = true;
    return o;
}

// ---------- станции вдоль трассы (с подразбиением пополам — чтобы полосы были мелкими) ----------
function lerpSt(a, b, t) {
    let nx = a.nx + (b.nx - a.nx) * t, ny = a.ny + (b.ny - a.ny) * t;
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, nx, ny, idx: b.idx, g: b.g, d: CAM3D.near + 1 };
}

function buildStations(centerIdx) {
    const N = totalSamples;
    const ds = trackLengthPx / N;
    const AH = Math.ceil(5600 / ds), BH = Math.ceil(520 / ds) + 2;
    const pts = [];
    for (let s = -BH; s <= AH; s++) {
        const i = (centerIdx + s + N) % N;
        const t = trackSamples[i];
        const A = { x: t.x, y: t.y, z: t.z * CAM3D.ZS, nx: t.nx, ny: t.ny, idx: i, g: i * 2, d: 0 };
        pts.push(A);
        if (s < AH) {
            const t2 = trackSamples[(i + 1) % N];
            const B = { x: t2.x, y: t2.y, z: t2.z * CAM3D.ZS, nx: t2.nx, ny: t2.ny, idx: (i + 1) % N, g: i * 2 + 1, d: 0 };
            const M = lerpSt(A, B, 0.5); M.idx = i; M.g = i * 2 + 1;
            pts.push(M);
        }
    }
    cam.AH = AH; cam.BH = BH;
    return pts;       // станции за камерой оставляем: полигоны отсекаются по плоскости near в пространстве камеры
}

// Точка в пространстве камеры: [боковое смещение, «вверх», глубина]
function edgeLine(st, off, dz = 0) {
    const m = st.length, Lt = new Float32Array(m), Yc = new Float32Array(m), D = new Float32Array(m);
    for (let k = 0; k < m; k++) {
        const s = st[k];
        const dx = s.x + s.nx * off - cam.x, dy = s.y + s.ny * off - cam.y, up = s.z + dz - cam.z;
        const fwd = dx * cam.fx + dy * cam.fy;
        Lt[k] = dx * cam.rx + dy * cam.ry;
        Yc[k] = fwd * cam.sinP + up * cam.cosP;
        D[k] = fwd * cam.cosP - up * cam.sinP;
    }
    return { L: Lt, Y: Yc, D };
}

// Отсечка многоугольника (в пространстве камеры) по плоскости near, затем проекция в путь
function addClippedPoly(ctx, poly) {
    const n = poly.length, near = CAM3D.near;
    let first = true, count = 0;
    const F = CAM3D.F, cx = CAM3D.cx, cy = CAM3D.cy;
    const emit = (l, y, d) => {
        const k = F / d;
        const sx = cx + l * k, sy = cy - y * k;
        if (first) { ctx.moveTo(sx, sy); first = false; } else ctx.lineTo(sx, sy);
        count++;
    };
    for (let i = 0; i < n; i++) {
        const c = poly[i], nx = poly[(i + 1) % n];
        const cin = c[2] >= near, nin = nx[2] >= near;
        if (cin) emit(c[0], c[1], c[2]);
        if (cin !== nin) {
            const t = (near - c[2]) / (nx[2] - c[2]);
            emit(c[0] + (nx[0] - c[0]) * t, c[1] + (nx[1] - c[1]) * t, near);
        }
    }
    if (count >= 3) ctx.closePath();
    return count;
}

function strip(ctx, A, B, color, k0 = 0, k1 = A.L.length - 1) {
    if (k1 - k0 < 1) return;
    const poly = [];
    for (let k = k0; k <= k1; k++) poly.push([A.L[k], A.Y[k], A.D[k]]);
    for (let k = k1; k >= k0; k--) poly.push([B.L[k], B.Y[k], B.D[k]]);
    ctx.beginPath();
    if (addClippedPoly(ctx, poly) < 3) return;
    ctx.fillStyle = color; ctx.fill();
}

// Чередующиеся квады одним путём (снизу уже залита базовая полоса — швов нет)
function altQuads(ctx, A, B, st, color, pred, k0 = 0, k1 = st.length - 1) {
    ctx.beginPath();
    for (let k = k1 - 1; k >= k0; k--) {
        if (!pred(st[k].g)) continue;
        addClippedPoly(ctx, [[A.L[k], A.Y[k], A.D[k]], [A.L[k + 1], A.Y[k + 1], A.D[k + 1]], [B.L[k + 1], B.Y[k + 1], B.D[k + 1]], [B.L[k], B.Y[k], B.D[k]]]);
    }
    ctx.fillStyle = color; ctx.fill();
}

// ---------- небо ----------
function drawSky(ctx, W, H) {
    const hy = cam.horizon;
    const top = Math.max(-120, hy - 600);
    const g = ctx.createLinearGradient(0, top, 0, hy);
    g.addColorStop(0, '#0f3b73'); g.addColorStop(0.5, '#3f86c5'); g.addColorStop(0.85, '#93c4e6'); g.addColorStop(1, '#cfe5f2');
    ctx.fillStyle = g; ctx.fillRect(-120, -120, W + 240, hy + 121);

    // солнце и блик
    const sx = ((0.78 * W - cam.yaw * 520) % (W * 2) + W * 2) % (W * 2) - W * 0.4;
    const sg = ctx.createRadialGradient(sx, hy - 90, 4, sx, hy - 90, 150);
    sg.addColorStop(0, 'rgba(255,248,214,0.95)'); sg.addColorStop(0.15, 'rgba(255,236,170,0.55)'); sg.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = sg; ctx.fillRect(sx - 160, hy - 250, 320, 320);

    // облака
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 9; i++) {
        const base = (i * 0.83 + 0.3) * W;
        const x = ((base - cam.yaw * 340) % (W * 1.8) + W * 1.8) % (W * 1.8) - W * 0.35;
        const y = hy - 60 - (i % 4) * 36 - (i % 3) * 10;
        for (let c = 0; c < 3; c++) { ctx.beginPath(); ctx.ellipse(x + c * 38 - 38, y + (c % 2) * 5, 52 - c * 6, 10 + (c % 2) * 3, 0, 0, Math.PI * 2); ctx.fill(); }
    }

    // дальние горы и леса — три слоя с параллаксом
    const layers = [['#7aa4c4', 34, 0.7, 3.1], ['#5c8f8a', 22, 0.85, 5.3], ['#3f7358', 12, 1.0, 9.1]];
    layers.forEach(([col, amp, par, fr], li) => {
        ctx.beginPath(); ctx.moveTo(-20, hy + 3);
        for (let x = -20; x <= W + 20; x += 14) {
            const ang = Math.atan((x - CAM3D.cx) / CAM3D.F) + cam.yaw * par;
            const hgt = amp * (0.55 + 0.30 * Math.sin(ang * fr + li) + 0.22 * Math.sin(ang * fr * 2.3 + 1.7 * li) + 0.10 * Math.sin(ang * fr * 5.1));
            ctx.lineTo(x, hy - Math.max(2, hgt));
        }
        ctx.lineTo(W + 20, hy + 3); ctx.closePath();
        ctx.fillStyle = col; ctx.fill();
    });
}

function drawHaze(ctx, W) {
    const hy = cam.horizon;
    const g = ctx.createLinearGradient(0, hy - 14, 0, hy + 230);
    g.addColorStop(0, 'rgba(207,229,242,0.97)'); g.addColorStop(0.35, 'rgba(190,214,228,0.55)'); g.addColorStop(1, 'rgba(190,214,228,0)');
    ctx.fillStyle = g; ctx.fillRect(-120, hy - 14, W + 240, 250);
}

// ---------- прямоугольник на земле ----------
function groundQuadAt(ctx, wx, wy, wz, dirx, diry, halfAcross, halfAlong, color) {
    const nx = -diry, ny = dirx;
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
        const [a, b] = c[i];
        proj(wx + nx * halfAcross * a + dirx * halfAlong * b, wy + ny * halfAcross * a + diry * halfAlong * b, wz, _p);
        if (!_p.ok) return;
        if (i === 0) ctx.moveTo(_p.x, _p.y); else ctx.lineTo(_p.x, _p.y);
    }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

// ---------- мягкая тень под машиной ----------
function drawCarShadow(ctx, car) {
    const { h, w } = spriteDims(car);
    const z = (car.elevationM || 0) * CAM3D.ZS + 0.3;
    const fx = Math.sin(car.angle), fy = -Math.cos(car.angle), rx = Math.cos(car.angle), ry = Math.sin(car.angle);
    proj(car.x + 3, car.y + 4, z, _p);
    if (!_p.ok) return;
    proj(car.x + 3 + rx * 14, car.y + 4 + ry * 14, z, _q);
    proj(car.x + 3 + fx * 14, car.y + 4 + fy * 14, z, _r);
    if (!_q.ok || !_r.ok) return;
    ctx.save();
    ctx.transform((_q.x - _p.x) / 14, (_q.y - _p.y) / 14, -(_r.x - _p.x) / 14, -(_r.y - _p.y) / 14, _p.x, _p.y);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, h * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.32)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.scale(w / h * 1.5, 1);
    ctx.beginPath(); ctx.arc(0, 0, h * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

// ---------- машина в 3D: 8 слоёв-«срезов» от днища до крыши ----------
function drawCar3D(ctx, car) {
    const id = car.spec.id;
    const img = spriteImgs[id], tints = spriteTint[id];
    if (!img) return null;
    const { h, w } = spriteDims(car);
    const fx = Math.sin(car.angle), fy = -Math.cos(car.angle);
    const rx = Math.cos(car.angle), ry = Math.sin(car.angle);
    const z0 = (car.elevationM || 0) * CAM3D.ZS;
    const Hc = car.spec.carClass === 'F1' ? 6.5 : 8.5;
    const NL = 11, L = 14;
    const lean = car.bodyRoll * 6, pitch = car.bodyPitch * 12;
    let topInfo = null;
    for (let i = 0; i < NL; i++) {
        const f = i / (NL - 1);
        const cx = car.x + rx * lean * f + fx * pitch * f;
        const cy = car.y + ry * lean * f + fy * pitch * f;
        const z = z0 + 0.6 + f * Hc;
        proj(cx, cy, z, _p);
        if (!_p.ok) return null;
        proj(cx + rx * L, cy + ry * L, z, _q);
        proj(cx + fx * L, cy + fy * L, z, _r);
        if (!_q.ok || !_r.ok) return null;
        const vrx = (_q.x - _p.x) / L, vry = (_q.y - _p.y) / L;
        const vfx = (_r.x - _p.x) / L, vfy = (_r.y - _p.y) / L;
        ctx.save();
        ctx.transform(vrx, vry, -vfx, -vfy, _p.x, _p.y);
        const top = i === NL - 1;
        const src = top ? img : tints[Math.min(4, Math.floor(f * 5))];
        ctx.drawImage(src, -w / 2, -h / 2, w, h);
        if (top) {
            if (car.braking) {
                const gl = ctx.createRadialGradient(0, h / 2 - 2, 0, 0, h / 2 - 2, w * 0.8);
                gl.addColorStop(0, 'rgba(255,40,40,0.6)'); gl.addColorStop(1, 'rgba(255,40,40,0)');
                ctx.fillStyle = gl; ctx.fillRect(-w, h / 2 - 12, w * 2, 26);
                ctx.fillStyle = '#ff2a2a';
                ctx.fillRect(-w * 0.36, h / 2 - 3.2, w * 0.22, 2.8); ctx.fillRect(w * 0.14, h / 2 - 3.2, w * 0.22, 2.8);
            }
            if (car.wingDamage > 0.2) {
                ctx.fillStyle = `rgba(20,20,20,${car.wingDamage * 0.7})`;
                ctx.beginPath(); ctx.arc(0, -h * 0.42, 4, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.restore();
        if (top) topInfo = { x: _p.x, y: _p.y, k: _p.k };
    }
    return topInfo;
}

function drawTag(ctx, car, info) {
    if (!info || info.k < 0.9) return;
    const name = (car.baseName || car.driverName).replace(/\s*\(.*\)/, '').split(' ').pop().slice(0, 3).toUpperCase();
    ctx.save();
    ctx.font = '700 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    const tx = info.x, ty = info.y - 30 * Math.min(1.3, info.k);
    ctx.fillStyle = 'rgba(8,12,18,0.7)';
    ctx.fillRect(tx - 17, ty - 11, 34, 14);
    ctx.fillStyle = car.isTeammate ? '#38bdf8' : '#e5e7eb';
    ctx.fillText(name, tx, ty);
    ctx.restore();
}

// ---------- объекты вдоль трассы ----------
const TREE_COLS = [['#1f5d34', '#2a7a45'], ['#18472a', '#236b3d'], ['#2f6b2a', '#3f8a38']];

function drawTree(ctx, d) {
    proj(d.x, d.y, d.z * CAM3D.ZS, _p);
    if (!_p.ok || _p.k < 0.12) return;
    const k = _p.k, h = d.h * k, w = h * 0.36;
    const [dark, light] = TREE_COLS[d.shade];
    ctx.fillStyle = '#4b3621'; ctx.fillRect(_p.x - w * 0.07, _p.y - h * 0.22, w * 0.14, h * 0.22);
    for (let t = 0; t < 3; t++) {
        const bw = w * (1 - t * 0.26), by = _p.y - h * (0.16 + t * 0.26), bh = h * 0.42;
        ctx.beginPath(); ctx.moveTo(_p.x - bw / 2, by); ctx.lineTo(_p.x + bw / 2, by); ctx.lineTo(_p.x, by - bh); ctx.closePath();
        ctx.fillStyle = t === 1 ? light : dark; ctx.fill();
    }
}

function projQuad(ctx, pts, color) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
        proj(pts[i][0], pts[i][1], pts[i][2], _p);
        if (!_p.ok) return false;
        if (i === 0) ctx.moveTo(_p.x, _p.y); else ctx.lineTo(_p.x, _p.y);
    }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    return true;
}

function drawBoard(ctx, d) {
    const z = d.z * CAM3D.ZS, L = 44, tx = d.tx, ty = d.ty;
    const x = d.x, y = d.y;
    // ножки
    ctx.strokeStyle = '#374151';
    for (const s of [-L * 0.8, L * 0.8]) {
        proj(x + tx * s, y + ty * s, z, _p); proj(x + tx * s, y + ty * s, z + 14, _q);
        if (_p.ok && _q.ok) { ctx.lineWidth = Math.max(1, 2 * _p.k); ctx.beginPath(); ctx.moveTo(_p.x, _p.y); ctx.lineTo(_q.x, _q.y); ctx.stroke(); }
    }
    if (!projQuad(ctx, [[x - tx * L, y - ty * L, z + 12], [x + tx * L, y + ty * L, z + 12], [x + tx * L, y + ty * L, z + 28], [x - tx * L, y - ty * L, z + 28]], d.c1)) return;
    projQuad(ctx, [[x - tx * L, y - ty * L, z + 18], [x + tx * L, y + ty * L, z + 18], [x + tx * L, y + ty * L, z + 22], [x - tx * L, y - ty * L, z + 22]], d.c2);
}

function drawLamp(ctx, d) {
    const z = d.z * CAM3D.ZS;
    proj(d.x, d.y, z, _p); proj(d.x, d.y, z + 48, _q);
    if (!_p.ok || !_q.ok) return;
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = Math.max(1, 2.2 * _p.k);
    ctx.beginPath(); ctx.moveTo(_p.x, _p.y); ctx.lineTo(_q.x, _q.y); ctx.stroke();
    ctx.fillStyle = '#fef9c3'; ctx.fillRect(_q.x - 4 * _q.k, _q.y - 1.5 * _q.k, 8 * _q.k, 3 * _q.k);
}

function drawStand(ctx, d) {
    const z = d.z * CAM3D.ZS, L = 90, tx = d.tx, ty = d.ty;
    const nx = -d.side * (-ty), ny = -d.side * tx;           // в сторону трассы
    const bx = d.x, by = d.y, dpt = 34;
    // крыша и задняя стенка
    projQuad(ctx, [[bx - tx * L - nx * dpt, by - ty * L - ny * dpt, z], [bx + tx * L - nx * dpt, by + ty * L - ny * dpt, z], [bx + tx * L - nx * dpt, by + ty * L - ny * dpt, z + 46], [bx - tx * L - nx * dpt, by - ty * L - ny * dpt, z + 46]], '#475569');
    // ряды зрителей (лицевая сторона)
    for (let r = 0; r < 4; r++) {
        const z1 = z + r * 9, z2 = z1 + 9;
        const col = `hsl(${(d.hue + r * 40) % 360}, 55%, ${34 + r * 5}%)`;
        projQuad(ctx, [[bx - tx * L, by - ty * L, z1], [bx + tx * L, by + ty * L, z1], [bx + tx * L, by + ty * L, z2], [bx - tx * L, by - ty * L, z2]], col);
    }
    projQuad(ctx, [[bx - tx * L - nx * dpt, by - ty * L - ny * dpt, z + 46], [bx + tx * L - nx * dpt, by + ty * L - ny * dpt, z + 46], [bx + tx * L + nx * 6, by + ty * L + ny * 6, z + 40], [bx - tx * L + nx * 6, by - ty * L + ny * 6, z + 40]], '#cbd5e1');
}

// ---------- главный рендер 3D-вида ----------
function renderChase3D(ctx, W, H) {
    const trk = TRACKS_DB[selectedTrackIndex];
    const theme = trk.theme || { grassBase: '#2e6b34', grassAlt: '#27602d' };
    const car = playerCar;
    setCamera(car);
    const speedFrac = cam.sp;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // крен камеры вокруг центра экрана
    ctx.translate(W / 2, H / 2); ctx.rotate(cam.roll); ctx.translate(-W / 2, -H / 2);

    // ground fill (с запасом под крен)
    ctx.fillStyle = '#2f6e35';
    ctx.fillRect(-160, -160, W + 320, H + 320);
    drawSky(ctx, W, H);

    const centerIdx = Math.max(0, car.lastSampleIdx);
    const st = buildStations(centerIdx);
    const drawList = [];

    if (st.length > 2) {
        const O = [-1300, -WALL_HALF_W - 1, -WALL_HALF_W + 2, -(CURB_OUTER_W + 14), -CURB_OUTER_W, -ASPHALT_HALF_W, -ASPHALT_HALF_W + 5, -ASPHALT_HALF_W + 9, -22, 22, ASPHALT_HALF_W - 9, ASPHALT_HALF_W - 5, ASPHALT_HALF_W, CURB_OUTER_W, CURB_OUTER_W + 14, WALL_HALF_W - 2, WALL_HALF_W + 1, 1300];
        const E = {};
        for (const o of O) E[o] = edgeLine(st, o);
        const WL0 = edgeLine(st, -WALL_HALF_W, 0), WL1 = edgeLine(st, -WALL_HALF_W, 4.5), WL2 = edgeLine(st, -WALL_HALF_W, CAM3D.ARMCO_H);
        const WR0 = edgeLine(st, WALL_HALF_W, 0), WR1 = edgeLine(st, WALL_HALF_W, 4.5), WR2 = edgeLine(st, WALL_HALF_W, CAM3D.ARMCO_H);
        const grassBase = '#2f6e35', grassAlt = '#2a6330';

        // Рисуем кусками от дальнего к ближнему: в шпильках ближний отбойник/трасса правильно перекрывают дальние
        const CH = 14, m = st.length;
        for (let kEnd = m - 1; kEnd > 0; kEnd -= CH) {
            const k0 = Math.max(0, kEnd - CH), k1 = kEnd;
            // 1. трава с полосами кошения
            strip(ctx, E[-1300], E[-WALL_HALF_W + 2], grassBase, k0, k1);
            strip(ctx, E[WALL_HALF_W - 2], E[1300], grassBase, k0, k1);
            altQuads(ctx, E[-1300], E[-WALL_HALF_W + 2], st, grassAlt, g => ((g >> 2) & 1) === 0, k0, k1);
            altQuads(ctx, E[WALL_HALF_W - 2], E[1300], st, grassAlt, g => ((g >> 2) & 1) === 0, k0, k1);
            // 2. зона вылета: трава потемнее у отбойника, песок у поребрика
            strip(ctx, E[-WALL_HALF_W + 2], E[-(CURB_OUTER_W + 14)], '#285a2d', k0, k1);
            strip(ctx, E[CURB_OUTER_W + 14], E[WALL_HALF_W - 2], '#285a2d', k0, k1);
            strip(ctx, E[-(CURB_OUTER_W + 14)], E[-CURB_OUTER_W], '#b9a77a', k0, k1);
            strip(ctx, E[CURB_OUTER_W], E[CURB_OUTER_W + 14], '#b9a77a', k0, k1);
            // 3. поребрики
            strip(ctx, E[-CURB_OUTER_W], E[-ASPHALT_HALF_W], '#d62828', k0, k1);
            strip(ctx, E[ASPHALT_HALF_W], E[CURB_OUTER_W], '#d62828', k0, k1);
            altQuads(ctx, E[-CURB_OUTER_W], E[-ASPHALT_HALF_W], st, '#f5f7fa', g => (g & 1) === 0, k0, k1);
            altQuads(ctx, E[ASPHALT_HALF_W], E[CURB_OUTER_W], st, '#f5f7fa', g => (g & 1) === 0, k0, k1);
            // 4. асфальт: тёмная «резиновая» траектория по центру, белые линии по краям
            strip(ctx, E[-ASPHALT_HALF_W], E[ASPHALT_HALF_W], '#323844', k0, k1);
            strip(ctx, E[-22], E[22], '#2a2f39', k0, k1);
            strip(ctx, E[-ASPHALT_HALF_W + 5], E[-ASPHALT_HALF_W + 9], 'rgba(255,255,255,0.72)', k0, k1);
            strip(ctx, E[ASPHALT_HALF_W - 9], E[ASPHALT_HALF_W - 5], 'rgba(255,255,255,0.72)', k0, k1);
            // 5. отбойник: тёмная нижняя часть + светлая верхняя планка
            strip(ctx, WL0, WL1, '#4b5668', k0, k1); strip(ctx, WL1, WL2, '#d7dde6', k0, k1);
            strip(ctx, WR0, WR1, '#4b5668', k0, k1); strip(ctx, WR1, WR2, '#d7dde6', k0, k1);
        }

        // линия старта/финиша и метки DRS
        const s0 = trackSamples[0], s2 = trackSamples[2];
        const ddx = s2.x - s0.x, ddy = s2.y - s0.y, dl = Math.hypot(ddx, ddy) || 1;
        const sdx = ddx / dl, sdy = ddy / dl;
        const cells = Math.floor((ASPHALT_HALF_W * 2) / 12);
        for (let i = 0; i < cells; i++) {
            const bx = s0.x + (-sdy) * (-ASPHALT_HALF_W + 6 + i * 12), by = s0.y + sdx * (-ASPHALT_HALF_W + 6 + i * 12), bz = s0.z * CAM3D.ZS + 0.3;
            groundQuadAt(ctx, bx - sdx * 5, by - sdy * 5, bz, sdx, sdy, 6, 5, i % 2 ? '#0b0f17' : '#f8fafc');
            groundQuadAt(ctx, bx + sdx * 5, by + sdy * 5, bz, sdx, sdy, 6, 5, i % 2 ? '#f8fafc' : '#0b0f17');
        }
        if (selectedCarClass === 'F1') {
            for (const mk of drsMarkerLines) groundQuadAt(ctx, mk.x, mk.y, (mk.z || 0) * CAM3D.ZS + 0.3, Math.sin(mk.angle), -Math.cos(mk.angle), ASPHALT_HALF_W - 4, 2.5, mk.color);
        }

        // 6. траектория (H)
        if (window.showRacingLine) {
            ctx.lineCap = 'round';
            let prev = null;
            for (let k = 0; k < st.length; k += 2) {
                const rp = dynamicRacingLinePoints[st[k].idx];
                proj(rp.x, rp.y, rp.z * CAM3D.ZS + 0.6, _p);
                if (prev && _p.ok) {
                    ctx.strokeStyle = rp.color; ctx.globalAlpha = 0.8;
                    ctx.lineWidth = Math.max(1.5, 4.5 * _p.k);
                    ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(_p.x, _p.y); ctx.stroke();
                }
                prev = _p.ok ? { x: _p.x, y: _p.y } : null;
            }
            ctx.globalAlpha = 1;
        }

        // 7. следы шин
        for (const sm of skidMarks) {
            proj(sm.x, sm.y, (car.elevationM || 0) * CAM3D.ZS + 0.5, _p);
            if (!_p.ok || _p.d > 1500) continue;
            ctx.fillStyle = `rgba(8,8,10,${Math.min(0.5, sm.life * 0.5)})`;
            ctx.fillRect(_p.x - 5 * _p.k, _p.y - 1.1 * _p.k, 3 * _p.k, 2.2 * _p.k);
            ctx.fillRect(_p.x + 3 * _p.k, _p.y - 1.1 * _p.k, 3 * _p.k, 2.2 * _p.k);
        }

        // 8. тени машин
        const tmpD = { x: 0, y: 0, d: 0, k: 0, ok: false };
        for (const c of allCars) {
            proj(c.x, c.y, (c.elevationM || 0) * CAM3D.ZS, tmpD);
            if (tmpD.ok && tmpD.d < 2600) drawCarShadow(ctx, c);
        }

        // объекты вдоль трассы — в общий список с машинами (сортировка по глубине)
        const N = totalSamples;
        for (const d of envDecorations) {
            const rel = (d.idx - centerIdx + N) % N;
            if (rel > (cam.AH || 90) && rel < N - (cam.BH || 8)) continue;
            proj(d.x, d.y, d.z * CAM3D.ZS, _p);
            if (!_p.ok || _p.d > 6200) continue;
            drawList.push({ d: _p.d, deco: d });
        }
    }

    for (const c of allCars) {
        proj(c.x, c.y, (c.elevationM || 0) * CAM3D.ZS, _p);
        if (_p.ok && _p.d < 5200) drawList.push({ d: _p.d, car: c });
    }
    drawList.sort((a, b) => b.d - a.d);
    for (const it of drawList) {
        if (it.car) {
            // ближние машины — полноценная 3D-модель (с текстурой ливреи у самых близких), дальние — слои спрайта
            const info = (it.d < 1700 && typeof drawCarModel3D === 'function')
                ? drawCarModel3D(ctx, it.car, it.d < 700)
                : drawCar3D(ctx, it.car);
            if (it.car !== playerCar && it.d < 900) drawTag(ctx, it.car, info);
        } else {
            const d = it.deco;
            if (d.type === 'tree') drawTree(ctx, d);
            else if (d.type === 'board') drawBoard(ctx, d);
            else if (d.type === 'lamp') drawLamp(ctx, d);
            else if (d.type === 'stand') drawStand(ctx, d);
        }
    }

    drawHaze(ctx, W);

    // искры
    for (const s of sparks) {
        proj(s.x, s.y, (car.elevationM || 0) * CAM3D.ZS + 6, _p);
        if (!_p.ok) continue;
        ctx.fillStyle = `rgba(255,${Math.round(150 + 100 * s.life)},60,${s.life})`;
        ctx.fillRect(_p.x - 2 * _p.k, _p.y - 2 * _p.k, 4 * _p.k, 4 * _p.k);
    }

    // линии скорости по краям экрана
    if (speedFrac > 0.45) {
        const a = Math.min(0.22, (speedFrac - 0.45) * 0.45);
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = 1.2;
        const t = performance.now() / 1000;
        for (let i = 0; i < 22; i++) {
            const ang = (i / 22) * Math.PI * 2 + 0.13;
            const ph = ((t * (1.4 + (i % 5) * 0.3) + i * 0.37) % 1);
            const r0 = 360 + ph * 360, r1 = r0 + 60 + speedFrac * 70;
            const cx = W / 2, cy = H * 0.52;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(ang) * r0 * 1.2, cy + Math.sin(ang) * r0 * 0.8);
            ctx.lineTo(cx + Math.cos(ang) * r1 * 1.2, cy + Math.sin(ang) * r1 * 0.8);
            ctx.stroke();
        }
    }
    ctx.restore();
}
