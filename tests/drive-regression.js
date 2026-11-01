// Run inside the loaded Full Stint iframe (see drive.html).
const verify=(ok,message)=>{if(!ok)throw new Error(message)};
const old={cls:selectedCarClass,track:selectedTrackIndex,session:currentSession,state:raceState,paused:isPaused,all:allCars,player:playerCar};
const results=[];
try {
    isPaused=true;
    verify(document.getElementById('classBtnRoad')!==null,'Missing track-day selector');
    verify(document.getElementById('hudDriveType')!==null,'Missing live drivetrain HUD');
    verify(document.getElementById('hudHandbrake')!==null,'Missing live handbrake indicator');
    selectedCarClass='ROAD';
    selectedTrackIndex=TRACKS_DB.findIndex(t=>t.id==='monaco');
    buildActiveTrackGeometry();
    currentSession='RACE';raceState='RACING';
    verify(ROAD_CATALOG.map(c=>c.drivetrain).join('/')==='FWD/AWD/RWD','Incorrect drive catalogue');
    verify(GT3_CATALOG.every(c=>c.drivetrain==='RWD')&&F1_CATALOG.every(c=>c.drivetrain==='RWD'),'Race-class GT3/F1 drivetrain changed');
    for(let index=0;index<ROAD_CATALOG.length;index++){
        const drive=ROAD_CATALOG[index].drivetrain;
        const probe=useHandbrake=>{
            const car=new Car('Drive QA',1,index,true,false);
            car.assignStrategy({start:'medium',stops:[]});
            car.placeForQualifying(0,1);
            car.velocity=70/KMH_FACTOR;
            car.dx=Math.sin(car.angle)*car.velocity;
            car.dy=-Math.cos(car.angle)*car.velocity;
            car.gear=4;car.rpm=.7;car.shiftTimer=1;
            allCars=[car];playerCar=car;
            car.update(1/60,{throttle:0,brake:0,handbrake:useHandbrake?1:0,steer:0});
            return {acceleration:car.aLong,active:car.handbrakeActive,gears:car.maxGears};
        };
        const released=probe(false),applied=probe(true);
        verify(!released.active&&applied.active,'Handbrake state not delivered to physics: '+drive);
        verify(applied.acceleration<released.acceleration-2,'Handbrake does not decelerate: '+drive);
        verify(applied.gears===ROAD_CATALOG[index].gearFrac.length,'Wrong gearbox: '+drive);
        results.push({drive,gears:applied.gears,freeAcceleration:+released.acceleration.toFixed(2),brakingAcceleration:+applied.acceleration.toFixed(2)});
    }
} finally {
    selectedCarClass=old.cls;selectedTrackIndex=old.track;currentSession=old.session;raceState=old.state;isPaused=old.paused;
    allCars=old.all;playerCar=old.player;buildActiveTrackGeometry();
}
return {result:'PASS',drives:results};