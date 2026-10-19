import {readFile,writeFile,mkdir,cp,readdir} from 'node:fs/promises';
import {dirname,resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createDeterministicZip} from '../upstream/Marinara-Agents/scripts/deterministic-zip.mjs';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..');
const manifest=JSON.parse(await readFile(join(here,'build/manifest.json'),'utf8'));
const stage=resolve(root,`deliverables/Gacha-Forge-Images-External-${manifest.config.version}`);
await mkdir(stage,{recursive:true});
for(const name of ['manifest.json','extension.js'])await cp(join(here,'build',name),join(stage,name));
await cp(join(here,'README.ko.md'),join(stage,'사용설명서.md'));
await cp(join(root,'upstream/Marinara-Engine/LICENSE'),join(stage,'LICENSE'));
await mkdir(join(stage,'verification'),{recursive:true});
for(const name of ['engine.json','browser.json','persistence.json','installation.json','external-1280.png','external-844.png'])await cp(join(here,'test-results',name),join(stage,'verification',name));
await mkdir(join(stage,'source/gacha-external'),{recursive:true});
for(const name of await readdir(here))if(/\.(?:mjs|md)$/.test(name)&&name!=='ui.mjs')await cp(join(here,name),join(stage,'source/gacha-external',name));
await mkdir(join(stage,'source/gacha-image-addon'),{recursive:true});
for(const name of ['native-prompts.mjs','server-addon.mjs','client-addon.js'])await cp(join(root,'gacha-image-addon',name),join(stage,'source/gacha-image-addon',name));
await mkdir(join(stage,'source/upstream/Marinara-Engine/packages/shared/src/constants'),{recursive:true});
await cp(join(root,'upstream/Marinara-Engine/packages/shared/src/constants/image-generation-defaults.ts'),join(stage,'source/upstream/Marinara-Engine/packages/shared/src/constants/image-generation-defaults.ts'));
await writeFile(join(stage,'source/README.md'),'The extension was built with esbuild from gacha-external/entry.mjs. vendor.mjs contains the original Gacha Forge image adapter source, retained for source availability; the original Engine and Gacha Forge installation files are never modified. build.mjs reads the known upstream checkout and existing Engine development dependencies. See the root Korean guide for pinned upstream commits and validation scope.\n');
async function walk(path){const files=[];for(const entry of await readdir(path,{withFileTypes:true})){const full=join(path,entry.name);if(entry.isDirectory())files.push(...await walk(full));else files.push(full);}return files;}
const payloads=[],hashes={};
for(const file of (await walk(stage)).sort()){
 const name=relative(stage,file).replaceAll('\\','/');if(name==='SHA256SUMS.json')continue;
 const data=await readFile(file);hashes[name]=createHash('sha256').update(data).digest('hex');payloads.push({name,data});
}
const hashFile=Buffer.from(JSON.stringify(hashes,null,2)+'\n');await writeFile(join(stage,'SHA256SUMS.json'),hashFile);payloads.push({name:'SHA256SUMS.json',data:hashFile});
const archive=createDeterministicZip(payloads),output=stage+'.zip';await writeFile(output,archive);await writeFile(output+'.sha256',createHash('sha256').update(archive).digest('hex')+'\n');
console.log(JSON.stringify({output,files:payloads.length,bytes:archive.length}));
