const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
isPaused=true;currentSession='RACE';raceState='RACING';selectedCarClass='GT3';selectedTrackIndex=2;buildActiveTrackGeometry();
const create=(index=0,player=false)=>{const c=new Car('Feature test',1,index,player,false);c.assignStrategy({start:'medium',stops:[]});c.placeOnGrid(0);c.tireTemp=90;c.form=1;return c;};
check(create(2).character.brakeStability>create(6).character.brakeStability,'Cars have identical braking balance');
check(create(10).character.traction>create(6).character.traction,'Exit traction is not distinct');
const front=create(8),rear=create(8);front.applyImpact(30,1,1);rear.applyImpact(30,1,-1);
check(front.frontWingDamage>0&&front.rearWingDamage===0,'Front wing not isolated');
check(rear.rearWingDamage>0&&rear.frontWingDamage===0&&rear.engineDamage>front.engineDamage,'Rear impact does not reach engine');
const frontEngine=create(0);frontEngine.applyImpact(30,1,1);check(frontEngine.engineDamage>front.engineDamage,'Engine location does not affect impact vulnerability');
const pt=getTrackPointAtProgress(.15),info=getTrackInfo(pt.x,pt.y,-1),n=trackSamples[(info.index+1)%totalSamples];
function acceleration(damage){const c=create(0,true);c.x=pt.x;c.y=pt.y;c.angle=Math.atan2(n.x-pt.x,-(n.y-pt.y));c.velocity=200/20;c.dx=Math.sin(c.angle)*c.velocity;c.dy=-Math.cos(c.angle)*c.velocity;c.gear=5;c.rpm=.7;c.shiftTimer=1;c.smoothThrottle=1;c.engineDamage=damage;allCars=[c];c.update(1/60,{throttle:1,brake:0,steer:0});return c.aLong;}
check(acceleration(0)>acceleration(.8)+.5,'Engine damage has no power consequence');
function probe(index,speed,brake,stability) {
 const c=create(index,true);c.x=pt.x;c.y=pt.y;c.angle=Math.atan2(n.x-pt.x,-(n.y-pt.y));c.velocity=speed/20;c.dx=Math.sin(c.angle)*c.velocity;c.dy=-Math.cos(c.angle)*c.velocity;c.gear=speed<50?1:4;c.rpm=.6;c.shiftTimer=1;c.smoothThrottle=1;
 if(stability!==undefined)c.character={...c.character,brakeStability:stability};
 allCars=[c];c.update(1/60,{throttle:brake?0:1,brake,steer:brake?.5:0});return c;
}
check(probe(10,30,0).aLong>probe(6,30,0).aLong,'Distinct exit traction does not reach physics');
check(probe(0,120,1,.85).yawRate>probe(0,120,1,1.15).yawRate,'Braking stability does not reach steering');
check(probe(8,250,0).dbgGripMax>probe(2,250,0).dbgGripMax,'Aero character has no high-speed grip effect');
const a=create(),b=create(2);a.x=0;a.y=0;b.x=8;b.y=-40;a.angle=b.angle=0;a.dx=b.dx=0;a.dy=-12;b.dy=-7;a.velocity=12;b.velocity=7;
const momentumBefore=a.mass*a.dy+b.mass*b.dy;resolveContourCarCollision(a,b);
check(Math.abs(a.impactSpin)+Math.abs(b.impactSpin)>.01,'Off-center hit does not rotate cars');
check(Math.abs(a.mass*a.dy+b.mass*b.dy-momentumBefore)<1e-6,'Collision impulse violates momentum conservation');
selectedCarClass='F1';buildActiveTrackGeometry();const w1=create(),w2=create();w1.x=0;w1.y=0;w2.x=w1.width*.9;w2.y=w1.height*.5;w1.angle=w2.angle=0;w1.dx=1;w2.dx=-1;w1.dy=w2.dy=-8;w1.velocity=w2.velocity=8;
resolveContourCarCollision(w1,w2);check(w1.suspensionDamage+w2.suspensionDamage>0,'Wheel contact has no suspension consequence');
selectedCarClass='GT3';buildActiveTrackGeometry();
selectedTrackIndex=5;buildActiveTrackGeometry();
let closeBranches=null;
for(let i=0;i<totalSamples&&!closeBranches;i+=2)for(let j=i+40;j<totalSamples;j+=2){if(j-i>totalSamples-40)continue;const a=trackSamples[i],b=trackSamples[j],d=Math.hypot(a.x-b.x,a.y-b.y);if(d<60){closeBranches={i,j,d};break;}}
check(closeBranches,'No close-branch geometry fixture');
const crossing={x:(trackSamples[closeBranches.i].x+trackSamples[closeBranches.j].x)/2,y:(trackSamples[closeBranches.i].y+trackSamples[closeBranches.j].y)/2};
const branchA=getTrackInfo(crossing.x,crossing.y,closeBranches.i),branchB=getTrackInfo(crossing.x,crossing.y,closeBranches.j);
const indexGap=(a,b)=>Math.min(Math.abs(a-b),totalSamples-Math.abs(a-b));
check(indexGap(branchA.index,closeBranches.i)<12&&indexGap(branchB.index,closeBranches.j)<12,'Track locator jumps to the other branch');
const pitEntryNormTest=TRACKS_DB[selectedTrackIndex].pitEntryNorm,entryPx=20/trackLengthPx;
check(!isPitEntryProgress(pitEntryNormTest-3*entryPx,pitEntryNormTest-5*entryPx),'Pit starts before the entry trigger');
check(isPitEntryProgress(pitEntryNormTest+entryPx,pitEntryNormTest-entryPx),'Pit misses the entry crossing');
check(!isPitEntryProgress(pitEntryNormTest+3*entryPx,pitEntryNormTest+entryPx),'Pit starts after the entry point');
const oldSettings={...aiSettings};
try {
 setAiSetting('aggression',55);
 const self=create(),other=create();self.x=0;self.y=0;self.angle=0;self.velocity=10;self.latOff=0;
 const straight=trackSamples.findIndex((p,i)=>p.futCurv<.03&&trackSamples[(i+45)%totalSamples].futCurv<.04);check(straight>=0,'No straight fixture');self.lastSampleIdx=straight;self.aiNextMistake=Infinity;
 other.x=0;other.y=-300;other.velocity=8;allCars=[self,other];
 check((planRaceTraffic(self,.5),self.aiMode)==='OVERTAKE','AI does not prepare an overtake');
 self.aiPassSide=0;other.y=300;other.velocity=12;planRaceTraffic(self,.5);check(self.aiMode==='DEFEND','AI does not defend');
 const firstLane=self.aiDefenseLane;other.x=-20;planRaceTraffic(self,.5);check(self.aiDefenseLane===firstLane,'AI weaves repeatedly on one straight');
 other.progressAcc=self.progressAcc+1.2;const yieldPlan=planRaceTraffic(self,.5);check(self.aiMode==='BLUE_FLAG'&&yieldPlan.pace<1,'Lapped AI does not yield');
 self.aiYieldUntil=0;self.aiDefenseLane=null;self.aiPassSide=0;self.aiNextMistake=Infinity;self.x=0;self.y=0;self.angle=0;self.velocity=0;self.latOff=0;
 other.x=0;other.y=-70;other.angle=0;other.velocity=0;other.progressAcc=self.progressAcc;allCars=[self,other];
 const blockedPlan=planRaceTraffic(self,1/60);check(self.aiMode==='OVERTAKE'&&blockedPlan.overtaking&&blockedPlan.followV===Infinity&&!blockedPlan.blockedByCar,'AI waits behind a stopped car instead of passing');
 allCars=[self];self.aiYieldUntil=0;self.aiDefenseLane=null;self.x=trackSamples[straight].x;self.y=trackSamples[straight].y;self.latOff=0;
 setAiSetting('pace',80);self.aiControls(1/60);const slow=self.dbgVAllow;
 setAiSetting('pace',110);self.aiControls(1/60);check(self.dbgVAllow>slow,'Pace slider has no effect');
 other.progressAcc=self.progressAcc;other.x=0;other.y=150;allCars=[self,other];self.aiYieldUntil=0;self.aiNextMistake=0;let pressureError=false;const oldTime=simTimeMs;
 for(let i=0;i<200&&!pressureError;i++){simTimeMs+=5000;planRaceTraffic(self,.1);pressureError=self.aiMode==='PRESSURE';}simTimeMs=oldTime;check(pressureError,'Pressure never causes a recoverable mistake');
 setAiSetting('aggression',0);check(aiSettings.pace===110,'Aggression changes pace');
} finally {setAiSetting('pace',oldSettings.pace);setAiSetting('aggression',oldSettings.aggression);}
const damagedBot=create(),entry=pitWaypoints[0],entryIdx=Math.round(TRACKS_DB[selectedTrackIndex].pitEntryNorm*totalSamples)%totalSamples,entryBefore=trackSamples[(entryIdx-4+totalSamples)%totalSamples],entryAfter=trackSamples[(entryIdx+4)%totalSamples];
currentSession='RACE';raceMode='LAPS';raceState='RACING';damagedBot.x=entry.x;damagedBot.y=entry.y;damagedBot.angle=Math.atan2(entryAfter.x-entryBefore.x,-(entryAfter.y-entryBefore.y));damagedBot.syncProgress();
damagedBot.prevNorm=(TRACKS_DB[selectedTrackIndex].pitEntryNorm-100/trackLengthPx+1)%1;damagedBot.engineDamage=.7;allCars=[damagedBot];raceMode='LAPS';totalRaceLaps=100;damagedBot.update(1/60,null);check(damagedBot.pitPhase!=='none','Damaged AI does not request a repair');
function steeringResponse(mode){
 const c=create(0,true),p=getTrackPointAtProgress(.15),info=getTrackInfo(p.x,p.y,-1),a=trackSamples[info.index],b=trackSamples[(info.index+1)%totalSamples];
 const angle=Math.atan2(b.x-a.x,-(b.y-a.y));c.x=p.x;c.y=p.y;c.angle=angle;c.velocity=100/20;c.dx=Math.sin(angle)*c.velocity;c.dy=-Math.cos(angle)*c.velocity;c.gear=4;c.rpm=.65;c.shiftTimer=1;c.syncProgress();allCars=[c];
 const previousMode=window.handlingMode;window.handlingMode=mode;
 for(let i=0;i<60;i++)c.update(1/60,{throttle:0,brake:0,steer:1});
 window.handlingMode=previousMode;
 let change=c.angle-angle;while(change>Math.PI)change-=Math.PI*2;while(change< -Math.PI)change+=Math.PI*2;return Math.abs(change);
}
check(steeringResponse('ARCADE')>.45,'Arcade steering response remains too weak');
check(steeringResponse('REAL')>.35,'Realistic steering response remains too weak');
// Record an actual lap using the ordinary physics; no fabricated timing samples.
selectedCarClass='GT3';selectedTrackIndex=2;selectedCarIndex=0;buildWeekendRoster();
const seasonBefore=JSON.stringify(season),seasonSave=localStorage.getItem(SEASON_KEY),key=trialKey(),oldGhost=localStorage.getItem(key);
try {
 localStorage.removeItem(key);startTimeTrialSession();isPaused=true;playerCar.humanControls=function(dt){return this.aiControls(dt,.8);};
 for(let i=0;i<30000&&!trialState.best;i++)stepSimulation({throttle:0,brake:0,steer:0});
 check(trialState.best,'No clean lap recorded: '+trialState.reason);
 const best=trialState.best;check(loadGhost(key)?.time===best.time,'Ghost does not persist');
 check(allCars.length===1&&aiCars.length===0,'Ghost mode includes physical opponents');
 const sample=best.samples[Math.floor(best.samples.length/2)];const pose=ghostPoseAt(sample[0]);
 check(pose&&Math.hypot(pose.x-sample[1],pose.y-sample[2])<.01,'Ghost replay is not aligned to recorded time');
 invalidateTrialLap('Test cut');finishTrialLap(playerCar,best.time-100);check(trialState.best===best,'Invalid lap overwrites clean record');
 startTimeTrialSession();isPaused=true;check(trialState.best?.time===best.time,'Restart loses personal record');
 beginTrialLap(playerCar);const edge=getTrackPointAtProgress(.1);playerCar.x=edge.x+edge.nx*200;playerCar.y=edge.y+edge.ny*200;recordTrialFrame();check(trialState.invalid,'Off-track lap remains valid');
 const beforeKey=trialKey();window.handlingMode=window.handlingMode==='REAL'?'ARCADE':'REAL';check(trialKey()!==beforeKey,'Different physics share a ghost record');window.handlingMode=beforeKey.includes(':REAL:')?'REAL':'ARCADE';
 localStorage.setItem(key,'{"time":10000,"samples":[[0,0,0,0,0]]}');check(loadGhost(key)===null,'Corrupt replay accepted');
 check(JSON.stringify(season)===seasonBefore&&localStorage.getItem(SEASON_KEY)===seasonSave,'Time trial changes season results');
} finally {if(oldGhost===null)localStorage.removeItem(key);else localStorage.setItem(key,oldGhost);currentSession='MENU';isPaused=true;trialState=null;allCars=[];aiCars=[];playerCar=null;}
return {cars:'distinct braking and traction',damage:'front/rear wings, suspension, engine power',contacts:'momentum and spin, wheel hooks',ai:'overtake, defense, blue flags, separate difficulty',ghost:'real lap, persistence, replay, invalidation, isolation'};
