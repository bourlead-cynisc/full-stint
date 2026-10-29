const GHOST_VERSION='v3-20261030';
let trialState=null;
const sessionGhosts=new Map();
function trialKey() {
 const track=TRACKS_DB[selectedTrackIndex],spec=getActiveCatalog()[selectedCarIndex];
 return `fiaSim.ghost.${GHOST_VERSION}:${track.id}:${track.layoutVersion}:${spec.id}:${window.handlingMode}:${window.transmissionMode}`;
}
function loadGhost(key) {
 try {
  const data=JSON.parse(localStorage.getItem(key));
  if(!data||!Number.isFinite(data.time)||data.time<5000||data.time>3600000||!Array.isArray(data.samples)||data.samples.length<50||data.samples.length>40000)return null;
  let previous=-1;
  for(const sample of data.samples) {
   if(!Array.isArray(sample)||sample.length!==5||!sample.every(Number.isFinite)||sample[0]<=previous||sample[0]<0||sample[0]>data.time||Math.abs(sample[1])+Math.abs(sample[2])>1e7)return null;
   previous=sample[0];
  }
  if(data.samples[0][0]!==0||Math.abs(data.samples.at(-1)[0]-data.time)>1)return null;
  return data;
 } catch{return null;}
}
function beginTrialLap(car) {
 if(!trialState)return;
 trialState.active=true;trialState.invalid=false;trialState.reason='';trialState.startMs=simTimeMs;
 trialState.startProgress=car.progressAcc;trialState.samples=[[0,car.x,car.y,car.angle,0]];
 trialState.reference=trialState.best;
 car.tireHealth=100;car.tireTemp=90;car.wingDamage=car.suspensionDamage=car.engineDamage=car.bodyDamage=0;
 car.suspensionPull=car.impactSpin=0;
}
function invalidateTrialLap(reason) {
 if(!trialState?.active||trialState.invalid)return;
 trialState.invalid=true;trialState.reason=reason;
 showRaceControl('Круг не засчитан: '+reason+'. Следующий — новая попытка.','#fca5a5');
}
function recordTrialFrame() {
 if(currentSession!=='TIME_TRIAL'||!trialState)return;
 const car=playerCar;car.tireHealth=100;car.tireTemp=90;
 if(!trialState.active)return;
 const info=getTrackInfo(car.x,car.y,car.lastSampleIdx);
 if(info.dist>CURB_OUTER_W-car.width*.2)invalidateTrialLap('Выезд за пределы трассы');
 if(car.velocity<-.05)invalidateTrialLap('Движение задним ходом');
 const elapsed=simTimeMs-trialState.startMs;
 const last=trialState.samples.at(-1);
 if(elapsed>=3600000){invalidateTrialLap('Превышена длительность попытки');return;}
 if(elapsed-last[0]>=100)trialState.samples.push([elapsed,car.x,car.y,car.angle,Math.max(last[4],Math.min(1,car.progressAcc-trialState.startProgress))]);
}
function finishTrialLap(car,time) {
 if(!trialState?.active)return false;
 const info=getTrackInfo(car.x,car.y,car.lastSampleIdx);
 if(info.dist>CURB_OUTER_W-car.width*.2)invalidateTrialLap('Выезд за пределы трассы');
 if(car.velocity<-.05)invalidateTrialLap('Движение задним ходом');
 const valid=!trialState.invalid&&time>=5000&&trialState.samples.length>=50;
 const last=trialState.samples.at(-1);
 if(time>last[0])trialState.samples.push([time,car.x,car.y,car.angle,1]);
 trialState.lastLap={time,valid,reason:trialState.reason};
 if(valid&&(!trialState.best||time<trialState.best.time)) {
  trialState.best={time,samples:trialState.samples};
  try{localStorage.setItem(trialState.key,JSON.stringify(trialState.best));trialState.sessionOnly=false;sessionGhosts.delete(trialState.key);}
  catch{trialState.sessionOnly=true;sessionGhosts.set(trialState.key,trialState.best);}
  showRaceControl('Новый личный рекорд: '+formatTime(time)+' · призрак сохранён'+(trialState.sessionOnly?' в этой сессии':''),'#67e8f9');
 }
 beginTrialLap(car);return valid;
}
function startTimeTrialSession() {
 initAudio();hideAllModals();currentSession='TIME_TRIAL';isPaused=false;raceState='RACING';simTimeMs=0;
 clearInputs();resetEffects();aiCars=[];allCars=[playerCar];
 playerCar.placeForQualifying(0,1);playerCar.compound='medium';playerCar.tireTemp=90;playerCar.wearScale=0;
 const key=trialKey(),disk=loadGhost(key),cached=sessionGhosts.get(key);
 const best=cached&&(!disk||cached.time<disk.time)?cached:disk;
 trialState={key,best,reference:best,active:false,invalid:false,samples:[],lastLap:null,sessionOnly:!!(cached&&best===cached)};
 playerCar.bestLapTime=best?.time||null;sessionBestLap={time:best?.time||null,driverName:playerCar.driverName,carName:playerCar.spec.shortName};
 rebuildEngineVoices();document.getElementById('sessionLabel').textContent='ГОНКА С ПРИЗРАКОМ';
 document.getElementById('start-lights').style.opacity=0;releaseFocus();
 showRaceControl(best?'Пересеките старт — призрак начнёт лучший круг вместе с вами.':'Первый чистый круг запишет вашего призрака.','#67e8f9');
}
function ghostPoseAt(elapsed) {
 const samples=trialState?.reference?.samples;
 if(!trialState?.active||!samples||elapsed<0||elapsed>trialState.reference.time)return null;
 let lo=0,hi=samples.length-1;
 while(lo+1<hi){const mid=(lo+hi)>>1;if(samples[mid][0]<=elapsed)lo=mid;else hi=mid;}
 const a=samples[lo],b=samples[hi],t=(elapsed-a[0])/Math.max(1,b[0]-a[0]);
 const angleDelta=Math.atan2(Math.sin(b[3]-a[3]),Math.cos(b[3]-a[3]));
 return {x:a[1]+(b[1]-a[1])*t,y:a[2]+(b[2]-a[2])*t,angle:a[3]+angleDelta*t};
}
function drawTrialGhost(ctx,overviewScale=0) {
 if(currentSession!=='TIME_TRIAL')return;
 const pose=ghostPoseAt(simTimeMs-trialState.startMs);if(!pose)return;
 const mul=overviewScale?Math.max(1,34/(playerCar.height*overviewScale)):1;
 ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.angle);ctx.scale(mul,mul);ctx.globalAlpha=.36;
 drawCarSpriteTop(ctx,{spec:playerCar.spec,livery:playerCar.livery,width:playerCar.width,height:playerCar.height,compound:'medium',wingDamage:0,braking:false,drsActive:false,driverNumber:playerCar.driverNumber});ctx.globalAlpha=.85;ctx.strokeStyle='#67e8f9';ctx.lineWidth=1.6;
 ctx.strokeRect(-playerCar.width*.55,-playerCar.height*.55,playerCar.width*1.1,playerCar.height*1.1);ctx.restore();
}
function updateTrialHUD() {
 const panel=document.getElementById('trial-panel');panel.hidden=currentSession!=='TIME_TRIAL';
 if(currentSession!=='TIME_TRIAL'||!trialState)return;
 document.getElementById('trialPauseHint').textContent='Пауза и выход в гараж: '+bindingLabel('pause');
 document.getElementById('trialRecord').textContent=trialState.best?formatTime(trialState.best.time):'Первый чистый круг';
 document.getElementById('trialStatus').textContent=!trialState.active?'Выезд: пересеките старт':trialState.invalid?'Не зачёт: '+trialState.reason:'Чистый круг · одинаковые шины Medium';
 document.getElementById('trialStatus').classList.toggle('invalid',trialState.invalid);
 document.getElementById('trialGhostStatus').textContent=trialState.reference?'Призрак лучшего круга активен'+(trialState.sessionOnly?' · рекорд только в этой сессии':''):'Призрак появится после личного рекорда';
 if(trialState.lastLap&&!trialState.lastLap.valid)document.getElementById('lastTime').textContent='НЕ ЗАЧЁТ';
 document.getElementById('topPosCounter').textContent='СОЛО';
 document.getElementById('topClockLabel').textContent='ЛИЧНЫЙ РЕКОРД';
 document.getElementById('topRaceClock').textContent=formatTime(trialState.best?.time);
 if(!playerCar.timingStarted)document.getElementById('topCurTime').textContent='ВЫЕЗД';
}
