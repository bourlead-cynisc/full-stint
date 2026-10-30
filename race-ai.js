const AI_SETTINGS_KEY='fiaSim.ai.v1';
function readAiSettings() {
 try {const s=JSON.parse(localStorage.getItem(AI_SETTINGS_KEY));return {pace:Number.isFinite(s?.pace)?Math.max(80,Math.min(110,s.pace)):100,aggression:Number.isFinite(s?.aggression)?Math.max(0,Math.min(100,s.aggression)):55};}
 catch{return {pace:100,aggression:55};}
}
let aiSettings=readAiSettings();
function setAiSetting(name,value) {
 if(!['pace','aggression'].includes(name))return;
 aiSettings[name]=Math.max(name==='pace'?80:0,Math.min(name==='pace'?110:100,Number(value)||0));
 try{localStorage.setItem(AI_SETTINGS_KEY,JSON.stringify(aiSettings));}catch{}
 for(const input of document.querySelectorAll('[data-ai-setting]')){input.value=aiSettings[input.dataset.aiSetting];input.parentElement.querySelector('output').textContent=input.value+'%';}
}
function planRaceTraffic(car,dt) {
 const attack=aiSettings.aggression/100,fx=Math.sin(car.angle),fy=-Math.cos(car.angle),rx=Math.cos(car.angle),ry=Math.sin(car.angle);
 const nearby=[];
 for(const other of allCars) {
  if(other===car||other.pitPhase!=='none')continue;
  const dx=other.x-car.x,dy=other.y-car.y,fwd=dx*fx+dy*fy,lat=dx*rx+dy*ry;
  if(Math.abs(fwd)<850&&Math.abs(lat)<160)nearby.push({other,fwd,lat});
 }
 const ahead=nearby.filter(o=>o.fwd>0&&Math.abs(o.lat)<55).sort((a,b)=>a.fwd-b.fwd)[0];
 const behind=nearby.filter(o=>o.fwd< -car.height&&Math.abs(o.lat)<60).sort((a,b)=>b.fwd-a.fwd)[0];
 const leader=nearby.find(o=>o.fwd<100&&o.fwd> -850&&o.other.getContinuousTrackDistance()-car.getContinuousTrackDistance()>.75);
 const sample=trackSamples[Math.max(0,car.lastSampleIdx)],corner=sample.futCurv>.11;
 const free=lane=>!nearby.some(o=>o.fwd> -80&&o.fwd<160&&Math.abs((car.latOff||0)+o.lat-lane)<car.width+8);
 let target=(((car.botSlot*7)%5)-2)*4,followV=Infinity,pace=1;
 car.aiMode='RACING';
 if(leader) {
  if(!(car.aiYieldUntil>simTimeMs))car.aiYieldLane=leader.lat>=0?-40:40;
  car.aiYieldUntil=simTimeMs+1600;
 }
 if(car.aiYieldUntil>simTimeMs) {target=car.aiYieldLane;pace=.84;car.aiMode='BLUE_FLAG';}
 else {
  if(corner){car.aiDefenseUsed=false;car.aiDefenseLane=null;}
  if(ahead && ahead.fwd>70 && ahead.fwd<750 && (car.velocity>ahead.other.velocity+.2 || (ahead.fwd<230&&car.velocity>ahead.other.velocity-.15))) {
   if(!car.aiPassSide || !free(car.aiPassSide*36)) {
    const left=free(-36),right=free(36);
    car.aiPassSide=left&&right?(ahead.lat>=0?-1:1):left?-1:right?1:0;
   }
   if(car.aiPassSide){target=car.aiPassSide*36;car.aiMode='OVERTAKE';}
  } else car.aiPassSide=0;
  if((!ahead||ahead.fwd>300)&&car.aiMode!=='OVERTAKE'&&!corner&&behind&&behind.fwd< -90&&behind.fwd> -600&&attack>.15&&!car.aiDefenseUsed) {
   const future=trackSamples[(Math.max(0,car.lastSampleIdx)+45)%totalSamples];
   const side=Math.abs(future.curv)>.02?Math.sign(future.curv):(behind.lat>=0?1:-1);
   if(free(side*28)){car.aiDefenseLane=side*28;car.aiDefenseUsed=true;}
  }
  if(car.aiDefenseLane!=null&&!corner&&(!ahead||ahead.fwd>300)&&car.aiMode!=='OVERTAKE') {target=car.aiDefenseLane;car.aiMode='DEFEND';}
 }
 if(!free(target))target=car.aiLane||0;
 if(ahead) {
  const closing=Math.max(0,car.velocity-ahead.other.velocity);
  const gap=100+(1-attack)*65+closing*42;
  if(ahead.fwd<gap&&Math.abs(ahead.lat)<car.width+12)followV=Math.max(0,ahead.other.velocity)*MS*(ahead.fwd<55?.8:.98);
 }
 const pressure=behind?Math.max(0,1+behind.fwd/600):0;
 if(simTimeMs>(car.aiNextMistake||0)) {
  car.aiNextMistake=simTimeMs+6500+(car.botSlot%5)*500;
  const noise=(Math.sin((car.botSlot+1)*12.9898+Math.floor(simTimeMs/4000)*78.233)*43758.5453)%1;
  if(pressure>.3&&Math.abs(noise)>.997-pressure*.01) {car.aiErrorTime=.35;car.aiErrorSide=(car.botSlot%2?1:-1)*4;}
 }
 if(car.aiErrorTime>0) {car.aiErrorTime-=dt;target+=car.aiErrorSide;pace*=.97;car.aiMode='PRESSURE';}
 car.aiLane=(car.aiLane||0)+(target-(car.aiLane||0))*(1-Math.exp(-dt*(1.6+attack)));
 return {lane:Math.max(-43,Math.min(43,car.aiLane)),followV,pace,pressure};
}
