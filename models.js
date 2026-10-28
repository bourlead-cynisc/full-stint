function renderCarBody(ctx, spec, livery, compoundKey = 'soft', isBraking = false, drsActive = false, driverNumber = 1) {
    const w = spec.width;
    const h = spec.height;
    const id = spec.id;
    const tireStripeColor = compoundKey === 'soft' ? '#ff3b4e' : (compoundKey === 'medium' ? '#facc15' : '#ffffff');

    if (spec.carClass === 'F1') {
        ctx.fillStyle = '#0c0f16';
        ctx.beginPath();
        ctx.roundRect(-w * 0.44, -h * 0.16, w * 0.88, h * 0.50, 3);
        ctx.fill();

        ctx.strokeStyle = '#181e29';
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.32); ctx.lineTo(-w * 0.45, -h * 0.35);
        ctx.moveTo(0, -h * 0.25); ctx.lineTo(-w * 0.45, -h * 0.30);
        ctx.moveTo(0, -h * 0.32); ctx.lineTo( w * 0.45, -h * 0.35);
        ctx.moveTo(0, -h * 0.25); ctx.lineTo( w * 0.45, -h * 0.30);
        ctx.moveTo(0, h * 0.27); ctx.lineTo(-w * 0.46, h * 0.31);
        ctx.moveTo(0, h * 0.36); ctx.lineTo(-w * 0.46, h * 0.36);
        ctx.moveTo(0, h * 0.27); ctx.lineTo( w * 0.46, h * 0.31);
        ctx.moveTo(0, h * 0.36); ctx.lineTo( w * 0.46, h * 0.36);
        ctx.stroke();

        const drawF1Wheel = (wx, wy, ww, wh) => {
            ctx.fillStyle = '#0f1218';
            ctx.beginPath();
            ctx.roundRect(wx - ww / 2, wy - wh / 2, ww, wh, 2.5);
            ctx.fill();
            ctx.strokeStyle = tireStripeColor;
            ctx.lineWidth = 1.25;
            ctx.strokeRect(wx - ww / 2 + 1.1, wy - wh / 2 + 1.4, ww - 2.2, wh - 2.8);
        };
        drawF1Wheel(-w * 0.45, -h * 0.32, 5.4, 10.8);
        drawF1Wheel( w * 0.45, -h * 0.32, 5.4, 10.8);
        drawF1Wheel(-w * 0.46,  h * 0.33, 6.2, 11.8);
        drawF1Wheel( w * 0.46,  h * 0.33, 6.2, 11.8);

        ctx.fillStyle = livery.primary;
        ctx.beginPath();
        ctx.moveTo(-w * 0.14, -h * 0.17);
        ctx.lineTo(-w * 0.39, -h * 0.13);
        ctx.quadraticCurveTo(-w * 0.41, h * 0.09, -w * 0.21, h * 0.30);
        ctx.lineTo(-w * 0.09, h * 0.40);
        ctx.lineTo( w * 0.09, h * 0.40);
        ctx.lineTo( w * 0.21, h * 0.30);
        ctx.quadraticCurveTo( w * 0.41, h * 0.09,  w * 0.39, -h * 0.13);
        ctx.lineTo( w * 0.14, -h * 0.17);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#07090d';
        ctx.fillRect(-w * 0.37, -h * 0.14, w * 0.21, 3.6);
        ctx.fillRect( w * 0.16, -h * 0.14, w * 0.21, 3.6);

        ctx.fillStyle = livery.primary;
        ctx.beginPath();
        ctx.moveTo(-w * 0.055, -h * 0.49);
        ctx.lineTo( w * 0.055, -h * 0.49);
        ctx.lineTo( w * 0.145, -h * 0.15);
        ctx.lineTo( w * 0.115,  h * 0.41);
        ctx.lineTo(-w * 0.115,  h * 0.41);
        ctx.lineTo(-w * 0.145, -h * 0.15);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#151a24';
        ctx.beginPath();
        ctx.moveTo(-w * 0.48, -h * 0.43);
        ctx.lineTo(0, -h * 0.485);
        ctx.lineTo( w * 0.48, -h * 0.43);
        ctx.lineTo( w * 0.48, -h * 0.37);
        ctx.lineTo(0, -h * 0.415);
        ctx.lineTo(-w * 0.48, -h * 0.37);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#07090e';
        ctx.beginPath();
        ctx.ellipse(0, -h * 0.05, w * 0.105, h * 0.095, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = livery.accent;
        ctx.beginPath();
        ctx.arc(0, -h * 0.035, 3.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#1e2430';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.15); ctx.lineTo(0, -h * 0.08);
        ctx.moveTo(-w * 0.095, -h * 0.01);
        ctx.quadraticCurveTo(0, -h * 0.145, w * 0.095, -h * 0.01);
        ctx.stroke();

        ctx.fillStyle = '#11151e';
        ctx.fillRect(-w * 0.35, h * 0.41, w * 0.70, 6.2);
        if (drsActive) {
            ctx.fillStyle = '#00e676';
            ctx.fillRect(-w * 0.31, h * 0.415, w * 0.62, 1.6);
        } else {
            ctx.fillStyle = livery.secondary;
            ctx.fillRect(-w * 0.33, h * 0.42, w * 0.66, 2.8);
        }

        const ersBlink = isBraking || (Math.floor(performance.now() / 160) % 2 === 0);
        ctx.fillStyle = ersBlink ? '#ff1e27' : '#660000';
        ctx.fillRect(-1.8, h * 0.47, 3.6, 3.2);
        return;
    }

    ctx.fillStyle = '#0c0e13';
    const wx = w / 2 - 0.5;
    ctx.fillRect(-wx - 2.0, -h * 0.31 - 4.2, 3.2, 8.6);
    ctx.fillRect( wx - 1.2, -h * 0.31 - 4.2, 3.2, 8.6);
    ctx.fillRect(-wx - 2.0,  h * 0.27 - 4.2, 3.2, 9.4);
    ctx.fillRect( wx - 1.2,  h * 0.27 - 4.2, 3.2, 9.4);

    ctx.fillStyle = '#12161f';
    ctx.beginPath();
    ctx.roundRect(-w * 0.50, -h * 0.515, w * 1.00, 6.0, 2.5);
    ctx.fill();

    ctx.fillStyle = livery.primary;
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, -h * 0.47);
    ctx.quadraticCurveTo(0, -h * 0.52, w * 0.45, -h * 0.47);
    ctx.lineTo(w * 0.51, -h * 0.22);
    ctx.lineTo(w * 0.46,  h * 0.02);
    ctx.lineTo(w * 0.51,  h * 0.26);
    ctx.lineTo(w * 0.47,  h * 0.46);
    ctx.lineTo(-w * 0.47, h * 0.46);
    ctx.lineTo(-w * 0.51, h * 0.26);
    ctx.lineTo(-w * 0.46,  h * 0.02);
    ctx.lineTo(-w * 0.51, -h * 0.22);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = livery.accent;
    ctx.fillRect(-w * 0.55, -h * 0.14, 3.5, 2.3);
    ctx.fillRect( w * 0.55 - 3.5, -h * 0.14, 3.5, 2.3);

    ctx.fillStyle = '#141c28';
    ctx.beginPath();
    ctx.moveTo(-w * 0.36, -h * 0.18);
    ctx.quadraticCurveTo(0, -h * 0.25, w * 0.36, -h * 0.18);
    ctx.lineTo(w * 0.30,  h * 0.08);
    ctx.lineTo(-w * 0.30, h * 0.08);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0f131b';
    ctx.fillRect(-w * 0.52, h * 0.39, w * 1.04, 5.8);

    ctx.fillStyle = isBraking ? '#ff2a2a' : '#990000';
    ctx.fillRect(-w * 0.42, h * 0.455, w * 0.84, 2.4);
}

function renderSafetyCar(ctx) {
    const w = 22, h = 45;
    ctx.save();
    ctx.fillStyle = '#d1d5db';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 6);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-w * 0.36, -h * 0.16, w * 0.72, h * 0.36, 4);
    ctx.fill();
    const blink = Math.floor(performance.now() / 220) % 2 === 0;
    ctx.fillStyle = blink ? '#22c55e' : '#f97316';
    ctx.fillRect(-w * 0.30, -2, w * 0.30, 4.5);
    ctx.fillStyle = blink ? '#f97316' : '#22c55e';
    ctx.fillRect(0, -2, w * 0.30, 4.5);
    ctx.restore();
}