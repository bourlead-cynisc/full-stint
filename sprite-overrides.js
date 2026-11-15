// GT3 models and both supplied paint designs, used in the garage and on track.
if (typeof SPRITE_DATA !== 'undefined') {
    for (const id of ['aston_gt3','audi_gt3','bmw_gt3','corvette_gt3','ferrari_gt3','mustang_gt3','lambo_gt3','lexus_gt3','mclaren_gt3','mercedes_gt3','porsche_gt3','bentley_gt3']) {
        SPRITE_DATA[id] = `assets/gt3/models/${id}-1.png?v=20261115-reference-gt3-wings-v11`;
        SPRITE_DATA[`${id}_livery2`] = `assets/gt3/models/${id}-2.png?v=20261115-reference-gt3-wings-v11`;
    }
}
// Each manufacturer gets the two real sprite designs from the supplied sheets.
const GT3_PAINT_VARIANTS = Object.freeze(Object.fromEntries([
    ['aston_gt3','Зелёная','#1b7760','Белая','#eeeeea'],
    ['audi_gt3','Чёрная','#303238','Белая','#e7e7e7'],
    ['bmw_gt3','Белая','#e9e9e9','Чёрная','#20232b'],
    ['corvette_gt3','Жёлтая','#f1c400','Графитовая','#333438'],
    ['ferrari_gt3','Красная','#cf2028','Белая','#ededeb'],
    ['mustang_gt3','Синяя','#1555a4','Графитовая','#3c4143'],
    ['lambo_gt3','Зелёная','#77bd10','Чёрная','#292b2c'],
    ['lexus_gt3','Белая','#e8e8e8','Синяя','#1556a3'],
    ['mclaren_gt3','Оранжевая','#f47b08','Голубая','#1d9dc8'],
    ['mercedes_gt3','Серебристая','#8a8d90','Салатовая','#c1d916'],
    ['porsche_gt3','Белая','#e9e9e7','Чёрная','#22252a'],
    ['bentley_gt3','Зелёная','#244c42','Белая','#e7e7e2']
].map(([id,name1,color1,name2,color2])=>[id,Object.freeze([
    {spriteId:id,name:name1,color:color1},
    {spriteId:`${id}_livery2`,name:name2,color:color2}
])])));
