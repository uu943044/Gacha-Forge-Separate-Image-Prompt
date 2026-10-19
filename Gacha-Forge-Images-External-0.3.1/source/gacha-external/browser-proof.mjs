import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..');
const require=createRequire('C:/Users/user/AppData/Local/Marinara-Engine/package.json');
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const results=[];
await mkdir(resolve(here,'test-results'),{recursive:true});
try{for(const viewport of [{width:1280,height:800},{width:844,height:390}]){
 const page=await browser.newPage({viewport,hasTouch:viewport.width===844});page.setDefaultTimeout(10000);
 await page.route('http://127.0.0.1:9876/**',route=>route.fulfill(new URL(route.request().url()).pathname.endsWith('.png')?{contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9eEAAAAASUVORK5CYII=','base64')}:{contentType:'text/html',body:'<html><body style="margin:0;background:#111"></body></html>'}));
 await page.goto('http://127.0.0.1:9876/');
 let storage={'images:world:cg:1:0':{baseRevision:1,revision:1,data:{url:'/old.png',artRef:'global-gallery:legacy-0.2'}}},requests=[],generationFail=false,storageFail=false,generationGate=null,uploads=0,duplicate=0;
 const run={runId:'world',scenario:'Park',protagonist:{name:'Player',appearance:'brown hair'},images:{connectionId:'nai',backgrounds:true,outfits:true,sceneWidth:1216,sceneHeight:832}};
 const records=new Map();
 const put=(id,kind,data)=>records.set(id,{id,packageId:'gacha-forge',kind,name:id,description:'',revision:1,data:JSON.stringify(data)});
 put('index','index',{runs:[run],activeRunId:'world'});
 put('world:beat:1:0','beat',{chapter:1,storyIndex:0,segments:Array.from({length:10},(_,i)=>({speaker:'',text:`저장된 스토리 ${i+1}번째 문장`,place:'Park'})),places:[{name:'Park',tags:'park, sunset'}]});
 put('world:beat:2:0','beat',{chapter:2,storyIndex:0,segments:[{text:'다른 장면'}],places:[{name:'Park',tags:'park'}]});
 put('world:beat:3:0','beat',{chapter:3,storyIndex:0,segments:[{text:'인물 없이 거리를 바라본다.'}]});
 put('world:chapter:3','chapter',{nodes:[{type:'story',title:'거리 풍경',location:'Street',locationTags:'street, sunset, empty street'}]});
 put('world:cg:1:0','cg',{title:'Together',prompt:'park, sunset',from:4,to:9,characters:[{name:'Alice',wearing:'blue dress',doing:'smiling'},{name:'Bob',doing:'waving'}],url:'/old.png',artRef:'global-gallery:old'});
 put('world:cg:2:0','cg',{title:'Single',prompt:'park, sunset',from:0,to:1,characters:[{name:'Alice',doing:'smiling'}]});
 put('world:unit:a','unit',{kind:'character',name:'Alice',rarity:5,identitySex:'female',imageTags:['1girl','red hair','white dress'],identityTags:['red hair'],identityLine:'red hair',outfitTags:['white dress'],outfitLine:'white dress',appearance:'red hair',outfits:[]});
 put('world:unit:b','unit',{kind:'character',name:'Bob',rarity:5,identitySex:'male',imageTags:['1boy','black hair','black coat'],identityTags:['black hair'],identityLine:'black hair',outfitTags:['black coat'],outfitLine:'black coat',appearance:'black hair',outfits:[]});
 put('world:locations','locations',{places:{park:{name:'Park',url:'/old-bg.png',ref:'global-gallery:old-bg'},street:{name:'Street',tags:'empty street',url:'/old-street.png'}}});
 put('world:session','session',{progress:{1:{normal:5}},wallet:{aether:1234},featured:{seq:1}});
 put('world:banner:standard','banner',{title:'Standard',charIds:['world:unit:a','world:unit:b'],bannerArt:'park, sunset',art:{}});
 const originalData=JSON.stringify([...records]);
 const connections=new Map([['nai',{id:'nai',name:'NAI',provider:'image_generation',model:'nai-diffusion-4-5-full',baseUrl:'https://image.novelai.net',defaultParameters:JSON.stringify({imageGeneration:{service:'novelai',version:1,seed:123,novelai:{steps:28,promptGuidance:6}}})}]]);
 const originalConnection=JSON.stringify(connections.get('nai'));
 await page.exposeFunction('fixtureStorage',async(action,value)=>{if(action==='get')return structuredClone(storage);if(action==='patch'){if(storageFail&&Object.keys(value).some(key=>key.startsWith('images:')&&!key.endsWith('settings')))throw Error('시험용 게임 저장 실패');storage={...storage,...value};return structuredClone(storage)}throw Error(action)});
 await page.exposeFunction('fixtureFetch',async input=>{
  const path=new URL(input.url,'http://127.0.0.1:9876').pathname,method=input.method||'GET',body=input.body?JSON.parse(input.body):{};
  requests.push({path,method,body});
  if(method!=='GET')assert.equal(input.headers['x-marinara-csrf'],'1');
  if(path==='/api/professor-mari/workspace/db/command'){
   const argv=body.argv;assert.equal(argv[0],'db');assert.equal(argv[2],'capability_documents');assert.ok(['get','select'].includes(argv[1]));
   if(argv[1]==='get'){const row=records.get(argv[3]);return {ok:!!row,output:row||null};}
   const expression=argv[argv.indexOf('--where')+1],match=/row.kind === "([^"]+)"/.exec(expression);
   return {ok:true,output:[...records.values()].filter(row=>row.kind===match[1])};
  }
  if(path==='/api/connections')return [...connections.values()];
  if(path==='/api/app-settings/ui')return {value:{}};
  if(path==='/api/connections/nai/duplicate'){const id=`tmp${++duplicate}`,data={...connections.get('nai'),id,name:'NAI (Copy)'};connections.set(id,data);return data;}
  const match=/^\/api\/connections\/([^/]+)(\/default-parameters)?$/.exec(path);
  if(match){const id=match[1];assert.notEqual(id,'nai');if(method==='PUT'){connections.get(id).defaultParameters=JSON.stringify(body);return {success:true};}if(method==='PATCH'){Object.assign(connections.get(id),body);return connections.get(id);}if(method==='DELETE'){assert.ok(connections.has(id));connections.delete(id);return {__status:204};}}
  if(path==='/api/characters/avatar-generation'){
   if(generationFail)return {__status:500,error:'시험용 생성 실패'};
   if(generationGate)await generationGate;
   const conn=connections.get(body.connectionId);assert.ok(conn);
   const params=JSON.parse(conn.defaultParameters).customParameters?.parameters;
   if(params){if(!params.v4_prompt.caption.char_captions.length)assert.match(params.v4_prompt.caption.base_caption,/no humans|No people/i);assert.doesNotMatch(params.v4_prompt.caption.base_caption,/red hair|black hair|blue dress|black coat/);}
   return {image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9eEAAAAASUVORK5CYII=',prompt:body.promptOverrides[0].prompt};
  }
  if(path==='/api/global-gallery/upload')return {id:`new${++uploads}`,url:`/new${uploads}.png`};
  throw Error(`Unexpected ${method} ${path}`);
 });
 await page.evaluate(()=>{window.marinara={extension:{id:'test-extension'},log:{debug(){},info(){},warn(){},error(...args){window._errors??=[];window._errors.push(args)}},storage:{get:()=>window.fixtureStorage('get'),patch:value=>window.fixtureStorage('patch',value)},fetch:async(url,options={})=>{const headers=Object.fromEntries(new Headers(options.headers));const data=await window.fixtureFetch({url:String(url),method:options.method,headers,body:options.body instanceof FormData?undefined:options.body});const status=data?.__status||200;return status===204?new Response(null,{status}):Response.json(data,{status})},onCleanup(callback){window._cleanup=callback}};});
 await page.addScriptTag({content:await readFile(resolve(root,'backups/gacha-forge-1.8.12/client.js'),'utf8')});
 await page.evaluate(()=>{const P=customElements.get('marinara-capability-gacha-forge').prototype;P.connectedCallback=function(){};P._loadState=function(){};P._resync=function(){};P._refreshState=function(){};P._postJson=async function(path,body){if(path==='/beat')return {ok:true,segments:this._beat,places:window._fixtureNoPlaces||body?.chapter===3?[]:[{slug:'park',name:'Park',url:'/old-bg.png'}],cg:body?.chapter===3?null:{from:4,to:9,title:'Together',url:'/old.png'}};return {ok:true}};
 const host=document.createElement('marinara-capability-gacha-forge');host.style.cssText='display:block;position:relative;width:100vw;height:100vh';document.body.append(host);host._run={runId:'world',name:'테스트 월드'};host._activeStoryNode={chapter:1,storyIndex:0,title:'과거 장면'};host._state=()=> 'beat';host._persistNav=()=>{};host._boot='ready';host._beat=Array.from({length:10},(_,i)=>({speaker:'',text:`저장된 스토리 ${i+1}번째 문장`,place:'Park'}));host._beatPlaces={Park:'/old-bg.png'};host._beatCg={from:4,to:9,url:'/old.png'};host._beatAt=8;host._beatState='ready';host._renderBrowser();});
 await page.addScriptTag({content:await readFile(resolve(here,'build/extension.js'),'utf8')});
 const launcher=page.getByRole('button',{name:'이미지 도구',exact:true});await launcher.waitFor();
 assert.equal(await launcher.locator('svg').count(),1);assert.equal((await launcher.textContent()).trim(),'');
 async function drag(locator,dx,dy){const b=await locator.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2+dy,{steps:5});await page.mouse.up();}
 const regen=()=>page.getByRole('button',{name:'재생성',exact:true});
 async function cgPrompt(){await page.locator('[data-gf-target-kind="cg"]').click();await page.getByRole('button',{name:'프롬프트 확인',exact:true}).click();await page.getByRole('textbox',{name:'공통 장면 프롬프트',exact:true}).waitFor();}
 let before=await launcher.boundingBox();await drag(launcher,-60,-20);let after=await launcher.boundingBox();assert(after.x<before.x);assert.equal(after.width,48);assert.equal(after.height,48);assert.equal(await page.locator('.gf-image-dialog').count(),0);
 await page.waitForFunction(async()=>!!(await window.marinara.storage.get()).floatingLayout);
 if(viewport.width===844){const cdp=await page.context().newCDPSession(page),b=await launcher.boundingBox(),x=b.x+24,y=b.y+24;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-20,y:y-12}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert((await launcher.boundingBox()).x<b.x);assert.equal(await page.locator('.gf-image-dialog').count(),0);const t=await launcher.boundingBox();await page.touchscreen.tap(t.x+24,t.y+24);await page.getByRole('dialog',{name:'장면 이미지 도구'}).waitFor();await page.getByRole('button',{name:'닫기',exact:true}).click();}
 await page.getByRole('button',{name:'이미지 도구',exact:true}).click();
 const panel=page.getByRole('dialog',{name:'장면 이미지 도구'});await panel.waitFor();before=await panel.boundingBox();await drag(page.getByRole('button',{name:'이미지 편집창 이동',exact:true}),-45,0);after=await panel.boundingBox();assert(after.x<before.x);
 before=after;await drag(page.getByRole('button',{name:'이미지 편집창 크기 조절',exact:true}),-25,-25);after=await panel.boundingBox();assert(after.width<before.width);assert(after.height<before.height);
 const adjusted=after;await page.getByRole('button',{name:'닫기',exact:true}).click();await launcher.click();assert.deepEqual(await panel.boundingBox(),adjusted);assert.equal(await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._beatAt),8);
 await cgPrompt();
 await page.getByRole('textbox',{name:'공통 장면 프롬프트',exact:true}).waitFor();
 const boxes=page.getByRole('textbox');assert.equal(await boxes.count(),6);
 assert.match(await page.getByRole('group',{name:'Alice'}).getByRole('textbox',{name:'외형·복장·동작·표정'}).inputValue(),/blue dress/);
 generationFail=true;
 await regen().click();
 await page.getByRole('status').filter({hasText:'시험용 생성 실패'}).waitFor();
 assert.equal(await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._beatCg.url),'/old.png');
 assert.equal(connections.size,1);
 generationFail=false;
 storageFail=true;
 const storedBefore=JSON.stringify(storage['images:world:cg:1:0']);
 await regen().click();await page.getByRole('status').filter({hasText:'시험용 게임 저장 실패'}).waitFor();
 assert.equal(await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._beatCg.url),'/old.png');assert.equal(JSON.stringify(storage['images:world:cg:1:0']),storedBefore);storageFail=false;
 await page.getByRole('textbox',{name:'공통 장면 프롬프트',exact:true}).fill('1girl, 1boy, park, rain');
 await regen().click();await regen().waitFor();assert.equal(await panel.locator('[role=status]').textContent(),'');
 assert.equal(await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._beatAt),8);
 let savedUrl=`/new${uploads}.png`;assert.equal(await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._beatCg.url),savedUrl);
 assert.equal(storage['images:world:cg:1:0'].data.gachaForgeImages.history[0].ref,'global-gallery:legacy-0.2');
 assert.equal(connections.size,1);assert.equal(JSON.stringify(connections.get('nai')),originalConnection);assert.equal(JSON.stringify([...records]),originalData);
 await page.screenshot({path:resolve(here,`test-results/external-${viewport.width}.png`)});
 await page.getByRole('button',{name:'닫기',exact:true}).click();
 const loaded=await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._postJson('/beat',{runId:'world',chapter:1,storyIndex:0}));
 assert.equal(loaded.cg.url,savedUrl);
 await launcher.click();await cgPrompt();
 let resume;generationGate=new Promise(resolve=>{resume=resolve;});await regen().click();await page.getByRole('button',{name:'재생성 중…',exact:true}).waitFor();await page.getByRole('button',{name:'닫기',exact:true}).click();resume();generationGate=null;
 await page.waitForFunction(old=>document.querySelector('marinara-capability-gacha-forge')._beatCg.url!==old,savedUrl);savedUrl=`/new${uploads}.png`;assert.equal(await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._beatAt),8);
 records.get('world:cg:1:0').revision++;
 const sameContentNewRevision=await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._postJson('/beat',{runId:'world',chapter:1,storyIndex:0}));assert.equal(sameContentNewRevision.cg.url,savedUrl);records.get('world:cg:1:0').revision--;
 const background=await page.evaluate(async()=>{const h=document.querySelector('marinara-capability-gacha-forge');const plan=await h._postJson('/image-addon/preview',{runId:'world',sceneId:'world:beat:1:0',kind:'background',slug:'park'});if(!plan.ok)return plan;return h._postJson('/image-addon/generate',plan);});
 assert.equal(background.ok,true,background.error);
 const imagePlaces=await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._postJson('/image-addon/scene',{runId:'world',sceneId:'world:beat:1:0'}));
 assert.equal(imagePlaces.places[0].url,background.url);
 const otherPlaces=await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._postJson('/image-addon/scene',{runId:'world',sceneId:'world:beat:2:0'}));
 assert.equal(otherPlaces.places[0].url,'/old-bg.png');
 const single=await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._postJson('/cg-art',{runId:'world',chapter:2,storyIndex:0}));
 assert.equal(single.ok,true,single.error);
 await launcher.click();await page.getByRole('combobox').selectOption('world:beat:2:0');await cgPrompt();await regen().click();await regen().waitFor();assert.equal(await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._beatCg.url),savedUrl);await page.getByRole('button',{name:'닫기',exact:true}).click();
 const banner=await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._postJson('/banner-art',{runId:'world',banner:'char-standard',force:true}));
 assert.equal(banner.ok,true,banner.error);
 // Reported regression: the first background shares a beat with a later character CG.
 await page.evaluate(()=>{const h=document.querySelector('marinara-capability-gacha-forge');h._beatAt=0;h._renderKey=null;h._renderBrowser();});await launcher.click();
 await page.waitForFunction(()=>document.querySelector('marinara-capability-gacha-forge')._root.querySelector('[data-gf-target-kind="background"]')?.getAttribute('aria-pressed')==='true');
 assert.equal(await page.locator('[data-gf-target-kind="cg"]').getAttribute('aria-pressed'),'false');assert.equal(await page.getByRole('textbox').count(),0);assert.match(await page.getByRole('combobox').locator('option:checked').textContent(),/저장된 스토리 1번째 문장.*Park/);
 const cgBeforeBackground=JSON.stringify(storage['images:world:cg:1:0']),callsBeforeInspect=requests.filter(request=>request.path==='/api/characters/avatar-generation').length;await page.getByRole('button',{name:'프롬프트 확인',exact:true}).click();await page.getByRole('textbox',{name:'배경 프롬프트 (인물 없음)',exact:true}).waitFor();assert.equal(requests.filter(request=>request.path==='/api/characters/avatar-generation').length,callsBeforeInspect);assert.equal(await page.getByRole('textbox').count(),2);assert.equal(await panel.locator('fieldset').count(),0);assert.match(await page.getByRole('textbox',{name:'배경 프롬프트 (인물 없음)',exact:true}).inputValue(),/No people|no humans/i);
 await regen().click();await regen().waitFor();assert.equal(JSON.stringify(storage['images:world:cg:1:0']),cgBeforeBackground);assert.equal(await panel.locator('[role=status]').textContent(),'');const once=uploads;
 await regen().click();await regen().waitFor();assert.equal(uploads,once+1);assert.equal(JSON.stringify(storage['images:world:cg:1:0']),cgBeforeBackground);assert.equal(await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._beatCg.url),savedUrl);assert.equal(await page.getByRole('button',{name:'프롬프트 확인',exact:true}).count(),1);
 await page.screenshot({path:resolve(here,`test-results/external-${viewport.width}.png`)});await page.getByRole('button',{name:'닫기',exact:true}).click();
 // Automatic backgrounds remain off while explicit manual generation and replay still work.
 const indexBefore=records.get('index').data,offRun=JSON.parse(indexBefore);offRun.runs[0].images.backgrounds=false;records.get('index').data=JSON.stringify(offRun);
 await page.evaluate(()=>{window._fixtureNoPlaces=true;});
 const manualOff=await page.evaluate(async()=>{const h=document.querySelector('marinara-capability-gacha-forge'),p=await h._postJson('/image-addon/preview',{runId:'world',sceneId:'world:beat:1:0',kind:'background',slug:'park'});return p.ok?h._postJson('/image-addon/generate',p):p;});assert.equal(manualOff.ok,true,manualOff.error);
 const offBackgroundReplay=await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._postJson('/beat',{runId:'world',chapter:1,storyIndex:0}));assert.equal(offBackgroundReplay.places.find(p=>p.slug==='park').url,manualOff.url);assert.equal(JSON.parse(records.get('index').data).runs[0].images.backgrounds,false);records.get('index').data=indexBefore;await page.evaluate(()=>{window._fixtureNoPlaces=false;});
 // No beat place list: resolve the actual chapter backdrop, with no CG document at all.
 await page.evaluate(()=>{const h=document.querySelector('marinara-capability-gacha-forge');h._activeStoryNode={chapter:3,storyIndex:0,location:'Street'};h._beat=[{text:'인물 없이 거리를 바라본다.'}];h._beatAt=0;h._beatCg=null;h._locations={street:{url:'/old-street.png'}};h._renderKey=null;h._renderBrowser();});await launcher.click();await page.getByRole('button',{name:'배경 선택: Street',exact:true}).waitFor();assert.equal(await page.locator('[data-gf-target-kind="cg"]').count(),0);await regen().click();await regen().waitFor();const fallbackUrl=`/new${uploads}.png`;assert.equal(await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._nodeBackground()),fallbackUrl);await page.getByRole('button',{name:'닫기',exact:true}).click();
 const fallbackReplay=await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._postJson('/beat',{runId:'world',chapter:3,storyIndex:0}));assert.equal(fallbackReplay.gachaForgeBackground,fallbackUrl);
 await page.evaluate(url=>{const h=document.querySelector('marinara-capability-gacha-forge');h._activeStoryNode={chapter:1,storyIndex:0,title:'과거 장면'};h._beat=Array.from({length:10},(_,i)=>({text:`저장된 스토리 ${i+1}번째 문장`,place:'Park'}));h._beatAt=8;h._beatCg={from:4,to:9,url};h._renderKey=null;h._renderBrowser();},savedUrl);
 assert.equal(JSON.stringify([...records]),originalData);assert.equal(connections.size,1);
 connections.get('nai').model='nai-diffusion-3';
 const unsupported=await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._postJson('/image-addon/preview',{runId:'world',sceneId:'world:beat:1:0',kind:'cg'}));
 assert.equal(unsupported.ok,true,unsupported.error);assert.equal(unsupported.native,false);assert.equal(unsupported.characterPrompts.length,0);
 connections.get('nai').model='non-nai';connections.get('nai').baseUrl='https://other.test';
 const other=await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._postJson('/image-addon/preview',{runId:'world',sceneId:'world:beat:1:0',kind:'cg'}));
 assert.equal(other.ok,true,other.error);assert.equal(other.native,false);
 Object.assign(connections.get('nai'),JSON.parse(originalConnection));
 await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._postJson('/image-addon/settings',{save:true,enabled:false,nativeCharacters:true}));
 const off=await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._postJson('/beat',{runId:'world',chapter:1,storyIndex:0}));assert.equal(off.cg.url,'/old.png');
 assert.equal(await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._beatCg.url),'/old.png');
 await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._postJson('/image-addon/settings',{save:true,enabled:true,nativeCharacters:true}));
 await page.evaluate(()=>window._cleanup());
 assert.equal(await page.getByRole('button',{name:'이미지 도구',exact:true}).count(),0);
 await page.addScriptTag({content:await readFile(resolve(here,'build/extension.js'),'utf8')});
 await page.getByRole('button',{name:'이미지 도구',exact:true}).waitFor();
 await page.getByRole('button',{name:'이미지 도구',exact:true}).click();
 await page.waitForFunction(async()=>{const d=document.querySelector('marinara-capability-gacha-forge')._root.querySelector('.gf-image-dialog');return d?.getBoundingClientRect().width===(await window.marinara.storage.get()).floatingLayout.panel.w;});
 const reloadedBox=await panel.boundingBox();assert(Math.abs(reloadedBox.width-adjusted.width)<1);assert(Math.abs(reloadedBox.x-adjusted.x)<1);await page.getByRole('button',{name:'닫기',exact:true}).click();
 const restored=await page.evaluate(()=>document.querySelector('marinara-capability-gacha-forge')._postJson('/beat',{runId:'world',chapter:1,storyIndex:0}));assert.equal(restored.cg.url,savedUrl);
 await page.evaluate(()=>window._cleanup());
 results.push({viewport,currentBackgroundBeforeLaterCg:true,backgroundEditorHasZeroCharacters:true,unselectedCgNotRegenerated:true,repeatButtonRemains:true,successBannerRemoved:true,separateRegenerateAndPromptButtons:true,manualBackgroundWithAutoOff:true,fallbackBackdropWithoutBeatPlaces:true,realOriginalRenderer:true,singleIcon:true,buttonFixed48px:true,wholeButtonDrag:true,dragDoesNotClick:true,touchDragAndTap:viewport.width===844,panelMoveResize:true,persistedLayout:true,closeDuringGenerationStillSaves:true,pastSceneUiRegeneration:true,manualMultiPerson:true,automaticSingle:true,bannerMulti:true,perSceneBackground:true,otherScenePreserved:true,failureRetry:true,storageFailurePreservesOld:true,unchangedContentNewRevisionRetainsImage:true,readingPositionPreserved:true,sourceDataUnchanged:true,sourceConnectionUnchanged:true,temporaryConnectionsRemoved:true,extensionStoragePersistence:true,reloadedExtensionPersistence:true,unsupportedNai:true,nonNai:true,offPreservesOriginal:true,disableCleanup:true,networkMocked:true});
 await page.close();
}await writeFile(resolve(here,'test-results/browser.json'),JSON.stringify(results,null,2));console.log('PASS: importable external bundle; PC/mobile; native multi CG, automatic single CG, multi banner, preview edit, failure/retry, persistence, original data/settings unchanged, temporary cleanup and disable cleanup.');
}finally{await browser.close()}
