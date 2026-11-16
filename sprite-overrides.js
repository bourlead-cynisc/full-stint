// GT3 models and both supplied paint designs, used in the garage and on track.
if (typeof SPRITE_DATA !== 'undefined') {
    for (const id of ['aston_gt3','audi_gt3','bmw_gt3','corvette_gt3','ferrari_gt3','mustang_gt3','lambo_gt3','lexus_gt3','mclaren_gt3','mercedes_gt3','porsche_gt3','bentley_gt3']) {
        SPRITE_DATA[id] = `assets/gt3/models/${id}-1.png?v=20261116-user-gt3-model-sheet-v1`;
        SPRITE_DATA[`${id}_livery2`] = `assets/gt3/models/${id}-2.png?v=20261116-user-gt3-model-sheet-v1`;
    }
}
// Each manufacturer gets the two real sprite designs from the supplied sheets.
const GT3_PAINT_VARIANTS = Object.freeze(Object.fromEntries([
    ['aston_gt3','Тёмно-зелёная','#174d39','Лаймовая','#b7e812'],
    ['audi_gt3','Чёрная · красная','#242427','Белая · красная','#f0f0ef'],
    ['bmw_gt3','Белая · M','#f0f2f4','Чёрная · M','#15171b'],
    ['corvette_gt3','Жёлтая','#f1c400','Графитовая · красная','#303136'],
    ['ferrari_gt3','Красная','#cf2028','Белая · красная','#f4f2ef'],
    ['mustang_gt3','Синяя','#1853a2','Графитовая · лаймовая','#343534'],
    ['lambo_gt3','Чёрная · оранжевая','#343332','Лаймовая','#a4e500'],
    ['lexus_gt3','Белая · синяя','#f1f2f5','Чёрная · красная','#25272b'],
    ['mclaren_gt3','Оранжевая','#f18112','Чёрная · голубая','#20252b'],
    ['mercedes_gt3','Серебристая · синяя','#c4c6c9','Чёрная · красная','#2d3036'],
    ['porsche_gt3','Белая · красная','#eeeeed','Чёрная · жёлтая','#323437'],
    ['bentley_gt3','Зелёная','#164a3e','Белая · зелёная','#f2f1ee']
].map(([id,name1,color1,name2,color2])=>[id,Object.freeze([
    {spriteId:id,name:name1,color:color1},
    {spriteId:`${id}_livery2`,name:name2,color:color2}
])])));
