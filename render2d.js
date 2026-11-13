const spriteImgs = {};
const spriteLoadPending = new Set();

// Stock Time Attack silhouettes with subtle endurance-racing paint, in the supplied 4x4 order.
// Rectangles are tight alpha bounds in the atlas.
const TIME_ATTACK_SPRITE_RECTS = {
    ta_civic:       [140, 38, 136, 256],
    ta_megane_rs:   [426, 37, 136, 257],
    ta_kalina:      [707, 40, 132, 253],
    ta_granta:      [989, 39, 134, 260],
    ta_vesta:       [138, 338, 139, 258],
    ta_mx5:         [423, 341, 145, 248],
    ta_gt86:        [701, 340, 146, 257],
    ta_brz:         [984, 339, 148, 270],
    ta_bmw_m3:      [141, 630, 140, 268],
    ta_bmw_m4:      [421, 629, 143, 274],
    ta_s2000:       [699, 644, 149, 246],
    ta_silvia:      [984, 633, 149, 270],
    ta_porsche_911: [136, 936, 148, 277],
    ta_lancer_evo:  [418, 935, 149, 276],
    ta_wrx_sti:     [701, 934, 147, 278],
    ta_gtr34:       [982, 937, 149, 276]
};

function loadTimeAttackSprites() {
    const atlas = new Image();
    atlas.onload = () => {
        const atlasScale = atlas.width / 1266;
        for (const [id, [sx, sy, sw, sh]] of Object.entries(TIME_ATTACK_SPRITE_RECTS)) {
            const sprite = document.createElement('canvas');
            sprite.width = Math.max(1, Math.round(sw * atlasScale));
            sprite.height = Math.max(1, Math.round(sh * atlasScale));
            const ctx = sprite.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(atlas, sx * atlasScale, sy * atlasScale, sw * atlasScale, sh * atlasScale, 0, 0, sprite.width, sprite.height);
            spriteImgs[id] = sprite;
        }
    };
    fetch('assets/time-attack-wec-cars.webp.b64?v=20261103-ta-ratata-v5')
        .then(response => {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.text();
        })
        .then(base64 => { atlas.src = 'data:image/webp;base64,' + base64.trim(); })
        .catch(error => console.error('Unable to load Time Attack car sprites', error));
}

function loadSprite(id) {
    if (!id || spriteImgs[id] || spriteLoadPending.has(id) || typeof SPRITE_DATA === 'undefined' || !SPRITE_DATA[id]) return;
    spriteLoadPending.add(id);
    const img = new Image();
    img.onload = () => {
        spriteImgs[id] = img;
        spriteLoadPending.delete(id);
    };
    img.onerror = () => spriteLoadPending.delete(id);
    img.src = SPRITE_DATA[id];
}

function loadSprites() {
    if (typeof SPRITE_DATA !== 'undefined') {
        for (const id in SPRITE_DATA) {
            // Ignore and discard any second-livery data left in older sprite bundles.
            if (id.endsWith('_livery2')) { delete SPRITE_DATA[id]; continue; }
            loadSprite(id);
        }
    }
    loadTimeAttackSprites();
}

function spriteDims(car, spriteId = car.spec.id) {
    const img = spriteImgs[spriteId] || spriteImgs[car.spec.id];
    const h = car.height * 1.28;
    return { img, h, w: h * img.width / img.height };
}

// ---------- 2D (вид сверху) ----------
// Спрайт заранее уменьшается до нужного размера в несколько проходов (по 2 раза) — так картинка остаётся
// чёткой, а не «мылится» при резком сжатии. Размер подбирается под текущий масштаб камеры.
const scaledCache = {};
let topZoomNow = 1;

function getScaledSprite(id, tw, th) {
    const src = spriteImgs[id];
    if (!src) return null;
    const key = id + ':' + tw + 'x' + th;
    if (scaledCache[key]) return scaledCache[key];
    const out = document.createElement('canvas');
    out.width = tw; out.height = th;
    const g = out.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    // Scale the full-resolution source once, directly into the high-DPI game canvas.
    g.drawImage(src, 0, 0, src.width, src.height, 0, 0, tw, th);
    scaledCache[key] = out;
    return out;
}

// Контекст уже в центре машины и повёрнут носом вверх. scaleMul — увеличение значка (в режиме «вся трасса»).
function drawCarSpriteTop(ctx, car, scaleMul = 1) {
    if (car.spriteId && car.spriteId !== car.spec.id && !spriteImgs[car.spriteId]) loadSprite(car.spriteId);
    const spriteId = spriteImgs[car.spriteId] ? car.spriteId : car.spec.id;
    const img = spriteImgs[spriteId];
    if (!img) {
        renderCarBody(ctx, car.spec, car.livery, car.compound, car.braking, car.drsActive, car.driverNumber);
        return;
    }
    const { h, w } = spriteDims(car, spriteId);
    const dpr = window.__GAME_CANVAS_DPR || window.devicePixelRatio || 1;
    const z = Math.max(0.05, topZoomNow) * scaleMul * dpr;
    const tw = Math.max(12, Math.round(w * z / 4) * 4), th = Math.max(24, Math.round(h * z / 4) * 4);
    const spr = getScaledSprite(spriteId, tw, th);

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

