// Run with: node tests/batch4-profile.cjs (requires Playwright and Chromium).
// Firebase imports are replaced only in this browser fixture; no remote requests are allowed.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const mocks = `
window.__fixture={docs:{},writes:[],failRead:false,failWrite:false,readDelay:0};
const initializeApp=()=>({}),getFirestore=()=>({}),getAuth=()=>({}),browserLocalPersistence={};
const setPersistence=async()=>{},onAuthStateChanged=()=>{};
const doc=(_db,collection,id)=>({collection,id});
const getDoc=async ref=>{if(__fixture.readDelay)await new Promise(r=>setTimeout(r,__fixture.readDelay));if(__fixture.failRead)throw Error('isolated read failure');const data=__fixture.docs[ref.collection+'/'+ref.id];return {exists:()=>data!==undefined,data:()=>structuredClone(data)};};
const setDoc=async(ref,data,options)=>{if(__fixture.failWrite)throw Error('isolated write failure');const key=ref.collection+'/'+ref.id;__fixture.writes.push({key,data:structuredClone(data),options});__fixture.docs[key]=options?.merge?{...__fixture.docs[key],...structuredClone(data)}:structuredClone(data);};
`;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/^import .*;\r?$/gm, '').replace('<script type="module">', '<script type="module">'+mocks)
  .replace('</script>', `window.__batch4={asMother:(code='BATCH4')=>{user={code,name:'أم اختبار',isConsultant:false};viewingClient=null;},open:goToProfile,save:submitSurvey,review:viewSurveyAsync,log:buildLogHTML,home:showHome};</script>`);
(async () => {
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  for(const width of [390,1440]) {
   const page=await browser.newPage({viewport:{width,height:900}}), errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
   await page.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.origin!=='http://127.0.0.1:9999')return route.abort();
    if(u.pathname==='/Dadasleep/')return route.fulfill({contentType:'text/html',body:html});
    if(u.pathname.startsWith('/Dadasleep/assets/images/'))return route.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(root,u.pathname.slice('/Dadasleep/'.length)))});
    return route.abort();
   });
   await page.goto('http://127.0.0.1:9999/Dadasleep/');await page.waitForFunction(()=>!!window.__batch4);
   await page.evaluate(()=>{__batch4.asMother();__batch4.home();});
   assert.deepEqual(await page.locator('#homeScreen .home-card-icon').allTextContents(),['👶🏻','🌙','📋']);
   // Existing profile, including unrepresented historical fields, must survive editing.
   await page.evaluate(()=>{__fixture.docs['surveys/BATCH4']={momName:'أم قديمة',babyName:'طفل تجريبي',phone:'000',birth:'وصف الولادة',otherKids:'نعم',otherKidsDetail:'طفل آخر',health:'نعم',healthDetail:'حساسية',routine:'نعم',routineDetail:'قصة',sleepPlace:'مكان قديم مخصص',sleepHow:'بالهز',backToSleep:'صوت خاص',personality:'هادئ',personalityDesc:'وصف محفوظ',sleepOnset:'17',bedtimeStart:'20:00',unknownLegacy:{keep:true}};});
   await page.evaluate(()=>__batch4.open());
   assert.equal(await page.locator('#s_momName').inputValue(),'أم قديمة');
   assert.equal(await page.locator('#s_sleepPlaceOther').inputValue(),'مكان قديم مخصص');
   assert.equal(await page.locator('#s_backToSleepOther').inputValue(),'صوت خاص');
   assert.equal(await page.locator('#s_pregnancyIron').inputValue(),'');
   assert.equal(await page.locator('#surveyScreen [required]').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.locator('#surveyScreen').screenshot({path:`/tmp/batch4-profile-${width}.png`});
   for(const choice of ['نعم','لا','لا أتذكر']){await page.locator('#s_pregnancyIron').selectOption(choice);assert.equal(await page.locator('#s_pregnancyIron').inputValue(),choice);}
   await page.locator('#s_pregnancyIron').selectOption('لا أتذكر');
   for(const val of ['الأم','الأب','أخرى'])await page.locator(`#s_dayCaregivers input[value="${val}"]`).check();
   await page.locator('#s_dayCaregiverOther').fill('خالة <آمنة>');
   for(const val of ['المربية','الجد أو الجدة'])await page.locator(`#s_nightCaregivers input[value="${val}"]`).check();
   await page.evaluate(()=>nextSection());
   for(const [id,text]of [['dayActivities','لعب وخروج'],['napEnvironment','إضاءة هادئة'],['nightEnvironment','غرفة مظلمة']])await page.locator('#s_'+id).fill(text);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.evaluate(()=>__batch4.save());
   const saved=await page.evaluate(()=>__fixture.docs['surveys/BATCH4']);
   assert.deepEqual(saved.dayCaregivers,['الأم','الأب','أخرى']);assert.deepEqual(saved.nightCaregivers,['المربية','الجد أو الجدة']);
   assert.equal(saved.momName,'أم قديمة');assert.equal(saved.personalityDesc,'وصف محفوظ');assert.equal(saved.sleepPlace,'مكان قديم مخصص');assert.equal(saved.backToSleep,'صوت خاص');assert.equal(saved.sleepOnset,'17');assert.deepEqual(saved.unknownLegacy,{keep:true});
   assert.equal((await page.evaluate(()=>__fixture.writes.at(-1))).options.merge,true);
   await page.evaluate(()=>__batch4.open());
   assert.equal(await page.locator('#s_dayCaregivers input:checked').count(),3);assert.equal(await page.locator('#s_nightCaregivers input:checked').count(),2);
   assert.equal(await page.locator('#s_dayCaregiverOther').inputValue(),'خالة <آمنة>');
   assert.equal(await page.locator('#s_pregnancyIron').inputValue(),'لا أتذكر');
   for(const [id,text]of [['dayActivities','لعب وخروج'],['napEnvironment','إضاءة هادئة'],['nightEnvironment','غرفة مظلمة']])assert.equal(await page.locator('#s_'+id).inputValue(),text);
   await page.locator('#s_dayCaregivers input[value="أخرى"]').uncheck();assert.equal(await page.locator('#dayCaregiverOtherGroup').isVisible(),false);
   await page.locator('#s_dayCaregivers input[value="أخرى"]').check();assert.equal(await page.locator('#s_dayCaregiverOther').inputValue(),'خالة <آمنة>');
   await page.evaluate(()=>{showScreen('appScreen');return __batch4.review('BATCH4','طفل تجريبي');});
   const review=await page.locator('#tab-log').innerText();for(const value of ['لا أتذكر','الأم، الأب، أخرى','المربية، الجد أو الجدة','خالة <آمنة>','لعب وخروج','إضاءة هادئة','غرفة مظلمة'])assert.ok(review.includes(value),value);
   assert.equal(await page.locator('#tab-log آمنة').count(),0);
   // Legacy consultant review tolerates missing optional fields.
   await page.evaluate(()=>{__fixture.docs['surveys/LEGACY']={momName:'أم سابقة',babyName:'طفل سابق'};return __batch4.review('LEGACY','طفل سابق');});
   const legacyReview=await page.locator('#tab-log').innerText();assert.ok(legacyReview.includes('أم سابقة'));assert.ok(!legacyReview.includes('undefined'));assert.ok(!legacyReview.includes('نقص الحديد'));
   // Empty new questions must not block submission or leak previous profile answers.
   await page.evaluate(()=>{__batch4.asMother('EMPTY');return __batch4.open();});
   assert.equal(await page.locator('#s_momName').inputValue(),'');assert.equal(await page.locator('#s_dayCaregivers input:checked').count(),0);
   await page.evaluate(()=>__batch4.save());assert.deepEqual(await page.evaluate(()=>__fixture.docs['surveys/EMPTY'].dayCaregivers),[]);
   // Submission is blocked while a profile read is still pending.
   await page.evaluate(()=>{__fixture.readDelay=100;window.pendingProfile=__batch4.open();});
   const pendingWrites=await page.evaluate(()=>__fixture.writes.length);await page.evaluate(()=>__batch4.save());assert.equal(await page.evaluate(()=>__fixture.writes.length),pendingWrites);
   await page.evaluate(()=>window.pendingProfile);await page.evaluate(()=>{__fixture.readDelay=0;});
   // A failed load must never permit overwriting a document with a blank form.
   await page.evaluate(()=>{__fixture.failRead=true;return __batch4.open();});
   assert.equal(await page.locator('#sec4 .btn-next').isDisabled(),true);
   const writes=await page.evaluate(()=>__fixture.writes.length);await page.evaluate(()=>__batch4.save());assert.equal(await page.evaluate(()=>__fixture.writes.length),writes);
   await page.evaluate(()=>{__fixture.failRead=false;return __batch4.open();});
   // Save errors leave answers available for retry.
   await page.locator('#s_pregnancyIron').selectOption('نعم');await page.evaluate(()=>{__fixture.failWrite=true;return __batch4.save();});assert.equal(await page.locator('#s_pregnancyIron').inputValue(),'نعم');
   await page.evaluate(()=>{__fixture.failWrite=false;return __batch4.save();});
   // Follow-up and diary share nap and nighttime question builders; IDs and limits stay intact.
   for(const mode of ['diary','followup']){
    await page.evaluate(mode=>{showScreen('appScreen');document.getElementById('tab-log').innerHTML=__batch4.log(mode);showTab('log');},mode);
    assert.equal(await page.locator('#tab-log label').filter({hasText:'كم استغرق حتى نام طفلك؟ (بالدقائق)'}).count(),4);
    assert.equal(await page.locator('#sleepDuration').getAttribute('max'),'180');assert.equal(await page.locator('#nap1Onset').getAttribute('max'),'120');
   }
   await page.evaluate(()=>showScreen('landingScreen'));
   for(const id of ['privacyScreen','termsScreen','refundScreen']){await page.locator(`[onclick="openPolicy('${id}')"]`).click();await page.locator('#'+id+' button').click();}
   await page.locator('[onclick="goToStore()"]:visible').click();for(const product of ['weaning','sijil']){await page.locator(`[onclick="openProduct('${product}')"]:visible`).click();await page.locator('#productDetailScreen [onclick="showScreen(\'storeScreen\')"]').click();}
   const loaded=await page.evaluate(async()=>Promise.all([...new Set(Array.from(document.images,el=>el.src))].map(src=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(true);img.onerror=()=>resolve(false);img.src=src;}))));assert.equal(loaded.length,8);assert.ok(loaded.every(Boolean));
   assert.deepEqual(errors,[]);console.log(`PASS ${width}px: icons, optional answers, multiselect/other, legacy preservation, merge save/reload, consultant display, read/write failures, both onset forms, policy/store navigation`);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
