const check = (ok, message) => { if (!ok) throw new Error(message); };
const angleErrorDeg=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b))*180/Math.PI);
isPaused = true;
const results = [];
for (const cls of ['GT3','F1']) {
    selectedCarClass = cls;
    for (let track = 0; track < TRACKS_DB.length; track++) {
        selectedTrackIndex = track;
        buildActiveTrackGeometry();
        check(trackLengthPx > 1000 && trackSamples.every(p => Number.isFinite(p.kappa)), 'Invalid geometry '+track);
        check(teamPitBoxes.every(b => Number.isFinite(b.x)), 'Invalid pit boxes');
        const circuit=TRACKS_DB[track],N=totalSamples,entryIndex=Math.round(circuit.pitEntryNorm*N)%N,exitIndex=Math.round(circuit.pitExitNorm*N)%N;
        check(pitWaypoints.length===PIT_WAYPOINT_COUNT,'Pit path resolution '+circuit.id);
        check(Math.hypot(pitWaypoints[0].x-trackSamples[entryIndex].x,pitWaypoints[0].y-trackSamples[entryIndex].y)<1,'Pit entry misses track '+circuit.id);
        check(Math.hypot(pitWaypoints.at(-1).x-trackSamples[exitIndex].x,pitWaypoints.at(-1).y-trackSamples[exitIndex].y)<1,'Pit exit misses track '+circuit.id);
        const heading=(a,b)=>Math.atan2(b.x-a.x,-(b.y-a.y));
        const entryTrack=heading(trackSamples[(entryIndex-4+N)%N],trackSamples[(entryIndex+4)%N]);
        const exitTrack=heading(trackSamples[(exitIndex-4+N)%N],trackSamples[(exitIndex+4)%N]);
        check(angleErrorDeg(heading(pitWaypoints[0],pitWaypoints[1]),entryTrack)<8,'Pit entry angle '+circuit.id);
        check(angleErrorDeg(heading(pitWaypoints.at(-2),pitWaypoints.at(-1)),exitTrack)<8,'Pit exit angle '+circuit.id);
        const middle=pitWaypoints[Math.floor(pitWaypoints.length/2)];
        const expectedMiddle=(entryIndex+Math.round(circuit.pitProgressSpan*N/2))%N;
        check(getTrackInfo(middle.x,middle.y,expectedMiddle).dist>WALL_HALF_W+30,'Pit lane too close to track '+circuit.id);
        check(measurePitLaneClearance(pitWaypoints,{start:entryIndex,span:Math.round(circuit.pitProgressSpan*N)})>=PIT_LANE_CLEARANCE_PX,'Pit lane overlaps another track section '+circuit.id);
        const lineA=pitWaypoints[55],lineB=pitWaypoints[105],lineDx=lineB.x-lineA.x,lineDy=lineB.y-lineA.y,lineLength=Math.hypot(lineDx,lineDy);
        for(let j=65;j<=95;j+=10){const p=pitWaypoints[j];check(Math.abs((p.x-lineA.x)*lineDy-(p.y-lineA.y)*lineDx)/lineLength<4,'Pit straight is curved '+circuit.id);}
        currentSession = 'RACE'; raceState = 'RACING'; raceMode = 'LAPS'; totalRaceLaps = 100;
        simTimeMs = 0;
        const c = new Car('Test',1,0,false,false);
        c.assignStrategy({start:'medium',stops:[]}); c.placeOnGrid(0); allCars=[c];
        for (let n=0; n<7200; n++) {simTimeMs+=1000/60; c.update(1/60,null);}
        check(Number.isFinite(c.x+c.y+c.velocity), 'NaN '+cls+track);
        check(c.progressAcc > .3, 'AI stuck '+cls+track+' '+c.progressAcc);
        const progress = c.progressAcc;
        c.engineDamage=.6;
        const pt=pitWaypoints[0]; c.x=pt.x;c.y=pt.y;c.lastSampleIdx=-1;
        c.nextCompound='hard'; c.pitRequested=true;
        for (let n=0;n<18000 && (c.pitStopsDone===0 || c.pitPhase!=='none');n++) {simTimeMs+=1000/60;c.update(1/60,null);}
        check(c.pitPhase==='none' && c.pitStopsDone===1 && c.compound==='hard' && c.engineDamage===0 && c.suspensionDamage===0 && c.wingDamage===0, 'Pit stuck '+cls+track+' '+c.pitNode+' '+c.pitPhase);
        check(c.lastSampleIdx===exitIndex,'Pit exit lost track branch '+circuit.id);
        results.push({cls,track:TRACKS_DB[track].id,progress:+progress.toFixed(2)});
    }
}
selectedCarClass='F1';selectedTrackIndex=2;buildActiveTrackGeometry();
const make=()=>{const c=new Car('Test',1,0,true,false);c.assignStrategy({start:'medium',stops:[]});c.placeOnGrid(0);return c;};
const a=make(),b=make();a.x=0;a.y=0;b.x=19;b.y=0;a.angle=b.angle=0;a.velocity=b.velocity=10;a.dx=b.dx=0;a.dy=b.dy=-10;
resolveContourCarCollision(a,b);
check(a.velocity===10 && b.velocity===10 && a.wingDamage===0,'Rubbing slows or damages cars');
a.applyImpact(5,1);const low=a.wingDamage;a.wingDamage=0;a.applyImpact(30,1);check(a.wingDamage>low,'Impact severity');
check(Math.abs(getTireGripMultiplier(18.01,90)-getTireGripMultiplier(17.99,90))<.01,'Tire cliff discontinuity');
check(planStints(3,'aggr').length===1 && planStints(10,'bal').length===2,'Strategies mismatch tire life');
// Both drivers share one team box; lap counting follows the straight section's
// actual entry/exit progress and only advances when that section crosses S/F.
const q1=make(),q2=make();
const startingPitLap=q1.lap;
for(const c of [q1,q2]) {const pt=pitWaypoints[0];c.x=pt.x;c.y=pt.y;c.syncProgress();c.sectorsPassed=[true,true,true];c.startPit('hard');}
allCars=[q1,q2];
for(let n=0;n<20000 && allCars.some(c=>c.pitPhase!=='none');n++) {
    simTimeMs+=1000/60;
    for(const c of allCars) c.update(1/60,{throttle:0,brake:0,steer:0});
    check(allCars.filter(c=>c.pitPhase==='service').length<=1,'Team box double booking');
    check(allCars.every(c=>c.pitPhase==='none'||c.velocity*20<=80.01),'Pit speed limit');
}
const pitSectionCrossesStart=TRACKS_DB[selectedTrackIndex].pitExitNorm<TRACKS_DB[selectedTrackIndex].pitEntryNorm;
const expectedPitLap=startingPitLap+(pitSectionCrossesStart?1:0);
check(allCars.every(c=>c.pitStopsDone===1 && c.lap===expectedPitLap),'Pit queue or lap counting failed '+JSON.stringify(allCars.map(c=>({phase:c.pitPhase,stops:c.pitStopsDone,lap:c.lap,node:c.pitNode,entry:c.frontNormProgress,route:c.pitRouteProgress}))));
// Expanding the calendar preserves old completed race results.
const oldSave=localStorage.getItem(SEASON_KEY);
try {
    localStorage.setItem(SEASON_KEY,JSON.stringify({order:[0,1,2,3],results:[{track:0,rows:[]}],team:0,seat:0,number:2}));
    const saved=loadSeason();check(saved.order.length===TRACKS_DB.length && saved.results.length===1 && saved.number===2,'Season migration lost results');
} finally {if(oldSave===null)localStorage.removeItem(SEASON_KEY);else localStorage.setItem(SEASON_KEY,oldSave);}
allCars=[];playerCar=null;currentSession='MENU';
return results;
