// Multi-car cornering regression. Runs inside the game iframe, not a mocked
// kinematic model: every car uses normal physics and contour car collisions.
const assert=(test,label)=>{if(!test)throw Error(label);};
const saved={
 carClass:selectedCarClass,track:selectedTrackIndex,session:currentSession,
 raceState,mode:window.handlingMode,cars:allCars,simTime:simTimeMs,
 raceMode,totalRaceLaps,pace:aiSettings.pace
};
const cases=[];
try {
 const importFixtures=[
  {id:'lemans',name:'🇫🇷 Ле-Ман',shortName:'Ле-Ман',length:13610.461,width:15.5,curb:1.4,objects:783,pit:291.255},
  {id:'interlagos',name:'🇧🇷 Интерлагос',shortName:'Интерлагос',length:6379.74,width:11,curb:1.5,objects:340,pit:403.798},
  {id:'imola',name:'🇮🇹 Имола',shortName:'Имола',length:6162.911,width:18,curb:2,objects:278,pit:737.622},
  {id:'monza',name:'🇮🇹 Монца',shortName:'Монца',length:3583.281,width:10,curb:2,objects:85,pit:581.158},
  {id:'spa',name:'🇧🇪 Спа-Франкоршам',shortName:'Спа-Франкоршам',length:3614.376,width:10,curb:2,objects:49,pit:452.022},
  {id:'fuji',name:'🇯🇵 Фудзи',shortName:'Фудзи',length:3735.056,width:14,curb:1,objects:153,pit:451.057}
 ];
 for(const fixture of importFixtures) {
  const index=TRACKS_DB.findIndex(t=>t.id===fixture.id);
  assert(index>=0,fixture.id+' is missing from the calendar');
  selectedTrackIndex=index;buildActiveTrackGeometry();
  const t=TRACKS_DB[index],origin=t.rawPoints[0];
  assert(t.name===fixture.name&&t.shortName===fixture.shortName,
    fixture.id+' lost its original calendar name');
  assert(t.importedScenery?.length===fixture.objects&&t.customPitLayout,
    fixture.id+' objects or custom pit road were not imported');
  assert(t.importedGridSlots?.length===22,fixture.id+' lost the 22-position editor grid');
  assert(Math.abs(trackLengthPx*PX_M-fixture.length)<25,
    fixture.id+' track length differs from its JSON centerline');
  assert(Math.abs(ASPHALT_HALF_W*PX_M-fixture.width/2)<.15
    &&Math.abs((CURB_OUTER_W-ASPHALT_HALF_W)*PX_M-fixture.curb)<.15,
    fixture.id+' road or kerb width differs from the JSON export');
  const sf=t.startFinishPoint;
  const localStart={x:(sf.x-origin.x)*t.scale,y:(sf.y-origin.y)*t.scale};
  assert(Math.hypot(trackSamples[0].x-localStart.x,trackSamples[0].y-localStart.y)*PX_M<5,
    fixture.id+' start/finish marker was misplaced');
  assert(Math.abs(pitRouteLength*PX_M-fixture.pit)<27
    &&pitWaypoints.length===161&&t.pitProgressSpan>0&&t.pitProgressSpan<.25,
    fixture.id+' pit lane direction or length is wrong');
  const car=new Car('Grid test',1,0,false,false);
  car.placeOnGrid(0);
  const slot=t.importedGridSlots[0];
  const sx=(slot.x-origin.x)*t.scale,sy=(slot.y-origin.y)*t.scale;
  assert(Math.hypot(car.x-sx,car.y-sy)*PX_M<5,
    fixture.id+' first grid slot did not use the uploaded coordinates');
  assert(getTrackInfo(car.x,car.y,-1).dist<ASPHALT_HALF_W,
    fixture.id+' first grid slot is outside the road');
 }

 // The supplied Le Mans grid has 17 places; the remaining five must not overlap.
 selectedTrackIndex=TRACKS_DB.findIndex(t=>t.id==='lemans');buildActiveTrackGeometry();
 const leMansGrid=[];
 for(let slot=0;slot<22;slot++) {
  const car=new Car('Grid test '+slot,slot+1,0,false,false);car.placeOnGrid(slot);
  assert(getTrackInfo(car.x,car.y,-1).dist<ASPHALT_HALF_W,'Le Mans grid slot is outside the road: '+slot);
  if(slot)assert(car.progressAcc<=leMansGrid[slot-1].progressAcc+.0001,'Le Mans grid order is reversed');
  for(const other of leMansGrid)assert(Math.hypot(car.x-other.x,car.y-other.y)*PX_M>5,'Le Mans grid cars overlap');
  leMansGrid.push(car);
 }

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
 // Timed clean laps catch slowdowns and late accidents beyond the opening grid phase.
 aiSettings.pace=100; window.handlingMode='REAL';
 for (const cls of ['GT3','F1']) for (const [id,maxLap] of Object.entries(cls==='GT3'
   ? {imola:117,interlagos:116,spa:87,monza:83.5,fuji:86.5}
   : {imola:87,interlagos:87,spa:68,monza:64,fuji:67})) {
  selectedCarClass=cls;selectedTrackIndex=TRACKS_DB.findIndex(t=>t.id===id);buildActiveTrackGeometry();
  const spec=getActiveCatalog()[0], car=new Car('Pace test',1,0,false,false,spec.drivers[0],0);
  car.assignStrategy({start:'medium',stops:[]});car.placeOnGrid(0);car.form=1;allCars=[car];simTimeMs=0;
  let walls=0, offTrack=0, start=null, lap=null;
  for(let step=0;step<30000;step++) {
   simTimeMs+=1000/60;car.update(1/60,null);
   if((car.dbgDist||0)>WALL_HALF_W-10)walls++;
   if((car.dbgDist||0)>CURB_OUTER_W)offTrack++;
   if(start===null&&car.progressAcc>=0)start=simTimeMs;
   if(car.progressAcc>=1&&start!==null&&lap===null)lap=(simTimeMs-start)/1000;
   if(car.progressAcc>=(id==='interlagos'?3:1))break;
  }
  assert(walls===0&&offTrack===0&&car.damageLevel===0,`AI left the track: ${cls}/${id} (${walls} wall, ${offTrack} off-road frames)`);
  assert((id!=='interlagos'||car.progressAcc>=3)&&lap!==null&&lap<maxLap,`AI lap time regressed: ${cls}/${id} (${lap}s)`);
 }
} finally {
 selectedCarClass=saved.carClass;selectedTrackIndex=saved.track;
 currentSession=saved.session;raceState=saved.raceState;
 window.handlingMode=saved.mode;allCars=saved.cars;simTimeMs=saved.simTime;
 raceMode=saved.raceMode;totalRaceLaps=saved.totalRaceLaps;aiSettings.pace=saved.pace;
 buildActiveTrackGeometry();
}
return {scenarios:cases.length,walls:cases.reduce((n,c)=>n+c.wallFrames,0),
 curbs:cases.reduce((n,c)=>n+c.curbFrames,0),worstOffsetPx:Math.max(...cases.map(c=>c.worstOffsetPx))};
