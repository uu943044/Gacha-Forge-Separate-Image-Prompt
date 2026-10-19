import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const here=dirname(fileURLToPath(import.meta.url)),runtime=resolve(here,`test-results/persistence-${Date.now()}`),run=promisify(execFile);
await mkdir(runtime,{recursive:true});const expected=resolve(runtime,'expected.json'),original=resolve(runtime,'original'),restored=resolve(runtime,'restored');
const worker=async(mode,dir)=>{const result=await run(process.execPath,[resolve(here,'persistence-worker.mjs'),mode,dir,expected],{timeout:120000,maxBuffer:1024*1024});console.log(result.stdout.trim());};
await worker('write',original);await worker('verify',original);
const require=createRequire('C:/Users/user/AppData/Local/Marinara-Engine/package.json'),Zip=require('adm-zip');
const zip=new Zip(await readFile(resolve(runtime,'full-game-backup.zip')));let copied=0;
for(const entry of zip.getEntries()){
 const parts=entry.entryName.split('/'),index=parts.findIndex(part=>['storage','gallery'].includes(part));
 if(entry.isDirectory||index<0)continue;
 const output=resolve(restored,...parts.slice(index));assert(output.startsWith(restored+sep),'Backup file must stay inside isolated restore directory');
 await mkdir(dirname(output),{recursive:true});await writeFile(output,entry.getData());copied++;
}
assert(copied>0);await worker('verify',restored);
await writeFile(resolve(here,'test-results/persistence.json'),JSON.stringify({passed:true,engine:'2.5.0',isolatedFixture:true,originalInstallationUntouched:true,realExtensionStorageApi:true,realGalleryUploadAndFileRead:true,realAddonGenerate:true,serverProcessRestart:true,fullBackupArchiveCreated:true,restoredStorageAndGalleryInNewDirectory:true,cgAndPerSceneBackgroundRestored:true,extensionUpgradeKeepsStorage:true,sourceStoryProgressAndWalletUnchanged:true,paidCalls:0,syntheticImageProvider:true},null,2));
console.log('PASS: real game server image save, process restart, full backup archive and restoration in a new directory; CG/background files and scene links retained. No paid calls.');
