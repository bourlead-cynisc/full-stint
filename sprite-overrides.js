// Straight overhead GT3 sprites: front faces up, rear wings at the bottom.
if (typeof SPRITE_DATA !== 'undefined') {
    SPRITE_DATA.audi_gt3 = 'assets/gt3/audi-r8-topdown.png';
    SPRITE_DATA.aston_gt3 = 'assets/gt3/aston-vantage-topdown.png';

    const alternateLiveryIds = [
        'aston_gt3', 'audi_gt3', 'bmw_gt3', 'corvette_gt3', 'ferrari_gt3', 'mustang_gt3',
        'lambo_gt3', 'lexus_gt3', 'mclaren_gt3', 'mercedes_gt3', 'porsche_gt3', 'bentley_gt3',
        'ta_civic', 'ta_megane_rs', 'ta_kalina', 'ta_granta', 'ta_vesta', 'ta_mx5', 'ta_gt86',
        'ta_brz', 'ta_bmw_m3', 'ta_bmw_m4', 'ta_s2000', 'ta_silvia', 'ta_porsche_911',
        'ta_lancer_evo', 'ta_wrx_sti', 'ta_gtr34'
    ];
    alternateLiveryIds.forEach(id => {
        SPRITE_DATA[`${id}__livery2`] = `assets/liveries/${id}-alt.png?v=20261104-real-schemes-v5`;
    });
}
