// Replacement Full Stint sprites: nose points to the top of each image.
const F1_DRIVER_SPRITES = Object.freeze({
    "f1_ferrari": {
        "16": "ferravox_16",
        "44": "ferravox_44"
    },
    "f1_mclaren": {
        "1": "makloryx_01",
        "81": "makloryx_81"
    },
    "f1_mercedes": {
        "12": "merzentix_12",
        "63": "merzentix_63"
    },
    "f1_redbull": {
        "3": "raging_bison_03",
        "6": "raging_bison_06"
    },
    "f1_williams": {
        "23": "willmorax_23",
        "55": "willmorax_55"
    },
    "f1_aston": {
        "14": "astrion_martel_14",
        "18": "astrion_martel_18"
    },
    "f1_alpine": {
        "10": "alperion_10",
        "43": "alperion_43"
    },
    "f1_haas": {
        "31": "haax_motorsport_31",
        "87": "haax_motorsport_87"
    },
    "f1_rb": {
        "30": "sprint_taurix_30",
        "41": "sprint_taurix_41"
    },
    "f1_sauber": {
        "5": "audrix_05",
        "27": "audrix_27"
    },
    "f1_cadillac": {
        "11": "cadilux_11",
        "77": "cadilux_77"
    }
});
function getF1DriverSpriteId(spec, number) {
    const id = typeof spec === 'string' ? spec : spec?.id;
    return Object.prototype.hasOwnProperty.call(F1_DRIVER_SPRITES[id] || {}, number)
        ? `${id}_driver_${number}` : id;
}
if (typeof SPRITE_DATA !== 'undefined') {
    const gt3Ids = ["aston_gt3","audi_gt3","bmw_gt3","corvette_gt3","ferrari_gt3","mustang_gt3","lambo_gt3","lexus_gt3","mclaren_gt3","mercedes_gt3","porsche_gt3","bentley_gt3"];
    for (const id of gt3Ids) {
        SPRITE_DATA[id] = `assets/gt3/models/${id}-1.webp?v=20261118-models-v1`;
        SPRITE_DATA[`${id}_livery2`] = `assets/gt3/models/${id}-2.webp?v=20261118-models-v1`;
    }
    for (const [id, driverSprites] of Object.entries(F1_DRIVER_SPRITES)) {
        let first = true;
        for (const [number, basename] of Object.entries(driverSprites)) {
            const uri = `assets/f1/models/${basename}.webp?v=20261118-models-v1`;
            SPRITE_DATA[`${id}_driver_${number}`] = uri;
            if (first) { SPRITE_DATA[id] = uri; first = false; }
        }
    }
}
const GT3_PAINT_VARIANTS = Object.freeze(Object.fromEntries([
    [
        "aston_gt3",
        "Зелёная · лайм",
        "#1e4b39",
        "Серебро · красный",
        "#ced0d2"
    ],
    [
        "audi_gt3",
        "Чёрная · оранжевый",
        "#1e2023",
        "Белая · синий",
        "#edeff2"
    ],
    [
        "bmw_gt3",
        "Белая · триколор",
        "#edf1f5",
        "Графит · лайм",
        "#32363b"
    ],
    [
        "corvette_gt3",
        "Жёлтая · чёрный",
        "#f2c400",
        "Белая · красный",
        "#f4f4f2"
    ],
    [
        "ferrari_gt3",
        "Красная · белый",
        "#bc2028",
        "Синяя · белый",
        "#1640ae"
    ],
    [
        "mustang_gt3",
        "Синяя · белый",
        "#1767b7",
        "Серебро · оранжевый",
        "#a4a4a6"
    ],
    [
        "lambo_gt3",
        "Лаймовая · чёрный",
        "#a0e600",
        "Белая · триколор",
        "#eef0f1"
    ],
    [
        "lexus_gt3",
        "Оранжевая · чёрный",
        "#f27c16",
        "Белая · фиолетовый",
        "#e7e7e9"
    ],
    [
        "mclaren_gt3",
        "Оранжевая · чёрный",
        "#f38112",
        "Белая · бирюзовый",
        "#edf1f2"
    ],
    [
        "mercedes_gt3",
        "Серебро · бирюза",
        "#c3c8ce",
        "Графит · золото",
        "#343538"
    ],
    [
        "porsche_gt3",
        "Белая · красный",
        "#edefef",
        "Голубая · оранжевый",
        "#9fcfe7"
    ],
    [
        "bentley_gt3",
        "Зелёная · золото",
        "#173e32",
        "Чёрная · розовый",
        "#24262b"
    ]
]
    .map(([id,name1,color1,name2,color2]) => [id,Object.freeze([
        {spriteId:id,name:name1,color:color1},
        {spriteId:`${id}_livery2`,name:name2,color:color2}
    ])])));
