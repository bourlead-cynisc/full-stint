// Execute inside the embedded game's window (tests/paint.html).
const assert=(ok,label)=>{if(!ok)throw new Error(label)};
const saved=localStorage.getItem(PAINT_STORAGE_KEY);
const oldChoices={...selectedPaintByCar};
const oldClass=selectedCarClass,oldCarIndex=selectedCarIndex;
const results=[];
try {
    assert(typeof GT3_PAINT_VARIANTS==='object','Livery catalog not loaded');
    assert(SPRITE_DATA.audi_gt3.endsWith('audi-red.webp'),'Audi base sprite missing');
    assert(SPRITE_DATA.audi_gt3_livery2.endsWith('audi-blue.webp'),'Audi blue variant missing');
    assert(SPRITE_DATA.porsche_gt3.endsWith('porsche-red.webp'),'Porsche base sprite missing');
    assert(SPRITE_DATA.porsche_gt3_livery2.endsWith('porsche-blue.webp'),'Porsche blue variant missing');
    for(const carId of ['audi_gt3','porsche_gt3']) {
        const index=GT3_CATALOG.findIndex(x=>x.id===carId);
        assert(index>=0,'Missing GT3 model '+carId);
        selectedCarClass='GT3';selectedCarIndex=index;
        const car=GT3_CATALOG[index];
        chooseCarPaint(car,0);
        assert(selectedCarSpriteId(car)===carId,'First colour failed '+carId);
        chooseCarPaint(car,1);
        assert(selectedCarSpriteId(car)===carId+'_livery2','Second colour failed '+carId);
        assert(JSON.parse(localStorage.getItem(PAINT_STORAGE_KEY))[carId]===1,'Colour not saved '+carId);
        const picker=document.querySelector('#selectedCarPreview .car-paint-picker');
        assert(picker&&picker.querySelectorAll('button').length===2,'Missing garage colour picker '+carId);
        assert(picker.querySelectorAll('button[aria-pressed="true"]').length===1,'Missing selected swatch '+carId);
        const ctx=document.getElementById('selectedCarCanvas')?.getContext('2d');
        assert(ctx,'Missing car preview '+carId);
        results.push({carId,colours:2,selected:selectedCarSpriteId(car)});
    }
    const bmw=GT3_CATALOG.find(x=>x.id==='bmw_gt3');
    assert(!carPaintOptions(bmw).length&&selectedCarSpriteId(bmw)==='bmw_gt3','Other car was changed');
} finally {
    selectedCarClass=oldClass;selectedCarIndex=oldCarIndex;
    selectedPaintByCar=oldChoices;
    if(saved===null)localStorage.removeItem(PAINT_STORAGE_KEY);
    else localStorage.setItem(PAINT_STORAGE_KEY,saved);
    renderGarageUI();
}
return {passed:true,results};
