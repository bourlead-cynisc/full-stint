// Race traffic planner: all positions are track-space pixels (right of the car
// is positive). It never commands a lane switch across an occupied corridor.
const AI_SETTINGS_KEY='fiaSim.ai.v3';
const AI_LEGACY_SETTINGS_KEY='fiaSim.ai.v2';
function readAiSettings() {
 try {
  const current=localStorage.getItem(AI_SETTINGS_KEY);
  const upgrading=current===null;
  const s=JSON.parse(upgrading?localStorage.getItem(AI_LEGACY_SETTINGS_KEY):current);
  const oldAggression=Number.isFinite(s?.aggression)?Math.max(0,Math.min(100,s.aggression)):68;
  // 45% was the previous automatic preset. Give existing players the new 68%
  // preset once, but keep any custom aggression or pace they selected.
  const aggression=upgrading&&oldAggression===45?68:oldAggression;
  return {pace:Number.isFinite(s?.pace)?Math.max(80,Math.min(110,s.pace)):100,aggression};
 }catch{return {pace:100,aggression:68};}
}
let aiSettings=readAiSettings();
function setAiSetting(name,value) {
 if(!['pace','aggression'].includes(name))return;
 aiSettings[name]=Math.max(name==='pace'?80:0,Math.min(name==='pace'?110:100,Number(value)||0));
 try{localStorage.setItem(AI_SETTINGS_KEY,JSON.stringify(aiSettings));}catch{}
 for(const input of document.querySelectorAll('[data-ai-setting]')){input.value=aiSettings[input.dataset.aiSetting];input.parentElement.querySelector('output').textContent=input.value+'%';}
}
function planRaceTraffic(car,dt) {
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const attack=aiSettings.aggression/100;
 const fx=Math.sin(car.angle),fy=-Math.cos(car.angle),rx=Math.cos(car.angle),ry=Math.sin(car.angle);
 const ownLane=Number.isFinite(car.latOff)?car.latOff:car.aiLane||0;
 const base=Math.max(0,car.lastSampleIdx),point=trackSamples[base];
 const line=dynamicRacingLinePoints[base];
 const lineLane=(line.x-point.x)*point.nx+(line.y-point.y)*point.ny;
 const limit=Math.max(0,ASPHALT_HALF_W-car.width*.5-12);
 const nearby=[];
 for(const other of allCars) {
  if(other===car||other.pitPhase!=='none'||other.finishedRace)continue;
  const dx=other.x-car.x,dy=other.y-car.y,fwd=dx*fx+dy*fy,lat=dx*rx+dy*ry;
  if(Math.abs(fwd)>1100||Math.abs(lat)>ASPHALT_HALF_W*2||fx*Math.sin(other.angle)+fy*(-Math.cos(other.angle))<.45)continue;
  nearby.push({other,fwd,lat,lane:ownLane+lat,v:Math.max(0,other.velocity)*MS});
 }
 const ahead=nearby.filter(o=>o.fwd>car.height*.6&&Math.abs(o.lat)<(car.width+o.other.width)*.5+8).sort((a,b)=>a.fwd-b.fwd)[0];
 const behind=nearby.filter(o=>o.fwd< -car.height&&o.fwd> -650).sort((a,b)=>b.fwd-a.fwd)[0];
 const ds=trackLengthPx/totalSamples;
 let peak=0,immediatePeak=0;
 for(let j=0;j<Math.min(totalSamples,Math.ceil(60/PX_M/ds));j+=2) {
  const k=trackSamples[(base+j)%totalSamples].kappa/PX_M;
  peak=Math.max(peak,k);
  if(j*ds*PX_M<25)immediatePeak=Math.max(immediatePeak,k);
 }
 const corner=peak>.006,dangerous=immediatePeak>.023;
 // Absolute road offsets are shared by traffic planning and the steering controller.
 const free=lane=>nearby.every(o=>o.fwd< -car.height*1.25||o.fwd>Math.max(180,car.velocity*60)||Math.abs(o.lane-lane)>(car.width+o.other.width)*.5+6);
 let target=clamp(lineLane+Math.sin((car.botSlot+1)*2.4)*3,-limit,limit);
 let pace=1,followV=Infinity,overtaking=false,blockedByCar=false;
 car.aiMode='RACING';
 const alongside=nearby.filter(o=>o.fwd> -car.height&&o.fwd<car.height*1.15&&Math.abs(o.lat)<car.width+o.other.width+14).sort((a,b)=>Math.abs(a.fwd)-Math.abs(b.fwd))[0];
 if(alongside) {
  const side=Math.abs(alongside.lat)>3?(alongside.lat>0?-1:1):(car.botSlot<alongside.other.botSlot?-1:1);
  const separation=(car.width+alongside.other.width)*.5+7;
  target=clamp(side<0?Math.min(ownLane,alongside.lane-separation):Math.max(ownLane,alongside.lane+separation),-limit,limit);
  car.aiHoldLane=target;car.aiHoldUntil=simTimeMs+900;car.aiMode='SIDE_BY_SIDE';pace=corner?.97:1;
 } else {
  const rival=nearby.find(o=>o.other===car.aiPassTarget);
  if(rival&&car.velocity*MS>=rival.v*.98&&rival.fwd<950)car.aiPassUntil=Math.max(car.aiPassUntil||0,simTimeMs+1800);
  if(car.aiPassTarget&&(!rival||rival.fwd< -car.height*1.7||simTimeMs>car.aiPassUntil)) {
   car.aiPassTarget=null;car.aiPassUntil=0;
  }
  if(car.aiPassTarget&&rival) {
   const separation=(car.width+rival.other.width)*.5+9;
   target=clamp(rival.lane+(car.aiPassSide||1)*separation,-limit,limit);
   if(Math.abs(target-rival.lane)<separation-2&&rival.fwd>car.height*1.6) {
    const alternative=clamp(rival.lane-(car.aiPassSide||1)*separation,-limit,limit);
    if(Math.abs(alternative-rival.lane)>=separation-2&&free(alternative)){target=alternative;car.aiPassSide=-car.aiPassSide;}
   }
   car.aiPassLane=target;overtaking=true;car.aiMode='OVERTAKE';
   // Preserve commitment through ordinary bends, ending only after clearing the rival.
   pace=corner?.98:1;
  } else if(car.aiHoldUntil>simTimeMs) {
   target=clamp(car.aiHoldLane,-limit,limit);car.aiMode='HOLD_LINE';
  }
  const closing=ahead?car.velocity*MS-ahead.v:0;
  car.aiFollowTime=ahead?Math.min(8,(car.aiFollowTime||0)+dt):0;
  const wants=ahead&&ahead.fwd<Math.min(1050,(20+car.velocity*MS*1.25)/PX_M)
    &&(ahead.v<3||closing>.2||car.aiFollowTime>1.1-attack*.6);
  if(!overtaking&&!dangerous&&wants) {
   const separation=(car.width+ahead.other.width)*.5+8;
   const lanes=[clamp(ahead.lane-separation-3,-limit,limit),clamp(ahead.lane+separation+3,-limit,limit)];
   const options=lanes.filter(l=>Math.abs(l-ahead.lane)>=separation&&free(l));
   options.sort((a,b)=>Math.abs(a-ownLane)-Math.abs(b-ownLane));
   if(options.length) {
    target=options[0];car.aiPassTarget=ahead.other;car.aiPassLane=target;car.aiPassSide=Math.sign(target-ahead.lane);
    car.aiPassUntil=simTimeMs+6500;car.aiMode='OVERTAKE';overtaking=true;
   }
  }
  const leader=nearby.find(o=>o.fwd<60&&o.fwd> -550&&o.other.getContinuousTrackDistance()-car.getContinuousTrackDistance()>.75);
  if(leader&&!overtaking) {
   const lane=clamp(leader.lat>=0?-limit:limit,-limit,limit);
   if(free(lane)){target=lane;pace=.93;car.aiMode='BLUE_FLAG';}
  }
  // One defensive move per straight; never move across an overlapping rival.
  if(corner)car.aiDefenseUsed=false;
  if(!corner&&!ahead&&!overtaking&&behind&&!car.aiDefenseUsed&&attack>.4) {
   const defense=clamp(behind.lane,-limit,limit);
   if(free(defense)){target=defense;car.aiDefenseUsed=true;car.aiHoldLane=target;car.aiHoldUntil=simTimeMs+1200;car.aiMode='DEFEND';}
  }
 }
 for(const o of nearby) {
  if(o.fwd<=0)continue;
  const separation=(car.width+o.other.width)*.5+6;
  const conflict=Math.abs(o.lat)<separation;
  const planned=Math.abs(o.lane-target)<separation;
  if(!conflict&&!planned)continue;
  const gapPx=o.fwd-(car.height+o.other.height)*.5;
  const gapM=Math.max(0,gapPx*PX_M-1.7-Math.max(0,car.velocity*MS)*.19);
  const decel=car.spec.carClass==='F1'?12:8.5;
  let allowed=Math.sqrt(o.v*o.v+2*decel*gapM);
  if(gapPx<12)allowed=Math.min(allowed,o.v*.95);
  if(overtaking&&!planned&&o.v<2&&gapPx>12)allowed=Math.max(allowed,2.2);
  followV=Math.min(followV,allowed);
  if(o.v<2&&gapPx<65&&!overtaking)blockedByCar=true;
 }
 const response=alongside?3.5:overtaking?2.8+attack:2.2;
 car.aiLane=clamp((car.aiLane??ownLane)+(target-(car.aiLane??ownLane))*(1-Math.exp(-dt*response)),-limit,limit);
 return {lane:car.aiLane,followV,pace,pressure:behind?Math.max(0,1+behind.fwd/650):0,blockedByCar,overtaking,corner,alongside:!!alongside};
}
