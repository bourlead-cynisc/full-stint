// Physical key codes work in both Latin and Cyrillic keyboard layouts.
const DEFAULT_BINDINGS = {
    throttle:['KeyW','ArrowUp'], brake:['KeyS','ArrowDown'], handbrake:['Space'], left:['KeyA','ArrowLeft'], right:['KeyD','ArrowRight'],
    shiftUp:['KeyE','ShiftLeft','ShiftRight'], shiftDown:['KeyQ','ControlLeft','ControlRight'],
    pit:['KeyP'], soft:['Digit1'], medium:['Digit2'], hard:['Digit3'], camera:['KeyC'], line:['KeyH'],
    sound:['KeyM'], zoomIn:['Equal','NumpadAdd'], zoomOut:['Minus','NumpadSubtract'], pause:['Escape'], settings:['F2']
};
const ACTION_LABELS = {throttle:'Газ',brake:'Тормоз / задний ход',handbrake:'Ручник',left:'Руль влево',right:'Руль вправо',shiftUp:'Передача выше',shiftDown:'Передача ниже',pit:'Запросить / отменить пит-стоп',soft:'Следующие шины: мягкие',medium:'Следующие шины: средние',hard:'Следующие шины: жёсткие',camera:'Машина / вся трасса',line:'Показать траекторию',sound:'Включить / выключить звук',zoomIn:'Приблизить',zoomOut:'Отдалить',pause:'Пауза',settings:'Настройки управления'};
const BINDINGS_KEY='fiaSim.controls.v1';
const DEFAULT_GAMEPAD_BINDINGS = {
    steer:{type:'axis',axis:0}, throttle:{type:'button',button:7}, brake:{type:'button',button:6}, handbrake:{type:'button',button:0},
    shiftUp:{type:'button',button:5}, shiftDown:{type:'button',button:4}, pit:{type:'button',button:1},
    soft:{type:'button',button:2}, medium:{type:'button',button:3}, hard:{type:'button',button:15},
    camera:{type:'button',button:10}, line:{type:'button',button:11}, sound:{type:'button',button:14},
    zoomIn:{type:'button',button:12}, zoomOut:{type:'button',button:13}, pause:{type:'button',button:9}, settings:{type:'button',button:8}
};
const GAMEPAD_ACTION_LABELS = {steer:'Руль (ось стика)',throttle:'Газ',brake:'Тормоз / задний ход',handbrake:'Ручник',shiftUp:'Передача выше',shiftDown:'Передача ниже',pit:'Запросить / отменить пит-стоп',soft:'Следующие шины: мягкие',medium:'Следующие шины: средние',hard:'Следующие шины: жёсткие',camera:'Машина / вся трасса',line:'Показать траекторию',sound:'Включить / выключить звук',zoomIn:'Приблизить',zoomOut:'Отдалить',pause:'Пауза / продолжить',settings:'Настройки управления'};
const GAMEPAD_BINDINGS_KEY='fiaSim.gamepad.v1';
const GAMEPAD_BUTTON_NAMES=['A','B','X','Y','LB','RB','LT','RT','View','Start','L3','R3','D-pad ↑','D-pad ↓','D-pad ←','D-pad →','Home'];
const GAMEPAD_ACTIONS=Object.keys(DEFAULT_GAMEPAD_BINDINGS);
let gamepadUsesStandardMapping=true;
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
let gamepadBindings=loadGamepadBindings(), capturingGamepadBinding=null, gamepadCaptureArmed=false, controlsTab='keyboard';
const pressedCodes=new Set();

function loadGamepadBindings() {
    const defaults=JSON.parse(JSON.stringify(DEFAULT_GAMEPAD_BINDINGS));
    try {
        const saved=JSON.parse(localStorage.getItem(GAMEPAD_BINDINGS_KEY));
        if(!saved || !Object.keys(defaults).every(action=>{
            const b=saved[action];
            return b && ((action==='steer' && b.type==='axis' && Number.isInteger(b.axis) && b.axis>=0 && b.axis<16) || (action!=='steer' && b.type==='button' && Number.isInteger(b.button) && b.button>=0 && b.button<32));
        })) return defaults;
        const used=new Set();
        for(const action of GAMEPAD_ACTIONS) {
            const b=saved[action];
            if(b.type==='button') {if(used.has(b.button))return defaults;used.add(b.button);}
        }
        return Object.fromEntries(GAMEPAD_ACTIONS.map(action=>[action,{...saved[action]}]));
    } catch {return defaults;}
}
function gamepadBindingLabel(action) {
    const b=gamepadBindings[action];
    if(!b)return '—';
    if(b.type==='axis')return `Ось ${b.axis+1} · левый стик`;
    return gamepadUsesStandardMapping?(GAMEPAD_BUTTON_NAMES[b.button] || `Кнопка ${b.button+1}`):`Кнопка ${b.button+1}`;
}
let lastGamepadStatus='';
function updateGamepadStatus(gp) {
    const element=document.getElementById('gamepadStatus');if(!element)return;
    const standard=!gp||gp.mapping==='standard',mappingChanged=standard!==gamepadUsesStandardMapping;
    gamepadUsesStandardMapping=standard;
    const message=!gp
        ? 'Геймпад не найден. Подключите его, затем нажмите любую кнопку.'
        : `Подключён: ${gp.id||'геймпад'}${gp.mapping==='standard'?' · стандартная раскладка':' · нестандартная раскладка'}${gp.mapping==='standard'?'':' — назначения по кнопкам могут отличаться.'}`;
    if(message!==lastGamepadStatus){element.textContent=message;lastGamepadStatus=message;}
    element.classList.toggle('connected',!!gp);
    if(mappingChanged&&controlsTab==='gamepad'&&capturingGamepadBinding===null)renderGamepadBindings();
}
function combinedBindingLabel(action) {return `${bindingLabel(action)} · ${gamepadBindingLabel(action)}`;}
function gamepadTabActive() {return controlsTab==='gamepad';}
function isGamepadBindingCaptureActive() {return capturingGamepadBinding!==null;}
function setControlsTab(tab) {
    controlsTab=tab==='gamepad'?'gamepad':'keyboard';
    for(const button of document.querySelectorAll('[data-controls-tab]')) {
        const active=button.dataset.controlsTab===controlsTab;
        button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));
    }
    document.getElementById('keyboardControlsPanel').hidden=controlsTab!=='keyboard';
    document.getElementById('gamepadControlsPanel').hidden=controlsTab!=='gamepad';
    capturingBinding=null;capturingGamepadBinding=null;gamepadCaptureArmed=false;
    if(controlsTab==='gamepad')renderGamepadBindings();else renderBindings();
    document.getElementById('bindingMessage').textContent=controlsTab==='gamepad'
        ? 'Подключите геймпад. Нажмите на действие и нажмите кнопку или отклоните стик.'
        : 'Нажмите на действие и назначьте клавишу. Настройки сохраняются автоматически.';
}
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
function renderGamepadBindings() {
    const grid=document.getElementById('gamepadBindingGrid');grid.replaceChildren();
    for(const action of GAMEPAD_ACTIONS) {
        const label=document.createElement('span');label.textContent=GAMEPAD_ACTION_LABELS[action];
        const button=document.createElement('button');button.className='binding-button';
        button.textContent=capturingGamepadBinding===action?'Нажмите кнопку…':gamepadBindingLabel(action);
        button.setAttribute('aria-label',GAMEPAD_ACTION_LABELS[action]+': '+button.textContent);
        button.onclick=()=>{capturingBinding=null;capturingGamepadBinding=action;gamepadCaptureArmed=false;clearInputs();renderGamepadBindings();document.getElementById('bindingMessage').textContent=action==='steer'?'Отклоните левый или правый стик, чтобы назначить ось руля.':'Нажмите кнопку на геймпаде. Для триггеров нажмите их до упора.';};
        grid.append(label,button);
    }
}
function captureGamepadBinding(gp, justPressed) {
    if(capturingGamepadBinding===null || !gp)return false;
    if(!gamepadCaptureArmed) {
        const axesForNeutral=capturingGamepadBinding==='steer'?(gp.axes||[]).slice(0,2):[];
        const neutral=(gp.buttons||[]).every(b=>(b?.value||0)<0.12) && axesForNeutral.every(v=>Math.abs(v)<0.28);
        if(neutral)gamepadCaptureArmed=true;
        return true;
    }
    let next=null;
    if(capturingGamepadBinding==='steer') {
        const axis=(gp.axes||[]).findIndex(v=>Math.abs(v)>0.65);
        if(axis>=0)next={type:'axis',axis};
    } else {
        const button=justPressed.findIndex(Boolean);
        if(button>=0)next={type:'button',button};
    }
    if(!next)return true;
    let swapped=false;
    if(next.type==='button') {
        const other=GAMEPAD_ACTIONS.find(action=>action!==capturingGamepadBinding && gamepadBindings[action].type==='button' && gamepadBindings[action].button===next.button);
        if(other){gamepadBindings[other]={...gamepadBindings[capturingGamepadBinding]};swapped=true;}
    }
    gamepadBindings[capturingGamepadBinding]=next;capturingGamepadBinding=null;gamepadCaptureArmed=false;
    saveGamepadBindings();renderGamepadBindings();document.getElementById('bindingMessage').textContent=swapped?'Назначения кнопок поменяны местами и сохранены.':'Кнопка назначена и сохранена.';
    return true;
}
function saveBindings() {
    try {localStorage.setItem(BINDINGS_KEY,JSON.stringify(keyBindings));}
    catch {document.getElementById('bindingMessage').textContent='Клавиши изменены. Браузер не разрешил сохранить их после перезапуска.';}
    updateControlHints();
}
function saveGamepadBindings() {
    try {localStorage.setItem(GAMEPAD_BINDINGS_KEY,JSON.stringify(gamepadBindings));}
    catch {document.getElementById('bindingMessage').textContent='Назначения изменены. Браузер не разрешил сохранить их после перезапуска.';}
    updateControlHints();
}
function openControls() {
    if(document.getElementById('controlsModal').style.display==='flex')return;
    controlsWasPaused=isPaused;isPaused=true;clearInputs();capturingBinding=null;capturingGamepadBinding=null;setControlsTab('keyboard');renderBindings();renderGamepadBindings();
    document.getElementById('bindingMessage').textContent='Нажмите на действие и назначьте клавишу. Настройки сохраняются автоматически.';
    document.getElementById('controlsModal').style.display='flex';document.getElementById('btnCloseControls').focus();
}
function closeControls() {
    capturingBinding=null;capturingGamepadBinding=null;document.getElementById('controlsModal').style.display='none';
    isPaused=controlsWasPaused;clearInputs();releaseFocus();
}
function handleBindingCapture(e) {
    if(document.getElementById('controlsModal').style.display!=='flex')return false;
    if(controlsTab!=='keyboard') {if(e.code==='Escape'){e.preventDefault();closeControls();}return true;}
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
    document.getElementById('control-hint').textContent=`КЛАВИАТУРА: ${bindingLabel('throttle')} газ · ${bindingLabel('brake')} тормоз · ${bindingLabel('handbrake')} ручник · ${bindingLabel('pause')} пауза\nГЕЙМПАД: ${gamepadBindingLabel('throttle')} газ · ${gamepadBindingLabel('brake')} тормоз · ${gamepadBindingLabel('handbrake')} ручник · ${gamepadBindingLabel('pause')} пауза`;
    document.getElementById('btnHudControls').textContent=`Управление · ${bindingLabel('settings')} / ${gamepadBindingLabel('settings')}`;
    for(const tire of ['soft','medium','hard']) document.querySelector(`[data-next-tire="${tire}"] small`).textContent=`${bindingLabel(tire)} · ${gamepadBindingLabel(tire)}`;
    const pitButton=document.getElementById('btnPitRequest');if(pitButton)pitButton.textContent=(pitButton.textContent.startsWith('Отменить')?'Отменить заезд':'Запросить заезд')+' · '+combinedBindingLabel('pit');
    const trialPauseHint=document.getElementById('trialPauseHint');if(trialPauseHint)trialPauseHint.textContent=`Пауза и выход в гараж: ${combinedBindingLabel('pause')}`;
}
