// ============================================================================
// carmodel.js — процедурная 3D-модель машины (GT3 и Ф-1) для вида из-за машины.
//
//  • корпус строится по поперечным сечениям (лофтинг): днище, пороги, пояс кузова,
//    остекление/крыша — получаются настоящие боковины, капот, лобовое стекло, задняя часть;
//  • колёса — 10-гранные призмы с ободом и вращающимися спицами, передние поворачиваются;
//  • GT3: антикрыло на стойках с пластинами, сплиттер, фары, стоп-сигналы;
//  • Ф-1: переднее и заднее крыло с пластинами, подвеска, гало, шлем пилота, воздухозаборник;
//  • верхние поверхности текстурируются вашей картинкой «вид сверху» (проекция в плане),
//    поэтому ливреи сохраняются; боковины и детали окрашены цветом ливреи, освещение — по нормалям.
// Грани сортируются по глубине (алгоритм художника), невидимые отсекаются.
// ============================================================================

const CAR_MODELS = {};
const spriteInfo = {};          // id -> { grid, cols, rows, body:[r,g,b] }

const GT3_SECTIONS = [
    // t,    hwB,  hwBelt, hwRoof, zB,   zBelt, zRoof
    [0.00, 0.78, 0.80, 0.70, 0.12, 0.48, 0.52],
    [0.04, 0.86, 0.90, 0.76, 0.10, 0.52, 0.56],
    [0.16, 0.92, 0.97, 0.82, 0.08, 0.56, 0.62],
    [0.30, 0.93, 1.00, 0.80, 0.08, 0.58, 0.66],
    [0.38, 0.93, 1.00, 0.74, 0.08, 0.60, 0.86],
    [0.50, 0.93, 1.00, 0.72, 0.08, 0.60, 1.00],
    [0.62, 0.93, 1.00, 0.72, 0.08, 0.60, 0.98],
    [0.70, 0.93, 0.99, 0.76, 0.08, 0.60, 0.70],
    [0.80, 0.92, 0.97, 0.82, 0.08, 0.56, 0.62],
    [0.92, 0.86, 0.90, 0.74, 0.08, 0.50, 0.54],
    [0.98, 0.76, 0.78, 0.64, 0.10, 0.42, 0.46],
    [1.00, 0.62, 0.64, 0.52, 0.14, 0.34, 0.38]
];
const F1_SECTIONS = [
    [0.00, 0.12, 0.16, 0.10, 0.30, 0.42, 0.46],
    [0.10, 0.20, 0.28, 0.16, 0.24, 0.42, 0.52],
    [0.22, 0.28, 0.42, 0.20, 0.16, 0.38, 0.70],
    [0.32, 0.31, 0.50, 0.21, 0.14, 0.38, 0.88],
    [0.40, 0.33, 0.55, 0.23, 0.12, 0.36, 0.60],
    [0.48, 0.33, 0.57, 0.25, 0.12, 0.34, 0.42],
    [0.58, 0.31, 0.55, 0.25, 0.12, 0.32, 0.38],
    [0.68, 0.26, 0.47, 0.21, 0.12, 0.30, 0.34],
    [0.80, 0.15, 0.25, 0.14, 0.12, 0.24, 0.30],
    [0.92, 0.09, 0.12, 0.08, 0.12, 0.19, 0.23],
    [1.00, 0.06, 0.07, 0.05, 0.14, 0.17, 0.19]
];

// Индивидуальные пропорции GT3. Раньше все машины отличались в основном
// ливреей, а сетка кузова была общей. Эти коэффициенты меняют узнаваемый
// силуэт: длину капота, ширину носа/кормы, высоту и ширину фонаря крыши.
const GT3_MODEL_TUNING = {
    aston_gt3:    { length: 1.04, width: 0.98, height: 0.98, roof: 0.94, nose: 0.96, rear: 1.00 },
    audi_gt3:     { length: 0.98, width: 1.03, height: 1.02, roof: 1.01, nose: 1.03, rear: 1.02 },
    bmw_gt3:      { length: 1.05, width: 1.00, height: 1.05, roof: 0.97, nose: 1.04, rear: 0.99 },
    corvette_gt3: { length: 1.06, width: 1.04, height: 0.90, roof: 0.87, nose: 1.07, rear: 1.02 },
    ferrari_gt3:  { length: 0.98, width: 1.03, height: 0.91, roof: 0.86, nose: 0.97, rear: 1.07 },
    mustang_gt3:  { length: 1.07, width: 1.03, height: 1.03, roof: 0.96, nose: 1.06, rear: 1.00 },
    lambo_gt3:    { length: 0.97, width: 1.05, height: 0.86, roof: 0.82, nose: 0.96, rear: 1.08 },
    lexus_gt3:    { length: 1.05, width: 1.00, height: 1.00, roof: 0.94, nose: 1.04, rear: 1.00 },
    mclaren_gt3:  { length: 0.96, width: 1.04, height: 0.88, roof: 0.84, nose: 0.94, rear: 1.09 },
    mercedes_gt3: { length: 1.06, width: 1.01, height: 1.01, roof: 0.94, nose: 1.06, rear: 0.99 },
    porsche_gt3:  { length: 0.94, width: 1.03, height: 0.97, roof: 0.92, nose: 0.92, rear: 1.13 },
    bentley_gt3:  { length: 1.07, width: 1.07, height: 1.08, roof: 1.03, nose: 1.03, rear: 1.05 }
};

function catmullSection(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return p1.map((v, c) => {
        if (c === 0) return p1[0] + (p2[0] - p1[0]) * t;
        return 0.5 * (2 * v + (-p0[c] + p2[c]) * t +
            (2 * p0[c] - 5 * v + 4 * p2[c] - p3[c]) * t2 +
            (-p0[c] + 3 * v - 3 * p2[c] + p3[c]) * t3);
    });
}

function tuneGt3Section(source, tuning) {
    const s = source.slice(), t = s[0];
    const noseBlend = Math.max(0, Math.min(1, (t - 0.68) / 0.32));
    const rearBlend = Math.max(0, Math.min(1, (0.28 - t) / 0.28));
    const endWidth = 1 + (tuning.nose - 1) * noseBlend + (tuning.rear - 1) * rearBlend;
    s[1] *= endWidth; s[2] *= endWidth;
    s[3] *= tuning.roof;
    // Низкий клиновидный нос у среднемоторных машин и более высокий капот
    // у переднемоторных задаются тем же nose-коэффициентом.
    s[5] *= 1 + (tuning.nose - 1) * noseBlend * 0.45;
    s[6] *= 1 + (tuning.roof - 1) * (1 - noseBlend * 0.65);
    return s;
}

// ---------- цвета кузова и сетка цветов из спрайта ----------
function computeSpriteInfo(id) {
    if (spriteInfo[id]) return spriteInfo[id];
    const img = spriteImgs[id];
    if (!img) return null;
    const cols = 12, rows = 28;
    const c = document.createElement('canvas'); c.width = cols; c.height = rows;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, cols, rows);
    const d = g.getImageData(0, 0, cols, rows).data;
    const grid = new Array(cols * rows);
    let sr = 0, sg = 0, sb = 0, sw = 0;
    for (let i = 0; i < cols * rows; i++) {
        const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3] / 255;
        grid[i] = [r, gg, b, a];
        const lum = (0.3 * r + 0.59 * gg + 0.11 * b) / 255;
        const sat = Math.max(r, gg, b) - Math.min(r, gg, b);
        if (a > 0.85 && lum > 0.14 && (sat > 40 || lum > 0.55)) { const w = 1 + sat / 80; sr += r * w; sg += gg * w; sb += b * w; sw += w; }
    }
    const body = sw > 0 ? [sr / sw, sg / sw, sb / sw] : [120, 120, 130];
    return (spriteInfo[id] = { grid, cols, rows, body });
}

function gridColor(info, u, v) {         // u,v в долях 0..1 по картинке
    const cx = Math.max(0, Math.min(info.cols - 1, Math.floor(u * info.cols)));
    const cy = Math.max(0, Math.min(info.rows - 1, Math.floor(v * info.rows)));
    const p = info.grid[cy * info.cols + cx];
    return p[3] > 0.5 ? p : null;
}

// ---------- построение модели ----------
function crossSection(sec, W, H, y) {
    const hw = W / 2;
    const hwB = sec[1] * hw, hwBelt = sec[2] * hw, hwRoof = sec[3] * hw;
    const zB = sec[4] * H, zBelt = sec[5] * H, zRoof = sec[6] * H;
    const xs = hwB + (hwBelt - hwB) * 0.4, zs = zB + (zBelt - zB) * 0.38;
    return [
        [-hwB, y, zB], [-xs, y, zs], [-hwBelt, y, zBelt], [-hwRoof, y, zRoof],
        [hwRoof, y, zRoof], [hwBelt, y, zBelt], [xs, y, zs], [hwB, y, zB]
    ];
}

function buildCarModel(car) {
    const isF1 = car.spec.carClass === 'F1';
    const img = spriteImgs[car.spec.id];
    const tuning = isF1 ? { length: 1, width: 1, height: 1, roof: 1, nose: 1, rear: 1 }
                        : (GT3_MODEL_TUNING[car.spec.id] || { length: 1, width: 1, height: 1, roof: 1, nose: 1, rear: 1 });
    const L = car.height * 1.16 * tuning.length;
    const aspect = img ? img.width / img.height : (isF1 ? 0.43 : 0.45);
    const W = L * aspect * tuning.width;
    const H = (isF1 ? 10.5 : 13.5) * tuning.height;
    const prof0 = isF1 ? F1_SECTIONS : GT3_SECTIONS;
    const prof = [];
    for (let i = 0; i < prof0.length; i++) {
        const addSection = (section) => prof.push(isF1 ? section : tuneGt3Section(section, tuning));
        addSection(prof0[i]);
        if (i < prof0.length - 1) {
            const p0 = prof0[Math.max(0, i - 1)], p1 = prof0[i], p2 = prof0[i + 1], p3 = prof0[Math.min(prof0.length - 1, i + 2)];
            // Две сглаженные промежуточные секции вместо одной: кузов получает
            // примерно на 50% больше полигонов вдоль силуэта.
            addSection(catmullSection(p0, p1, p2, p3, 1 / 3));
            addSection(catmullSection(p0, p1, p2, p3, 2 / 3));
        }
    }
    const rearOff = isF1 ? 0.06 : 0.07, frontOff = isF1 ? 0.075 : 0.01;
    const y0 = -L / 2 + rearOff * L, y1 = L / 2 - frontOff * L;

    const verts = [], faces = [], lines = [];
    const addV = (x, y, z) => { verts.push([x, y, z]); return verts.length - 1; };
    const sec = [];
    for (const s of prof) {
        const pts = crossSection(s, W * (isF1 ? 1 : 0.97), H, y0 + s[0] * (y1 - y0));
        sec.push(pts.map(p => addV(p[0], p[1], p[2])));
    }
    const cabin = (i) => (prof[i][6] - prof[i][5]) > 0.14;
    const kindOfEdge = (e, i) => {
        if (e === 0 || e === 6) return 'sill';
        if (e === 1 || e === 5) return 'side';
        if (e === 3) return 'top';
        // e === 2 | 4 : верхняя часть боковины
        if (!isF1 && cabin(i) && cabin(i + 1)) return 'glass';
        return 'upper';
    };
    for (let i = 0; i < sec.length - 1; i++) {
        for (let e = 0; e < 7; e++) {
            faces.push({ v: [sec[i][e], sec[i][e + 1], sec[i + 1][e + 1], sec[i + 1][e]], kind: kindOfEdge(e, i) });
        }
    }
    faces.push({ v: sec[0].slice().reverse(), kind: 'rear' });
    faces.push({ v: sec[sec.length - 1].slice(), kind: 'front' });

    // горизонтальная пластина (крыло/сплиттер) с текстурой
    const plate = (x0, x1, ya, yb, z, kind) => {
        const a = addV(x0, ya, z), b = addV(x1, ya, z), c = addV(x1, yb, z), d = addV(x0, yb, z);
        faces.push({ v: [a, b, c, d], kind: kind || 'wing', up: true });
    };
    // вертикальная пластина (боковина крыла, стойка)
    const vplate = (x, ya, yb, za, zb, kind) => {
        const a = addV(x, ya, za), b = addV(x, yb, za), c = addV(x, yb, zb), d = addV(x, ya, zb);
        faces.push({ v: [a, d, c, b], kind: kind || 'dark', two: true });
    };
    const light = (cxp, y, z, w, h, kind, dir) => {
        const a = addV(cxp - w / 2, y, z - h / 2), b = addV(cxp + w / 2, y, z - h / 2), c = addV(cxp + w / 2, y, z + h / 2), d = addV(cxp - w / 2, y, z + h / 2);
        faces.push({ v: dir > 0 ? [a, b, c, d] : [b, a, d, c], kind, light: true });
    };

    const wheels = [];
    const arms = [];
    if (!isF1) {
        // антикрыло GT3 на стойках, пластины, сплиттер
        const wy0 = -L / 2, wy1 = -L / 2 + 0.085 * L, wz = H * 0.98, wx = W * 0.47;
        plate(-wx, wx, wy0, wy1, wz, 'wing');
        vplate(-wx, wy0, wy1, H * 0.80, H * 1.08);
        vplate(wx, wy0, wy1, H * 0.80, H * 1.08);
        for (const sx of [-W * 0.2, W * 0.2]) vplate(sx, (wy0 + wy1) / 2 - 0.4, (wy0 + wy1) / 2 + 0.4, H * 0.56, wz - 0.2);
        plate(-W * 0.40, W * 0.40, L / 2 - 0.035 * L, L / 2 + 0.012 * L, H * 0.07, 'dark');
        // стоп-сигналы и фары
        const rz = H * 0.50, fz = H * 0.40;
        light(-W * 0.30, y0 - 0.15, rz, W * 0.22, H * 0.09, 'tail', -1); light(W * 0.30, y0 - 0.15, rz, W * 0.22, H * 0.09, 'tail', -1);
        light(-W * 0.28, y1 + 0.15, fz, W * 0.22, H * 0.08, 'head', 1); light(W * 0.28, y1 + 0.15, fz, W * 0.22, H * 0.08, 'head', 1);
        const wr = 3.9, wwid = 3.4, wxo = W / 2 - 1.1;
        wheels.push({ x: -wxo, y: L * 0.285, z: wr, r: wr, w: wwid, front: true }, { x: wxo, y: L * 0.285, z: wr, r: wr, w: wwid, front: true },
                    { x: -wxo, y: -L * 0.255, z: wr, r: wr + 0.2, w: wwid + 0.4, front: false }, { x: wxo, y: -L * 0.255, z: wr, r: wr + 0.2, w: wwid + 0.4, front: false });
    } else {
        // заднее крыло Ф-1: основная плоскость, нижний элерон, пластины, стойка
        const wy0 = -L / 2, wy1 = -L / 2 + 0.075 * L;
        plate(-W * 0.36, W * 0.36, wy0, wy1, H * 0.80, 'wing');
        plate(-W * 0.30, W * 0.30, wy0 + 0.5, wy1 - 0.2, H * 0.50, 'wing');
        vplate(-W * 0.36, wy0, wy1, H * 0.46, H * 1.02);
        vplate(W * 0.36, wy0, wy1, H * 0.46, H * 1.02);
        vplate(0, wy0 + 1.0, wy1 - 0.6, H * 0.42, H * 0.80);
        // переднее крыло
        const fy0 = L / 2 - 0.075 * L, fy1 = L / 2;
        plate(-W * 0.49, W * 0.49, fy0, fy1, H * 0.13, 'wing');
        plate(-W * 0.34, W * 0.34, fy0 + 0.6, fy1 - 0.3, H * 0.23, 'wing');
        vplate(-W * 0.49, fy0, fy1, H * 0.06, H * 0.34);
        vplate(W * 0.49, fy0, fy1, H * 0.06, H * 0.34);
        // огни
        light(0, y0 - 0.1, H * 0.40, W * 0.10, H * 0.07, 'tail', -1);
        // колёса
        const rr = 4.6, rw = 5.0, fr = 4.0, fw = 4.2;
        const rxo = W / 2 - rw / 2 + 0.2, fxo = W / 2 - fw / 2 + 0.2;
        wheels.push({ x: -fxo, y: L * 0.30, z: fr, r: fr, w: fw, front: true }, { x: fxo, y: L * 0.30, z: fr, r: fr, w: fw, front: true },
                    { x: -rxo, y: -L * 0.23, z: rr, r: rr, w: rw, front: false }, { x: rxo, y: -L * 0.23, z: rr, r: rr, w: rw, front: false });
        // подвеска: рычаги от корпуса к ступицам
        for (const w of wheels) {
            const sx = Math.sign(w.x), hubx = w.x - sx * w.w / 2;
            const bx = sx * W * 0.07;
            arms.push({ a: [bx, w.y + 2.2, H * 0.30], b: [hubx, w.y, w.z + 0.8], width: 0.9 });
            arms.push({ a: [bx, w.y - 2.2, H * 0.24], b: [hubx, w.y, w.z - 0.6], width: 0.9 });
        }
        // гало: тонкая рама над кокпитом
        const hy = y0 + 0.50 * (y1 - y0);
        const hzb = H * 0.36, hzt = H * 0.56;
        arms.push({ a: [-W * 0.085, hy - 2.6, hzb], b: [-W * 0.07, hy + 1.0, hzt], width: 0.9, color: '#14161b' });
        arms.push({ a: [W * 0.085, hy - 2.6, hzb], b: [W * 0.07, hy + 1.0, hzt], width: 0.9, color: '#14161b' });
        arms.push({ a: [-W * 0.07, hy + 1.0, hzt], b: [W * 0.07, hy + 1.0, hzt], width: 0.9, color: '#14161b' });
        arms.push({ a: [0, hy + 1.0, hzt], b: [0, hy + 4.2, H * 0.32], width: 0.9, color: '#14161b' });
    }

    // нормали: наружу от центра корпуса
    const cen = [0, (y0 + y1) / 2, H * 0.35];
    for (const f of faces) {
        const a = verts[f.v[0]], b = verts[f.v[1]], c = verts[f.v[2]];
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        const fc = [0, 0, 0];
        for (const i of f.v) { fc[0] += verts[i][0]; fc[1] += verts[i][1]; fc[2] += verts[i][2]; }
        fc[0] /= f.v.length; fc[1] /= f.v.length; fc[2] /= f.v.length;
        if (f.up) {
            // горизонтальная пластина: нормаль вверх, порядок вершин — против часовой при взгляде сверху
            if (nz < 0) f.v.reverse();
            nx = 0; ny = 0; nz = 1;
        } else if (!f.two) {
            const dir = (fc[0] - cen[0]) * nx + (fc[1] - cen[1]) * ny + (fc[2] - cen[2]) * nz;
            if (dir < 0) { nx = -nx; ny = -ny; nz = -nz; f.v.reverse(); }
        }
        f.n = [nx, ny, nz];
        f.c = fc;
        f.tex = (f.kind === 'top' || f.kind === 'upper' || f.kind === 'wing') && nz > 0.1;
        if (f.kind === 'glass' && nz > 0.55) f.tex = true;      // лобовое/заднее стекло — из текстуры
    }
    return { isF1, L, W, H, verts, faces, wheels, arms, y0, y1 };
}

// ---------- освещение ----------
const SUN = (() => { const l = Math.hypot(-0.35, -0.45, 0.82); return [-0.35 / l, -0.45 / l, 0.82 / l]; })();
function shadeOf(n) { return 0.56 + 0.50 * Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]); }
function rgb(c, s) { return `rgb(${Math.min(255, c[0] * s) | 0},${Math.min(255, c[1] * s) | 0},${Math.min(255, c[2] * s) | 0})`; }

// аффинное отображение текстуры на треугольник
function texTri(ctx, img, S0, S1, S2, T0, T1, T2) {
    const du1 = T1[0] - T0[0], dv1 = T1[1] - T0[1], du2 = T2[0] - T0[0], dv2 = T2[1] - T0[1];
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-6) return;
    const dx1 = S1[0] - S0[0], dy1 = S1[1] - S0[1], dx2 = S2[0] - S0[0], dy2 = S2[1] - S0[1];
    const a = (dx1 * dv2 - dx2 * dv1) / det, c = (dx2 * du1 - dx1 * du2) / det;
    const b = (dy1 * dv2 - dy2 * dv1) / det, d = (dy2 * du1 - dy1 * du2) / det;
    const e = S0[0] - a * T0[0] - c * T0[1], f = S0[1] - b * T0[0] - d * T0[1];
    ctx.save();
    // чуть расширяем треугольник, чтобы не было щелей между гранями
    const mx = (S0[0] + S1[0] + S2[0]) / 3, my = (S0[1] + S1[1] + S2[1]) / 3;
    const ex = (p) => [p[0] + Math.sign(p[0] - mx) * 0.6, p[1] + Math.sign(p[1] - my) * 0.6];
    const A = ex(S0), B = ex(S1), C = ex(S2);
    ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(C[0], C[1]); ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
}

// ---------- кадр: рисуем модель ----------
const _w = [0, 0, 0];
function drawCarModel3D(ctx, car, texNear) {
    const id = car.spec.id;
    const img = spriteImgs[id];
    if (!img) return null;
    const info = computeSpriteInfo(id);
    let m = CAR_MODELS[id];
    if (!m) m = CAR_MODELS[id] = buildCarModel(car);

    const A = car.angle, ca = Math.cos(A), sa = Math.sin(A);
    const rollA = (car.bodyRoll || 0) * 0.10, pitA = (car.bodyPitch || 0) * 0.30;
    const cr = Math.cos(rollA), sr = Math.sin(rollA), cp = Math.cos(pitA), sp = Math.sin(pitA);
    const z0 = (car.elevationM || 0) * CAM3D.ZS + 0.4;
    const F = CAM3D.F, cx = CAM3D.cx, cy = CAM3D.cy, near = CAM3D.near;

    // локальные → мировые (крен вокруг оси Y, тангаж вокруг оси X, затем курс)
    const wv = (x, y, z) => {
        const x1 = x * cr - z * sr, z1 = x * sr + z * cr;
        const y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        return [car.x + ca * x1 + sa * y1, car.y + sa * x1 - ca * y1, z0 + z2];
    };
    const wn = (x, y, z) => {
        const x1 = x * cr - z * sr, z1 = x * sr + z * cr;
        const y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        return [ca * x1 + sa * y1, sa * x1 - ca * y1, z2];
    };
    const camP = (w) => {
        const dx = w[0] - cam.x, dy = w[1] - cam.y, up = w[2] - cam.z;
        const fwd = dx * cam.fx + dy * cam.fy;
        const d = fwd * cam.cosP - up * cam.sinP;
        const yc = fwd * cam.sinP + up * cam.cosP;
        const lat = dx * cam.rx + dy * cam.ry;
        const k = F / Math.max(d, 1e-3);
        return { x: cx + lat * k, y: cy - yc * k, d, k };
    };

    const bodyC = info ? info.body : [120, 120, 130];
    const items = [];

    // --- корпус ---
    const V = m.verts.map(v => { const w = wv(v[0], v[1], v[2]); return { w, p: camP(w) }; });
    const camPos = [cam.x, cam.y, cam.z];
    const braking = !!car.braking;
    for (const f of m.faces) {
        const n = wn(f.n[0], f.n[1], f.n[2]);
        const fc = wv(f.c[0], f.c[1], f.c[2]);
        const vis = (camPos[0] - fc[0]) * n[0] + (camPos[1] - fc[1]) * n[1] + (camPos[2] - fc[2]) * n[2];
        if (!f.two && vis <= 0) continue;
        let dsum = 0, ok = true;
        for (const i of f.v) { const p = V[i].p; if (p.d < near) { ok = false; break; } dsum += p.d; }
        if (!ok) continue;
        items.push({ d: dsum / f.v.length, f, n, kindObj: 'face' });
    }

    // --- колёса (пересчитываются каждый кадр: поворот и вращение) ---
    // Знак локальной оси X модели противоположен знаку yaw в физике:
    // без минуса передние колёса визуально поворачивались в другую сторону.
    const steer = -(car.smoothSteer || 0) * 0.42;
    car._wp = (car._wp || 0) + Math.hypot(car.dx, car.dy) / 4.0 * (car.velocity < 0 ? -1 : 1);
    // 16 сегментов вместо 10: шины остаются недорогими для Canvas,
    // но в близком 3D-виде уже не выглядят десятиугольными.
    const NS = 16;
    const lateralCamSide = ((cam.x - car.x) * ca + (cam.y - car.y) * sa);      // + : камера справа от машины
    for (const wh of m.wheels) {
        const cs = Math.cos(wh.front ? steer : 0), ss = Math.sin(wh.front ? steer : 0);
        const ring = (side) => {
            const arr = [];
            for (let j = 0; j < NS; j++) {
                const th = (j / NS) * Math.PI * 2;
                const ly = Math.cos(th) * wh.r, lz = Math.sin(th) * wh.r;
                // поворот колеса вокруг вертикали
                const px = -ly * ss, py = ly * cs;
                const w = wv(wh.x + side * wh.w / 2 + px, wh.y + py, wh.z + lz);
                arr.push({ w, p: camP(w) });
            }
            return arr;
        };
        const outerSide = Math.sign(wh.x) || 1;
        const rin = ring(-outerSide), rout = ring(outerSide);
        const nearSide = (lateralCamSide * outerSide > 0) ? -90 : 90;            // ближняя к камере сторона рисуется позже
        const cenW = wv(wh.x, wh.y, wh.z);
        for (let j = 0; j < NS; j++) {
            const j2 = (j + 1) % NS;
            const thm = ((j + 0.5) / NS) * Math.PI * 2;
            const ly = Math.cos(thm), lz = Math.sin(thm);
            const nl = wn(-ly * ss, ly * cs, lz);
            const mid = [(rin[j].w[0] + rout[j2].w[0]) / 2, (rin[j].w[1] + rout[j2].w[1]) / 2, (rin[j].w[2] + rout[j2].w[2]) / 2];
            if ((camPos[0] - mid[0]) * nl[0] + (camPos[1] - mid[1]) * nl[1] + (camPos[2] - mid[2]) * nl[2] <= 0) continue;
            const pts = [rin[j].p, rout[j].p, rout[j2].p, rin[j2].p];
            if (pts.some(p => p.d < near)) continue;
            items.push({ d: (pts[0].d + pts[1].d + pts[2].d + pts[3].d) / 4 + nearSide, kindObj: 'tread', pts, n: nl });
        }
        // наружная крышка колеса с ободом и спицами
        const ncap = wn(outerSide, 0, 0);
        const capC = wv(wh.x + outerSide * wh.w / 2, wh.y, wh.z);
        if ((camPos[0] - capC[0]) * ncap[0] + (camPos[1] - capC[1]) * ncap[1] + (camPos[2] - capC[2]) * ncap[2] > 0) {
            const pts = rout.map(o => o.p);
            if (!pts.some(p => p.d < near)) {
                const cp0 = camP(capC);
                items.push({ d: cp0.d + nearSide - 1, kindObj: 'cap', pts, c: cp0, rim: rout, n: ncap, wh, ss, cs, capW: capC });
            }
        }
        // внутренняя крышка: видна у дальнего от камеры колеса
        const ncapI = wn(-outerSide, 0, 0);
        const capI = wv(wh.x - outerSide * wh.w / 2, wh.y, wh.z);
        if ((camPos[0] - capI[0]) * ncapI[0] + (camPos[1] - capI[1]) * ncapI[1] + (camPos[2] - capI[2]) * ncapI[2] > 0) {
            const pts = rin.map(o => o.p);
            if (!pts.some(p => p.d < near)) items.push({ d: camP(capI).d + nearSide + 1, kindObj: 'capin', pts, n: ncapI });
        }
    }

    // --- рычаги подвески, гало ---
    for (const ar of m.arms) {
        const a = wv(ar.a[0], ar.a[1], ar.a[2]), b = wv(ar.b[0], ar.b[1], ar.b[2]);
        const pa = camP(a), pb = camP(b);
        if (pa.d < near || pb.d < near) continue;
        items.push({ d: (pa.d + pb.d) / 2 - 2, kindObj: 'line', pa, pb, ar });
    }

    items.sort((x, y) => y.d - x.d);

    // --- рисование ---
    // Мягкая контактная тень привязывает машину к асфальту. Раньше кузов
    // визуально «висел», из-за чего даже объёмная модель казалась плоским спрайтом.
    const shadowCorners = [
        wv(-m.W * 0.48, -m.L * 0.40, 0.05), wv(m.W * 0.48, -m.L * 0.40, 0.05),
        wv(m.W * 0.44, m.L * 0.40, 0.05), wv(-m.W * 0.44, m.L * 0.40, 0.05)
    ].map(camP);
    if (shadowCorners.every(p => p.d > near)) {
        ctx.save();
        ctx.beginPath(); ctx.moveTo(shadowCorners[0].x, shadowCorners[0].y);
        for (let i = 1; i < shadowCorners.length; i++) ctx.lineTo(shadowCorners[i].x, shadowCorners[i].y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.27)';
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = Math.max(2, 4.5 * shadowCorners[0].k);
        ctx.fill();
        ctx.restore();
    }

    const lightFlash = braking ? 1 : 0.35;
    for (const it of items) {
        if (it.kindObj === 'face') {
            const f = it.f, sh = shadeOf(it.n);
            const P = f.v.map(i => V[i].p);
            let col;
            if (f.kind === 'sill') col = [22, 24, 30];
            else if (f.kind === 'dark') col = [20, 22, 27];
            else if (f.kind === 'glass') col = [12, 18, 26];
            else if (f.kind === 'tail') col = braking ? [255, 40, 40] : [120, 12, 12];
            else if (f.kind === 'head') col = [235, 244, 255];
            else col = bodyC;
            let base;
            if (f.kind === 'tail' || f.kind === 'head') base = `rgb(${col[0]},${col[1]},${col[2]})`;
            else base = rgb(col, sh);
            // плоская окраска верхних граней цветом из спрайта (LOD)
            if (f.tex && !texNear && info) {
                const u = (f.c[0] / m.W + 0.5), vv = (0.5 - f.c[1] / m.L);
                const gc = gridColor(info, u, vv);
                if (gc) base = rgb(gc, sh);
            }
            ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y);
            for (let i = 1; i < P.length; i++) ctx.lineTo(P[i].x, P[i].y);
            ctx.closePath();
            ctx.fillStyle = base; ctx.fill();
            if (f.kind === 'tail' && braking) { ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0; }
            if (f.tex && texNear) {
                // текстура картинки «сверху», проекция в плане
                const W = m.W, L = m.L, iw = img.width, ih = img.height;
                const uv = (i) => { const v = m.verts[i]; return [(v[0] / W + 0.5) * iw, (0.5 - v[1] / L) * ih]; };
                for (let t = 1; t < f.v.length - 1; t++) {
                    texTri(ctx, img, [P[0].x, P[0].y], [P[t].x, P[t].y], [P[t + 1].x, P[t + 1].y], uv(f.v[0]), uv(f.v[t]), uv(f.v[t + 1]));
                }
                // затенение по нормали поверх текстуры
                const a = (1 - sh) * 0.62;
                if (a > 0.02) {
                    ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y);
                    for (let i = 1; i < P.length; i++) ctx.lineTo(P[i].x, P[i].y);
                    ctx.closePath(); ctx.fillStyle = `rgba(4,6,12,${a})`; ctx.fill();
                }
            }
            // Лаковый блик и холодный отблеск стекла. Полупрозрачный градиент
            // сохраняет ливрею, но добавляет материалу глубину и читаемую форму.
            if (f.kind === 'top' || f.kind === 'upper' || f.kind === 'glass') {
                let minY = P[0].y, maxY = P[0].y;
                for (const p of P) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
                const gloss = ctx.createLinearGradient(0, minY, 0, Math.max(minY + 1, maxY));
                if (f.kind === 'glass') {
                    gloss.addColorStop(0, 'rgba(130,190,225,0.30)');
                    gloss.addColorStop(0.35, 'rgba(40,80,110,0.10)');
                    gloss.addColorStop(1, 'rgba(0,5,12,0.42)');
                } else {
                    gloss.addColorStop(0, 'rgba(255,255,255,0.22)');
                    gloss.addColorStop(0.28, 'rgba(255,255,255,0.04)');
                    gloss.addColorStop(1, 'rgba(0,0,0,0.13)');
                }
                ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y);
                for (let i = 1; i < P.length; i++) ctx.lineTo(P[i].x, P[i].y);
                ctx.closePath(); ctx.fillStyle = gloss; ctx.fill();
            }
            // тонкий контур: «картунный» стиль как у исходных спрайтов
            if (f.kind !== 'tail' && f.kind !== 'head' && !f.tex) {
                // контур только у боковин и деталей; текстурированные верхние поверхности без швов
                ctx.strokeStyle = (f.kind === 'side' || f.kind === 'sill') ? 'rgba(6,8,12,0.16)' : 'rgba(6,8,12,0.4)';
                ctx.lineWidth = Math.max(0.4, 0.28 * P[0].k);
                ctx.stroke();
            }
        } else if (it.kindObj === 'tread') {
            const sh = shadeOf(it.n);
            ctx.beginPath(); ctx.moveTo(it.pts[0].x, it.pts[0].y);
            for (let i = 1; i < 4; i++) ctx.lineTo(it.pts[i].x, it.pts[i].y);
            ctx.closePath(); ctx.fillStyle = rgb([28, 30, 36], 0.5 + sh * 0.7); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.5; ctx.stroke();
        } else if (it.kindObj === 'capin') {
            ctx.beginPath(); ctx.moveTo(it.pts[0].x, it.pts[0].y);
            for (let i = 1; i < it.pts.length; i++) ctx.lineTo(it.pts[i].x, it.pts[i].y);
            ctx.closePath(); ctx.fillStyle = rgb([16, 17, 21], 0.55 + shadeOf(it.n) * 0.5); ctx.fill();
        } else if (it.kindObj === 'cap') {
            const sh = shadeOf(it.n);
            ctx.beginPath(); ctx.moveTo(it.pts[0].x, it.pts[0].y);
            for (let i = 1; i < it.pts.length; i++) ctx.lineTo(it.pts[i].x, it.pts[i].y);
            ctx.closePath(); ctx.fillStyle = rgb([18, 19, 24], 0.6 + sh * 0.6); ctx.fill();
            ctx.strokeStyle = 'rgba(5,6,8,0.9)'; ctx.lineWidth = Math.max(0.7, 0.7 * it.c.k); ctx.stroke();
            // обод: уменьшенный многоугольник к центру
            const c = it.c, rf = 0.62;
            ctx.beginPath();
            for (let i = 0; i < it.pts.length; i++) {
                const x = c.x + (it.pts[i].x - c.x) * rf, y = c.y + (it.pts[i].y - c.y) * rf;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath(); ctx.fillStyle = rgb([150, 158, 172], 0.6 + sh * 0.5); ctx.fill();
            // тормозной диск внутри обода
            ctx.beginPath();
            for (let i = 0; i < it.pts.length; i++) {
                const x = c.x + (it.pts[i].x - c.x) * 0.39, y = c.y + (it.pts[i].y - c.y) * 0.39;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath(); ctx.fillStyle = 'rgba(66,72,82,0.96)'; ctx.fill();
            ctx.strokeStyle = 'rgba(190,198,210,0.75)'; ctx.lineWidth = Math.max(0.45, 0.35 * c.k); ctx.stroke();
            // спицы (вращаются с колесом)
            ctx.strokeStyle = 'rgba(30,32,38,0.9)'; ctx.lineWidth = Math.max(0.6, 0.5 * c.k);
            const wh = it.wh, outerSide = Math.sign(wh.x) || 1;
            for (let s = 0; s < 5; s++) {
                const th = car._wp + s * (Math.PI * 2 / 5);
                const ly = Math.cos(th) * wh.r * 0.55, lz = Math.sin(th) * wh.r * 0.55;
                const px = -ly * it.ss, py = ly * it.cs;
                const w = wv(wh.x + outerSide * wh.w / 2 + px * 0, wh.y + py, wh.z + lz);
                const p = camP(w);
                ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(p.x, p.y); ctx.stroke();
            }
            // втулка
            ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(0.8, 0.9 * c.k), 0, Math.PI * 2); ctx.fillStyle = '#2b2f38'; ctx.fill();
        } else if (it.kindObj === 'line') {
            ctx.strokeStyle = it.ar.color || '#1b1e25';
            ctx.lineWidth = Math.max(0.7, it.ar.width * (it.pa.k + it.pb.k) / 2);
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(it.pa.x, it.pa.y); ctx.lineTo(it.pb.x, it.pb.y); ctx.stroke();
        }
    }

    // шлем пилота (Ф-1)
    if (m.isF1) {
        const hz = wv(0, m.y0 + 0.49 * (m.y1 - m.y0), m.H * 0.46);
        const hp = camP(hz);
        if (hp.d > near) {
            ctx.fillStyle = car.livery ? car.livery.accent : '#ffd400';
            ctx.beginPath(); ctx.arc(hp.x, hp.y, Math.max(1.0, 1.25 * hp.k), 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();
        }
    }

    const top = camP(wv(0, 0, m.H));
    return { x: top.x, y: top.y, k: top.k };
}
