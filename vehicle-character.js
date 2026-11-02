// Gameplay calibration, not manufacturer telemetry. Power remains expressed in W/kg.
const CAR_CHARACTER = {
 aston_gt3:[1325,1.02,1.10,1.04,1.00],audi_gt3:[1300,1.08,.98,1.02,1.04],bmw_gt3:[1350,.94,1.14,1.08,.88],
 corvette_gt3:[1280,1.06,.94,1.00,.95],ferrari_gt3:[1290,1.10,1.01,1.04,1.08],mustang_gt3:[1380,.91,1.10,1.12,.85],
 lambo_gt3:[1305,1.13,.89,.96,1.07],lexus_gt3:[1360,.93,1.13,1.06,.90],mclaren_gt3:[1270,1.12,.97,1.02,1.18],
 mercedes_gt3:[1340,.99,1.12,1.09,1.01],porsche_gt3:[1280,1.09,.94,1.17,.98],bentley_gt3:[1390,.88,1.15,1.10,.86],
 f1_redbull:[800,1.05,1.04,1.08,1.04],f1_mercedes:[805,1.00,1.12,1.04,1.00],f1_ferrari:[800,1.10,.95,1.10,.99],
 f1_mclaren:[800,1.09,1.04,1.06,1.15],f1_aston:[810,.98,1.08,1.02,1.02],f1_alpine:[805,1.03,.98,.99,.96],
 f1_sauber:[812,.95,1.06,1.00,.94],f1_rb:[802,1.08,.94,1.05,.98],f1_williams:[800,.97,1.04,1.10,.86],
 f1_haas:[807,.98,1.08,1.01,.93],f1_cadillac:[815,.94,1.10,.98,.91],
 ta_civic:[1130,1.01,1.02,1.00,.96],ta_megane_rs:[1390,1.05,1.06,1.07,1.10],
 ta_kalina:[1070,.92,.94,.93,.75],ta_granta:[1120,.95,.96,.95,.80],ta_vesta:[1240,.98,1.02,1.00,.88],
 ta_mx5:[1050,1.16,.97,.96,.88],ta_gt86:[1280,1.10,1.00,.99,1.02],ta_brz:[1275,1.12,1.02,1.00,1.05],
 ta_bmw_m3:[1460,.98,1.08,1.03,1.00],ta_bmw_m4:[1550,.96,1.10,1.04,1.12],
 ta_s2000:[1270,1.16,1.00,1.01,.95],ta_silvia:[1280,1.13,.92,.95,1.10],
 ta_porsche_911:[1480,1.05,.90,1.14,1.16],ta_lancer_evo:[1520,.98,1.10,1.12,1.05],ta_wrx_sti:[1500,1.03,1.08,1.09,1.02]
};
for(const catalog of [GT3_CATALOG,F1_CATALOG,TIME_ATTACK_CATALOG]) for(const spec of catalog) {
 const [mass,rotation,brakeStability,traction,aeroResponse]=CAR_CHARACTER[spec.id];
 const enginePosition=spec.enginePosition||(['aston_gt3','bmw_gt3','mustang_gt3','lexus_gt3','mercedes_gt3','bentley_gt3'].includes(spec.id)?'front':spec.id==='porsche_gt3'?'rear':'mid');
 spec.character={mass,rotation,brakeStability,traction,aeroResponse,enginePosition};
}
function characterSummary(spec) {
 const c=spec.character;
 return `${c.rotation>=1.06?'Острый руль':c.rotation<.97?'Плавный руль':'Нейтральный руль'} · ${c.brakeStability>=1.07?'устойчивое торможение':c.brakeStability<.98?'требует точного торможения':'ровное торможение'} · ${c.traction>=1.07?'сильная тяга на выходе':'точная работа газом'}`;
}
