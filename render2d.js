const spriteImgs = {};

function loadSprites() {
    if (typeof SPRITE_DATA === 'undefined') return;
    for (const id in SPRITE_DATA) {
        const img = new Image();
        img.onload = () => {
            spriteImgs[id] = img;
        };
        img.src = SPRITE_DATA[id];
    }
}

function spriteDims(car) {
    const img = spriteImgs[car.spec.id];
    const h = car.height * 1.20;
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
    let src = spriteImgs[id];
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
        drawCarModelDetails(ctx,car.spec,car.livery,car.driverNumber,car.width,car.height,car.braking,car.drsActive);
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
    drawCarModelDetails(ctx,car.spec,car.livery,car.driverNumber,w,h,car.braking,car.drsActive);

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

