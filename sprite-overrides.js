// Imported top-down GT3 artwork; the two colour variants use the same car geometry.
// Keep other cars on their existing one-livery assets.
if (typeof SPRITE_DATA !== 'undefined') {
    SPRITE_DATA.audi_gt3 = 'assets/gt3/audi-red.webp';
    SPRITE_DATA.audi_gt3_livery2 = 'assets/gt3/audi-blue.webp';
    SPRITE_DATA.porsche_gt3 = 'assets/gt3/porsche-red.webp';
    SPRITE_DATA.porsche_gt3_livery2 = 'assets/gt3/porsche-blue.webp';
    SPRITE_DATA.aston_gt3 = 'assets/gt3/aston-vantage-topdown.png';
}
// The swatch selects a whole supplied paint design, preserving sponsor stickers
// and race numbers rather than colouring over them with a global tint.
const GT3_PAINT_VARIANTS = Object.freeze({
    audi_gt3: Object.freeze([
        {spriteId:'audi_gt3',name:'Красно-белая · №33',color:'#e02833'},
        {spriteId:'audi_gt3_livery2',name:'Сине-жёлтая · №46',color:'#f3d62a'}
    ]),
    porsche_gt3: Object.freeze([
        {spriteId:'porsche_gt3',name:'Красно-белая · №92',color:'#e02934'},
        {spriteId:'porsche_gt3_livery2',name:'Сине-жёлтая · №64',color:'#f6da26'}
    ])
});