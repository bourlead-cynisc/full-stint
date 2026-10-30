// Physical key codes work in both Latin and Cyrillic keyboard layouts.
const DEFAULT_BINDINGS = {
    throttle:['KeyW','ArrowUp'], brake:['KeyS','ArrowDown'], handbrake:['Space'], left:['KeyA','ArrowLeft'], right:['KeyD','ArrowRight'],
    shiftUp:['KeyE','ShiftLeft','ShiftRight'], shiftDown:['KeyQ','ControlLeft','ControlRight'],
    pit:['KeyP'], soft:['Digit1'], medium:['Digit2'], hard:['Digit3'], camera:['KeyC'], line:['KeyH'],
    sound:['KeyM'], zoomIn:['Equal','NumpadAdd'], zoomOut:['Minus','NumpadSubtract'], pause:['Escape'], settings:['F2']
};
const ACTION_LABELS = {throttle:'Газ',brake:'Тормоз / задний ход',handbrake:'Ручник',left:'Руль влево',right:'Руль вправо',shiftUp:'Передача выше',shiftDown:'Передача ниже',pit:'Запросить / отменить пит-стоп',soft:'Следующие шины: мягкие',medium:'Следующие шины: средние',hard:'Следующие шины: жёсткие',camera:'Машина / вся трасса',line:'Показать траекторию',sound:'Включить / выключить звук',zoomIn:'Приблизить',zoomOut:'Отдалить',pause:'Пауза',settings:'Настройки управления'};
const BINDINGS_KEY='fiaSim.controls.v1';
function loadBindings() {
    const defaults=JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    try {
        const saved=JSON.parse(localStorage.getItem(BINDINGS_KEY));
        // Move Space from the old brake binding to the new handbrake without resetting other keys.
        if(saved && typeof saved==='object' && !Array.isArray(saved) && !Array.isArray(saved.handbrake)) {
            const brakeKeys=Array.isArray(saved.brake)?saved.brake:defaults.brake;
            saved.brake=brakeKeys.filter(code=>code!=='Space');
            if(!saved.brake.length)saved.brake=[...defaults.brake];
            saved.handbrake=['Space'];
        }
        const used=new Set();
        if(!saved || !Object.keys(defaults).every(action=>Array.isArray(saved[action]) && saved[action].length>0 && saved[action].length<=4 && saved[action].every(code=>{
            if(typeof code!=='string'||!/^[A-Za-z][A-Za-z0-9]{0,31}$/.test(code)||used.has(code))return false;
            used.add(code);return true;
        }))) return defaults;
        return Object.fromEntries(Object.keys(defaults).map(action=>[action,saved[action]]));
    } catch {return defaults;}
}
let keyBindings=loadBindings(), capturingBinding=null, controlsWasPaused=false;
const pressedCodes=new Set();
function keyName(code) {
    return ({ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Space:'Пробел',Escape:'Esc',Equal:'+',Minus:'−',NumpadAdd:'Num +',NumpadSubtract:'Num −',ShiftLeft:'Лев. Shift',ShiftRight:'Прав. Shift',ControlLeft:'Лев. Ctrl',ControlRight:'Прав. Ctrl'})[code] || code.replace(/^Key|^Digit/,'');
}
function bindingLabel(action) {return keyBindings[action].map(keyName).join(' / ');}
function bindingMatches(action,code) {return keyBindings[action].includes(code);}
function syncKeyboardInputs() {
    for(const [action,key] of [['throttle','w'],['brake','s'],['handbrake','space'],['left','a'],['right','d']]) keys[key]=keyBindings[action].some(code=>pressedCodes.has(code));
}
function renderBindings() {
    for(const button of document.querySelectorAll('[data-hm],#btnGearAuto,#btnGearManual'))button.disabled=currentSession==='TIME_TRIAL';
    const grid=document.getElementById('bindingGrid');grid.replaceChildren();
    for(const action of Object.keys(DEFAULT_BINDINGS)) {
        const label=document.createElement('span');label.textContent=ACTION_LABELS[action];
        const button=document.createElement('button');button.className='binding-button';
        button.textContent=capturingBinding===action?'Нажмите клавишу…':bindingLabel(action);
        button.setAttribute('aria-label',ACTION_LABELS[action]+': '+button.textContent);
        button.onclick=()=>{capturingBinding=action;clearInputs();renderBindings();document.getElementById('bindingMessage').textContent=action==='pause'?'Нажмите новую клавишу. Esc можно назначить обратно на паузу.':'Нажмите новую клавишу. Esc — отменить.';};
        grid.append(label,button);
    }
}
function saveBindings() {
    try {localStorage.setItem(BINDINGS_KEY,JSON.stringify(keyBindings));}
    catch {document.getElementById('bindingMessage').textContent='Клавиши изменены. Браузер не разрешил сохранить их после перезапуска.';}
    updateControlHints();
}
function openControls() {
    if(document.getElementById('controlsModal').style.display==='flex')return;
    controlsWasPaused=isPaused;isPaused=true;clearInputs();capturingBinding=null;renderBindings();
    document.getElementById('bindingMessage').textContent='Нажмите на клавишу справа, затем нажмите новую. Настройки сохраняются автоматически.';
    document.getElementById('controlsModal').style.display='flex';document.getElementById('btnCloseControls').focus();
}
function closeControls() {
    capturingBinding=null;document.getElementById('controlsModal').style.display='none';
    isPaused=controlsWasPaused;clearInputs();releaseFocus();
}
function handleBindingCapture(e) {
    if(document.getElementById('controlsModal').style.display!=='flex')return false;
    if(capturingBinding) {
        e.preventDefault();e.stopPropagation();
        if(e.repeat)return true;
        if(e.code==='Escape' && capturingBinding!=='pause') {capturingBinding=null;renderBindings();document.getElementById('bindingMessage').textContent='Переназначение отменено.';return true;}
        if(!e.code || !/^[A-Za-z][A-Za-z0-9]{0,31}$/.test(e.code))return true;
        const other=Object.keys(keyBindings).find(action=>action!==capturingBinding && bindingMatches(action,e.code));
        if(other) {document.getElementById('bindingMessage').textContent='Эта клавиша уже назначена: '+ACTION_LABELS[other]+'. Выберите другую.';return true;}
        keyBindings[capturingBinding]=[e.code];capturingBinding=null;
        document.getElementById('bindingMessage').textContent='Клавиша назначена и сохранена.';
        saveBindings();renderBindings();return true;
    }
    if(e.code==='Tab') {
        const buttons=[...document.querySelectorAll('#controlsModal button:not([disabled])')].filter(b=>b.getClientRects().length);
        const first=buttons[0],last=buttons[buttons.length-1];
        if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
    }
    if(e.code==='Escape') {e.preventDefault();closeControls();}
    return true;
}
function updateControlHints() {
    document.getElementById('control-hint').textContent=`${bindingLabel('throttle')} — газ · ${bindingLabel('brake')} — тормоз · ${bindingLabel('handbrake')} — ручник · ${bindingLabel('pause')} — пауза`;
    document.getElementById('btnHudControls').textContent=`Управление · ${bindingLabel('settings')}`;
    for(const tire of ['soft','medium','hard']) document.querySelector(`[data-next-tire="${tire}"] small`).textContent=bindingLabel(tire);
}
