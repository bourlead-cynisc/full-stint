const check=(ok,message)=>{if(!ok)throw new Error(message);};
isPaused=true;currentSession='RACE';raceState='RACING';selectedCarClass='GT3';selectedTrackIndex=2;buildActiveTrackGeometry();
const pt=getTrackPointAtProgress(.02),info=getTrackInfo(pt.x,pt.y,-1);
function wallCar(nspeed,tspeed){
 const c=new Car('Wall test',1,0,true,false);c.assignStrategy({start:'medium',stops:[]});c.placeOnGrid(0);
 const nx=info.center.nx,ny=info.center.ny,tx=-ny,ty=nx,v=Math.hypot(nspeed,tspeed);
 c.x=pt.x+nx*(WALL_HALF_W+2);c.y=pt.y+ny*(WALL_HALF_W+2);c.lastSampleIdx=-1;
 const near=getTrackInfo(c.x,c.y,-1),nnx=(c.x-near.center.x)/near.dist,nny=(c.y-near.center.y)/near.dist;
 c.dx=nnx*nspeed-nny*tspeed;c.dy=nny*nspeed+nnx*tspeed;c.velocity=v;c.angle=Math.atan2(c.dx,-c.dy);return c;
}
const head=wallCar(10,0);allCars=[head];head.resolveWallContact(1/60);
check(Math.abs(head.velocity)<.001,'Head-on collision retains speed: '+head.velocity);
for(let n=0;n<60;n++)head.update(1/60,{throttle:1,brake:0,steer:0});
check(Math.abs(head.velocity)<.1,'Engine restores wall impact speed: '+head.velocity);
for(let n=0;n<60;n++)head.update(1/60,{throttle:0,brake:1,steer:0});
check(head.velocity<-.1,'Cannot reverse away from wall');
const glance=wallCar(6,8);glance.resolveWallContact(1/60);
check(glance.velocity>0&&glance.velocity<8,'Glancing contact ignores friction');
for(let i=0;i<=100;i++) {
    const pt=getSplinePoint({x:-1000,y:0},{x:0,y:0},{x:10,y:0},{x:1000,y:0},i/100);
    check(pt.x>=-1e-6&&pt.x<=10.000001&&Math.abs(pt.y)<1e-6,'Nonuniform spline creates loops');
}
const saved=localStorage.getItem(BINDINGS_KEY),bindings=JSON.parse(JSON.stringify(keyBindings));
try {
 openControls();capturingBinding='throttle';
 handleBindingCapture(new KeyboardEvent('keydown',{code:'KeyS',cancelable:true}));
 check(capturingBinding==='throttle','Key conflict accepted');
 handleBindingCapture(new KeyboardEvent('keydown',{code:'KeyT',cancelable:true}));
 check(keyBindings.throttle[0]==='KeyT'&&loadBindings().throttle[0]==='KeyT','Rebind not saved');
 closeControls();isPaused=false;
 onKeyDown(new KeyboardEvent('keydown',{code:'KeyW',cancelable:true}));check(!collectInput().throttle,'Old binding still active');onKeyUp(new KeyboardEvent('keyup',{code:'KeyW'}));
 onKeyDown(new KeyboardEvent('keydown',{code:'KeyT',cancelable:true}));check(collectInput().throttle===1,'New binding not active');
 onKeyUp(new KeyboardEvent('keyup',{code:'KeyT'}));check(collectInput().throttle===0,'Key release stuck');
 openControls();check(isPaused,'Controls do not pause game');closeControls();check(!isPaused,'Controls do not resume game');
 openControls();keyBindings.pause=['KeyJ'];capturingBinding='pause';
 handleBindingCapture(new KeyboardEvent('keydown',{code:'Escape',cancelable:true}));
 check(keyBindings.pause[0]==='Escape'&&keyBindings.throttle[0]==='KeyT','Cannot restore Escape without losing other bindings');closeControls();
} finally {keyBindings=bindings;if(saved===null)localStorage.removeItem(BINDINGS_KEY);else localStorage.setItem(BINDINGS_KEY,saved);updateControlHints();clearInputs();isPaused=true;}
return {wall:'head-on stops, glancing friction, reverse works',bindings:'conflict rejection, save, press/release, pause/resume'};
