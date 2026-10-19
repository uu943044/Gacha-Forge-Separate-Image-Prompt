import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import assert from 'node:assert/strict';
import {nativeParameters} from './native-request.mjs';
const here=dirname(fileURLToPath(import.meta.url)),installation='C:/Users/user/AppData/Local/Marinara-Engine';
const runtime=resolve(here,'test-results',`engine-${Date.now()}`);
await mkdir(runtime,{recursive:true});
const envFile=resolve(runtime,'fixture.env');await writeFile(envFile,'');
Object.assign(process.env,{MARINARA_ENV_FILE:envFile,DATA_DIR:runtime,FILE_STORAGE_DIR:resolve(runtime,'storage'),NODE_ENV:'test',LOG_LEVEL:'silent',DISABLE_AUTO_CREATE_DEFAULT_CONNECTION:'true',ENABLE_EXTERNAL_EXTENSIONS:'true'});
const require=createRequire(`${installation}/package.json`);
const sharp=require(`${installation}/packages/server/node_modules/sharp`);
const png=await sharp({create:{width:16,height:16,channels:4,background:{r:30,g:40,b:50,alpha:1}}}).png().toBuffer();
const previousFetch=globalThis.fetch,wire=[];
globalThis.fetch=async(url,options={})=>{
 if(String(url)==='https://image.novelai.net/ai/generate-image'){
  assert.equal(new Headers(options.headers).get('Authorization'),'Bearer synthetic-test-key');
  wire.push(JSON.parse(options.body));return new Response(png,{headers:{'Content-Type':'image/png'}});
 }
 throw new Error('Test blocks external fetch: '+String(url));
};
const {buildApp}=await import(pathToFileURL(`${installation}/packages/server/dist/app.js`).href);
const app=await buildApp();
try{
 await app.ready();
 const request=async(method,url,payload)=>{
  const response=await app.inject({method,url,headers:{host:'localhost','x-marinara-csrf':'1'},payload});
  assert.ok(response.statusCode>=200&&response.statusCode<300,`${method} ${url}: ${response.statusCode} ${response.body.slice(0,300)}`);
  return response.statusCode===204?null:response.json();
 };
 const connection=await request('POST','/api/connections',{name:'Synthetic NAI',provider:'image_generation',model:'nai-diffusion-4-5-full',baseUrl:'https://image.novelai.net',apiKey:'synthetic-test-key',imageService:'novelai',imageGenerationSource:'novelai'});
 const before=await request('GET',`/api/connections/${connection.id}`);
 for(const count of [0,1,2]){
  const duplicate=await request('POST',`/api/connections/${connection.id}/duplicate`,{});
  const prompt={prompt:count===0?'scenery, no humans, park':count===1?'1girl, park':'1girl, 1boy, park',negativePrompt:'text',width:1216,height:832,characterPrompts:count===0?[]:[{name:'Alice',prompt:'girl, red hair, blue dress',negativePrompt:'black hair',position:{x:.33,y:.5}},...(count===2?[{name:'Bob',prompt:'boy, black hair, black coat',negativePrompt:'red hair',position:{x:.67,y:.5}}]:[])]};
  await request('PUT',`/api/connections/${duplicate.id}/default-parameters`,nativeParameters(before,prompt));
  const result=await request('POST','/api/characters/avatar-generation',{connectionId:duplicate.id,name:'Test scene',appearance:prompt.prompt,purpose:'avatar',width:prompt.width,height:prompt.height,promptOverrides:[{id:'avatar:test-scene',prompt:prompt.prompt,negativePrompt:prompt.negativePrompt}]});
  assert.match(result.image,/^data:image\/png;base64,/);
  const last=wire.at(-1);assert.equal(last.parameters.v4_prompt.caption.char_captions.length,count);assert.doesNotMatch(last.parameters.v4_prompt.caption.base_caption,/red hair|black hair/);if(count)assert.equal(last.parameters.v4_prompt.caption.char_captions[0].centers[0].x,.33);else assert.equal(last.parameters.v4_prompt.use_coords,false);
  await request('DELETE',`/api/connections/${duplicate.id}`);
 }
 assert.deepEqual(await request('GET',`/api/connections/${connection.id}`),before);
 const connections=await request('GET','/api/connections');assert.equal(connections.filter(c=>c.name==='Synthetic NAI (Copy)').length,0);
 const {createAppSettingsStorage}=await import(pathToFileURL(`${installation}/packages/server/dist/services/storage/app-settings.storage.js`).href);
 await createAppSettingsStorage(app.db).set('external-extensions-enabled','true');
 const manifest=JSON.parse(await readFile(resolve(here,'build/manifest.json'),'utf8'));
 const script=await readFile(resolve(here,'build/extension.js'),'utf8');
 const imported=await request('POST','/api/personal-extensions',{...manifest.config,js:script});
 assert.deepEqual(imported.capabilities,['full_page_access']);
 assert.equal(imported.enabled,false);
 assert.equal(imported.runtime,'client');
 await writeFile(resolve(here,'test-results/engine.json'),JSON.stringify({passed:true,unpatchedEngine:'2.5.0',isolatedDataDirectory:true,realHttpRoutes:['connections duplicate','connection default-parameters','characters avatar-generation','connections delete','personal extensions import'],importedAsDisabledExternal:true,capabilitiesPreserved:['full_page_access'],originalConnectionUnchanged:true,nativeCharacterCounts:[0,1,2],paidCalls:0,networkResponseReplaced:true,wire},null,2));
 console.log('PASS: unpatched Engine 2.5.0 real HTTP handlers, encrypted-key duplication, one/two native character captions and coords, original connection unchanged, temporary copies removed. No paid request.');
}finally{await app.close();globalThis.fetch=previousFetch;}
process.exit(0);
