// BoP-style class normalization. Differences remain visible in torque, handling,
// tyres, drive layout and mass, but no single car gets every advantage at once.
// The underlying CAR_PERF entries retain their authoring values for reference.
const FULL_STINT_BALANCE = Object.freeze({
 GT3:{power:.32,vmax:.46,grip:.42,aero:.42,brake:.42,tire:.62,mass:.62},
 F1: {power:.38,vmax:.44,grip:.48,aero:.45,brake:.50,tire:.68,mass:.78},
 TA: {power:.54,vmax:.60,grip:.60,aero:.56,brake:.57,tire:.75,mass:.78}
});
function normalizeFullStintClass(catalog,calibration) {
 const keys=['power','vmax','grip','aero','brake','tire'];
 const mean=Object.fromEntries(keys.map(k=>[k,catalog.reduce((total,s)=>total+s.perf[k],0)/catalog.length]));
 const meanMass=catalog.reduce((total,s)=>total+s.character.mass,0)/catalog.length;
 for(const car of catalog) {
  const raw={...car.perf};
  for(const key of keys) {
   car.perf[key]=+(mean[key]+(raw[key]-mean[key])*calibration[key]).toFixed(key==='vmax'?2:4);
  }
  car.character.mass=Math.round(meanMass+(car.character.mass-meanMass)*calibration.mass);
  // Display a BoP rating derived from actual calibrated physics, not a legacy
  // manually entered 66..92 label that exaggerates performance differences.
  const delta=.23*(car.perf.power/mean.power-1)
     +.21*(car.perf.vmax/mean.vmax-1)
     +.26*(car.perf.grip/mean.grip-1)
     +.17*(car.perf.aero/mean.aero-1)
     +.09*(car.perf.brake/mean.brake-1)
     +.04*(car.perf.tire/mean.tire-1);
  car.perf.balance=Math.max(82,Math.min(94,Math.round(89+delta*175)));
  car.topSpeedKmh=Math.round(car.perf.vmax);
 }
}
normalizeFullStintClass(GT3_CATALOG,FULL_STINT_BALANCE.GT3);
normalizeFullStintClass(F1_CATALOG,FULL_STINT_BALANCE.F1);
normalizeFullStintClass(TIME_ATTACK_CATALOG,FULL_STINT_BALANCE.TA);
