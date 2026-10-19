import { makeService } from './browser-service.mjs';
import { installUi } from './ui.mjs';
import { createFloatingControls } from './floating-controls.mjs';
import { openImageEditor } from './image-editor.mjs';

async function start(marinara) {
  let alive = true;
  const cleanups = [];
  marinara.onCleanup(async () => { alive = false; for (const cleanup of cleanups.reverse()) await cleanup(); });
  await customElements.whenDefined('marinara-capability-gacha-forge');
  if (!alive) return;
  const service = await makeService(marinara);
  if (!alive) return;
  const prototype = customElements.get('marinara-capability-gacha-forge').prototype;
  const originalPost = prototype._postJson;
  const originalRender = prototype._renderBrowser;
  const originalNodeBackground = prototype._nodeBackground;
  let imagesEnabled = true;
  const locks = new Map();
  const dedupe = (key, task) => {
    if (locks.has(key)) return locks.get(key);
    const promise = Promise.resolve().then(task).finally(() => { if (locks.get(key) === promise) locks.delete(key); });
    locks.set(key, promise); return promise;
  };
  const sceneId = (path, body) => {
    const part = Number(body.part) || 1;
    const chapter = path === '/bond-chapter/beat' ? `bond-${String(body.unitId).split(':unit:')[1] || body.unitId}${part > 1 ? `-${part}` : ''}` : body.chapter;
    return `${body.runId}:beat:${chapter}:${body.storyIndex}`;
  };
  async function restoreHost(host){
    delete host._gfImageSceneBackground;
    if(!host._run?.runId||!host._activeStoryNode||host._beatState!=='ready')return;
    const runId=host._run.runId,active=host._activeStoryNode;
    const body={runId,chapter:active.chapter,storyIndex:active.storyIndex,unitId:host._bondUnit,part:host._bondPart};
    const id=sceneId(host._bondUnit?'/bond-chapter/beat':'/beat',body);
    const [cg,beat,run]=await Promise.all([service.raw(id.replace(':beat:',':cg:')),service.raw(id),service.getRun(runId)]);
    if(host._run?.runId!==runId||host._activeStoryNode!==active||!beat)return;
    host._beatCg=cg?{from:cg.data.from,to:cg.data.to,title:cg.data.title,url:cg.data.url||''}:null;
    const places=await service.places(runId,beat.data.places,run);
    host._beatPlaces=Object.fromEntries(places.filter(place=>place.url).map(place=>[place.name,place.url]));
    host._renderKey=null;host._renderBrowser();
  }
  const overlayBeat = async (path, body, response) => {
    if (!response?.ok || !response.segments) return response;
    const config = await service.invoke('/image-addon/settings', {});
    if (!config.settings.enabled) return response;
    const id = sceneId(path, body);
    const cg = await service.documents.getById('gacha-forge', id.replace(':beat:', ':cg:'));
    return { ...response, places: await service.addon.scenePlaces(id, response.places ?? []), gachaForgeBackground: await service.addon.sceneBackground(id), cg: cg ? { ...response.cg, from: cg.data.from, to: cg.data.to, title: cg.data.title, url: cg.data.url || '' } : response.cg };
  };
  prototype._nodeBackground = function(...args) {
    const active = this._activeStoryNode;
    const id = active && sceneId(this._bondUnit ? '/bond-chapter/beat' : '/beat', { runId: this._run?.runId, chapter: active.chapter, storyIndex: active.storyIndex, unitId: this._bondUnit, part: this._bondPart });
    return alive && this._gfImageSceneBackground?.sceneId === id ? this._gfImageSceneBackground.url : originalNodeBackground.apply(this, args);
  };
  const addonNodeBackground = prototype._nodeBackground;
  prototype._postJson = async function(path, body = {}, ...rest) {
    if (!alive) return originalPost.call(this,path,body,...rest);
    let baseResponse;
    try {
      if (path.startsWith('/image-addon/')) {
        const result=await service.invoke(path,body);
        if (path === '/image-addon/settings' && result.ok) imagesEnabled = result.settings.enabled;
        if(path==='/image-addon/settings'&&result.ok&&body.save&&body.enabled===false)await restoreHost(this);
        return result;
      }
      if (path === '/cg-art' && await service.nativeEnabled(body.runId)) {
        const id = sceneId('/beat',body);
        return await dedupe(id,async () => {
          const cg = await service.documents.getById('gacha-forge',id.replace(':beat:',':cg:'));
          if (cg?.data.url) return { ok:true,url:cg.data.url,cached:true };
          const plan = await service.invoke('/image-addon/preview',{runId:body.runId,sceneId:id,kind:'cg'});
          if (!plan.ok) return plan;
          return service.invoke('/image-addon/generate',plan);
        });
      }
      if(path === '/banner-art' && await service.nativeEnabled(body.runId)) {
        const result=await service.bannerArt(body); if(result)return result;
      }
      const result = await originalPost.call(this,path,body,...rest);
      baseResponse=result;
      if (path === '/beat' || path === '/bond-chapter/beat') { const response = await overlayBeat(path,body,result); if (response?.ok) this._gfImageSceneBackground = { sceneId: sceneId(path,body), url: response.gachaForgeBackground || '' }; if (!response?.gachaForgeBackground) delete this._gfImageSceneBackground; return response; }
      if(path==='/summon-banner'&&result?.ok){
        const config=await service.invoke('/image-addon/settings',{});
        if(config.settings.enabled){
          const session=await service.raw(`${body.runId}:session`),sequence=Math.max(1,Math.round(Number(session?.data.featured?.seq)||1));
          for(const banner of result.banners??[]){
            const doc=await service.documents.getById('gacha-forge',`${body.runId}:banner:${banner.id.endsWith('standard')?'standard':`char:f${sequence}`}`);
            if(doc?.data.art?.[banner.id])banner.art=doc.data.art[banner.id];
          }
          const current=result.banners?.find(banner=>banner.id===(body.banner||'char-featured'));if(current?.art&&result.banner)result.banner.art=current.art;
        }
      }
      return result;
    } catch (error) {
      marinara.log.error('이미지 확장 요청 실패', path, error.message);
      if (path === '/beat' || path === '/bond-chapter/beat') return baseResponse ?? originalPost.call(this,path,body,...rest);
      return {ok:false,error:error.message};
    }
  };
  const addonPost = prototype._postJson;
  const floating = createFloatingControls({ load: async () => (await service.invoke('/image-addon/layout', {})).layout, save: layout => service.invoke('/image-addon/layout', { save: true, layout }).then(result => { if (!result.ok) throw new Error(result.error); }), isActive: () => alive });
  installUi({ floating, isActive: () => alive, openEditor: (host, helpers) => openImageEditor(host, { ...helpers, floating, isActive: () => alive && imagesEnabled }) });
  const addonRender = prototype._renderBrowser;
  cleanups.push(async () => {
    await floating.dispose();
    if (prototype._postJson === addonPost) prototype._postJson = originalPost;
    if (prototype._renderBrowser === addonRender) prototype._renderBrowser = originalRender;
    if (prototype._nodeBackground === addonNodeBackground) prototype._nodeBackground = originalNodeBackground;
    delete prototype._gfImageAddon;
    for (const host of document.querySelectorAll('marinara-capability-gacha-forge')) {
      host._root?.querySelectorAll('[data-gf-image-tools],.gf-image-dialog').forEach(element=>element.remove());
      try{await restoreHost(host);}catch(error){marinara.log.warn('원본 이미지 표시를 다시 불러오려면 장면을 재진입해 주세요.',error.message);}
      host._renderKey = null; host._renderBrowser();
    }
  });
  for (const host of document.querySelectorAll('marinara-capability-gacha-forge')) host._renderBrowser();
  marinara.log.info('Gacha Forge 이미지 확장 0.3.1 준비 완료. 엔진 파일을 수정하지 않습니다.');
}

start(marinara).catch(error => marinara.log.error('Gacha Forge 이미지 확장 시작 실패', error.message));
