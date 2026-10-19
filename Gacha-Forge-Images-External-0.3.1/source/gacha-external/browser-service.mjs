import { createImageAddon } from '../gacha-image-addon/server-addon.mjs';
import { nativeLimit } from '../gacha-image-addon/native-prompts.mjs';
import { imageAdapter, bannerPrompt, scenePrompt, dimensions, backdrop } from './vendor.mjs';
import { nativeParameters } from './native-request.mjs';

const copy = value => structuredClone(value);
const tagList = value => Array.isArray(value) ? value.filter(value => typeof value === 'string' && value.trim()) : [];
const slug = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0,60);
export async function makeService(marinara) {
  const pending = new Map();
  let queue = Promise.resolve(), storeQueue = Promise.resolve();
  const ownedTemporary = new Set();
  const serial = task => { const result = queue.then(task, task); queue = result.catch(() => {}); return result; };
  const engineFetch = (path, options = {}) => {
    const url = new URL(path, location.origin);
    if (url.origin !== location.origin) throw new Error('확장은 마리나라 서버에만 요청합니다.');
    const headers = new Headers(options.headers);
    if (!['GET','HEAD','OPTIONS'].includes(String(options.method ?? 'GET').toUpperCase())) headers.set('x-marinara-csrf','1');
    try { const admin = localStorage.getItem('marinara_admin_secret'); if (admin) headers.set('X-Admin-Secret', admin); } catch {}
    return marinara.fetch(url,{...options,headers});
  };
  const json = async (path, options = {}) => {
    const response = await engineFetch(path, { ...options, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers ?? {}) } });
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new Error(data?.error || `마리나라 API 응답: ${response.status}`);
    return data;
  };
  const db = async argv => {
    // This adapter deliberately implements SELECT/GET only. It never issues a database write.
    if (!['get','select'].includes(argv[1]) || argv[2] !== 'capability_documents') throw new Error('읽기 전용 장면 조회만 허용합니다.');
    const data = await json('/api/professor-mari/workspace/db/command', { method: 'POST', body: JSON.stringify({ argv }) });
    if (!data.ok && data.output !== null) throw new Error(data.error || '장면 조회가 거절되었습니다. 이 확장은 서버 PC의 localhost에서 사용해 주세요.');
    return data.output;
  };
  const parse = row => {
    if (!row) return null;
    if (row.packageId !== 'gacha-forge') throw new Error('다른 패키지의 데이터는 사용하지 않습니다.');
    return { ...row, data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data };
  };
  const raw = async id => parse(await db(['db','get','capability_documents',id]));
  const ownKey = id => `images:${id}`;
  const own = async id => (await marinara.storage.get())[ownKey(id)];
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const signature = async data => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical(data)))))].map(value => value.toString(16).padStart(2, '0')).join('');
  const applies = async (base, extra) => !!base && !!extra && (extra.baseRevision === base.revision || typeof extra.sourceSignature === 'string' && extra.sourceSignature === await signature(base.data));
  async function read(id) {
    const extra = await own(id);
    if (id === 'image-addon:settings') return extra ? { id, revision: extra.revision, data: extra.data, name: 'Image settings', description: '' } : null;
    const base = await raw(id);
    if (!base) return null;
    if (!await applies(base, extra)) return base;
    return { ...base, revision: base.revision + extra.revision, data: { ...base.data, ...extra.data } };
  }
  const lock = task => navigator.locks ? navigator.locks.request(`gacha-forge-images:${marinara.extension.id}`, task) : (() => { const result=storeQueue.then(task,task); storeQueue=result.catch(()=>{}); return result; })();
  const documents = {
    getById: async (_pkg, id) => read(id),
    list: async (_pkg, kind) => {
      const rows = await db(['db','select','capability_documents','--where',`row.packageId === "gacha-forge" && row.kind === ${JSON.stringify(kind)}`,'--limit','5000']);
      if (!Array.isArray(rows) || rows.length >= 5000) throw new Error('장면 목록이 너무 큽니다. 전체 목록을 안전하게 읽을 수 없어 중단했습니다.');
      const state = await marinara.storage.get();
      return Promise.all(rows.map(parse).map(async base => { const entry = state[ownKey(base.id)]; return await applies(base, entry) ? { ...base, revision: base.revision + entry.revision, data: { ...base.data, ...entry.data } } : base; }));
    },
    create: async input => lock(async () => {
      if (input.id !== 'image-addon:settings' || await own(input.id)) throw new Error('이미지 확장 설정 이외의 원본 문서는 만들지 않습니다.');
      const value = { revision: 1, data: input.data };
      await marinara.storage.patch({ [ownKey(input.id)]: value });
      return { ...input, revision: 1 };
    }),
    update: async input => lock(async () => {
      const current = await read(input.id);
      if (!current || current.revision !== input.expectedRevision) return null;
      const base = input.id === 'image-addon:settings' ? null : await raw(input.id);
      const previous = await own(input.id);
      let data;
      if (input.id === 'image-addon:settings') data = { enabled: input.data.enabled === true, nativeCharacters: input.data.nativeCharacters === true };
      else if (base.kind === 'cg') data = { url: input.data.url, artRef: input.data.artRef, gachaForgeImages: input.data.gachaForgeImages };
      else if (base.kind === 'beat') data = { gachaForgeImages: input.data.gachaForgeImages };
      else if (base.kind === 'banner') data = { art: input.data.art, artRef: input.data.artRef };
      else throw new Error('CG·장면별 이미지 이외의 데이터는 저장하지 않습니다.');
      const previousApplies = base ? await applies(base, previous) : !!previous;
      const value = { baseRevision: base?.revision, ...(base ? { sourceSignature: await signature(base.data) } : {}), revision: (previousApplies ? previous?.revision ?? 0 : 0) + 1, data };
      await marinara.storage.patch({ [ownKey(input.id)]: value });
      const persisted = await own(input.id);
      if (JSON.stringify(persisted) !== JSON.stringify(value)) throw new Error('게임 서버에서 이미지 저장을 확인하지 못했습니다. 기존 이미지는 유지됩니다.');
      const confirmedBase = base ? await raw(input.id) : null;
      if (base && !await applies(confirmedBase, persisted)) throw new Error('저장 중 장면이 바뀌었습니다. 기존 이미지는 유지됩니다.');
      return { ...current, revision: (confirmedBase?.revision ?? 0) + value.revision, data: { ...current.data, ...data } };
    }),
  };
  const routes = new Map();
  const addon = createImageAddon({ package: { id: 'gacha-forge' }, api: { runtime: { persistence: { documents } }, registerPrivilegedRoutes: async (plugin, options) => { await plugin({ post: (path, handler) => routes.set(options.prefix + path, handler) }); } } });
  const client = imageAdapter({ baseUrl: location.origin, fetch: engineFetch, logger: marinara.log });
  const getRun = async id => (await raw('index'))?.data?.runs?.find(run => run.runId === id);
  const imageConfig = run => ({ ...(run.images ?? {}), ...dimensions(run.images), off: !!run.images && !run.images.connectionId, backgrounds: run.images?.backgrounds === true, connectionId: run.images?.connectionId || '', styleProfileId: run.images?.styleProfileId || '' });
  const connection = async run => {
    const connections = await client.listConnections();
    const config = imageConfig(run);
    if (config.off) return null;
    return connections.find(value => value.id === config.connectionId) ?? (!run.images ? connections.find(value => value.provider === 'image_generation') : null);
  };
  async function deleteTemporary(id) {
    const entry = (await marinara.storage.get()).temporaryConnections?.[id];
    if (!entry && !ownedTemporary.has(id)) return;
    await json(`/api/connections/${encodeURIComponent(id)}`, { method: 'DELETE' });
    ownedTemporary.delete(id);
    await lock(async()=>marinara.storage.patch({ temporaryConnections: { ...((await marinara.storage.get()).temporaryConnections ?? {}), [id]: null } }));
  }
  // Recover only this extension's journalled copies after an interrupted browser session.
  const journal=(await marinara.storage.get()).temporaryConnections??{};
  for(const [id,entry] of Object.entries(journal)){
    if(!entry||id===entry.sourceId||Date.now()-entry.at<30*60*1000)continue;
    const recover=async()=>{
      try{
        const current=await json(`/api/connections/${encodeURIComponent(id)}`);
        if(current?.id===id&&current.name===`Gacha Forge 이미지 임시 연결 (${marinara.extension.id})`)await deleteTemporary(id);
      }catch(error){marinara.log.warn('지난 임시 연결 확인을 완료하지 못했습니다.',id,error.message);}
    };
    if(navigator.locks)await navigator.locks.request(`gacha-forge-image-request:${entry.sourceId}`,{ifAvailable:true},lock=>lock?recover():undefined);
    else await recover();
  }
  client.generatePrepared = async request => {
    const connections = await client.listConnections();
    const original = connections.find(value => value.id === request.connectionId);
    const parameters = request.characterPrompts?.length || request.imageKind === 'background' && nativeLimit(original) ? nativeParameters(original, request) : null;
    let temporary;
    try {
      if (parameters) {
        temporary = await json(`/api/connections/${encodeURIComponent(original.id)}/duplicate`, { method: 'POST', body: '{}' });
        ownedTemporary.add(temporary.id);
        // The encrypted credential is copied on the server. The key is never read by this extension.
        await lock(async()=>marinara.storage.patch({ temporaryConnections: { ...((await marinara.storage.get()).temporaryConnections ?? {}), [temporary.id]: { sourceId: original.id, at: Date.now() } } }));
        await json(`/api/connections/${encodeURIComponent(temporary.id)}`, { method: 'PATCH', body: JSON.stringify({ name: `Gacha Forge 이미지 임시 연결 (${marinara.extension.id})` }) });
        await json(`/api/connections/${encodeURIComponent(temporary.id)}/default-parameters`, { method: 'PUT', body: JSON.stringify(parameters) });
      }
      const name = request.name || 'Scene';
      const promptId = `avatar:${name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/(^-|-$)/g, '').slice(0,120) || 'character'}`;
      const response = await json('/api/characters/avatar-generation', { method: 'POST', body: JSON.stringify({ connectionId: temporary?.id ?? request.connectionId, name, appearance: request.prompt, purpose: 'avatar', width: request.width, height: request.height, styleProfileId: request.styleProfileId || undefined, promptOverrides: [{ id: promptId, prompt: request.prompt, negativePrompt: request.negativePrompt }] }) });
      const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(response.image ?? '');
      if (!match) throw new Error('마리나라가 사용할 수 있는 이미지를 반환하지 않았습니다.');
      return { mime: match[1], ext: match[1] === 'image/jpeg' ? '.jpg' : '.png', base64: match[2], prompt: response.prompt, width: request.width, height: request.height };
    } finally { if (temporary) await deleteTemporary(temporary.id).catch(error => marinara.log.warn('임시 연결 정리가 필요합니다.', temporary.id, error.message)); }
  };
  async function cgUnits(run, runId, cg) {
    const records = (await documents.list('gacha-forge','unit')).filter(row => row.id.startsWith(`${runId}:unit:`) && row.data.kind === 'character');
    const result = [];
    for (const person of cg.characters ?? []) {
      const source = typeof person === 'string' ? { name: person } : person;
      const matches = records.filter(row => row.data.name?.normalize('NFC').toLowerCase() === source.name?.normalize('NFC').toLowerCase());
      if (matches.length > 1) throw new Error(`동명이인 외형을 확인해 주세요: ${source.name}`);
      const unit = matches[0]?.data ?? (run.protagonist?.name === source.name ? run.protagonist : source.look ? { name: source.name, appearance: source.look } : null);
      if (!unit) throw new Error(`외형 데이터를 찾을 수 없습니다: ${source.name}`);
      const back = source.back === true || source.back === 'true';
      const fixed = tagList(back ? unit.backTags : unit.identityTags);
      const worn = run.images?.outfits !== false && [true,'true'].includes(run.images?.outfitCanon) ? (unit.outfits ?? []).find(outfit => outfit.id === unit.wornOutfit) : null;
      const clothing = source.wearing ? source.wearing.split(',').map(value => value.trim()).filter(Boolean) : tagList(worn?.outfitTags ?? unit.outfitTags);
      const tags = fixed.length ? [...fixed, ...clothing] : tagList(unit.imageTags);
      result.push({ ...unit, name: source.name, imageTags: tags, appearance: joinAppearance(back ? unit.backLine : unit.identityLine, source.wearing || worn?.outfitLine || worn?.prompt || unit.outfitLine) || unit.appearance, sceneAction: source.doing || '', sceneExpression: source.expression || '', backView: back, promptPosition: source.position });
    }
    return result;
  }
  const places = async (runId, entries, run) => {
    if (!imageConfig(run).backgrounds) return [];
    const known = (await raw(`${runId}:locations`))?.data?.places ?? {};
    return (entries ?? []).map(entry => { const key = slug(entry.name); const match = Object.keys(known).find(value => value === key || value.normalize('NFD').replace(/[\u0300-\u036f]/g,'') === key.normalize('NFD').replace(/[\u0300-\u036f]/g,'')) || key; return { ...entry, slug: match, url: known[match]?.url || '' }; });
  };
  async function backgroundPlaces(runId, scene, run) {
    const known = (await raw(`${runId}:locations`))?.data?.places ?? {};
    const entries = new Map();
    const add = (name, tags = '', fallback = false) => { if (typeof name !== 'string' || !name.trim()) return; name = name.trim(); const old = entries.get(name); entries.set(name, { name, tags: old?.tags || tags, fallback: !!old?.fallback || fallback }); };
    for (const place of scene.data.places ?? []) add(place.name, place.tags);
    for (const segment of scene.data.segments ?? []) add(segment.place);
    if ((scene.data.segments ?? []).some(segment => !segment.place) || !entries.size) {
      const chapter = await raw(`${runId}:chapter:${scene.data.chapter}`);
      const node = chapter?.data?.nodes?.filter(node => node.type === 'story')[scene.data.storyIndex];
      add(node?.location || scene.data.location, node?.locationTags || scene.data.locationTags, true);
    }
    const result = [];
    for (const entry of entries.values()) {
      const key = slug(entry.name);
      const match = Object.keys(known).find(value => known[value]?.name?.normalize('NFC').toLowerCase() === entry.name.normalize('NFC').toLowerCase()) ?? (key && Object.hasOwn(known, key) ? key : null);
      const id = match ?? (key || `place-${(await signature(entry.name)).slice(0, 16)}`);
      result.push({ ...entry, slug: id, tags: entry.tags || known[id]?.tags || '', url: known[id]?.url || '' });
    }
    return result;
  }
  await addon.register({ client: () => client, getRun, imageConfig, connection, dimensions, queue: (connection, task) => navigator.locks ? navigator.locks.request(`gacha-forge-image-request:${connection.id}`, () => serial(task)) : serial(task), cgUnits, bannerPrompt, scenePrompt, places, backgroundPlaces });
  async function bannerArt(body) {
    if (!['char-standard','char-featured'].includes(body.banner)) return null;
    const run = await getRun(body.runId), conn = await connection(run);
    const session = await raw(`${body.runId}:session`);
    const sequence = Math.max(1,Math.round(Number(session?.data.featured?.seq)||1));
    const docId = `${body.runId}:banner:${body.banner === 'char-standard' ? 'standard' : `char:f${sequence}`}`;
    return serial(async () => {
      const doc = await read(docId);
      if (!doc) throw new Error('배너 데이터를 먼저 생성해 주세요.');
      if (!body.force && doc.data.art?.[body.banner]) return {ok:true,banner:body.banner,art:doc.data.art[body.banner],cached:true};
      const records = await documents.list('gacha-forge','unit');
      let ids = body.banner === 'char-featured' ? [doc.data.fiveId] : (doc.data.charIds ?? []).filter(id=>records.find(row=>row.id===id)?.data.rarity===5);
      if (body.banner === 'char-standard' && ids.length < 2) {
        for(let index=1;index<sequence;index++){ const past=await raw(`${body.runId}:banner:char:f${index}`); if(past?.data.fiveId)ids.push(past.data.fiveId); }
      }
      ids=[...new Set(ids)].filter(Boolean).slice(0,2);
      const people=ids.map(id=>records.find(row=>row.id===id)?.data.name).filter(Boolean);
      if(!people.length)throw new Error('배너 인물 데이터를 찾을 수 없습니다.');
      const units=await cgUnits(run,body.runId,{characters:people});
      const config=imageConfig(run), profile=await client.portraitProfile(config.styleProfileId);
      const args={connectionId:conn.id,units,scene:doc.data.bannerArt||'',profile,background:backdrop(units[0])};
      const compiled=await addon.prepare(args,bannerPrompt(args,profile),client);
      const size=dimensions(config);
      const image=await client.generatePrepared({connectionId:conn.id,name:doc.data.title||'Banner',width:size.sceneWidth,height:size.sceneHeight,styleProfileId:config.styleProfileId,...compiled});
      const stored=await client.uploadToGallery({image,name:doc.data.title||'Banner',prompt:JSON.stringify(compiled),provider:conn.provider,model:conn.model});
      const saved=await documents.update({...doc,expectedRevision:doc.revision,data:{...doc.data,art:{...doc.data.art,[body.banner]:stored.url},artRef:{...doc.data.artRef,[body.banner]:`global-gallery:${stored.id}`}}});
      if(!saved)throw new Error('배너 이미지가 바뀌어 저장을 중단했습니다. 기존 이미지는 유지됩니다.');
      return {ok:true,banner:body.banner,art:stored.url};
    });
  }
  return {
    addon, documents, raw, client, getRun, imageConfig, connection, cgUnits, serial,bannerArt,places,
    async invoke(path, body) {
      if (path === '/image-addon/layout') {
        if (body.save) await lock(async () => {
          const { button, panel } = body.layout ?? {};
          if (![button?.x, button?.y, panel?.x, panel?.y, panel?.w, panel?.h].every(Number.isFinite) || ![button.x, button.y, panel.x, panel.y].every(value => value >= 0 && value <= 1) || panel.w < 240 || panel.w > 1600 || panel.h < 180 || panel.h > 1400) throw new Error('창 위치·크기가 올바르지 않습니다.');
          await marinara.storage.patch({ floatingLayout: { button: { x: button.x, y: button.y }, panel: { x: panel.x, y: panel.y, w: panel.w, h: panel.h } } });
        });
        return { ok: true, layout: (await marinara.storage.get()).floatingLayout ?? {} };
      }
      const handler = routes.get(`/api/gacha-forge${path}`); if (!handler) throw new Error('지원하지 않는 이미지 도구 요청입니다.'); return handler({ body });
    },
    async nativeEnabled(runId) { const config = await this.invoke('/image-addon/settings',{}); const run = await getRun(runId); return config.settings.enabled && config.settings.nativeCharacters && run && nativeLimit(await connection(run)) > 0; },
  };
}
const joinAppearance = (...values) => values.filter(Boolean).join(', ');
