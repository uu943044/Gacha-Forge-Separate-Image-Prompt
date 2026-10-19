// Runs only against a caller-created, isolated fixture directory. Never connects to the user's running server.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const [mode, runtime, expectedPath] = process.argv.slice(2);
assert(['write','verify'].includes(mode)); assert(runtime && expectedPath);
const here=dirname(fileURLToPath(import.meta.url)),installation='C:/Users/user/AppData/Local/Marinara-Engine';
await mkdir(runtime,{recursive:true});const envFile=resolve(runtime,'fixture.env');await writeFile(envFile,'');
Object.assign(process.env,{MARINARA_ENV_FILE:envFile,DATA_DIR:runtime,FILE_STORAGE_DIR:resolve(runtime,'storage'),NODE_ENV:'test',LOG_LEVEL:'silent',DISABLE_AUTO_CREATE_DEFAULT_CONNECTION:'true',ENABLE_EXTERNAL_EXTENSIONS:'true'});
const require=createRequire(`${installation}/package.json`),sharp=require(`${installation}/packages/server/node_modules/sharp`);
const png=await sharp({create:{width:16,height:16,channels:4,background:{r:23,g:64,b:83,alpha:1}}}).png().toBuffer();
globalThis.fetch=async(url,options)=>{
 assert.equal(String(url),'https://image.novelai.net/ai/generate-image');assert.equal(new Headers(options.headers).get('Authorization'),'Bearer synthetic-test-key');
 return new Response(png,{headers:{'content-type':'image/png'}});
};
globalThis.location={origin:'http://localhost'};globalThis.localStorage={getItem:()=>null};
const {buildApp}=await import(pathToFileURL(`${installation}/packages/server/dist/app.js`).href),app=await buildApp();
const {makeService}=await import('./browser-service.mjs');
try{
 await app.ready();
 const request=async(method,url,payload)=>{const r=await app.inject({method,url,headers:{host:'localhost','x-marinara-csrf':'1'},payload});assert(r.statusCode>=200&&r.statusCode<300,`${method} ${url}: ${r.statusCode} ${r.body.slice(0,200)}`);return r.statusCode===204?null:r.json();};
 const approve=ext=>request('POST',`/api/personal-extensions/${ext.id}/approve`,{contentHash:ext.contentHash,acknowledgeFullPageAccess:true,acknowledgeSandboxedCode:true});
 let extension,expected;
 if(mode==='write'){
  const {createAppSettingsStorage}=await import(pathToFileURL(`${installation}/packages/server/dist/services/storage/app-settings.storage.js`).href);await createAppSettingsStorage(app.db).set('external-extensions-enabled','true');
  extension=await request('POST','/api/personal-extensions',{name:'Gacha Forge Images',version:'0.2.0',runtime:'client',capabilities:['full_page_access'],js:'// synthetic old extension'});await approve(extension);
  await request('PATCH',`/api/personal-extensions/${extension.id}/storage`,{upgradeMarker:'keep-me',floatingLayout:{button:{x:.2,y:.3},panel:{x:.4,y:.2,w:390,h:440}}});
  const manifest=JSON.parse(await readFile(resolve(here,'build/manifest.json'),'utf8')),js=await readFile(resolve(here,'build/extension.js'),'utf8');
  extension=await request('PATCH',`/api/personal-extensions/${extension.id}`,{...manifest.config,js,jsPath:undefined});assert.equal(extension.enabled,false);await approve(extension);
  assert.equal((await request('GET',`/api/personal-extensions/${extension.id}/storage`)).value.upgradeMarker,'keep-me');
  const connection=await request('POST','/api/connections',{name:'Synthetic NAI',provider:'image_generation',model:'nai-diffusion-4-5-full',baseUrl:'https://image.novelai.net',apiKey:'synthetic-test-key',imageService:'novelai',imageGenerationSource:'novelai'});
  const schema=await import(pathToFileURL(`${installation}/packages/server/dist/db/schema/index.js`).href);
  const data=[['index','index',{runs:[{runId:'world',scenario:'Park',images:{connectionId:connection.id,backgrounds:true,sceneWidth:1216,sceneHeight:832}}]}],['world:beat:1:0','beat',{chapter:1,storyIndex:0,segments:[{text:'story preserved'}],places:[{name:'Park',tags:'park, sunset'}]}],['world:beat:2:0','beat',{chapter:2,storyIndex:0,segments:[{text:'other story'}],places:[{name:'Park',tags:'park'}]}],['world:cg:1:0','cg',{title:'Together',from:0,to:0,characters:[{name:'Alice'},{name:'Bob'}],prompt:'park',url:'/old.png'}],['world:unit:a','unit',{kind:'character',name:'Alice',identityTags:['red hair'],identitySex:'female',outfitTags:['blue dress']}],['world:unit:b','unit',{kind:'character',name:'Bob',identityTags:['black hair'],identitySex:'male',outfitTags:['black coat']}],['world:locations','locations',{places:{park:{name:'Park',url:'/old-bg.png'}}}],['world:session','session',{progress:{1:3},wallet:{aether:123}}]];
  for(const [id,kind,value] of data)await app.db.insert(schema.capabilityDocuments).values({id,packageId:'gacha-forge',kind,name:id,description:'',data:JSON.stringify(value),revision:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  expected={extensionId:extension.id,source:data,connectionId:connection.id};
 }else{expected=JSON.parse(await readFile(expectedPath,'utf8'));extension={id:expected.extensionId};}
 const extensionFetch=async(url,options={})=>{
  const req=new Request(url,options),headers=Object.fromEntries(req.headers);headers.host='localhost';
  const r=await app.inject({method:req.method,url:new URL(url).pathname,headers,payload:['GET','HEAD'].includes(req.method)?undefined:Buffer.from(await req.arrayBuffer())});
  return new Response(r.statusCode===204?null:r.rawPayload,{status:r.statusCode,headers:r.headers});
 };
 const marinara={extension,fetch:extensionFetch,log:{info(){},warn(){},error(){}},storage:{get:async()=>(await request('GET',`/api/personal-extensions/${extension.id}/storage`)).value,patch:async value=>(await request('PATCH',`/api/personal-extensions/${extension.id}/storage`,value)).value}};
 const service=await makeService(marinara);
 if(mode==='write'){
  const run=async body=>{const plan=await service.invoke('/image-addon/preview',body);assert.equal(plan.ok,true,plan.error);const result=await service.invoke('/image-addon/generate',plan);assert.equal(result.ok,true,result.error);return result;};
  expected.cg=await run({runId:'world',sceneId:'world:beat:1:0',kind:'cg'});expected.background=await run({runId:'world',sceneId:'world:beat:1:0',kind:'background',slug:'park'});
  expected.fileHashes = {};
 }
 const cg=await service.documents.getById('gacha-forge','world:cg:1:0');assert.equal(cg.data.url,expected.cg.url);
 const scene=await service.invoke('/image-addon/scene',{runId:'world',sceneId:'world:beat:1:0'});assert.equal(scene.places[0].url,expected.background.url);
 const other=await service.invoke('/image-addon/scene',{runId:'world',sceneId:'world:beat:2:0'});assert.equal(other.places[0].url,'/old-bg.png');
 for(const [id,,value] of expected.source)assert.deepEqual((await service.raw(id)).data,value);
 const stored=await marinara.storage.get();assert.equal(stored.upgradeMarker,'keep-me');assert.equal(stored.floatingLayout.panel.w,390);
 for(const image of [expected.cg,expected.background]){
  const r=await app.inject({method:'GET',url:image.url,headers:{host:'localhost'}});assert.equal(r.statusCode,200);assert.deepEqual(await sharp(r.rawPayload).raw().toBuffer(),await sharp(png).raw().toBuffer());
  const hash=createHash('sha256').update(r.rawPayload).digest('hex');if(mode==='write')expected.fileHashes[image.url]=hash;else assert.equal(hash,expected.fileHashes[image.url]);
 }
 if(mode==='write'){
  await writeFile(expectedPath,JSON.stringify(expected,null,2));
  const r=await app.inject({method:'POST',url:'/api/backup/download',headers:{host:'localhost','x-marinara-csrf':'1'},payload:{}});assert.equal(r.statusCode,200,r.body.slice(0,100));await writeFile(resolve(dirname(expectedPath),'full-game-backup.zip'),r.rawPayload);
 }
 console.log(JSON.stringify({phase:mode,realEngine:'2.5.0',gameServerImageLinks:true,cgAndBackgroundFilesReadable:true,sourceStoryAndSaveUnchanged:true,extensionUpdateRetainsStorage:true,layoutRetained:true,paidCalls:0}));
}finally{await app.close();}
process.exit(0);
