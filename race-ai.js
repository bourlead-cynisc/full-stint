// Race traffic planner: all positions are track-space pixels (right of the car
// is positive). It never commands a lane switch across an occupied corridor.
const AI_SETTINGS_KEY='fiaSim.ai.v2';
function readAiSettings() {
 try {const s=JSON.parse(localStorage.getItem(AI_SETTINGS_KEY));return {pace:Number.isFinite(s?.pace)?Math.max(80,Math.min(110,s.pace)):100,aggression:Number.isFinite(s?.aggression)?Math.max(0,Math.min(100,s.aggression)):68};}
 catch{return {pace:100,aggression:68};}
}
let aiSettings=readAiSettings();
function setAiSetting(name,value) {
 if(!['pace','aggression'].includes(name))return;
 aiSettings[name]=Math.max(name==='pace'?80:0,Math.min(name==='pace'?110:100,Number(value)||0));
 try{localStorage.setItem(AI_SETTINGS_KEY,JSON.stringify(aiSettings));}catch{}
 for(const input of document.querySelectorAll('[data-ai-setting]')){input.value=aiSettings[input.dataset.aiSetting];input.parentElement.querySelector('output').textContent=input.value+'%';}
}
function planRaceTraffic(car,dt) {
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const attack=aiSettings.aggression/100;
 const fx=Math.sin(car.angle),fy=-Math.cos(car.angle),rx=Math.cos(car.angle),ry=Math.sin(car.angle);
 const ownLane=Number.isFinite(car.latOff)?car.latOff:(car.aiLane||0);
 const nearby=[];
 for(const other of allCars) {
  if(other===car||other.pitPhase!=='none'||other.finishedRace)continue;
  const dx=other.x-car.x,dy=other.y-car.y,fwd=dx*fx+dy*fy,lat=dx*rx+dy*ry;
  const alignment=fx*Math.sin(other.angle)+fy*(-Math.cos(other.angle));
  if(Math.abs(fwd)>1100||Math.abs(lat)>175||alignment<0.35)continue;
  nearby.push({other,fwd,lat,lane:ownLane+lat,v:Math.max(0,other.velocity)*MS});
 }
 const ahead=nearby.filter(o=>o.fwd>0&&Math.abs(o.lat)<car.width+24).sort((a,b)=>a.fwd-b.fwd)[0];
 const behind=nearby.filter(o=>o.fwd< -car.height&&Math.abs(o.lat)<car.width+36).sort((a,b)=>b.fwd-a.fwd)[0];
 const base=Math.max(0,car.lastSampleIdx),ds=trackLengthPx/totalSamples;
 const horizon=Math.min(totalSamples-1,Math.ceil((145/PX_M)/ds));
 let peak=0;
 for(let j=0;j<=horizon;j+=3)peak=Math.max(peak,(trackSamples[(base+j)%totalSamples].kappa||0)/PX_M);
 const corner=peak>.005;
 // A hairpin close ahead blocks a NEW overtake, but long gentle bends do not.
 // Keep the normal long lookahead for braking and the short one for racing decisions.
 const attackHorizon=Math.min(totalSamples-1,Math.ceil((80/PX_M)/ds));
 let severePeak=0;
 for(let j=0;j<=attackHorizon;j+=2) severePeak=Math.max(severePeak,(trackSamples[(base+j)%totalSamples].kappa||0)/PX_M);
 const dangerousCorner=severePeak>.0085;
 const laneMargin=ASPHALT_HALF_W-car.width*.55-13;
 const laneLimit=Math.min(43,laneMargin);
 const free=lane=>nearby.every(o=>o.fwd< -car.height*1.2||o.fwd>240||Math.abs(o.lane-lane)>(car.width+o.other.width)*.5+12);
 let target=clamp((((car.botSlot*7)%5)-2)*3,-laneLimit,laneLimit);
 let followV=Infinity,pace=1,overtaking=false,blockedByCar=false;
 car.aiMode='RACING';

 // Use the *actual* side of a nearby car. Alternating slot numbers alone do
 // not describe where cars are after overtakes or collisions.
 const alongside=nearby.filter(o=>o.fwd> -car.height*.95&&o.fwd<car.height*1.35&&Math.abs(o.lat)<car.width+o.other.width+25)
   .sort((a,b)=>Math.abs(a.fwd)+Math.abs(a.lat)*.25-(Math.abs(b.fwd)+Math.abs(b.lat)*.25))[0];
 if(alongside) {
  const side=Math.abs(alongside.lat)>car.width*.22
   ? (alongside.lat>0?-1:1)
   : ((car.botSlot||0)<(alongside.other.botSlot||0)?-1:1);
  const required=(car.width+alongside.other.width)*.5+13;
  target=side<0?Math.min(ownLane,alongside.lane-required):Math.max(ownLane,alongside.lane+required);
  target=clamp(target,-laneLimit,laneLimit);
  car.aiHoldLane=target;
  car.aiHoldUntil=simTimeMs+1600;
  car.aiMode='SIDE_BY_SIDE';
  // Side by side is a racing situation, not an automatic 10–23% slowdown.
  // Save a speed reserve only if both cars are entering a bend.
  pace=corner?(.81+.08*attack):(.96+.04*attack);
 } else if(car.aiHoldUntil>simTimeMs) {
  target=clamp(car.aiHoldLane||0,-laneLimit,laneLimit);
  pace=corner?.85:1;
  car.aiMode='HOLD_LINE';
 }

 const leader=nearby.find(o=>o.fwd<120&&o.fwd> -850&&o.other.getContinuousTrackDistance()-car.getContinuousTrackDistance()>.75);
 if(leader) {
  if(!(car.aiYieldUntil>simTimeMs))car.aiYieldLane=free(leader.lat>=0?-32:32)?(leader.lat>=0?-32:32):0;
  car.aiYieldUntil=simTimeMs+1600;
 }
 if(!alongside&&!(car.aiHoldUntil>simTimeMs)&&car.aiYieldUntil>simTimeMs) {
  target=corner?ownLane:(car.aiYieldLane||0);
  pace=.83;
  car.aiMode='BLUE_FLAG';
 } else if(!alongside&&!(car.aiHoldUntil>simTimeMs)) {
  if(corner){car.aiDefenseUsed=false;car.aiDefenseLane=null;}
  const stopped=ahead&&ahead.fwd<200&&ahead.v<2;
  const closing=ahead&&car.velocity*MS-ahead.v;
  if(ahead&&ahead.fwd<760&&ahead.fwd>car.height*.9&&closing> -1.2) {
   car.aiFollowTime=Math.min(6,(car.aiFollowTime||0)+dt);
  } else car.aiFollowTime=Math.max(0,(car.aiFollowTime||0)-dt*1.5);

  // Keep the chosen outside lane until the rival is visibly behind.
  // This prevents aborting every move as soon as the other car leaves our
  // narrow forward sensor, which previously produced long single-file trains.
  const passRival=nearby.find(o=>o.other===car.aiPassTarget);
  if(car.aiPassTarget&&passRival&&passRival.fwd< -car.height*1.7) {
   car.aiPassTarget=null;car.aiPassUntil=0;car.aiPassSide=0;
  }
  const activeRival=nearby.find(o=>o.other===car.aiPassTarget);
  if(car.aiPassTarget&&activeRival&&!dangerousCorner&&simTimeMs<(car.aiPassUntil||0)) {
   target=clamp(car.aiPassLane||0,-laneLimit,laneLimit);
   if(free(target)||Math.abs(activeRival.lane-target)>car.width+10) {
    car.aiMode='OVERTAKE';overtaking=true;
    car.aiPassUntil=simTimeMs+1200;
    car.aiPassSide=Math.sign(target-activeRival.lane);
   }
  }
  // Do not carry a new pass across the entrance to a tight corner.
  if(car.aiPassTarget&&dangerousCorner&&!alongside) {
   car.aiPassTarget=null;car.aiPassUntil=0;car.aiPassSide=0;overtaking=false;
  }
  const wantsToPass=ahead&&ahead.fwd>car.height*.95&&ahead.fwd<(stopped?660:880)
   &&(stopped||closing>(.12+.35*(1-attack))||car.aiFollowTime>1.4-attack*.9);
  if(!overtaking&&!dangerousCorner&&wantsToPass) {
   const separation=(car.width+ahead.other.width)*.5+14;
   const offset=Math.max(37,separation+2);
   const lanes=[clamp(ahead.lane-offset,-laneLimit,laneLimit),clamp(ahead.lane+offset,-laneLimit,laneLimit)];
   const options=lanes.filter(lane=>Math.abs(lane-ahead.lane)>=separation&&free(lane));
   if(options.length) {
    // Consistent choice of side; do not weave left/right each frame.
    options.sort((a,b)=>Math.abs(a-ownLane)-Math.abs(b-ownLane)
     +((car.aiPassSide||0)&&Math.sign(a-ahead.lane)!==car.aiPassSide?13:0)
     -((car.aiPassSide||0)&&Math.sign(b-ahead.lane)!==car.aiPassSide?13:0));
    target=options[0];car.aiPassLane=target;car.aiPassTarget=ahead.other;
    car.aiPassUntil=simTimeMs+1500;car.aiPassSide=Math.sign(target-ahead.lane);
    car.aiMode='OVERTAKE';overtaking=true;car.aiFollowTime=0;
   }
  }
  if(!corner&&!overtaking&&!ahead&&behind&&behind.fwd> -550&&attack>.15&&!car.aiDefenseUsed) {
   const side=behind.lat>=0?1:-1,defenseLane=clamp(side*27,-laneLimit,laneLimit);
   if(free(defenseLane)){car.aiDefenseLane=defenseLane;car.aiDefenseUsed=true;}
  }
  if(!corner&&!overtaking&&car.aiDefenseLane!=null&&!ahead) {
   target=car.aiDefenseLane;car.aiMode='DEFEND';
  }
 }

 // Never force a car from one side of another to the other during a corner.
 // When racing alone on the bend, gradually return towards the race centre.
 if(corner&&!alongside&&!overtaking&&!(car.aiHoldUntil>simTimeMs)&&car.aiMode!=='BLUE_FLAG')target=0;
 if(!alongside&&!corner&&!free(target))target=clamp(ownLane,-laneLimit,laneLimit);

 // Headway uses physical stopping distance, not an arbitrary 100px trigger.
 // Project the neighbouring car into the desired corridor before accelerating.
 for(const o of nearby) {
  if(o.fwd<=0||o.fwd>1000)continue;
  const currentConflict=Math.abs(o.lat)<(car.width+o.other.width)*.5+14;
  const plannedConflict=Math.abs(o.lane-target)<(car.width+o.other.width)*.5+14;
  if(!currentConflict&&!plannedConflict)continue;
  const gapPx=o.fwd-(car.height+o.other.height)*.5;
  const gapM=Math.max(0,gapPx*PX_M-5.5);
  const safeDecel=car.spec?.carClass==='F1'?11:7.2;
  let allowed=Math.sqrt(o.v*o.v+2*safeDecel*gapM);
  if(gapPx<40)allowed=Math.min(allowed,o.v*.96);
  // Speed is released only after the car has ACTUALLY moved out of
  // the leader's corridor, never merely because the steering target changed.
  followV=Math.min(followV,allowed);
  if(o.v<2&&o.fwd<110)blockedByCar=true;
 }
 if(alongside) {
  // Avoid sudden full braking in the middle of a side-by-side fight.
  const next=alongside.fwd>car.height*.3?Math.max(alongside.v*.92,alongside.v-3):Infinity;
  followV=Math.min(followV,next);
 }
 if(simTimeMs>(car.aiNextMistake||0)){
  car.aiNextMistake=simTimeMs+9000+(car.botSlot%5)*500;
  const pressure=behind?Math.max(0,1+behind.fwd/600):0;
  const noise=Math.abs(Math.sin((car.botSlot+1)*12.9898+Math.floor(simTimeMs/4000)*78.233)*43758.5453)%1;
  if(!corner&&!alongside&&pressure>.3&&noise>.997-pressure*.01){car.aiErrorTime=.22;car.aiErrorSide=(car.botSlot%2?1:-1)*3;}
 }
 if(car.aiErrorTime>0){car.aiErrorTime-=dt;if(!corner&&!alongside){target+=car.aiErrorSide;pace*=.97;car.aiMode='PRESSURE';}}
 const laneResponse=alongside?2.5:overtaking?(2.1+attack*1.15):corner?2.7:1.5+attack*.6;
 car.aiLane=clamp((car.aiLane||0)+(clamp(target,-laneLimit,laneLimit)-(car.aiLane||0))*(1-Math.exp(-dt*laneResponse)),-laneLimit,laneLimit);
 return {lane:car.aiLane,followV,pace,pressure:behind?Math.max(0,1+behind.fwd/600):0,blockedByCar,overtaking,corner,alongside:!!alongside};
}