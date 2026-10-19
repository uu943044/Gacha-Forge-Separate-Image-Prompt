import { randomUUID } from 'node:crypto';
import { nativeLimit, nativePrompts, validateEditedPrompt } from './native-prompts.mjs';

const clone = value => structuredClone(value);
const defaults = { enabled: true, nativeCharacters: true };
const settingsId = 'image-addon:settings';
const version = '0.1.0';
const safe = handler => async req => {
  try { return await handler(req.body ?? {}); }
  catch (error) { return { ok: false, error: error.message || '이미지 작업에 실패했습니다.' }; }
};

export function createImageAddon(context) {
  const { api, package: pkg } = context;
  const docs = api.runtime.persistence.documents;
  const plans = new Map();
  const busy = new Set();
  const settings = async () => ({ ...defaults, ...(await docs.getById(pkg.id, settingsId))?.data });
  const put = (doc, data) => docs.update({ id: doc.id, packageId: pkg.id, expectedRevision: doc.revision, name: doc.name, description: doc.description, data, updatedAt: new Date().toISOString() });
  let adapters;

  async function prepare(input, legacy, client) {
    const config = await settings();
    if (!config.enabled || !config.nativeCharacters) return legacy;
    const connections = await client.listConnections();
    const connection = connections.find(c => c.id === input.connectionId);
    const limit = nativeLimit(connection);
    if (!limit) return legacy;
    const compiled = nativePrompts(input, limit);
    return compiled ? validateEditedPrompt(compiled, compiled, limit) : legacy;
  }

  async function scenePlaces(sceneId, places) {
    if (!(await settings()).enabled) return places;
    const overrides = (await docs.getById(pkg.id, sceneId))?.data?.gachaForgeImages?.backgrounds ?? {};
    const result = places.map(place => overrides[place.slug]?.url ? { ...place, url: overrides[place.slug].url } : place);
    for (const [slug, entry] of Object.entries(overrides)) if (entry.url && entry.name && !result.some(place => place.slug === slug)) result.push({ name: entry.name, slug, tags: entry.tags || '', url: entry.url, fallback: !!entry.fallback });
    return result;
  }
  const backgroundPlaces = (runId, scene, run) => adapters.backgroundPlaces ? adapters.backgroundPlaces(runId, scene, run) : adapters.places(runId, scene.data.places, run);
  async function sceneBackground(sceneId) {
    if (!(await settings()).enabled) return '';
    return Object.values((await docs.getById(pkg.id, sceneId))?.data?.gachaForgeImages?.backgrounds ?? {}).find(entry => entry.fallback && entry.url)?.url || '';
  }

  async function getScene(body) {
    if (typeof body.runId !== 'string' || !body.runId || body.runId.length > 160) throw new Error('월드 ID가 필요합니다.');
    if (typeof body.sceneId !== 'string' || !body.sceneId.startsWith(`${body.runId}:beat:`)) throw new Error('장면 ID가 올바르지 않습니다.');
    const scene = await docs.getById(pkg.id, body.sceneId);
    if (!scene || !Array.isArray(scene.data?.segments)) throw new Error('이미 저장된 장면만 재생성할 수 있습니다.');
    const run = await adapters.getRun(body.runId);
    if (!run) throw new Error('월드를 찾을 수 없습니다.');
    return { scene, run };
  }

  async function preview(body) {
    if (!(await settings()).enabled) throw new Error('이미지 확장이 꺼져 있습니다.');
    const { scene, run } = await getScene(body);
    const imageConfig = adapters.imageConfig(run);
    if (imageConfig.off) throw new Error('월드 이미지 생성이 꺼져 있습니다.');
    const connection = await adapters.connection(run);
    if (!connection) throw new Error('이미지 연결이 없습니다.');
    const client = adapters.client();
    const profile = await client.portraitProfile(imageConfig.styleProfileId);
    const { sceneWidth: width, sceneHeight: height } = adapters.dimensions(imageConfig);
    let target, old, input, legacy, name, slug, placeInfo;
    if (body.kind === 'cg') {
      target = await docs.getById(pkg.id, scene.id.replace(`${body.runId}:beat:`, `${body.runId}:cg:`));
      if (!target) throw new Error('이 장면에는 CG 데이터가 없습니다. 배경 재생성을 선택해 주세요.');
      const units = await adapters.cgUnits(run, body.runId, target.data);
      name = target.data.title || 'Key image';
      input = { connectionId: connection.id, units, scene: target.data.promptEn || target.data.prompt || '', framing: 'scene', profile };
      legacy = adapters.bannerPrompt(input, profile);
      old = { url: target.data.url || '', ref: target.data.artRef || '' };
    } else if (body.kind === 'background') {
      const places = await backgroundPlaces(body.runId, scene, run);
      const place = places.find(p => p.slug === body.slug);
      if (!place) throw new Error('이 장면에 속한 배경을 선택해 주세요.');
      slug = place.slug;
      placeInfo = { name: place.name, tags: place.tags || '', fallback: !!place.fallback };
      name = place.name;
      target = scene;
      old = scene.data.gachaForgeImages?.backgrounds?.[slug] ?? { url: place.url || '', ref: '' };
      input = { units: [], scene: place.tags, profile };
      legacy = adapters.scenePrompt({ name, tags: place.tags }, profile);
    } else throw new Error('CG 또는 배경을 선택해 주세요.');
    const compiled = await prepare(input, legacy, client);
    const limit = compiled.characterPrompts?.length ? nativeLimit(connection) : 0;
    // Check the exact strings before a preview is offered; never silently truncate identity tags.
    const editable = validateEditedPrompt(compiled, compiled, limit);
    const now = Date.now();
    for (const [key, plan] of plans) if (plan.expires < now) plans.delete(key);
    if (plans.size >= 100) throw new Error('열린 이미지 확인 창이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    const token = randomUUID();
    plans.set(token, { expires: now + 15 * 60 * 1000, runId: body.runId, sceneId: scene.id, kind: body.kind, slug, placeInfo, targetId: target.id, revision: target.revision, connectionId: connection.id, model: connection.model, baseUrl: connection.baseUrl, imageConfig: clone(imageConfig), width, height, name, compiled: editable, old: clone(old), limit });
    return { ok: true, token, name, kind: body.kind, oldUrl: old.url, native: !!limit, ...editable, notice: body.kind === 'background' ? '이 장면의 배경만 바뀝니다. 같은 장소의 다른 장면은 유지됩니다.' : '성공 후 이 장면의 CG만 교체합니다.' };
  }

  async function generate(body) {
    const plan = plans.get(body.token);
    if (!plan || plan.expires < Date.now()) throw new Error('확인 시간이 만료되었습니다. 프롬프트를 다시 열어 주세요.');
    if (busy.has(plan.targetId)) throw new Error('이 장면의 이미지를 생성 중입니다.');
    const config = await settings();
    if (!config.enabled || (plan.limit && !config.nativeCharacters)) throw new Error('설정이 바뀌었습니다. 프롬프트를 다시 열어 주세요.');
    const edited = validateEditedPrompt(body, plan.compiled, plan.limit);
    const current = await docs.getById(pkg.id, plan.targetId);
    if (!current || current.revision !== plan.revision) throw new Error('장면 데이터가 바뀌었습니다. 프롬프트를 다시 열어 주세요.');
    const { run } = await getScene(plan);
    const connection = await adapters.connection(run);
    if (!connection || connection.id !== plan.connectionId || connection.model !== plan.model || connection.baseUrl !== plan.baseUrl || JSON.stringify(adapters.imageConfig(run)) !== JSON.stringify(plan.imageConfig)) throw new Error('이미지 연결 또는 설정이 바뀌었습니다. 다시 확인해 주세요.');
    busy.add(plan.targetId);
    try {
      const client = adapters.client();
      // Keep the original connection queue. No progression/complete/reward route is called.
      return await adapters.queue(connection, async () => {
        const latest = await docs.getById(pkg.id, plan.targetId);
        if (!latest || latest.revision !== plan.revision) throw new Error('대기 중 장면 데이터가 바뀌었습니다. 다시 확인해 주세요.');
        const image = await client.generatePrepared({ connectionId: connection.id, name: plan.name, imageKind: plan.kind, width: plan.width, height: plan.height, styleProfileId: plan.imageConfig.styleProfileId, ...edited });
        const stored = await client.uploadToGallery({ image, name: plan.name, prompt: JSON.stringify(edited), provider: connection.provider, model: connection.model });
        const data = clone(latest.data);
        const extra = data.gachaForgeImages ?? {};
        const history = [...(extra.history ?? []), { kind: plan.kind, slug: plan.slug, ...plan.old, replacedAt: new Date().toISOString() }];
        const next = { url: stored.url, ref: `global-gallery:${stored.id}` };
        data.gachaForgeImages = { ...extra, history, lastPrompt: edited };
        if (plan.kind === 'cg') { data.url = next.url; data.artRef = next.ref; }
        else data.gachaForgeImages.backgrounds = { ...(extra.backgrounds ?? {}), [plan.slug]: { ...next, ...plan.placeInfo, prompt: edited } };
        const saved = await put(latest, data);
        if (!saved) throw new Error('이미지는 갤러리에 저장됐지만 장면 저장이 충돌했습니다. 기존 이미지는 유지됩니다.');
        plans.delete(body.token);
        return { ok: true, kind: plan.kind, slug: plan.slug, sceneId: plan.sceneId, ...plan.placeInfo, ...next };
      });
    } finally { busy.delete(plan.targetId); }
  }

  async function register(value) {
    adapters = value;
    await api.registerPrivilegedRoutes(async app => {
      app.post('/settings', safe(async body => {
        if (body.save === true) {
          const data = { enabled: body.enabled === true, nativeCharacters: body.nativeCharacters === true };
          const old = await docs.getById(pkg.id, settingsId);
          const saved = old ? await put(old, data) : await docs.create({ id: settingsId, packageId: pkg.id, kind: 'image-addon-settings', name: 'Image addon', description: '', data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
          if (!saved) throw new Error('설정 저장이 충돌했습니다. 다시 시도해 주세요.');
        }
        return { ok: true, version, settings: await settings() };
      }));
      app.post('/scenes', safe(async body => {
        if (typeof body.runId !== 'string' || !body.runId || body.runId.length > 160) throw new Error('월드를 먼저 선택해 주세요.');
        const scenes = (await docs.list(pkg.id, 'beat')).filter(doc => doc.id.startsWith(`${body.runId}:beat:`));
        return { ok: true, scenes: scenes.map(doc => ({ id: doc.id, title: doc.data.title || (doc.name !== doc.id ? doc.name : '') || doc.data.segments?.find(segment => segment.text)?.text?.slice(0, 56) || '저장된 이야기', places: (doc.data.places ?? []).map(place => place.name).filter(Boolean), chapter: doc.data.chapter, storyIndex: doc.data.storyIndex })) };
      }));
      app.post('/scene', safe(async body => {
        const { scene, run } = await getScene(body);
        const cg = await docs.getById(pkg.id, scene.id.replace(`${body.runId}:beat:`, `${body.runId}:cg:`));
        return { ok: true, cg: cg ? { title: cg.data.title, url: cg.data.url, from: Number(cg.data.from) || 0, to: Number(cg.data.to) || 0, characterCount: cg.data.characters?.length || 0 } : null, places: await scenePlaces(scene.id, await backgroundPlaces(body.runId, scene, run)) };
      }));
      app.post('/preview', safe(preview));
      app.post('/generate', safe(generate));
    }, { prefix: '/api/gacha-forge/image-addon' });
  }
  return { prepare, scenePlaces, sceneBackground, register };
}
