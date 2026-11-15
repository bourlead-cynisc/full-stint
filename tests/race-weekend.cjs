// Headless integration checks using the game's real tracks, vehicle physics and traffic planner.
const path=require('path');process.chdir(path.resolve(__dirname,'..'));
const fs=require('fs'),vm=require('vm');
const noop=()=>{};let nodes=new Map();
const ctx=new Proxy({measureText:t=>({width:String(t).length*7}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>k in o?o[k]:noop});
function node(id=''){if(nodes.has(id))return nodes.get(id);const n={id,style:{setProperty:noop,removeProperty:noop},dataset:{},classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},getContext:()=>ctx,addEventListener:noop,setAttribute:noop,appendChild:noop,append:noop,remove:noop,querySelector:()=>node('child'),querySelectorAll:()=>[],getBoundingClientRect:()=>({width:1440,height:900,left:0,top:0}),focus:noop,contains:()=>false,clientWidth:200,clientHeight:300,innerHTML:'',textContent:''};nodes.set(id,n);return n;}
const store=new Map();const s={console,Math,Date,JSON,Set,Map,Float32Array,Uint8Array,performance:{now:()=>0},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},document:{getElementById:node,querySelector:()=>node('query'),querySelectorAll:()=>[],createElement:()=>node(Math.random().toString()),addEventListener:noop,documentElement:node('html'),body:node('body'),activeElement:node('body')},navigator:{getGamepads:()=>[]},innerWidth:1440,innerHeight:900,devicePixelRatio:1,addEventListener:noop,requestAnimationFrame:noop,cancelAnimationFrame:noop,setTimeout:noop,clearTimeout:noop,matchMedia:()=>({matches:false,addEventListener:noop}),Image:function(){},ResizeObserver:function(){this.observe=noop},CustomEvent:function(){}};
s.window=s;vm.createContext(s);
const files=['data.js','circuits.js','track-geometry.js','vehicle-character.js','balance.js','models.js','track.js','render2d.js','topview.js','audio.js','race-ai.js','physics.js','custom-tracks.js','season.js','controls.js','ghost.js','main.js'];
vm.runInContext('const SPRITE_DATA={};',s);files.splice(5,0,'sprite-overrides.js');
for(const file of files){let code=fs.readFileSync(file,'utf8');if(file==='main.js')code=code.slice(0,code.indexOf('\napplyMenuTheme();'));try{vm.runInContext(code,s,{filename:file});}catch(e){console.error(file,e);process.exit(1);}}

const calibration=vm.runInContext(String.raw`
(()=>{
const assert=(v,m)=>{if(!v)throw Error(m)};
const report={paints:[],pace:[],balance:[],passing:[]};
selectedCarClass='GT3';selectedCarIndex=0;selectedPaintByCar.aston_gt3=0;buildWeekendRoster();
for(const spec of getActiveCatalog()){
 const cars=allCars.filter(c=>c.spec===spec);const paints=[...new Set(cars.map(c=>c.spriteId))];
 if(cars.length>1)assert(paints.length===2,'Paints not distributed: '+spec.id);
 report.paints.push([spec.id,paints.length]);
}
window.handlingMode='REAL';currentSession='RACE';raceState='RACING';raceMode='LAPS';totalRaceLaps=100;
// Isolated clean laps exercise the complete steering and braking model.
for(const cls of ['GT3','F1'])for(const track of ['monza','imola','spa','interlagos','fuji','lemans']){
 selectedCarClass=cls;selectedTrackIndex=TRACKS_DB.findIndex(t=>t.id===track);buildActiveTrackGeometry();
 simTimeMs=0;const spec=getActiveCatalog()[0],c=new Car('Pace',1,0,false,false,spec.drivers[0],0);c.assignStrategy({start:'medium',stops:[]});c.placeOnGrid(0);c.form=1;allCars=[c];simTimeMs=0;
 let walls=0,lap=null;
 for(let step=0;step<18000;step++){
  simTimeMs+=1000/60;c.update(1/60,null);if(c.dbgDist>WALL_HALF_W-10)walls++;
  if(c.lastLapTime){lap=c.lastLapTime/1000;break;}
 }
 assert(walls===0,'Pace wall: '+cls+'/'+track+' '+walls);assert(c.progressAcc>.3,'Pace stuck '+cls+'/'+track);
 report.pace.push({cls,track,lap:lap&&+lap.toFixed(1),progress:+c.progressAcc.toFixed(2)});
}
// Every GT3 model: same line, tyres, driver and weather, two contrasting circuits.
selectedCarClass='GT3';
for(const track of ['monza','imola']){
 selectedTrackIndex=TRACKS_DB.findIndex(t=>t.id===track);buildActiveTrackGeometry();
 const times=[];
 for(let i=0;i<getActiveCatalog().length;i++){
  simTimeMs=0;const spec=getActiveCatalog()[i],c=new Car('Balance',1,i,false,false,{skill:1,cornerMult:1,aggression:.8},i);
  c.assignStrategy({start:'medium',stops:[]});c.placeOnGrid(0);c.form=1;allCars=[c];simTimeMs=0;let walls=0;
  for(let step=0;step<12000;step++){simTimeMs+=1000/60;c.update(1/60,null);if(c.dbgDist>WALL_HALF_W-10)walls++;if(c.lastLapTime)break;}
  assert(walls===0,'Balance wall '+spec.id+'/'+track);assert(c.lastLapTime,'Balance lap missing '+spec.id);
  times.push({id:spec.id,lap:+(c.lastLapTime/1000).toFixed(2),mass:c.mass,vmax:+c.perf.vmax.toFixed(1)});
 }
 const laps=times.map(c=>c.lap),spread=(Math.max(...laps)/Math.min(...laps)-1)*100;
 assert(spread<4,'Class balance spread exceeds 4% on '+track);
 report.balance.push({track,spread:+spread.toFixed(1),times});
}
return report;
})()
`,s,{timeout:180000});
const racing=vm.runInContext(String.raw`
(()=>{
const report=[];currentSession='RACE';raceState='RACING';raceMode='LAPS';totalRaceLaps=100;window.handlingMode='REAL';
for(const cls of ['GT3','F1'])for(const track of ['monza','imola','spa','interlagos','fuji','lemans']){
 selectedCarClass=cls;selectedTrackIndex=TRACKS_DB.findIndex(t=>t.id===track);buildActiveTrackGeometry();allCars=[];simTimeMs=0;
 for(let slot=0;slot<6;slot++) {const spec=getActiveCatalog()[slot];const c=new Car('Bot '+slot,slot+1,slot,false,false,spec.drivers[0],slot);c.assignStrategy({start:'medium',stops:[]});c.placeOnGrid(slot);c.form=1;allCars.push(c);}
 let walls=0,stalls=0,moves=0;
 for(let step=0;step<3600;step++){
  simTimeMs+=1000/60;
  for(const c of allCars){c.update(1/60,null);if(c.dbgDist>WALL_HALF_W-10)walls++;if(step>600&&c.velocity*MS<1)stalls++;if(c.aiMode==='OVERTAKE')moves++;}
  for(let a=0;a<allCars.length;a++)for(let b=a+1;b<allCars.length;b++)resolveContourCarCollision(allCars[a],allCars[b]);
 }
 if(walls||stalls)throw Error(cls+'/'+track+' walls='+walls+' stalls='+stalls);
 report.push({cls,track,walls,stalls,attackFrames:moves,minProgress:+Math.min(...allCars.map(c=>c.progressAcc)).toFixed(2)});
}
// Deliberately slower rival on a straight: attack must become a completed pass.
selectedCarClass='GT3';selectedTrackIndex=TRACKS_DB.findIndex(t=>t.id==='lemans');buildActiveTrackGeometry();simTimeMs=0;
let start=30,run=0,longest=0;
for(let i=0;i<totalSamples;i++) {
 if(trackSamples[i].kappa/PX_M<.0012)run++;else run=0;
 if(run>longest){longest=run;start=i-run+1;}
}
start=Math.min(totalSamples-20,start+8);
allCars=[];
for(let slot=0;slot<2;slot++){
 const c=new Car(slot?'Attacker':'Leader',slot+1,0,false,false,{skill:1,cornerMult:1,aggression:.85},slot);
 c.assignStrategy({start:'medium',stops:[]});c.placeOnGrid(0);const idx=start+(slot?0:12),p=trackSamples[idx],next=trackSamples[idx+2];c.x=p.x;c.y=p.y;c.angle=Math.atan2(next.x-p.x,-(next.y-p.y));c.syncProgress();c.velocity=(slot?42:30)/MS;c.dx=Math.sin(c.angle)*c.velocity;c.dy=-Math.cos(c.angle)*c.velocity;c.gear=4;c.rpm=.8;c.form=slot?1:.82;allCars.push(c);
}
let passed=false,attack=0,walls=0;
for(let step=0;step<1800;step++){
 simTimeMs+=1000/60;for(const c of allCars){c.update(1/60,null);if(c.dbgDist>WALL_HALF_W-10)walls++;}resolveContourCarCollision(allCars[0],allCars[1]);
 if(allCars[1].aiMode==='OVERTAKE')attack++;
 if(allCars[1].getContinuousTrackDistance()>allCars[0].getContinuousTrackDistance()+allCars[0].height/trackLengthPx)passed=true;
}
if(!passed||walls)throw Error('Controlled pass failed: passed='+passed+' wallFrames='+walls+' attacks='+attack);
return {traffic:report,controlledPass:{passed,wallFrames:walls,attackFrames:attack}};
})()
`,s,{timeout:180000});
console.log(JSON.stringify({paintVariants:calibration.paints,cleanLaps:calibration.pace,balance:calibration.balance,traffic:racing.traffic,controlledPass:racing.controlledPass},null,2));
