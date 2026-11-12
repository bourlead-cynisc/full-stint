// Multi-car cornering regression. Runs inside the game iframe, not a mocked
// kinematic model: every car uses normal physics and contour car collisions.
const assert=(test,label)=>{if(!test)throw Error(label);};
const saved={
 carClass:selectedCarClass,track:selectedTrackIndex,session:currentSession,
 raceState,mode:window.handlingMode,cars:allCars,simTime:simTimeMs,
 raceMode,totalRaceLaps
};
const cases=[];
try {
 currentSession='RACE';raceState='RACING';raceMode='LAPS';totalRaceLaps=100;
 for(const mode of ['ARCADE','REAL'])for(const cls of ['GT3','F1']){
  window.handlingMode=mode;
  selectedCarClass=cls;
  const catalog=getActiveCatalog();
  for(let track=0;track<TRACKS_DB.length;track++){
   selectedTrackIndex=track;buildActiveTrackGeometry();
   allCars=[];
   for(let slot=0;slot<6;slot++){
    const team=catalog[slot%catalog.length];
    const c=new Car('AI '+slot,slot+1,slot%catalog.length,false,false,team.drivers[0],slot);
    c.assignStrategy({start:'medium',stops:[]});c.placeOnGrid(slot);
    c.form=1;allCars.push(c);
   }
   simTimeMs=0;let walls=0,stalls=0,curbs=0,worst=0;
   for(let step=0;step<1800;step++){
    simTimeMs+=1000/60;
    for(const c of allCars){
     c.update(1/60,null);
     const distance=c.dbgDist||0;
     if(distance>WALL_HALF_W-10)walls++;
     if(distance>CURB_OUTER_W)curbs++;
     worst=Math.max(worst,distance);
     if(step>500&&c.velocity*MS<1)stalls++;
    }
    for(let a=0;a<allCars.length;a++)for(let b=a+1;b<allCars.length;b++)
     resolveContourCarCollision(allCars[a],allCars[b]);
   }
   const name=mode+'/'+cls+'/'+TRACKS_DB[track].id;
   assert(walls===0,'AI hit a wall: '+name+' ('+walls+' frames)');
   assert(stalls===0,'AI stalled: '+name+' ('+stalls+' frames)');
   assert(allCars.every(c=>Number.isFinite(c.x+c.y+c.velocity)&&c.progressAcc>.06),
     'AI did not advance safely: '+name);
   cases.push({name,wallFrames:walls,curbFrames:curbs,worstOffsetPx:Math.round(worst)});
  }
 }
} finally {
 selectedCarClass=saved.carClass;selectedTrackIndex=saved.track;
 currentSession=saved.session;raceState=saved.raceState;
 window.handlingMode=saved.mode;allCars=saved.cars;simTimeMs=saved.simTime;
 raceMode=saved.raceMode;totalRaceLaps=saved.totalRaceLaps;
 buildActiveTrackGeometry();
}
return {scenarios:cases.length,walls:cases.reduce((n,c)=>n+c.wallFrames,0),
 curbs:cases.reduce((n,c)=>n+c.curbFrames,0),worstOffsetPx:Math.max(...cases.map(c=>c.worstOffsetPx))};
