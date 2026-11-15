// Run inside the loaded Full Stint iframe (see drive.html).
const verify=(ok,message)=>{if(!ok)throw new Error(message)};
const old={cls:selectedCarClass,car:selectedCarIndex,track:selectedTrackIndex,session:currentSession,state:raceState,paused:isPaused,all:allCars,player:playerCar};
const results=[];
try {
    isPaused=true;
    verify(document.getElementById('classBtnRoad')===null,'Obsolete track-day selector is still present');
    verify(typeof ROAD_CATALOG==='undefined','Obsolete ROAD_CATALOG is still present');
    verify(document.getElementById('hudDriveType')!==null,'Missing live drivetrain HUD');
    verify(document.getElementById('hudHandbrake')!==null,'Missing live handbrake indicator');
    verify(document.getElementById('hud-left-stack')!==null,'HUD panels are not grouped');
    const hudRect=document.getElementById('hud-left').getBoundingClientRect();
    const damageRect=document.getElementById('damage-panel').getBoundingClientRect();
    verify(damageRect.top>=hudRect.bottom,'Machine state still overlaps the left HUD');
    verify(document.getElementById('minimapCanvas').width>=600&&document.getElementById('minimapFrame').clientWidth>=300,'Minimap is not enlarged');
    verify(GT3_CATALOG.every(c=>c.drivetrain==='RWD')&&F1_CATALOG.every(c=>c.drivetrain==='RWD'),'Unverified drivetrain in GT3/F1 catalog');
    const selectedBefore=selectedCarClass;
    window.selectCarClass('ROAD');
    verify(selectedCarClass===selectedBefore,'Removed car class can still be selected');
    selectedTrackIndex=TRACKS_DB.findIndex(t=>t.id==='monaco');
    currentSession='RACE';raceState='RACING';
    for(const [carClass,catalog] of [['GT3',GT3_CATALOG],['F1',F1_CATALOG]]) {
        selectedCarClass=carClass;
        buildActiveTrackGeometry();
        for(let index=0;index<catalog.length;index++) {
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
            verify(!released.active&&applied.active,'Handbrake state not delivered to physics: '+catalog[index].id);
            verify(applied.acceleration<released.acceleration-2,'Handbrake does not decelerate: '+catalog[index].id);
            verify(applied.gears===CLASS_CFG[carClass].gearFrac.length,'Wrong gearbox: '+catalog[index].id);
            results.push({carClass,car:catalog[index].id,gears:applied.gears,freeAcceleration:+released.acceleration.toFixed(2),brakingAcceleration:+applied.acceleration.toFixed(2)});
        }
    }
} finally {
    selectedCarClass=old.cls;selectedCarIndex=old.car;selectedTrackIndex=old.track;currentSession=old.session;raceState=old.state;isPaused=old.paused;
    allCars=old.all;playerCar=old.player;buildActiveTrackGeometry();
}
return {result:'PASS',cars:results};
