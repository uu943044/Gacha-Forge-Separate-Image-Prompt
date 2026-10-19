(() => {
  // browser-builtins:node:crypto
  var randomUUID = () => globalThis.crypto.randomUUID();

  // gacha-image-addon/native-prompts.mjs
  var text = (value) => typeof value === "string" ? value.trim() : "";
  var join = (...parts) => parts.flat().map(text).filter(Boolean).join(", ");
  var array = (value) => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
  var counted = /^(?:\d+(?:girls?|boys?|others?|women|men)|solo(?: focus)?|multiple (?:girls|boys))$/i;
  function nativeLimit(connection) {
    try {
      const url = new URL(connection?.baseUrl);
      if (url.protocol !== "https:" || !/(^|\.)novelai\.net$/i.test(url.hostname)) return 0;
      const model = text(connection.model);
      if (!/^nai-diffusion-(?:4(?:-(?:curated-preview|full))?|4-5(?:-(?:curated|full))?|5(?:-(?:curated|full))?)$/i.test(model)) return 0;
      return /^nai-diffusion-5(?:-|$)/i.test(model) ? 22 : 6;
    } catch {
      return 0;
    }
  }
  function nativePrompts({ units = [], scene = "", framing, profile = {}, background = "" }, limit) {
    if (!units.length) return null;
    if (units.length > limit) throw new Error(`\uC774 \uBAA8\uB378\uC740 \uC778\uBB3C ${limit}\uBA85\uAE4C\uC9C0 \uC9C0\uC6D0\uD569\uB2C8\uB2E4. \uC778\uBB3C\uC744 \uC904\uC5EC \uC8FC\uC138\uC694.`);
    const counts = { girl: 0, boy: 0, other: 0 };
    const names = /* @__PURE__ */ new Set();
    const characterPrompts = units.map((unit, index) => {
      const name = text(unit.name) || `\uC778\uBB3C ${index + 1}`;
      if (names.has(name)) throw new Error(`\uC911\uBCF5 \uC778\uBB3C \uC774\uB984: ${name}`);
      names.add(name);
      const tags = array(unit.imageTags);
      const traits = tags.length ? tags.filter((tag) => !counted.test(tag)) : [text(unit.appearance)];
      if (!traits.some(Boolean)) throw new Error(`${name}\uC758 \uC678\uD615 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uD655\uC778 \uD6C4 \uC778\uBB3C \uD504\uB86C\uD504\uD2B8\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694.`);
      const sex = unit.identitySex === "male" ? "boy" : unit.identitySex === "female" ? "girl" : tags.some((tag) => /^(?:1boy|boy|man|male)$/i.test(tag)) ? "boy" : tags.some((tag) => /^(?:1girl|girl|woman|female)$/i.test(tag)) ? "girl" : "other";
      counts[sex]++;
      const supplied = unit.promptPosition;
      const position = supplied && Number.isFinite(supplied.x) && Number.isFinite(supplied.y) ? { x: Math.max(0, Math.min(1, supplied.x)), y: Math.max(0, Math.min(1, supplied.y)) } : { x: (index + 1) / (units.length + 1), y: 0.5 };
      return {
        name,
        prompt: join(sex, traits, unit.sceneAction, unit.sceneExpression),
        negativePrompt: unit.backView ? "looking at viewer, facing viewer, front view" : "",
        position
      };
    });
    const countTags = Object.entries(counts).filter(([, n]) => n).map(([sex, n]) => `${n}${sex}${n > 1 ? "s" : ""}`);
    return {
      prompt: join(countTags, scene || background, framing === "scene" ? "" : "wide shot, full body, dynamic composition, cinematic lighting, detailed background", profile.positiveTags),
      negativePrompt: join(profile.negativeTags, framing === "scene" ? "" : "portrait, close-up, headshot, cropped, out of frame, extra figures"),
      characterPrompts
    };
  }
  function validateEditedPrompt(value, original, limit) {
    const bounded = (v, max, label, required = false) => {
      if (typeof v !== "string" || v.length > max || required && !v.trim()) throw new Error(`${label} \uC785\uB825\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.`);
      return v.trim();
    };
    const prompt = bounded(value?.prompt, 12e3, "\uACF5\uD1B5 \uD504\uB86C\uD504\uD2B8", true);
    const negativePrompt = bounded(value?.negativePrompt ?? "", 6e3, "\uB124\uAC70\uD2F0\uBE0C \uD504\uB86C\uD504\uD2B8");
    const entries = value?.characterPrompts ?? [];
    const expected = original.characterPrompts ?? [];
    if (!Array.isArray(entries) || entries.length !== expected.length || entries.length > limit) throw new Error("\uC778\uBB3C \uBAA9\uB85D\uC744 \uC784\uC758\uB85C \uCD94\uAC00\uD558\uAC70\uB098 \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    return { prompt, negativePrompt, characterPrompts: entries.map((entry, index) => {
      if (entry.name !== expected[index].name) throw new Error("\uC778\uBB3C \uC774\uB984 \uB610\uB294 \uC21C\uC11C\uAC00 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4.");
      const position = entry.position;
      if (!position || ![position.x, position.y].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1)) throw new Error("\uC778\uBB3C \uC704\uCE58\uB294 0~1 \uC0AC\uC774 \uC22B\uC790\uC5EC\uC57C \uD569\uB2C8\uB2E4.");
      return { name: entry.name, prompt: bounded(entry.prompt, 1400, "\uC778\uBB3C \uD504\uB86C\uD504\uD2B8", true), negativePrompt: bounded(entry.negativePrompt ?? "", 700, "\uC778\uBB3C \uB124\uAC70\uD2F0\uBE0C"), position: { x: position.x, y: position.y } };
    }) };
  }

  // gacha-image-addon/server-addon.mjs
  var clone = (value) => structuredClone(value);
  var defaults = { enabled: true, nativeCharacters: true };
  var settingsId = "image-addon:settings";
  var version = "0.1.0";
  var safe = (handler) => async (req) => {
    try {
      return await handler(req.body ?? {});
    } catch (error) {
      return { ok: false, error: error.message || "\uC774\uBBF8\uC9C0 \uC791\uC5C5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4." };
    }
  };
  function createImageAddon(context) {
    const { api, package: pkg } = context;
    const docs = api.runtime.persistence.documents;
    const plans = /* @__PURE__ */ new Map();
    const busy = /* @__PURE__ */ new Set();
    const settings = async () => ({ ...defaults, ...(await docs.getById(pkg.id, settingsId))?.data });
    const put = (doc, data) => docs.update({ id: doc.id, packageId: pkg.id, expectedRevision: doc.revision, name: doc.name, description: doc.description, data, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
    let adapters;
    async function prepare(input, legacy, client) {
      const config = await settings();
      if (!config.enabled || !config.nativeCharacters) return legacy;
      const connections = await client.listConnections();
      const connection = connections.find((c) => c.id === input.connectionId);
      const limit = nativeLimit(connection);
      if (!limit) return legacy;
      const compiled = nativePrompts(input, limit);
      return compiled ? validateEditedPrompt(compiled, compiled, limit) : legacy;
    }
    async function scenePlaces(sceneId, places) {
      if (!(await settings()).enabled) return places;
      const overrides = (await docs.getById(pkg.id, sceneId))?.data?.gachaForgeImages?.backgrounds ?? {};
      const result = places.map((place) => overrides[place.slug]?.url ? { ...place, url: overrides[place.slug].url } : place);
      for (const [slug2, entry] of Object.entries(overrides)) if (entry.url && entry.name && !result.some((place) => place.slug === slug2)) result.push({ name: entry.name, slug: slug2, tags: entry.tags || "", url: entry.url, fallback: !!entry.fallback });
      return result;
    }
    const backgroundPlaces = (runId, scene, run) => adapters.backgroundPlaces ? adapters.backgroundPlaces(runId, scene, run) : adapters.places(runId, scene.data.places, run);
    async function sceneBackground(sceneId) {
      if (!(await settings()).enabled) return "";
      return Object.values((await docs.getById(pkg.id, sceneId))?.data?.gachaForgeImages?.backgrounds ?? {}).find((entry) => entry.fallback && entry.url)?.url || "";
    }
    async function getScene(body) {
      if (typeof body.runId !== "string" || !body.runId || body.runId.length > 160) throw new Error("\uC6D4\uB4DC ID\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
      if (typeof body.sceneId !== "string" || !body.sceneId.startsWith(`${body.runId}:beat:`)) throw new Error("\uC7A5\uBA74 ID\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      const scene = await docs.getById(pkg.id, body.sceneId);
      if (!scene || !Array.isArray(scene.data?.segments)) throw new Error("\uC774\uBBF8 \uC800\uC7A5\uB41C \uC7A5\uBA74\uB9CC \uC7AC\uC0DD\uC131\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
      const run = await adapters.getRun(body.runId);
      if (!run) throw new Error("\uC6D4\uB4DC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return { scene, run };
    }
    async function preview(body) {
      if (!(await settings()).enabled) throw new Error("\uC774\uBBF8\uC9C0 \uD655\uC7A5\uC774 \uAEBC\uC838 \uC788\uC2B5\uB2C8\uB2E4.");
      const { scene, run } = await getScene(body);
      const imageConfig = adapters.imageConfig(run);
      if (imageConfig.off) throw new Error("\uC6D4\uB4DC \uC774\uBBF8\uC9C0 \uC0DD\uC131\uC774 \uAEBC\uC838 \uC788\uC2B5\uB2C8\uB2E4.");
      const connection = await adapters.connection(run);
      if (!connection) throw new Error("\uC774\uBBF8\uC9C0 \uC5F0\uACB0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
      const client = adapters.client();
      const profile = await client.portraitProfile(imageConfig.styleProfileId);
      const { sceneWidth: width, sceneHeight: height } = adapters.dimensions(imageConfig);
      let target, old, input, legacy, name, slug2, placeInfo;
      if (body.kind === "cg") {
        target = await docs.getById(pkg.id, scene.id.replace(`${body.runId}:beat:`, `${body.runId}:cg:`));
        if (!target) throw new Error("\uC774 \uC7A5\uBA74\uC5D0\uB294 CG \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uBC30\uACBD \uC7AC\uC0DD\uC131\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
        const units = await adapters.cgUnits(run, body.runId, target.data);
        name = target.data.title || "Key image";
        input = { connectionId: connection.id, units, scene: target.data.promptEn || target.data.prompt || "", framing: "scene", profile };
        legacy = adapters.bannerPrompt(input, profile);
        old = { url: target.data.url || "", ref: target.data.artRef || "" };
      } else if (body.kind === "background") {
        const places = await backgroundPlaces(body.runId, scene, run);
        const place = places.find((p) => p.slug === body.slug);
        if (!place) throw new Error("\uC774 \uC7A5\uBA74\uC5D0 \uC18D\uD55C \uBC30\uACBD\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
        slug2 = place.slug;
        placeInfo = { name: place.name, tags: place.tags || "", fallback: !!place.fallback };
        name = place.name;
        target = scene;
        old = scene.data.gachaForgeImages?.backgrounds?.[slug2] ?? { url: place.url || "", ref: "" };
        input = { units: [], scene: place.tags, profile };
        legacy = adapters.scenePrompt({ name, tags: place.tags }, profile);
      } else throw new Error("CG \uB610\uB294 \uBC30\uACBD\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
      const compiled = await prepare(input, legacy, client);
      const limit = compiled.characterPrompts?.length ? nativeLimit(connection) : 0;
      const editable = validateEditedPrompt(compiled, compiled, limit);
      const now = Date.now();
      for (const [key, plan] of plans) if (plan.expires < now) plans.delete(key);
      if (plans.size >= 100) throw new Error("\uC5F4\uB9B0 \uC774\uBBF8\uC9C0 \uD655\uC778 \uCC3D\uC774 \uB108\uBB34 \uB9CE\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
      const token = randomUUID();
      plans.set(token, { expires: now + 15 * 60 * 1e3, runId: body.runId, sceneId: scene.id, kind: body.kind, slug: slug2, placeInfo, targetId: target.id, revision: target.revision, connectionId: connection.id, model: connection.model, baseUrl: connection.baseUrl, imageConfig: clone(imageConfig), width, height, name, compiled: editable, old: clone(old), limit });
      return { ok: true, token, name, kind: body.kind, oldUrl: old.url, native: !!limit, ...editable, notice: body.kind === "background" ? "\uC774 \uC7A5\uBA74\uC758 \uBC30\uACBD\uB9CC \uBC14\uB01D\uB2C8\uB2E4. \uAC19\uC740 \uC7A5\uC18C\uC758 \uB2E4\uB978 \uC7A5\uBA74\uC740 \uC720\uC9C0\uB429\uB2C8\uB2E4." : "\uC131\uACF5 \uD6C4 \uC774 \uC7A5\uBA74\uC758 CG\uB9CC \uAD50\uCCB4\uD569\uB2C8\uB2E4." };
    }
    async function generate(body) {
      const plan = plans.get(body.token);
      if (!plan || plan.expires < Date.now()) throw new Error("\uD655\uC778 \uC2DC\uAC04\uC774 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uD504\uB86C\uD504\uD2B8\uB97C \uB2E4\uC2DC \uC5F4\uC5B4 \uC8FC\uC138\uC694.");
      if (busy.has(plan.targetId)) throw new Error("\uC774 \uC7A5\uBA74\uC758 \uC774\uBBF8\uC9C0\uB97C \uC0DD\uC131 \uC911\uC785\uB2C8\uB2E4.");
      const config = await settings();
      if (!config.enabled || plan.limit && !config.nativeCharacters) throw new Error("\uC124\uC815\uC774 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4. \uD504\uB86C\uD504\uD2B8\uB97C \uB2E4\uC2DC \uC5F4\uC5B4 \uC8FC\uC138\uC694.");
      const edited = validateEditedPrompt(body, plan.compiled, plan.limit);
      const current = await docs.getById(pkg.id, plan.targetId);
      if (!current || current.revision !== plan.revision) throw new Error("\uC7A5\uBA74 \uB370\uC774\uD130\uAC00 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4. \uD504\uB86C\uD504\uD2B8\uB97C \uB2E4\uC2DC \uC5F4\uC5B4 \uC8FC\uC138\uC694.");
      const { run } = await getScene(plan);
      const connection = await adapters.connection(run);
      if (!connection || connection.id !== plan.connectionId || connection.model !== plan.model || connection.baseUrl !== plan.baseUrl || JSON.stringify(adapters.imageConfig(run)) !== JSON.stringify(plan.imageConfig)) throw new Error("\uC774\uBBF8\uC9C0 \uC5F0\uACB0 \uB610\uB294 \uC124\uC815\uC774 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      busy.add(plan.targetId);
      try {
        const client = adapters.client();
        return await adapters.queue(connection, async () => {
          const latest = await docs.getById(pkg.id, plan.targetId);
          if (!latest || latest.revision !== plan.revision) throw new Error("\uB300\uAE30 \uC911 \uC7A5\uBA74 \uB370\uC774\uD130\uAC00 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
          const image = await client.generatePrepared({ connectionId: connection.id, name: plan.name, imageKind: plan.kind, width: plan.width, height: plan.height, styleProfileId: plan.imageConfig.styleProfileId, ...edited });
          const stored = await client.uploadToGallery({ image, name: plan.name, prompt: JSON.stringify(edited), provider: connection.provider, model: connection.model });
          const data = clone(latest.data);
          const extra = data.gachaForgeImages ?? {};
          const history = [...extra.history ?? [], { kind: plan.kind, slug: plan.slug, ...plan.old, replacedAt: (/* @__PURE__ */ new Date()).toISOString() }];
          const next = { url: stored.url, ref: `global-gallery:${stored.id}` };
          data.gachaForgeImages = { ...extra, history, lastPrompt: edited };
          if (plan.kind === "cg") {
            data.url = next.url;
            data.artRef = next.ref;
          } else data.gachaForgeImages.backgrounds = { ...extra.backgrounds ?? {}, [plan.slug]: { ...next, ...plan.placeInfo, prompt: edited } };
          const saved = await put(latest, data);
          if (!saved) throw new Error("\uC774\uBBF8\uC9C0\uB294 \uAC24\uB7EC\uB9AC\uC5D0 \uC800\uC7A5\uB410\uC9C0\uB9CC \uC7A5\uBA74 \uC800\uC7A5\uC774 \uCDA9\uB3CC\uD588\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC774\uBBF8\uC9C0\uB294 \uC720\uC9C0\uB429\uB2C8\uB2E4.");
          plans.delete(body.token);
          return { ok: true, kind: plan.kind, slug: plan.slug, sceneId: plan.sceneId, ...plan.placeInfo, ...next };
        });
      } finally {
        busy.delete(plan.targetId);
      }
    }
    async function register(value) {
      adapters = value;
      await api.registerPrivilegedRoutes(async (app) => {
        app.post("/settings", safe(async (body) => {
          if (body.save === true) {
            const data = { enabled: body.enabled === true, nativeCharacters: body.nativeCharacters === true };
            const old = await docs.getById(pkg.id, settingsId);
            const saved = old ? await put(old, data) : await docs.create({ id: settingsId, packageId: pkg.id, kind: "image-addon-settings", name: "Image addon", description: "", data, createdAt: (/* @__PURE__ */ new Date()).toISOString(), updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
            if (!saved) throw new Error("\uC124\uC815 \uC800\uC7A5\uC774 \uCDA9\uB3CC\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
          }
          return { ok: true, version, settings: await settings() };
        }));
        app.post("/scenes", safe(async (body) => {
          if (typeof body.runId !== "string" || !body.runId || body.runId.length > 160) throw new Error("\uC6D4\uB4DC\uB97C \uBA3C\uC800 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
          const scenes = (await docs.list(pkg.id, "beat")).filter((doc) => doc.id.startsWith(`${body.runId}:beat:`));
          return { ok: true, scenes: scenes.map((doc) => ({ id: doc.id, title: doc.data.title || (doc.name !== doc.id ? doc.name : "") || doc.data.segments?.find((segment) => segment.text)?.text?.slice(0, 56) || "\uC800\uC7A5\uB41C \uC774\uC57C\uAE30", places: (doc.data.places ?? []).map((place) => place.name).filter(Boolean), chapter: doc.data.chapter, storyIndex: doc.data.storyIndex })) };
        }));
        app.post("/scene", safe(async (body) => {
          const { scene, run } = await getScene(body);
          const cg = await docs.getById(pkg.id, scene.id.replace(`${body.runId}:beat:`, `${body.runId}:cg:`));
          return { ok: true, cg: cg ? { title: cg.data.title, url: cg.data.url, from: Number(cg.data.from) || 0, to: Number(cg.data.to) || 0, characterCount: cg.data.characters?.length || 0 } : null, places: await scenePlaces(scene.id, await backgroundPlaces(body.runId, scene, run)) };
        }));
        app.post("/preview", safe(preview));
        app.post("/generate", safe(generate));
      }, { prefix: "/api/gacha-forge/image-addon" });
    }
    return { prepare, scenePlaces, sceneBackground, register };
  }

  // browser-builtins:node:async_hooks
  var AsyncLocalStorage = class {
    getStore() {
      return void 0;
    }
    run(value, task) {
      return task();
    }
  };

  // gacha-external/vendor.mjs
  var Jh = new AsyncLocalStorage();
  var Tl = new AsyncLocalStorage();
  var so = 7;
  var As = 160;
  var oo = As * 10;
  var rp = Array.from({ length: so }, (e, t) => ({ day: t + 1, aether: oo, extra: { kind: "aether", qty: oo, name: "Aether" } }));
  var db = 30;
  var Il = db * 24 * 60 * 60 * 1e3;
  var ys = 80;
  var _l = { "farm-clear": { one: "Clear a Materials stage", many: "Clear N Materials stages" }, "node-clear": { one: "Clear a combat node", many: "Clear N combat nodes" }, "story-clear": { one: "Play a story node", many: "Play N story nodes" }, summon: { one: "Summon once", many: "Summon N times" }, "level-up": { one: "Level a unit once", many: "Level a unit N times" }, "form-up": { one: "Train an ability once", many: "Train an ability N times" }, ascend: { one: "Ascend a unit", many: "Ascend a unit N times" }, "relic-feed": { one: "Reinforce a relic", many: "Reinforce a relic N times" }, "vigor-spent": { one: "Spend 1 Vigor", many: "Spend N Vigor" } };
  var fb = 5;
  var ub = 1e3;
  var hb = [20, 40, 60, 75];
  var pb = (e) => e <= 26 ? { tier: "shard", qty: 3, name: "Insight Shard" } : e <= 53 ? { tier: "core", qty: 2, name: "Insight Core" } : { tier: "prism", qty: 1, name: "Insight Prism" };
  var mb = (e) => e <= 26 ? 1 : e <= 53 ? 2 : 3;
  var tp = ["funds", "xp", "sigil", "doctrine", "tenet"];
  var io = (() => {
    let e = [], t = {};
    for (let n = 1; n <= ys; n += 1) {
      let r = n % fb === 0 ? ub : 0;
      if (n === ys) {
        e.push({ level: n, aether: r, extra: { kind: "relic", qty: 1, rarity: 5, name: "5&#9733; Relic" }, prize: true });
        continue;
      }
      if (hb.includes(n)) {
        e.push({ level: n, aether: r, extra: { kind: "mandate", qty: 1, name: "Mandate" }, prize: true });
        continue;
      }
      if (r) {
        e.push({ level: n, aether: r, extra: { kind: "aether", qty: r, name: "Aether" } });
        continue;
      }
      let a = tp[e.filter((f) => !f.aether && f.extra.kind !== "mandate").length % tp.length];
      if (t[a] = (t[a] || 0) + 1, a === "funds") e.push({ level: n, aether: r, extra: { kind: "funds", qty: 8e3, name: "Funds" } });
      else if (a === "xp") {
        let f = pb(n);
        e.push({ level: n, aether: r, extra: { kind: "xp", tier: f.tier, qty: f.qty, name: f.name } });
      } else {
        let f = a === "tenet" ? 2 : 4;
        e.push({ level: n, aether: r, extra: { kind: a, qty: f, tier: mb(n), pick: t[a] - 1 } });
      }
    }
    return e;
  })();
  var cr = (e, t, n, r, a = 0, f = null) => [{ kind: "aether", qty: 100, count: e }, { kind: "funds", qty: 2e3, count: t }, ...f ? [{ kind: "xp", ...f, count: wb }] : [], { kind: "material", tier: 2, qty: 1, count: n }, { kind: "material", tier: 1, qty: 1, count: r }, ...a ? [{ kind: "mandate", count: a }] : []];
  var yb = /* @__PURE__ */ new Set([3, 5, 7]);
  var Kn = (e) => yb.has(e) ? 1 : 0;
  var wb = 8;
  var lr = () => 2;
  var dr = (e) => 3 - Kn(e);
  var fr = (e) => e <= 4 ? { tier: "shard", qty: 6, name: "Insight Shard" } : e <= 8 ? { tier: "core", qty: 3, name: "Insight Core" } : { tier: "prism", qty: 1, name: "Insight Prism" };
  var bb = [cr(7, 5, lr(), dr(1), Kn(1), fr(1)), cr(7, 5, lr(), dr(2), Kn(2), fr(2)), cr(7, 5, lr(), dr(3), Kn(3), fr(3)), cr(7, 5, lr(), dr(4), Kn(4), fr(4)), cr(7, 5, lr(), dr(5), Kn(5), fr(5)), cr(7, 5, lr(), dr(6), Kn(6), fr(6)), cr(7, 5, lr(), dr(7), Kn(7), fr(7)), cr(7, 5, lr(), dr(8), Kn(8), fr(8)), cr(7, 5, lr(), dr(9), Kn(9), fr(9)), cr(7, 5, lr(), dr(10), Kn(10), fr(10))];
  var yn = { summon: { after: "prologue", label: "Summon" }, featured: { rank: 10, label: "Featured banner" }, events: { rank: 5, label: "Events" }, seasonal: { rank: 10, label: "Seasonal Event" }, outfits: { rank: 15, label: "Outfits" }, tower: { rank: 20, label: "Tower" } };
  var qi = As * 10;
  var Ki = 360 * 60 * 1e3;
  var bs = 4;
  var Qr = bs * bs;
  var vb = 160;
  var Ul = Array.from({ length: 2 * bs + 2 }, () => ({ kind: "aether", qty: vb }));
  var Np = [{ id: "ach-rank", cat: "campaign", kind: "rank", steps: [3, 5, 8, 12, 16, 20, 25, 30, 40, 50, 60, 75, 100] }, { id: "ach-login", cat: "campaign", kind: "login-day", steps: [3, 7, 14, 21, 30, 45, 60, 90, 120] }, { id: "ach-story", cat: "campaign", kind: "story-clear", steps: [3, 8, 15, 25, 40, 60, 85, 115, 150] }, { id: "ach-node", cat: "campaign", kind: "node-clear", steps: [3, 8, 15, 30, 50, 80, 120, 180, 250] }, { id: "ach-chapter", cat: "campaign", kind: "chapter-clear", steps: [1, 2, 3, 5, 7, 10, 13, 16, 20] }, { id: "ach-hard", cat: "campaign", kind: "hard-clear", steps: [1, 5, 12, 25, 45, 70, 100, 140, 200] }, { id: "ach-level", cat: "training", kind: "level-up", steps: [5, 15, 30, 60, 100, 160, 250, 380, 550] }, { id: "ach-ascend", cat: "training", kind: "ascend", steps: [1, 3, 6, 10, 15, 21, 28, 36, 45] }, { id: "ach-form", cat: "training", kind: "form-up", steps: [3, 8, 15, 25, 40, 60, 85, 115, 150] }, { id: "ach-relic", cat: "training", kind: "relic-feed", steps: [3, 8, 15, 25, 40, 60, 85, 115, 150] }, { id: "ach-equip", cat: "training", kind: "equip", steps: [4, 10, 20, 35, 55, 80, 110, 145, 185] }, { id: "ach-farm", cat: "expedition", kind: "farm-clear", steps: [3, 8, 15, 30, 50, 80, 120, 180, 250, 350, 500, 700, 1e3] }, { id: "ach-vigor", cat: "expedition", kind: "vigor-spent", steps: [100, 300, 750, 1500, 3e3, 6e3, 1e4, 16e3, 25e3] }, { id: "ach-drop", cat: "expedition", kind: "relic-drop", steps: [2, 6, 12, 22, 36, 55, 80, 110, 150] }, { id: "ach-tower", cat: "expedition", kind: "tower-floor", steps: [5, 10, 15, 20, 30, 40, 50, 60, 70] }, { id: "ach-summon", cat: "summon", kind: "summon", steps: [5, 10, 25, 50, 100, 200, 350, 600, 1e3, 1400, 2e3, 2800, 4e3] }, { id: "ach-5star", cat: "summon", kind: "summon-5star", steps: [1, 2, 4, 7, 11, 16, 22, 30, 40] }, { id: "ach-facet", cat: "summon", kind: "facet", steps: [1, 3, 6, 10, 15, 21, 28, 36, 45, 60, 75, 95, 120] }, { id: "ach-roster", cat: "summon", kind: "characters", steps: [5, 10, 15, 20, 25, 30, 40, 50, 60] }, { id: "ach-cstory", cat: "bonds", kind: "character-story", steps: [1, 2, 3, 5, 7, 10, 13, 16, 20] }, { id: "ach-bond", cat: "bonds", kind: "bond-level", steps: [5, 10, 20, 35, 50, 75, 100, 140, 200] }, { id: "ach-chat", cat: "bonds", kind: "chat-message", steps: [5, 15, 30, 60, 100, 160, 250, 380, 550] }];
  var Nb = ["rank", "tower-floor", "character-story", "bond-level", "characters"];
  var Ip = (() => {
    let e = new Set(Object.keys(_l));
    for (let t of Np) Nb.indexOf(t.kind) >= 0 || e.add(t.kind);
    return e;
  })();
  var Ts = [{ id: "vigor-s", cat: "key", name: "Vigor Draught", grants: { vigor: 20 }, price: 8, live: true, bag: true }, { id: "vigor-m", cat: "key", name: "Vigor Flask", grants: { vigor: 40 }, price: 14, live: true, bag: true }, { id: "vigor-l", cat: "key", name: "Vigor Decanter", grants: { vigor: 60 }, price: 20, live: true, bag: true }, { id: "coupon", cat: "key", name: "Summon Coupon", grants: { summon: 1 }, live: false, note: "Not open yet" }, { id: "solvent", cat: "key", name: "Relic Solvent", grants: { reroll: 1 }, live: false, note: "Not open yet" }];
  var ql = Ts.filter((e) => e.bag === true);
  var Rp = [{ tier: 1, suffix: "I" }, { tier: 2, suffix: "II" }, { tier: 3, suffix: "III" }];
  var Mb = 3;
  var Rb = { Fire: "Ember", Water: "Tide", Wind: "Gale", Earth: "Stone", Light: "Dawn", Dark: "Umbra" };
  var Ob = { Tank: "Bulwark", Warrior: "Warblade", Mage: "Arcana", Support: "Concord", Assassin: "Shadow" };
  function gt(e, t, n) {
    return `${e}:${String(t).toLowerCase()}:${n}`;
  }
  function Vi(e, t) {
    let n = [];
    for (let r of e) {
      let a = Rb[r] || r;
      for (let f of Rp) n.push({ id: gt("sigil", r, f.tier), name: `${a} Sigil ${f.suffix}`, family: "sigil", key: r, tier: f.tier, matches: `${r} units` }), n.push({ id: gt("tenet", r, f.tier), name: `${a} Tenet ${f.suffix}`, family: "tenet", key: r, tier: f.tier, matches: `${r} units' Form` });
    }
    for (let r of t) {
      let a = Ob[r] || r;
      for (let f of Rp) n.push({ id: gt("doctrine", r, f.tier), name: `${a} Doctrine ${f.suffix}`, family: "doctrine", key: r, tier: f.tier, matches: `${r}s` });
    }
    return n.push({ id: gt("mandate", "any", 1), name: "Mandate", family: "mandate", key: "any", tier: 1, matches: "the last Form levels" }), n;
  }
  var ea = [20, 40, 50, 60, 70, 80, 90];
  var Vn = ea.length - 1;
  var Vl = [{ tier: 1, sigil: 4, doctrine: 2, funds: 5e3 }, { tier: 1, sigil: 8, doctrine: 4, funds: 1e4 }, { tier: 2, sigil: 6, doctrine: 3, funds: 2e4 }, { tier: 2, sigil: 10, doctrine: 5, funds: 35e3 }, { tier: 3, sigil: 6, doctrine: 3, funds: 6e4 }, { tier: 3, sigil: 10, doctrine: 6, funds: 1e5 }];
  var Xl = [{ tier: 1, tenet: 2, funds: 500 }, { tier: 1, tenet: 3, funds: 1e3 }, { tier: 2, tenet: 2, funds: 1500 }, { tier: 2, tenet: 2, funds: 2500 }, { tier: 3, tenet: 2, funds: 3e3 }, { tier: 3, tenet: 2, funds: 4500 }, { tier: 3, tenet: 3, mandate: 1, funds: 7e3 }, { tier: 3, tenet: 4, mandate: 1, funds: 1e4 }, { tier: 3, tenet: 5, mandate: 1, funds: 14e3 }];
  var Ct = [{ id: "shard", name: "Insight Shard", xp: 200 }, { id: "core", name: "Insight Core", xp: 1e3 }, { id: "prism", name: "Insight Prism", xp: 5e3 }];
  var Db = (e) => (Ct.find((t) => t.id === e) || { xp: 0 }).xp;
  var Kl = (e, t) => ({ tier: e, qty: t, worth: t * Db(e) });
  var Aa = { 1: Kl("shard", 12), 2: Kl("core", 6), 3: Kl("prism", 2) };
  var ho = (e, t) => ({ tier: e, qty: t, worth: t * Math.pow(Mb, e - 1) });
  var nd = { 1: ho(1, 3), 2: ho(2, 2), 3: ho(3, 1) };
  var rd = { 1: ho(1, 3), 2: ho(2, 2), 3: ho(3, 1) };
  function mr(e) {
    return 100 * Math.max(1, Math.round(Number(e) || 1)) + 100;
  }
  function Dp() {
    let e = (n, r) => {
      let a = {};
      for (let f of n) f[r] && (a[f.tier] = (a[f.tier] || 0) + f[r]);
      return a;
    }, t = 0;
    for (let n = 1; n < ea[Vn]; n += 1) t += mr(n);
    return { sigil: e(Vl, "sigil"), doctrine: e(Vl, "doctrine"), tenet: e(Xl, "tenet"), mandate: Xl.reduce((n, r) => n + (r.mandate || 0), 0), xp: t };
  }
  var $b = new Set(Ct.map((e) => String(e.id)));
  var Fb = new Set(Ts.filter((e) => e && e.bag === true).map((e) => String(e.id)));
  var Hb = ["funds", "aether", "glimmer", "rank", "coin-event", "relic", "unit"];
  var Ub = ["core", "edge", "flow", "crest"];
  var jb = new Set(Hb);
  var Wb = new Set(Ub);
  var sd = Array.from({ length: 10 }, (e, t) => 5 * (t + 1) + (t + 1) ** 2);
  var cd = sd.map((e, t) => sd.slice(0, t + 1).reduce((n, r) => n + r, 0));
  var Is = 500;
  var Ms = [{ level: 1, kind: "grant", grants: { aether: Is }, live: true }, { level: 2, kind: "unlock", opens: "chat", live: true }, { level: 3, kind: "grant", grants: { aether: Is }, live: true }, { level: 4, kind: "unlock", opens: "chapter", part: 1, live: true }, { level: 5, kind: "grant", grants: { aether: Is }, live: true }, { level: 6, kind: "grant", grants: { background: 1 }, live: true }, { level: 7, kind: "grant", grants: { aether: Is }, live: true }, { level: 8, kind: "unlock", opens: "chapter", part: 2, live: true }, { level: 9, kind: "grant", grants: { aether: Is }, live: true }, { level: 10, kind: "grant", grants: { outfit: 1 }, live: true }];
  var Ji = (Ms.find((e) => e.grants && e.grants.background) || {}).level || 0;
  var va = Ms.filter((e) => e.opens === "chapter").map((e) => e.level);
  var Fp = va[0] || 0;
  var Dv = va.length;
  var Dr = (Ms.find((e) => e.grants && e.grants.outfit) || {}).level || 0;
  var Ea = (Ms.find((e) => e.opens === "chat") || {}).level || 0;
  var id = Array.from({ length: 10 }, (e, t) => 5 * (t + 1));
  var $p = id.map((e, t) => id.slice(0, t + 1).reduce((n, r) => n + r, 0));
  var bo = va.map((e, t) => t + 1);
  var Kp = 40;
  var $v = 2 * 1024 * 1024;
  var en = ["Tank", "Warrior", "Mage", "Support", "Assassin"];
  var Nt = ["Fire", "Water", "Wind", "Earth", "Light", "Dark"];
  var gd = "lorebook";
  var em = "cards";
  var yd = "cards-then-lorebook";
  var ik = [{ id: gd, label: "Your Cast lorebook", hint: "Default. Banner characters come from your Cast book." }, { id: em, label: "Your character cards", hint: "Every banner character is one of yours." }, { id: yd, label: "Cards, then your Cast lorebook", hint: "Cards first, then the book. If you run out of 5&#9733; cards, only that slot falls back." }];
  var sc = 1500;
  var Wv = "The game reads up to " + sc + " characters from each field of a card.";
  var ck = new Set(ik.map((e) => e.id));
  var un = 100;
  var Ut = 70;
  var Ad = 10;
  var nE = Number(yn.tower && yn.tower.rank) || 20;
  var Bs = (e) => Number(e) > 0 && Number(e) % Ad === 0;
  var Sd = (e) => Math.ceil(Math.max(1, Math.min(un, Number(e) || 1)) / Ad);
  var pk = [[30, 90], [60, 175], [90, 260], [120, 350], [150, 435], [180, 520], [210, 610], [300, 900], [420, 1260], [530, 1590]];
  function lc(e) {
    let t = pk[Sd(e) - 1] || [0, 0];
    return Bs(e) ? t[1] : t[0];
  }
  var nm = (e, t) => {
    let n = 0;
    for (let r = e; r <= t; r += 1) n += lc(r);
    return n;
  };
  var rE = nm(1, Ut);
  var aE = nm(Ut + 1, un);
  var dc = 6;
  var fc = Ut - Ad + 1;
  var $s = { escorts: dc - 1, escortPower: 0.35 };
  var gk = { 1: 2, 2: 5, 3: 15 };
  var yk = { prism: 6, core: 2, shard: 1 };
  var wk = 20;
  var uc = (() => {
    let e = Dp(), t = [{ id: "unit", group: "special", name: "5\u2605 Unit", grants: { unit: 5 }, price: 2400, cap: 1 }, { id: "aether", group: "special", name: "Aether", qty: 160, grants: { aether: 160 }, price: 80, cap: 100 }, { id: "mandate:any:1", group: "special", name: "Mandate", grants: { material: "mandate:any:1" }, price: 1e3, cap: e.mandate }];
    for (let n of Vi(Nt, en)) n.family !== "mandate" && t.push({ id: n.id, group: n.family, name: n.name, grants: { material: n.id }, price: gk[n.tier], cap: e[n.family][n.tier] || 0 });
    for (let n of Ct.slice().reverse()) t.push({ id: n.id, group: "insight", name: n.name, grants: { insight: n.id }, price: yk[n.id], cap: n.id === "prism" ? Math.ceil(e.xp / n.xp) : wk });
    return t.push({ id: "funds", group: "other", name: "Funds", qty: 2e4, grants: { funds: 2e4 }, price: 40, cap: 10 }), t.push({ id: "glimmer", group: "other", name: "Glimmer", qty: 10, grants: { glimmer: 10 }, price: 60, cap: 5 }), t;
  })();
  var oE = uc.reduce((e, t) => e + t.price * t.cap, 0);
  var Yd = 20;
  var Kd = 6;
  var Vd = 1.5;
  var Xd = 0.4;
  var hm = 0.21;
  var pm = 1 / (1 - hm);
  var Fs = Math.round(1.6 * pm * 100) / 100;
  var mm = Math.round(0.65 * pm * 100) / 100;
  var Md = 3;
  var Rd = 0.15;
  var _a = 0.15;
  var Od = 1.1;
  var Cd = 0.25;
  var gm = 0.15;
  var ym = 0.1;
  var wm = 0.6;
  var Hs = 30;
  var bm = 10;
  var km = 30;
  var Am = 0.5;
  var Sm = 0.15;
  var Ld = 3;
  var vm = 0.5;
  var Jd = 1.5;
  var Em = Math.round((Jd - 1) * 100);
  var Pd = 0.4;
  var Dd = 1;
  var Bd = 3;
  var $d = 2;
  var Fd = 0.4;
  var Hd = 0.35;
  var Ud = 35;
  var jd = 0.5;
  var Wd = 1;
  var Tm = 30;
  var Ma = 0.5;
  var Us = 0.4;
  var xm = 3;
  var Gd = 1.8;
  var Nm = { Tank: 3, Warrior: 2, Assassin: 1.5, Mage: 1, Support: 1 };
  var Im = 1;
  var _m = 0.05;
  var Mm = 2;
  var Rm = 0.08;
  var Om = 15;
  var Cm = 0.4;
  var Lm = 12;
  var Pm = 0.3;
  var Dm = { water: ["heal", "revive"], dark: ["drain"], earth: ["shield"] };
  var mc = 0.35;
  var kr = { battle_start: 1, self: 1, on_attack: 0.5, on_hit: 0.5, on_ally_low: 1.2, on_low: 1.2, on_round: mc, on_ult: 0.7, on_death: 1.4, on_kill: 0.6 };
  var $m = 0.02;
  var Fm = 0.1;
  var Hm = 0.18;
  var Um = 0.2;
  var hc = 0.5;
  var fe = { ATK_K: Vd, DEF_K: Xd, DEF_TYPICAL_SHARE: hm, HP_BASE: Yd, HP_PER: Kd, GRANTED_COOLDOWN: xm, ULT_SINGLE: Fs, ULT_AOE: mm, CP_ROW_HEADS: Md, AOE_FALLOFF: Rd, HEAL_SCALE: _a, SHIELD_SCALE: Od, DOT_SCALE: Cd, BUFF_SCALE: gm, BUFF_MIN: ym, BUFF_MAX: wm, FOCUS: Gd, DOT_ROUNDS: Bd, BUFF_ROUNDS: Ld, REVIVE_PCT: Hd, ENERGY_GRANT: Ud, DRAIN_SHARE: Pd, PASSIVE_SHARE: Ma, PASSIVE_HIT_SHARE: Us, STUN_TURNS: Wd, EXECUTE_BONUS: Dd, CLEANSE_SHARE: jd, LOW_PCT: mc, AURA_REGEN: $m, AURA_MITIGATION: Fm, AURA_SHIELD: Hm, RESIST_MITIGATION: Um, DEFEND_MITIGATION: hc, RIDER_BURN: _m, RIDER_FLOW: Rm, RIDER_HASTE: Om, RIDER_BULWARK: Cm, RIDER_RADIANCE: Lm, RIDER_BLIGHT: Pm, RIDER_REPEATS: Dm, ENERGY_KILL: km, RIDER_BURN_ROUNDS: Mm, TRIGGER_SCALE: kr, PASSIVE_ROUNDS: $d, REVIVE_TEAM_HEAL: Fd, DEF_FLOOR: vm, ATK_CEIL: Jd, CRIT_CEIL: Em, EFFECT_LAND_BASE: Am, EFFECT_LAND_MIN: Sm, ENERGY_ATTACK: Hs, ENERGY_HIT: bm, ROUND_CAP: Tm, AGGRO_BY_ROLE: Nm, AGGRO_DEFAULT: Im };
  var Nk = fe.RIDER_REPEATS || {};
  var Jm = 1 / 3;
  var yc = ["crit", "critDmg", "recharge", "effectHit", "effectRes", "healBonus"];
  var $k = new Set(yc);
  var of = [0.7, 0.8, 0.9, 1];
  var Wk = of.reduce((e, t) => e + t, 0) / of.length;
  var af = of.map((e) => e / Wk);
  var Ks = { 3: { cap: 4, mainScale: 0.45, ticks: 1 }, 4: { cap: 8, mainScale: 0.7, ticks: 2 }, 5: { cap: 20, mainScale: 1, ticks: 5, floor: 1 / 2 } };
  var Vk = 1 / 3;
  var xe = fe;
  function qe(e) {
    return Math.round(Number(e) * 1e3) / 10 + "%";
  }
  var Jk = [["one enemy row's", "one of your rows'"], ["every enemy's", "all your units'"], ["one enemy's", "one of your units'"], ["one enemy row", "one of your rows"], ["the enemy BACK line", "your BACK line"], ["the enemy front line", "your front line"], ["every enemy", "every unit of yours"], ["one enemy", "one of your units"], ["your front line", "its front line"], ["your back line", "its back line"], ["your most hurt ally", "its most hurt ally"], ["the whole team", "its whole team"], ["from the team", "from its team"], ["heals the team", "heals its team"], ["every ally", "each of its allies"], ["one ally's", "one of its allies'"], ["one fallen ally", "one of its fallen allies"], ["fallen allies", "of its fallen allies"], ["one ally", "one of its allies"], ["an ally", "one of its allies"], ["the teammate", "its teammate"]];
  var hE = new RegExp(Jk.map(([e]) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  var t0 = { battle_start: "As the fight opens", self: "As the fight opens", aura: "For the whole fight", on_hit: "Each time this unit is struck", on_attack: "Each time this unit swings", on_kill: "Each time this unit finishes someone", on_ally_low: "The first time an ally drops below <b>" + qe(xe.LOW_PCT) + " health</b> (once per battle)", on_low: "The first time this unit drops below <b>" + qe(xe.LOW_PCT) + " health</b> (once per battle)", resist: "For the whole fight", on_round: "On every one of this unit's turns", on_ult: "When this unit casts its Ultimate", on_death: "When this unit falls", cooldown: "Every few rounds", energy: "When the energy bar fills" };
  function $r(e) {
    let t = (r, a) => {
      let f = Number(r);
      if (!Number.isFinite(f) || f <= 0) return a;
      let h = Math.round(f / 64) * 64;
      return Math.max(512, Math.min(2048, h));
    }, n = e && typeof e == "object" ? e : {};
    return { sceneWidth: t(n.sceneWidth, 1216), sceneHeight: t(n.sceneHeight, 832), portraitWidth: t(n.portraitWidth, 832), portraitHeight: t(n.portraitHeight, 1216) };
  }
  var xg = { "image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/gif": ".gif", "image/webp": ".webp", "image/avif": ".avif" };
  function Po(e) {
    let t = e || {}, n = Number.parseInt(t.PORT, 10);
    return `${!!(ve(t.SSL_CERT) && ve(t.SSL_KEY)) ? "https" : "http"}://127.0.0.1:${Number.isFinite(n) ? n : 7860}`;
  }
  function p0(e, t) {
    return Ef(e, t).promptMode;
  }
  function Ef(e, t) {
    let n = { id: "", promptMode: "natural", styleText: "", positiveTags: "", negativeTags: "", subjectAvatar: "" }, r = typeof e == "string" ? Tf(e) : e, a = r && typeof r == "object" ? r.imageStyleProfiles || r.styleProfiles : null;
    if (!a || typeof a != "object") return n;
    let f = Array.isArray(a.profiles) ? a.profiles : [], h = (C) => C ? f.find((I) => I && ve(I.id) === C) : null, A = h(ve(t)) || h(ve(a.defaultProfileId)) || f[0];
    if (!A) return n;
    let T = ve(A.promptMode), R = A.subjectTags && typeof A.subjectTags == "object" ? A.subjectTags : {};
    return { id: ve(A.id), promptMode: T === "tagged" || T === "danbooru" || T === "hybrid" ? T : "natural", styleText: ve(A.baseStyle) === "auto" ? "" : ve(A.styleText), positiveTags: ve(A.positiveTags), negativeTags: ve(A.negativeTags), subjectAvatar: ve(R.avatar) };
  }
  var m0 = "1girl, 1boy, person, people, character, portrait, face, text, captions, logos, watermarks, borders, UI, frame, signature";
  var Ig = "text, captions, logos, watermarks, borders, UI, collage layouts, duplicate faces, extra people, cropped-off heads, white background, plain background, simple background, flat lighting, full body, standing at attention";
  function Ec(e) {
    return "avatar:" + (String(e ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 120) || "character");
  }
  function Fr(e) {
    return String(e ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  }
  function Hr(...e) {
    let t = /* @__PURE__ */ new Set(), n = [];
    for (let r of e) for (let a of Fr(r)) {
      let f = a.toLowerCase();
      t.has(f) || (t.add(f), n.push(a));
    }
    return n.join(", ");
  }
  function g0(e, ...t) {
    let n = Fr(e), r = new Set(n.map((a) => a.toLowerCase()));
    for (let a of t) for (let f of Fr(a)) {
      let h = f.toLowerCase();
      r.has(h) || (r.add(h), n.push(f));
    }
    return n.join(", ");
  }
  function oa(e) {
    return e === "danbooru" || e === "tagged";
  }
  function Qs(e) {
    return ve(e && e.name).split(",")[0].trim();
  }
  function Zn(e) {
    let t = ve(e);
    return t ? /[.!?…]$/.test(t) ? t : t + "." : "";
  }
  function ln(e) {
    return ve(e).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "").trim();
  }
  function y0(e, t) {
    let n = t || {}, r = oa(n.promptMode), a = ve(e && e.name), f = ve(e && e.tags), h = ln(f || a);
    return { prompt: r ? Hr("scenery, no humans, wide shot", n.positiveTags, h) : [ve(n.styleText), h ? Zn("A background illustration of " + h) : "", "Wide establishing shot. No people in frame.", ve(n.positiveTags)].filter(Boolean).join(" "), negativePrompt: Hr(n.negativeTags, m0) };
  }
  function w0(e, t) {
    let n = t || {}, r = xc(e, n.promptMode), a = oa(n.promptMode), f = Qs(e), h = xf(e), A = a ? Hr(f, n.positiveTags, r, Tc, h) : [f ? f + "." : "", ve(n.styleText), r ? "Canonical appearance: " + Zn(r) : "", "Framing and light: " + Zn(Tc), h ? "Behind them: " + Zn(h) : "", ve(n.positiveTags)].filter(Boolean).join(" "), T = Hr(n.negativeTags, Ig);
    return { prompt: A, negativePrompt: T };
  }
  function _g(e, t, n) {
    let r = t || {}, a = Array.isArray(r.tags) ? r.tags.map(ve).filter(Boolean) : [], f = ve(r.prompt), h = a.join(", ");
    return oa(n) && h ? ln(h) : f && Da(f) ? ln(f) : ln(h || f) || xc(e, n);
  }
  function b0(e, t, n) {
    let r = n || {}, a = _g(e, t, r.promptMode), f = oa(r.promptMode), h = Qs(e), A = xf(e);
    return { prompt: f ? Hr(h, r.positiveTags, a, Tc, A) : [h ? h + "." : "", ve(r.styleText), a ? "Canonical appearance: " + Zn(a) : "", "Framing and light: " + Zn(Tc), A ? "Behind them: " + Zn(A) : "", ve(r.positiveTags)].filter(Boolean).join(" "), negativePrompt: Hr(r.negativeTags, Ig) };
  }
  var k0 = /\b(?:de|del|la|el|los|las|una|uno|con|sin|su|sus|que|por|para|pelo|ojos|cabello|piel|rostro|cuerpo|und|der|die|das|mit|des|le|les|un|une|avec|dans)\b/iu;
  function Da(e) {
    let t = ve(e);
    return !t || /[^\x00-\x7F]/u.test(t) ? false : !k0.test(t);
  }
  var Tc = "three-quarter shot, cowboy shot, from head to mid-thigh, dynamic pose, dramatic lighting, rim light, cinematic key art, detailed background, depth of field";
  var A0 = { Fire: "ember-lit air, drifting sparks, warm backlight, smoke haze", Water: "rain-slick surfaces, cold blue light, mist, shallow reflections", Wind: "open sky, streaming clouds, wind-swept air, bright rim light", Earth: "stone ruins, dust motes in a low sun, ochre light, weathered walls", Light: "radiant haze, golden backlight, lens flare, pale sky", Dark: "deep shadow, cold moonlight, drifting fog, violet gloom" };
  function xf(e) {
    let t = e || {}, n = Array.isArray(t.sceneTags) ? t.sceneTags.map(ve).filter(Boolean).join(", ") : "";
    return n ? ln(n) : A0[ve(t.affinity)] || "atmospheric backdrop, soft depth of field";
  }
  function xc(e, t) {
    let n = e || {}, r = Array.isArray(n.imageTags) ? n.imageTags.map(ve).filter(Boolean) : [], a = ve(n.appearance), f = r.join(", ");
    return oa(t) && f ? ln(f) : a && Da(a) ? ln(a) : ln(f || a);
  }
  var S0 = /^(1girl|1woman|1female|2girls|2women|multiple girls)$/i;
  var Mg = /^(1boy|1man|1male|2boys|2men|multiple boys)$/i;
  var v0 = /^(solo|1other|solo focus)$/i;
  var Tg = (e) => S0.test(e) || Mg.test(e) || v0.test(e);
  function E0(e, t, n) {
    let r = Array.isArray(e) ? e : [], a = Array.isArray(t) ? t : [], f = Array.isArray(n) ? n : [], h = [], A = [], T = [];
    for (let te = 0; te < r.length; te += 1) {
      let ie = Fr(r[te]);
      !ie.length && !Fr(f[te]).length || (T.push(ie), h.push(String(a[te] || "")), A.push(Fr(f[te])));
    }
    if (!T.length) return "";
    let R = 0, C = 0, I = [], D = /* @__PURE__ */ new Set();
    for (let te = 0; te < T.length; te += 1) {
      let ie = T[te];
      h[te] === "male" ? C += 1 : h[te] === "female" || h[te] === "other" ? R += 1 : ie.some((se) => Mg.test(se)) ? C += 1 : R += 1;
      for (let se of ie) {
        let le = se.toLowerCase();
        Tg(se) || D.has(le) || (D.add(le), I.push(se));
      }
      for (let se of A[te]) Tg(se) || I.push(se);
    }
    let G = (te, ie, se, le) => te === 1 ? ie : te === 2 ? se : le, W = [];
    return R && W.push(G(R, "1girl", "2girls", "multiple girls")), C && W.push(G(C, "1boy", "2boys", "multiple boys")), W.concat(I).join(", ");
  }
  function T0({ units: e, scene: t, framing: n = "banner" }, r) {
    let a = r || {}, f = oa(a.promptMode), h = Array.isArray(e) ? e.filter(Boolean) : [], A = (Ee) => Da(ve(Ee && Ee.sceneAction)) ? ln(ve(Ee.sceneAction)) : "", T = E0(h.map((Ee) => xc(Ee, a.promptMode)), h.map((Ee) => ve(Ee && Ee.identitySex)), h.map(A)), R = Da(ve(t)) ? ln(ve(t)) : "", C = Hr(...h.map((Ee) => Qs(Ee))), I = R ? "" : xf(h[0]), D = new Set(Fr(T).map((Ee) => Ee.toLowerCase())), G = Fr(C).filter((Ee) => !D.has(Ee.toLowerCase())).concat(Fr(T)).join(", "), W = n !== "scene", te = W ? "wide shot, full body, dynamic composition, cinematic lighting, detailed background" : "", ie = W ? "A wide banner illustration of " : "An illustration of ", se = f ? g0(G, R, I, te, a.positiveTags) : [ve(a.styleText), C ? Zn(C) : "", T ? Zn(ie + T) : "", R ? Zn(R) : "", I ? Zn("Behind them: " + I) : "", W ? "Full body, dynamic composition, cinematic lighting." : "", ve(a.positiveTags)].filter(Boolean).join(" "), le = "portrait, close-up, headshot, cropped, out of frame, extra figures", Ce = h.length > 0 && h.every((Ee) => Ee && Ee.backView === true) ? "looking at viewer, facing viewer, front view" : "";
    return { prompt: se, negativePrompt: W ? Hr(a.negativeTags, le) : Hr(a.negativeTags, Ce) };
  }
  function Lo(e) {
    let t = /^data:([^;,]+);base64,([\s\S]+)$/u.exec(ve(e));
    if (!t) return null;
    let n = t[1].toLowerCase(), r = xg[n];
    if (!r) return null;
    let a = t[2].replace(/\s+/gu, "");
    return a ? { mime: n, ext: r, base64: a } : null;
  }
  function Rg({ baseUrl: e, fetch: t, logger: n } = {}) {
    let r = ve(e) || Po(typeof process > "u" ? {} : process.env), a = (...h) => {
      if (t) return t(...h);
      if (typeof fetch != "function") throw new Error("engine-image: no fetch available");
      return fetch(...h);
    };
    async function f(h, A) {
      let T = await a(`${r}${h}`, A);
      if (!T || !T.ok) {
        let R = T ? T.status : 0, C = "";
        try {
          let D = await T.json();
          C = ve(D && D.error);
        } catch {
          C = "";
        }
        let I = new Error(`engine ${h} -> ${R}${C ? `: ${C}` : ""}`);
        throw I.status = R, I;
      }
      return T.json();
    }
    return { async personaAvatar(h) {
      let A = ve(h);
      if (!A) return "";
      try {
        let T = await f(`/api/characters/personas/${encodeURIComponent(A)}`);
        return T && typeof T == "object" ? ve(T.avatarPath) : "";
      } catch (T) {
        return Number(T && T.status) !== 404 && n && typeof n.warn == "function" && n.warn("[gacha-forge] could not read persona %s for its avatar: %s", A, ve(T && T.message)), "";
      }
    }, async characterCard(h) {
      let A = ve(h);
      if (!A) return null;
      let T = await f(`/api/characters/${encodeURIComponent(A)}`);
      if (!T || typeof T != "object") return null;
      let R = typeof T.data == "string" ? Tf(T.data) : T.data, C = R && typeof R == "object" ? R : {}, I = C.data && typeof C.data == "object" ? C.data : C, D = I.extensions && typeof I.extensions == "object" ? I.extensions : {};
      return { id: ve(T.id) || A, name: ve(I.name) || ve(T.comment) || "", description: ve(I.description), personality: ve(I.personality), scenario: ve(I.scenario), backstory: ve(D.backstory), appearance: ve(D.appearance), creatorNotes: ve(I.creator_notes), tags: Array.isArray(I.tags) ? I.tags.map(ve).filter(Boolean).slice(0, 20) : [], avatarPath: ve(T.avatarPath) };
    }, async cardAvatarImage(h) {
      let A = ve(h);
      if (!A || !A.startsWith("/")) return null;
      try {
        let T = await a(`${r}${A}`);
        if (!T || !T.ok) return null;
        let R = ve(T.headers && T.headers.get && T.headers.get("content-type")).split(";")[0].toLowerCase(), C = xg[R];
        if (!C) return null;
        let I = await T.arrayBuffer(), D = new Uint8Array(I);
        if (!D.length) return null;
        let G = "";
        for (let W = 0; W < D.length; W += 8192) G += String.fromCharCode.apply(null, D.subarray(W, W + 8192));
        return { mime: R, ext: C, base64: btoa(G) };
      } catch {
        return null;
      }
    }, listConnections() {
      return f("/api/connections");
    }, async promptMode(h) {
      try {
        let A = await f("/api/app-settings/ui");
        return p0(A && typeof A == "object" && "value" in A ? A.value : A, h);
      } catch {
        return "natural";
      }
    }, async styleProfiles() {
      try {
        let h = await f("/api/app-settings/ui"), A = h && typeof h == "object" && "value" in h ? h.value : h, T = typeof A == "string" ? Tf(A) : A, R = T && typeof T == "object" ? T.imageStyleProfiles || T.styleProfiles : null;
        return (R && Array.isArray(R.profiles) ? R.profiles : []).filter((I) => I && ve(I.id)).map((I) => ({ id: ve(I.id), name: ve(I.name) || ve(I.id), promptMode: ve(I.promptMode) || "natural" }));
      } catch {
        return [];
      }
    }, async portraitProfile(h) {
      try {
        let A = await f("/api/app-settings/ui"), T = A && typeof A == "object" && "value" in A ? A.value : A;
        return Ef(T, h);
      } catch {
        return Ef(null, h);
      }
    }, async generateScene({ connectionId: h, place: A, styleProfileId: T, size: R }) {
      let { sceneWidth: C, sceneHeight: I } = $r(R), D = ve(A && A.name) || "Scene", G = await this.portraitProfile(T), W = y0(A, G), te = await f("/api/characters/avatar-generation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: h, name: D, appearance: W.prompt, purpose: "avatar", styleProfileId: ve(T) || void 0, width: C, height: I, promptOverrides: [{ id: Ec(D), prompt: W.prompt, negativePrompt: W.negativePrompt }] }) }), ie = Lo(te && te.image);
      if (!ie) throw new Error("engine returned no usable image");
      let se = ve(te && te.prompt);
      return { ...ie, width: C, height: I, prompt: se, overrideTook: se === W.prompt, sentPrompt: W.prompt };
    }, async generateBannerArt({ connectionId: h, name: A, units: T, scene: R, styleProfileId: C, framing: I, size: D }) {
      let { sceneWidth: G, sceneHeight: W } = $r(D), te = ve(A) || "Banner", ie = await this.portraitProfile(C), se = T0({ units: T, scene: R, framing: I }, ie), le = await f("/api/characters/avatar-generation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: h, name: te, appearance: se.prompt, purpose: "avatar", styleProfileId: ve(C) || void 0, width: G, height: W, promptOverrides: [{ id: Ec(te), prompt: se.prompt, negativePrompt: se.negativePrompt }] }) }), ce = Lo(le && le.image);
      if (!ce) throw new Error("engine returned no usable image");
      let Ce = ve(le && le.prompt);
      return { ...ce, width: G, height: W, prompt: Ce, overrideTook: Ce === se.prompt, sentPrompt: se.prompt };
    }, async generatePortrait({ connectionId: h, name: A, unit: T, styleProfileId: R, size: C }) {
      let { portraitWidth: I, portraitHeight: D } = $r(C), G = ve(A) || "Character", W = await this.portraitProfile(R), te = w0(T, W), ie = xc(T, W.promptMode), se = await f("/api/characters/avatar-generation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: h, name: G, appearance: ie, purpose: "avatar", styleProfileId: ve(R) || void 0, width: I, height: D, promptOverrides: [{ id: Ec(G), prompt: te.prompt, negativePrompt: te.negativePrompt }] }) }), le = Lo(se && se.image);
      if (!le) throw new Error("engine returned no usable image");
      let ce = ve(se && se.prompt);
      return { ...le, width: I, height: D, prompt: ce, overrideTook: ce === te.prompt, sentPrompt: te.prompt };
    }, async generateOutfit({ connectionId: h, name: A, unit: T, outfit: R, styleProfileId: C, size: I }) {
      let { portraitWidth: D, portraitHeight: G } = $r(I), W = ve(A) || "Character", te = await this.portraitProfile(C), ie = b0(T, R, te), se = _g(T, R, te.promptMode), le = await f("/api/characters/avatar-generation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: h, name: W, appearance: se, purpose: "avatar", styleProfileId: ve(C) || void 0, width: D, height: G, promptOverrides: [{ id: Ec(W), prompt: ie.prompt, negativePrompt: ie.negativePrompt }] }) }), ce = Lo(le && le.image);
      if (!ce) throw new Error("engine returned no usable image");
      let Ce = ve(le && le.prompt);
      return { ...ce, width: D, height: G, prompt: Ce, overrideTook: Ce === ie.prompt, sentPrompt: ie.prompt };
    }, async uploadToGallery({ image: h, name: A, prompt: T, provider: R, model: C }) {
      let I = new FormData();
      I.append("prompt", ve(T)), I.append("provider", ve(R) || "image_generation"), I.append("model", ve(C) || "unknown");
      let D = Number(h && h.width), G = Number(h && h.height);
      D > 0 && G > 0 && (I.append("width", String(Math.round(D))), I.append("height", String(Math.round(G))));
      let W = Uint8Array.from(atob(h.base64), (le) => le.charCodeAt(0));
      I.append("file", new Blob([W], { type: h.mime }), `${x0(A)}${h.ext}`);
      let te = await f("/api/global-gallery/upload", { method: "POST", body: I }), ie = ve(te && te.id), se = ve(te && te.url);
      if (!ie || !se) throw new Error("gallery upload returned no image");
      return { id: ie, url: se };
    }, async deleteGalleryImage(h) {
      let A = ve(h);
      if (!A) return false;
      try {
        let T = await a(`${r}/api/global-gallery/${encodeURIComponent(A)}`, { method: "DELETE" });
        return !!(T && T.ok);
      } catch {
        return false;
      }
    } };
  }
  function ve(e) {
    return typeof e == "string" ? e.trim() : "";
  }
  function Tf(e) {
    try {
      return JSON.parse(e);
    } catch {
      return null;
    }
  }
  function x0(e) {
    return ve(e).toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/(^-|-$)/gu, "").slice(0, 60) || "portrait";
  }
  var Qo = ["damage = one hard hit; aoe_damage = a sweep across the target side", "drain = damage that heals the caster for part of it", "execute = damage that grows with how much health the target has ALREADY lost (a finisher)", "dot = poison: it ticks for several rounds and ignores shields", "stun = the target loses its next action", "cleanse = strips poison, stuns and debuffs from your side, and heals a little", "revive = brings ONE fallen ally back at a fraction of their health", "energy = fills your side's ultimate bars instead of their health"].join("; ");
  var zc = ["battle_start/self = once, as the fight opens; aura = with buff/heal/shield a standing effect on the whole team, with any other effect it fires on every one of its turns", "on_hit = when this unit is struck; on_attack = when it swings; on_kill = when it finishes someone", "on_ally_low = the first time an ALLY drops low; on_low = the first time THIS unit does", "on_round = every one of its turns; on_ult = when it casts its Ultimate", "on_death = a parting gift to the survivors; resist = permanent damage reduction for itself"].join("; ");
  var Jc = ["AS A PASSIVE: dot (on_attack, on_hit, on_round, aura) = a poison or burn that keeps ticking on whoever it touches, past shields", "stun (on_hit, battle_start, on_ult) = the striker, or the line, loses its next action", "energy (on_kill, on_ult, on_round, on_death) = the team's ultimate bars fill faster", "drain (on_attack, on_round) = every swing gives part of its damage back as health", "execute (on_attack, on_kill) = extra hits that punish the wounded", "heal (on_round, aura, on_ally_low) = steady healing; cleanse (on_ally_low, on_round, on_death) = strips poison, stuns and DEF drops off the team and heals a little", "revive (on_death, on_ally_low) = one fallen ally returns; damage (on_hit, on_round) = a counter-blow", "buff/debuff/shield = the stat axis, for the ONE character in three whose role is to carry it (a Tank's DEF ward, a Support's SPD rally, a duellist's crit edge); an aura buff:atk is standing damage reduction for the team, an aura buff:def/spd/crit is that stat raised for the team all fight"].join("; ");
  var $u = `granted trigger: cooldown = ready on the wielder's first turn, then every ${fe.GRANTED_COOLDOWN} of their own turns; energy = the turn right after their Ultimate, every time; on_hit = every ${fe.GRANTED_COOLDOWN} turns, and only once the wielder has been struck since its last use.`;
  var ja = { Tank: "bulwark", Warrior: "blade", Mage: "focus", Support: "tome", Assassin: "edge" };
  var Ya = Object.values(ja);
  var fi = 180 * 1e3;
  var Qc = Vi(Nt, en);
  var Jt = new Map(Qc.map((e) => [e.id, e]));
  var tu = 1 / 3;
  var cT = 1440 * 60 * 1e3;
  var Wu = 336 * 60 * 60 * 1e3;
  var BA = 600 * 1e3;
  var $S = 8 * 1024 * 1024;
  var vw = `at most ${Kp} tags, IN THIS ORDER: the count tag and "solo"; who they are (hair, eyes, skin, build); the POSE, the expression and what they are doing; the outfit's main garments; then its colours, prints and small accessories; then the setting and the light.`;

  // upstream/Marinara-Engine/packages/shared/src/constants/image-generation-defaults.ts
  var IMAGE_DEFAULTS_STORAGE_KEY = "imageGeneration";
  var IMAGE_GENERATION_DEFAULTS_VERSION = 1;
  var COMFYUI_LORA_STRENGTH_MIN = -100;
  var COMFYUI_LORA_STRENGTH_MAX = 100;
  var DEFAULT_AUTOMATIC1111_DEFAULTS = {
    promptPrefix: "",
    negativePromptPrefix: "",
    sampler: "Euler a",
    scheduler: "",
    steps: 20,
    cfgScale: 7,
    clipSkip: null,
    restoreFaces: false,
    denoisingStrength: 0.6
  };
  var DEFAULT_COMFYUI_DEFAULTS = {
    promptPrefix: "",
    negativePromptPrefix: "",
    sampler: "euler_ancestral",
    scheduler: "normal",
    steps: 20,
    cfgScale: 7,
    denoisingStrength: 1,
    clipSkip: null,
    uploadPlaceholderOnMissingReference: false,
    saveToBackend: false,
    loras: []
  };
  var DEFAULT_NOVELAI_DEFAULTS = {
    promptPrefix: "",
    negativePromptPrefix: "",
    sampler: "k_euler_ancestral",
    noiseSchedule: "karras",
    steps: 28,
    promptGuidance: 6,
    promptGuidanceRescale: 0,
    undesiredContentPreset: 0,
    dynamicResolutionBySubjectCount: true,
    styleReferenceImage: null,
    styleReferenceStrength: 0.6,
    styleReferenceFidelity: 0.5
  };
  function createDefaultImageGenerationProfile(service) {
    const profile = {
      version: IMAGE_GENERATION_DEFAULTS_VERSION,
      service,
      seed: -1,
      styleProfileId: null
    };
    if (service === "automatic1111") profile.automatic1111 = { ...DEFAULT_AUTOMATIC1111_DEFAULTS };
    if (service === "comfyui") profile.comfyui = { ...DEFAULT_COMFYUI_DEFAULTS, loras: [] };
    if (service === "novelai") profile.novelai = { ...DEFAULT_NOVELAI_DEFAULTS };
    return profile;
  }
  function normalizeImageGenerationProfile(rawProfile, service) {
    const profile = normalizeImageGenerationProfileValue(rawProfile, service);
    return { profile, changed: JSON.stringify(profile) !== JSON.stringify(rawProfile) };
  }
  function normalizeImageGenerationProfileValue(rawProfile, service) {
    if (!isRecord(rawProfile)) {
      return createDefaultImageGenerationProfile(service);
    }
    const profile = createDefaultImageGenerationProfile(service);
    profile.seed = readInteger(rawProfile.seed, -1, -1, 4294967295);
    profile.styleProfileId = readNullableString(rawProfile.styleProfileId, null);
    if (service === "automatic1111") {
      profile.automatic1111 = normalizeAutomatic1111Defaults(rawProfile.automatic1111);
    } else if (service === "comfyui") {
      profile.comfyui = normalizeComfyUiDefaults(rawProfile.comfyui);
    } else {
      profile.novelai = normalizeNovelAiDefaults(rawProfile.novelai);
    }
    return profile;
  }
  function normalizeAutomatic1111Defaults(rawDefaults) {
    const raw = isRecord(rawDefaults) ? rawDefaults : {};
    return {
      promptPrefix: readString(raw.promptPrefix, DEFAULT_AUTOMATIC1111_DEFAULTS.promptPrefix),
      negativePromptPrefix: readString(raw.negativePromptPrefix, DEFAULT_AUTOMATIC1111_DEFAULTS.negativePromptPrefix),
      sampler: readString(raw.sampler, DEFAULT_AUTOMATIC1111_DEFAULTS.sampler),
      scheduler: readString(raw.scheduler, DEFAULT_AUTOMATIC1111_DEFAULTS.scheduler),
      steps: readInteger(raw.steps, DEFAULT_AUTOMATIC1111_DEFAULTS.steps, 1, 150),
      cfgScale: readNumber(raw.cfgScale, DEFAULT_AUTOMATIC1111_DEFAULTS.cfgScale, 0, 30),
      clipSkip: readNullableInteger(raw.clipSkip, DEFAULT_AUTOMATIC1111_DEFAULTS.clipSkip, 1, 12),
      restoreFaces: readBoolean(raw.restoreFaces, DEFAULT_AUTOMATIC1111_DEFAULTS.restoreFaces),
      denoisingStrength: readNumber(raw.denoisingStrength, DEFAULT_AUTOMATIC1111_DEFAULTS.denoisingStrength, 0, 1)
    };
  }
  function normalizeComfyUiDefaults(rawDefaults) {
    const raw = isRecord(rawDefaults) ? rawDefaults : {};
    return {
      promptPrefix: readString(raw.promptPrefix, DEFAULT_COMFYUI_DEFAULTS.promptPrefix),
      negativePromptPrefix: readString(raw.negativePromptPrefix, DEFAULT_COMFYUI_DEFAULTS.negativePromptPrefix),
      sampler: readString(raw.sampler, DEFAULT_COMFYUI_DEFAULTS.sampler),
      scheduler: readString(raw.scheduler, DEFAULT_COMFYUI_DEFAULTS.scheduler),
      steps: readInteger(raw.steps, DEFAULT_COMFYUI_DEFAULTS.steps, 1, 150),
      cfgScale: readNumber(raw.cfgScale, DEFAULT_COMFYUI_DEFAULTS.cfgScale, 0, 30),
      denoisingStrength: readNumber(raw.denoisingStrength, DEFAULT_COMFYUI_DEFAULTS.denoisingStrength, 0, 1),
      clipSkip: readNullableInteger(raw.clipSkip, DEFAULT_COMFYUI_DEFAULTS.clipSkip, 1, 12),
      uploadPlaceholderOnMissingReference: readBoolean(
        raw.uploadPlaceholderOnMissingReference,
        DEFAULT_COMFYUI_DEFAULTS.uploadPlaceholderOnMissingReference
      ),
      loras: normalizeComfyUiLoraSettings(raw.loras),
      saveToBackend: readBoolean(raw.saveToBackend, false)
    };
  }
  function normalizeComfyUiLoraSettings(rawLoras) {
    if (!Array.isArray(rawLoras)) return [];
    return rawLoras.slice(0, 5).map((entry) => {
      const raw = isRecord(entry) ? entry : {};
      return {
        model: readString(raw.model, "").trim(),
        strength: readNumber(raw.strength, 1, COMFYUI_LORA_STRENGTH_MIN, COMFYUI_LORA_STRENGTH_MAX)
      };
    });
  }
  function normalizeNovelAiDefaults(rawDefaults) {
    const raw = isRecord(rawDefaults) ? rawDefaults : {};
    return {
      promptPrefix: readString(raw.promptPrefix, DEFAULT_NOVELAI_DEFAULTS.promptPrefix),
      negativePromptPrefix: readString(raw.negativePromptPrefix, DEFAULT_NOVELAI_DEFAULTS.negativePromptPrefix),
      sampler: readString(raw.sampler, DEFAULT_NOVELAI_DEFAULTS.sampler),
      noiseSchedule: readString(raw.noiseSchedule, DEFAULT_NOVELAI_DEFAULTS.noiseSchedule),
      steps: readInteger(raw.steps, DEFAULT_NOVELAI_DEFAULTS.steps, 1, 150),
      promptGuidance: readNumber(raw.promptGuidance, DEFAULT_NOVELAI_DEFAULTS.promptGuidance, 0, 30),
      promptGuidanceRescale: readNumber(raw.promptGuidanceRescale, DEFAULT_NOVELAI_DEFAULTS.promptGuidanceRescale, 0, 1),
      undesiredContentPreset: readInteger(
        raw.undesiredContentPreset,
        DEFAULT_NOVELAI_DEFAULTS.undesiredContentPreset,
        0,
        4
      ),
      dynamicResolutionBySubjectCount: readBoolean(
        raw.dynamicResolutionBySubjectCount,
        DEFAULT_NOVELAI_DEFAULTS.dynamicResolutionBySubjectCount
      ),
      styleReferenceImage: readNullableString(raw.styleReferenceImage, DEFAULT_NOVELAI_DEFAULTS.styleReferenceImage),
      styleReferenceStrength: readNumber(
        raw.styleReferenceStrength,
        DEFAULT_NOVELAI_DEFAULTS.styleReferenceStrength,
        0,
        1
      ),
      styleReferenceFidelity: readNumber(
        raw.styleReferenceFidelity,
        DEFAULT_NOVELAI_DEFAULTS.styleReferenceFidelity,
        0,
        1
      )
    };
  }
  function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
  function readString(value, fallback) {
    return typeof value === "string" ? value : fallback;
  }
  function readNullableString(value, fallback) {
    if (value === null || value === void 0) return fallback;
    return typeof value === "string" ? value : fallback;
  }
  function readBoolean(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }
  function readNumber(value, fallback, min, max) {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }
  function readInteger(value, fallback, min, max) {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.trunc(Math.min(max, Math.max(min, value)));
  }
  function readNullableInteger(value, fallback, min, max) {
    if (value === null || value === "" || value === void 0) return fallback;
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.trunc(Math.min(max, Math.max(min, value)));
  }

  // gacha-external/native-request.mjs
  var join2 = (...values) => values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()).join(", ");
  var parameterRoot = (connection) => {
    try {
      return typeof connection.defaultParameters === "string" ? JSON.parse(connection.defaultParameters) : structuredClone(connection.defaultParameters ?? {});
    } catch {
      throw new Error("\uC774\uBBF8\uC9C0 \uC5F0\uACB0\uC758 \uC0DD\uC131 \uC124\uC815\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
  };
  function nativeParameters(connection, request) {
    const limit = nativeLimit(connection);
    if (!limit) return null;
    const edit = validateEditedPrompt(request, request, limit);
    const allowUnicode = /^nai-diffusion-5(?:-|$)/i.test(connection.model);
    const clean = (value) => {
      const normalized = value.replace(/[\u2018\u2019\u201A\u201B]/g, "'").replace(/[\u201C\u201D\u201E\u201F]/g, '"').replace(/[\u2010-\u2015\u2212]/g, "-").replace(/\u2026/g, "...").replace(/\u00A0/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").normalize(allowUnicode ? "NFC" : "NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, allowUnicode ? "$&" : " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
      if (value.trim() && !normalized) throw new Error("\uC774 NAI \uBAA8\uB378\uC740 \uC785\uB825\uD55C \uBB38\uC790\uB97C \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC601\uC5B4 \uD0DC\uADF8\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      return normalized;
    };
    edit.prompt = clean(edit.prompt);
    edit.negativePrompt = clean(edit.negativePrompt);
    edit.characterPrompts = edit.characterPrompts.map((entry) => ({ ...entry, prompt: clean(entry.prompt), negativePrompt: clean(entry.negativePrompt) }));
    const root = parameterRoot(connection);
    const profile = normalizeImageGenerationProfile(root[IMAGE_DEFAULTS_STORAGE_KEY], "novelai").profile;
    const defaults2 = { ...DEFAULT_NOVELAI_DEFAULTS, ...profile.novelai };
    let width = request.width, height = request.height;
    if (defaults2.dynamicResolutionBySubjectCount) {
      const count = edit.characterPrompts.length;
      if (count === 1) {
        width = 832;
        height = 1216;
      } else if (count === 2) {
        width = 1024;
        height = 1024;
      } else if (count >= 3) {
        width = 1216;
        height = 832;
      }
    }
    const dimension = (value) => Math.max(64, Math.min(2048, Math.round(Number(value) / 64) * 64));
    width = dimension(width || 1216);
    height = dimension(height || 832);
    if (width * height > 1048576) {
      const scale = Math.sqrt(1048576 / (width * height));
      width = Math.max(64, Math.floor(width * scale / 64) * 64);
      height = Math.max(64, Math.floor(height * scale / 64) * 64);
    }
    const center = (position) => ({ x: position.x, y: position.y });
    const parameters = {
      width,
      height,
      n_samples: 1,
      ucPreset: defaults2.undesiredContentPreset,
      negative_prompt: clean(join2(defaults2.negativePromptPrefix, edit.negativePrompt)),
      seed: typeof profile.seed === "number" && profile.seed >= 0 ? profile.seed : crypto.getRandomValues(new Uint32Array(1))[0],
      scale: defaults2.promptGuidance,
      steps: defaults2.steps,
      sampler: defaults2.sampler,
      cfg_rescale: defaults2.promptGuidanceRescale,
      params_version: 3,
      reference_image_multiple: [],
      reference_information_extracted_multiple: [],
      reference_strength_multiple: [],
      ...defaults2.noiseSchedule ? { noise_schedule: defaults2.noiseSchedule } : {},
      ...root.customParameters?.parameters ?? {}
    };
    parameters.v4_prompt = { caption: { base_caption: clean(join2(defaults2.promptPrefix, edit.prompt)), char_captions: edit.characterPrompts.map((entry) => ({ char_caption: entry.prompt, centers: [center(entry.position)] })) }, use_coords: edit.characterPrompts.length > 1, use_order: true };
    parameters.v4_negative_prompt = { caption: { base_caption: parameters.negative_prompt, char_captions: edit.characterPrompts.map((entry) => ({ char_caption: entry.negativePrompt, centers: [center(entry.position)] })) }, use_coords: edit.characterPrompts.length > 1, use_order: true };
    if (defaults2.styleReferenceImage && /^nai-diffusion-4-5(?:-|$)/i.test(connection.model)) {
      parameters.director_reference_descriptions = [{ caption: { base_caption: "style", char_captions: [] }, legacy_uc: false }];
      parameters.director_reference_information_extracted = [1];
      parameters.director_reference_strength_values = [defaults2.styleReferenceStrength];
      parameters.director_reference_secondary_strength_values = [1 - defaults2.styleReferenceFidelity];
    }
    return { ...root, customParameters: { ...root.customParameters ?? {}, parameters } };
  }

  // gacha-external/browser-service.mjs
  var tagList = (value) => Array.isArray(value) ? value.filter((value2) => typeof value2 === "string" && value2.trim()) : [];
  var slug = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
  async function makeService(marinara2) {
    const pending = /* @__PURE__ */ new Map();
    let queue = Promise.resolve(), storeQueue = Promise.resolve();
    const ownedTemporary = /* @__PURE__ */ new Set();
    const serial = (task) => {
      const result = queue.then(task, task);
      queue = result.catch(() => {
      });
      return result;
    };
    const engineFetch = (path, options = {}) => {
      const url = new URL(path, location.origin);
      if (url.origin !== location.origin) throw new Error("\uD655\uC7A5\uC740 \uB9C8\uB9AC\uB098\uB77C \uC11C\uBC84\uC5D0\uB9CC \uC694\uCCAD\uD569\uB2C8\uB2E4.");
      const headers = new Headers(options.headers);
      if (!["GET", "HEAD", "OPTIONS"].includes(String(options.method ?? "GET").toUpperCase())) headers.set("x-marinara-csrf", "1");
      try {
        const admin = localStorage.getItem("marinara_admin_secret");
        if (admin) headers.set("X-Admin-Secret", admin);
      } catch {
      }
      return marinara2.fetch(url, { ...options, headers });
    };
    const json = async (path, options = {}) => {
      const response = await engineFetch(path, { ...options, headers: { ...options.body instanceof FormData ? {} : { "Content-Type": "application/json" }, ...options.headers ?? {} } });
      const data = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(data?.error || `\uB9C8\uB9AC\uB098\uB77C API \uC751\uB2F5: ${response.status}`);
      return data;
    };
    const db2 = async (argv) => {
      if (!["get", "select"].includes(argv[1]) || argv[2] !== "capability_documents") throw new Error("\uC77D\uAE30 \uC804\uC6A9 \uC7A5\uBA74 \uC870\uD68C\uB9CC \uD5C8\uC6A9\uD569\uB2C8\uB2E4.");
      const data = await json("/api/professor-mari/workspace/db/command", { method: "POST", body: JSON.stringify({ argv }) });
      if (!data.ok && data.output !== null) throw new Error(data.error || "\uC7A5\uBA74 \uC870\uD68C\uAC00 \uAC70\uC808\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC774 \uD655\uC7A5\uC740 \uC11C\uBC84 PC\uC758 localhost\uC5D0\uC11C \uC0AC\uC6A9\uD574 \uC8FC\uC138\uC694.");
      return data.output;
    };
    const parse = (row) => {
      if (!row) return null;
      if (row.packageId !== "gacha-forge") throw new Error("\uB2E4\uB978 \uD328\uD0A4\uC9C0\uC758 \uB370\uC774\uD130\uB294 \uC0AC\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      return { ...row, data: typeof row.data === "string" ? JSON.parse(row.data) : row.data };
    };
    const raw = async (id2) => parse(await db2(["db", "get", "capability_documents", id2]));
    const ownKey = (id2) => `images:${id2}`;
    const own = async (id2) => (await marinara2.storage.get())[ownKey(id2)];
    const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
    const signature = async (data) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical(data)))))].map((value) => value.toString(16).padStart(2, "0")).join("");
    const applies = async (base, extra) => !!base && !!extra && (extra.baseRevision === base.revision || typeof extra.sourceSignature === "string" && extra.sourceSignature === await signature(base.data));
    async function read(id2) {
      const extra = await own(id2);
      if (id2 === "image-addon:settings") return extra ? { id: id2, revision: extra.revision, data: extra.data, name: "Image settings", description: "" } : null;
      const base = await raw(id2);
      if (!base) return null;
      if (!await applies(base, extra)) return base;
      return { ...base, revision: base.revision + extra.revision, data: { ...base.data, ...extra.data } };
    }
    const lock = (task) => navigator.locks ? navigator.locks.request(`gacha-forge-images:${marinara2.extension.id}`, task) : (() => {
      const result = storeQueue.then(task, task);
      storeQueue = result.catch(() => {
      });
      return result;
    })();
    const documents = {
      getById: async (_pkg, id2) => read(id2),
      list: async (_pkg, kind) => {
        const rows = await db2(["db", "select", "capability_documents", "--where", `row.packageId === "gacha-forge" && row.kind === ${JSON.stringify(kind)}`, "--limit", "5000"]);
        if (!Array.isArray(rows) || rows.length >= 5e3) throw new Error("\uC7A5\uBA74 \uBAA9\uB85D\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4. \uC804\uCCB4 \uBAA9\uB85D\uC744 \uC548\uC804\uD558\uAC8C \uC77D\uC744 \uC218 \uC5C6\uC5B4 \uC911\uB2E8\uD588\uC2B5\uB2C8\uB2E4.");
        const state = await marinara2.storage.get();
        return Promise.all(rows.map(parse).map(async (base) => {
          const entry = state[ownKey(base.id)];
          return await applies(base, entry) ? { ...base, revision: base.revision + entry.revision, data: { ...base.data, ...entry.data } } : base;
        }));
      },
      create: async (input) => lock(async () => {
        if (input.id !== "image-addon:settings" || await own(input.id)) throw new Error("\uC774\uBBF8\uC9C0 \uD655\uC7A5 \uC124\uC815 \uC774\uC678\uC758 \uC6D0\uBCF8 \uBB38\uC11C\uB294 \uB9CC\uB4E4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
        const value = { revision: 1, data: input.data };
        await marinara2.storage.patch({ [ownKey(input.id)]: value });
        return { ...input, revision: 1 };
      }),
      update: async (input) => lock(async () => {
        const current = await read(input.id);
        if (!current || current.revision !== input.expectedRevision) return null;
        const base = input.id === "image-addon:settings" ? null : await raw(input.id);
        const previous = await own(input.id);
        let data;
        if (input.id === "image-addon:settings") data = { enabled: input.data.enabled === true, nativeCharacters: input.data.nativeCharacters === true };
        else if (base.kind === "cg") data = { url: input.data.url, artRef: input.data.artRef, gachaForgeImages: input.data.gachaForgeImages };
        else if (base.kind === "beat") data = { gachaForgeImages: input.data.gachaForgeImages };
        else if (base.kind === "banner") data = { art: input.data.art, artRef: input.data.artRef };
        else throw new Error("CG\xB7\uC7A5\uBA74\uBCC4 \uC774\uBBF8\uC9C0 \uC774\uC678\uC758 \uB370\uC774\uD130\uB294 \uC800\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
        const previousApplies = base ? await applies(base, previous) : !!previous;
        const value = { baseRevision: base?.revision, ...base ? { sourceSignature: await signature(base.data) } : {}, revision: (previousApplies ? previous?.revision ?? 0 : 0) + 1, data };
        await marinara2.storage.patch({ [ownKey(input.id)]: value });
        const persisted = await own(input.id);
        if (JSON.stringify(persisted) !== JSON.stringify(value)) throw new Error("\uAC8C\uC784 \uC11C\uBC84\uC5D0\uC11C \uC774\uBBF8\uC9C0 \uC800\uC7A5\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC774\uBBF8\uC9C0\uB294 \uC720\uC9C0\uB429\uB2C8\uB2E4.");
        const confirmedBase = base ? await raw(input.id) : null;
        if (base && !await applies(confirmedBase, persisted)) throw new Error("\uC800\uC7A5 \uC911 \uC7A5\uBA74\uC774 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC774\uBBF8\uC9C0\uB294 \uC720\uC9C0\uB429\uB2C8\uB2E4.");
        return { ...current, revision: (confirmedBase?.revision ?? 0) + value.revision, data: { ...current.data, ...data } };
      })
    };
    const routes = /* @__PURE__ */ new Map();
    const addon = createImageAddon({ package: { id: "gacha-forge" }, api: { runtime: { persistence: { documents } }, registerPrivilegedRoutes: async (plugin, options) => {
      await plugin({ post: (path, handler) => routes.set(options.prefix + path, handler) });
    } } });
    const client = Rg({ baseUrl: location.origin, fetch: engineFetch, logger: marinara2.log });
    const getRun = async (id2) => (await raw("index"))?.data?.runs?.find((run) => run.runId === id2);
    const imageConfig = (run) => ({ ...run.images ?? {}, ...$r(run.images), off: !!run.images && !run.images.connectionId, backgrounds: run.images?.backgrounds === true, connectionId: run.images?.connectionId || "", styleProfileId: run.images?.styleProfileId || "" });
    const connection = async (run) => {
      const connections = await client.listConnections();
      const config = imageConfig(run);
      if (config.off) return null;
      return connections.find((value) => value.id === config.connectionId) ?? (!run.images ? connections.find((value) => value.provider === "image_generation") : null);
    };
    async function deleteTemporary(id2) {
      const entry = (await marinara2.storage.get()).temporaryConnections?.[id2];
      if (!entry && !ownedTemporary.has(id2)) return;
      await json(`/api/connections/${encodeURIComponent(id2)}`, { method: "DELETE" });
      ownedTemporary.delete(id2);
      await lock(async () => marinara2.storage.patch({ temporaryConnections: { ...(await marinara2.storage.get()).temporaryConnections ?? {}, [id2]: null } }));
    }
    const journal = (await marinara2.storage.get()).temporaryConnections ?? {};
    for (const [id2, entry] of Object.entries(journal)) {
      if (!entry || id2 === entry.sourceId || Date.now() - entry.at < 30 * 60 * 1e3) continue;
      const recover = async () => {
        try {
          const current = await json(`/api/connections/${encodeURIComponent(id2)}`);
          if (current?.id === id2 && current.name === `Gacha Forge \uC774\uBBF8\uC9C0 \uC784\uC2DC \uC5F0\uACB0 (${marinara2.extension.id})`) await deleteTemporary(id2);
        } catch (error) {
          marinara2.log.warn("\uC9C0\uB09C \uC784\uC2DC \uC5F0\uACB0 \uD655\uC778\uC744 \uC644\uB8CC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", id2, error.message);
        }
      };
      if (navigator.locks) await navigator.locks.request(`gacha-forge-image-request:${entry.sourceId}`, { ifAvailable: true }, (lock2) => lock2 ? recover() : void 0);
      else await recover();
    }
    client.generatePrepared = async (request) => {
      const connections = await client.listConnections();
      const original = connections.find((value) => value.id === request.connectionId);
      const parameters = request.characterPrompts?.length || request.imageKind === "background" && nativeLimit(original) ? nativeParameters(original, request) : null;
      let temporary;
      try {
        if (parameters) {
          temporary = await json(`/api/connections/${encodeURIComponent(original.id)}/duplicate`, { method: "POST", body: "{}" });
          ownedTemporary.add(temporary.id);
          await lock(async () => marinara2.storage.patch({ temporaryConnections: { ...(await marinara2.storage.get()).temporaryConnections ?? {}, [temporary.id]: { sourceId: original.id, at: Date.now() } } }));
          await json(`/api/connections/${encodeURIComponent(temporary.id)}`, { method: "PATCH", body: JSON.stringify({ name: `Gacha Forge \uC774\uBBF8\uC9C0 \uC784\uC2DC \uC5F0\uACB0 (${marinara2.extension.id})` }) });
          await json(`/api/connections/${encodeURIComponent(temporary.id)}/default-parameters`, { method: "PUT", body: JSON.stringify(parameters) });
        }
        const name = request.name || "Scene";
        const promptId = `avatar:${name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 120) || "character"}`;
        const response = await json("/api/characters/avatar-generation", { method: "POST", body: JSON.stringify({ connectionId: temporary?.id ?? request.connectionId, name, appearance: request.prompt, purpose: "avatar", width: request.width, height: request.height, styleProfileId: request.styleProfileId || void 0, promptOverrides: [{ id: promptId, prompt: request.prompt, negativePrompt: request.negativePrompt }] }) });
        const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(response.image ?? "");
        if (!match) throw new Error("\uB9C8\uB9AC\uB098\uB77C\uAC00 \uC0AC\uC6A9\uD560 \uC218 \uC788\uB294 \uC774\uBBF8\uC9C0\uB97C \uBC18\uD658\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
        return { mime: match[1], ext: match[1] === "image/jpeg" ? ".jpg" : ".png", base64: match[2], prompt: response.prompt, width: request.width, height: request.height };
      } finally {
        if (temporary) await deleteTemporary(temporary.id).catch((error) => marinara2.log.warn("\uC784\uC2DC \uC5F0\uACB0 \uC815\uB9AC\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.", temporary.id, error.message));
      }
    };
    async function cgUnits(run, runId, cg) {
      const records = (await documents.list("gacha-forge", "unit")).filter((row) => row.id.startsWith(`${runId}:unit:`) && row.data.kind === "character");
      const result = [];
      for (const person of cg.characters ?? []) {
        const source = typeof person === "string" ? { name: person } : person;
        const matches = records.filter((row) => row.data.name?.normalize("NFC").toLowerCase() === source.name?.normalize("NFC").toLowerCase());
        if (matches.length > 1) throw new Error(`\uB3D9\uBA85\uC774\uC778 \uC678\uD615\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694: ${source.name}`);
        const unit = matches[0]?.data ?? (run.protagonist?.name === source.name ? run.protagonist : source.look ? { name: source.name, appearance: source.look } : null);
        if (!unit) throw new Error(`\uC678\uD615 \uB370\uC774\uD130\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: ${source.name}`);
        const back = source.back === true || source.back === "true";
        const fixed = tagList(back ? unit.backTags : unit.identityTags);
        const worn = run.images?.outfits !== false && [true, "true"].includes(run.images?.outfitCanon) ? (unit.outfits ?? []).find((outfit) => outfit.id === unit.wornOutfit) : null;
        const clothing = source.wearing ? source.wearing.split(",").map((value) => value.trim()).filter(Boolean) : tagList(worn?.outfitTags ?? unit.outfitTags);
        const tags = fixed.length ? [...fixed, ...clothing] : tagList(unit.imageTags);
        result.push({ ...unit, name: source.name, imageTags: tags, appearance: joinAppearance(back ? unit.backLine : unit.identityLine, source.wearing || worn?.outfitLine || worn?.prompt || unit.outfitLine) || unit.appearance, sceneAction: source.doing || "", sceneExpression: source.expression || "", backView: back, promptPosition: source.position });
      }
      return result;
    }
    const places = async (runId, entries, run) => {
      if (!imageConfig(run).backgrounds) return [];
      const known = (await raw(`${runId}:locations`))?.data?.places ?? {};
      return (entries ?? []).map((entry) => {
        const key = slug(entry.name);
        const match = Object.keys(known).find((value) => value === key || value.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === key.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) || key;
        return { ...entry, slug: match, url: known[match]?.url || "" };
      });
    };
    async function backgroundPlaces(runId, scene, run) {
      const known = (await raw(`${runId}:locations`))?.data?.places ?? {};
      const entries = /* @__PURE__ */ new Map();
      const add = (name, tags = "", fallback = false) => {
        if (typeof name !== "string" || !name.trim()) return;
        name = name.trim();
        const old = entries.get(name);
        entries.set(name, { name, tags: old?.tags || tags, fallback: !!old?.fallback || fallback });
      };
      for (const place of scene.data.places ?? []) add(place.name, place.tags);
      for (const segment of scene.data.segments ?? []) add(segment.place);
      if ((scene.data.segments ?? []).some((segment) => !segment.place) || !entries.size) {
        const chapter = await raw(`${runId}:chapter:${scene.data.chapter}`);
        const node = chapter?.data?.nodes?.filter((node2) => node2.type === "story")[scene.data.storyIndex];
        add(node?.location || scene.data.location, node?.locationTags || scene.data.locationTags, true);
      }
      const result = [];
      for (const entry of entries.values()) {
        const key = slug(entry.name);
        const match = Object.keys(known).find((value) => known[value]?.name?.normalize("NFC").toLowerCase() === entry.name.normalize("NFC").toLowerCase()) ?? (key && Object.hasOwn(known, key) ? key : null);
        const id2 = match ?? (key || `place-${(await signature(entry.name)).slice(0, 16)}`);
        result.push({ ...entry, slug: id2, tags: entry.tags || known[id2]?.tags || "", url: known[id2]?.url || "" });
      }
      return result;
    }
    await addon.register({ client: () => client, getRun, imageConfig, connection, dimensions: $r, queue: (connection2, task) => navigator.locks ? navigator.locks.request(`gacha-forge-image-request:${connection2.id}`, () => serial(task)) : serial(task), cgUnits, bannerPrompt: T0, scenePrompt: y0, places, backgroundPlaces });
    async function bannerArt(body) {
      if (!["char-standard", "char-featured"].includes(body.banner)) return null;
      const run = await getRun(body.runId), conn = await connection(run);
      const session = await raw(`${body.runId}:session`);
      const sequence = Math.max(1, Math.round(Number(session?.data.featured?.seq) || 1));
      const docId = `${body.runId}:banner:${body.banner === "char-standard" ? "standard" : `char:f${sequence}`}`;
      return serial(async () => {
        const doc = await read(docId);
        if (!doc) throw new Error("\uBC30\uB108 \uB370\uC774\uD130\uB97C \uBA3C\uC800 \uC0DD\uC131\uD574 \uC8FC\uC138\uC694.");
        if (!body.force && doc.data.art?.[body.banner]) return { ok: true, banner: body.banner, art: doc.data.art[body.banner], cached: true };
        const records = await documents.list("gacha-forge", "unit");
        let ids = body.banner === "char-featured" ? [doc.data.fiveId] : (doc.data.charIds ?? []).filter((id2) => records.find((row) => row.id === id2)?.data.rarity === 5);
        if (body.banner === "char-standard" && ids.length < 2) {
          for (let index = 1; index < sequence; index++) {
            const past = await raw(`${body.runId}:banner:char:f${index}`);
            if (past?.data.fiveId) ids.push(past.data.fiveId);
          }
        }
        ids = [...new Set(ids)].filter(Boolean).slice(0, 2);
        const people = ids.map((id2) => records.find((row) => row.id === id2)?.data.name).filter(Boolean);
        if (!people.length) throw new Error("\uBC30\uB108 \uC778\uBB3C \uB370\uC774\uD130\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
        const units = await cgUnits(run, body.runId, { characters: people });
        const config = imageConfig(run), profile = await client.portraitProfile(config.styleProfileId);
        const args = { connectionId: conn.id, units, scene: doc.data.bannerArt || "", profile, background: xf(units[0]) };
        const compiled = await addon.prepare(args, T0(args, profile), client);
        const size = $r(config);
        const image = await client.generatePrepared({ connectionId: conn.id, name: doc.data.title || "Banner", width: size.sceneWidth, height: size.sceneHeight, styleProfileId: config.styleProfileId, ...compiled });
        const stored = await client.uploadToGallery({ image, name: doc.data.title || "Banner", prompt: JSON.stringify(compiled), provider: conn.provider, model: conn.model });
        const saved = await documents.update({ ...doc, expectedRevision: doc.revision, data: { ...doc.data, art: { ...doc.data.art, [body.banner]: stored.url }, artRef: { ...doc.data.artRef, [body.banner]: `global-gallery:${stored.id}` } } });
        if (!saved) throw new Error("\uBC30\uB108 \uC774\uBBF8\uC9C0\uAC00 \uBC14\uB00C\uC5B4 \uC800\uC7A5\uC744 \uC911\uB2E8\uD588\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC774\uBBF8\uC9C0\uB294 \uC720\uC9C0\uB429\uB2C8\uB2E4.");
        return { ok: true, banner: body.banner, art: stored.url };
      });
    }
    return {
      addon,
      documents,
      raw,
      client,
      getRun,
      imageConfig,
      connection,
      cgUnits,
      serial,
      bannerArt,
      places,
      async invoke(path, body) {
        if (path === "/image-addon/layout") {
          if (body.save) await lock(async () => {
            const { button, panel } = body.layout ?? {};
            if (![button?.x, button?.y, panel?.x, panel?.y, panel?.w, panel?.h].every(Number.isFinite) || ![button.x, button.y, panel.x, panel.y].every((value) => value >= 0 && value <= 1) || panel.w < 240 || panel.w > 1600 || panel.h < 180 || panel.h > 1400) throw new Error("\uCC3D \uC704\uCE58\xB7\uD06C\uAE30\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
            await marinara2.storage.patch({ floatingLayout: { button: { x: button.x, y: button.y }, panel: { x: panel.x, y: panel.y, w: panel.w, h: panel.h } } });
          });
          return { ok: true, layout: (await marinara2.storage.get()).floatingLayout ?? {} };
        }
        const handler = routes.get(`/api/gacha-forge${path}`);
        if (!handler) throw new Error("\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uC774\uBBF8\uC9C0 \uB3C4\uAD6C \uC694\uCCAD\uC785\uB2C8\uB2E4.");
        return handler({ body });
      },
      async nativeEnabled(runId) {
        const config = await this.invoke("/image-addon/settings", {});
        const run = await getRun(runId);
        return config.settings.enabled && config.settings.nativeCharacters && run && nativeLimit(await connection(run)) > 0;
      }
    };
  }
  var joinAppearance = (...values) => values.filter(Boolean).join(", ");

  // gacha-external/ui.mjs
  function installUi(options = {}) {
    const floating = options.floating;
    const Element = customElements.get("marinara-capability-gacha-forge");
    if (!Element || Element.prototype._gfImageAddon) return;
    const prototype = Element.prototype;
    prototype._gfImageAddon = true;
    const render = prototype._renderBrowser;
    const node = (tag, text2, parent) => {
      const element = document.createElement(tag);
      if (text2 != null) element.textContent = text2;
      parent?.append(element);
      return element;
    };
    const call = async (host, path, body = {}) => {
      const result = await host._postJson(`/image-addon/${path}`, body);
      if (!result?.ok) throw new Error(result?.error || "\uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC774\uBBF8\uC9C0\uB294 \uC720\uC9C0\uB429\uB2C8\uB2E4.");
      return result;
    };
    function currentScene(host) {
      const runId = host._run?.runId;
      const active = host._activeStoryNode;
      if (!runId || !active) return "";
      const part = Number(host._bondPart) || 1;
      const chapter = host._bondUnit ? `bond-${String(host._bondUnit).split(":unit:")[1] || host._bondUnit}${part > 1 ? `-${part}` : ""}` : active.chapter;
      return `${runId}:beat:${chapter}:${active.storyIndex}`;
    }
    async function open(host) {
      if (options.openEditor) return options.openEditor(host, { call, currentScene, node });
      const runId = host._run?.runId;
      if (!runId || host._gfImageDialog?.isConnected) return;
      const focusBefore = host._root.activeElement;
      const dialog = node("dialog", null, host._root);
      host._gfImageDialog = dialog;
      dialog.className = "gf-image-dialog";
      dialog.setAttribute("aria-label", "\uC7A5\uBA74 \uC774\uBBF8\uC9C0 \uB3C4\uAD6C");
      const style = node("style", null, dialog);
      style.textContent = ".gf-image-dialog{box-sizing:border-box;width:min(720px,94vw);max-height:88vh;overflow:auto;background:var(--ink-2,#172334);color:var(--text,#f3f6fa);border:1px solid #7c8da5;border-radius:12px;padding:20px;font:14px/1.5 system-ui}.gf-image-dialog::backdrop{background:#0009}.gf-image-dialog label{display:block;margin:10px 0}.gf-image-dialog textarea,.gf-image-dialog select{box-sizing:border-box;width:100%;padding:8px;color:#fafafa;background:#142032;border:1px solid #71839b;border-radius:5px;font:inherit}.gf-image-dialog textarea{min-height:76px;resize:vertical}.gf-image-dialog button{padding:8px 12px;margin:6px 8px 6px 0;cursor:pointer}.gf-image-dialog input[type=number]{width:80px}.gf-image-dialog [role=status]{white-space:pre-wrap}.gf-image-dialog fieldset{margin:12px 0;border:1px solid #71839b}.gf-image-dialog .gf-image-actions{display:flex;flex-wrap:wrap;gap:6px}";
      node("h2", "\uC7A5\uBA74 \uC774\uBBF8\uC9C0 \uB3C4\uAD6C", dialog);
      node("p", "\uC800\uC7A5\uB41C \uD604\uC7AC\xB7\uACFC\uAC70 \uC7A5\uBA74\uC758 CG\uC640 \uBC30\uACBD\uC744 \uB2E4\uC2DC \uC0DD\uC131\uD569\uB2C8\uB2E4. \uC774\uBBF8\uC9C0 \uC0DD\uC131 \uBE44\uC6A9\uC774 \uBC1C\uC0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", dialog);
      const status = node("p", "\uBD88\uB7EC\uC624\uB294 \uC911\u2026", dialog);
      status.setAttribute("role", "status");
      const content = node("div", null, dialog);
      const close = node("button", "\uB2EB\uAE30", dialog);
      close.type = "button";
      close.onclick = () => dialog.close();
      dialog.addEventListener("close", () => {
        dialog.remove();
        focusBefore?.focus();
      });
      dialog.addEventListener("cancel", (event) => {
        if (close.disabled) event.preventDefault();
      });
      dialog.addEventListener("keydown", (event) => event.stopPropagation());
      dialog.addEventListener("click", (event) => event.stopPropagation());
      if (floating) {
        floating.decorateDialog(host, dialog, { close, status, content });
        dialog.show();
      } else dialog.showModal();
      try {
        const config = await call(host, "settings");
        const settingsBox = floating ? node("details", null, content) : content;
        if (floating) node("summary", "\uD655\uC7A5 \uC124\uC815", settingsBox);
        const checkbox = (label2, checked) => {
          const row = node("label", null, settingsBox);
          const input = node("input", null, row);
          input.type = "checkbox";
          input.checked = checked;
          row.append(document.createTextNode(` ${label2}`));
          return input;
        };
        const enabled = checkbox("\uC774\uBBF8\uC9C0 \uD655\uC7A5 \uCF1C\uAE30", config.settings.enabled);
        const native = checkbox("\uC9C0\uC6D0\uB418\uB294 NAI \uBAA8\uB378\uC5D0\uC11C \uC778\uBB3C\uBCC4 \uD504\uB86C\uD504\uD2B8 \uC0AC\uC6A9", config.settings.nativeCharacters);
        const save = node("button", "\uC124\uC815 \uC800\uC7A5", settingsBox);
        save.onclick = async () => {
          save.disabled = true;
          try {
            await call(host, "settings", { save: true, enabled: enabled.checked, nativeCharacters: native.checked });
            status.textContent = "\uC124\uC815\uC744 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4.";
          } catch (error) {
            status.textContent = error.message;
          } finally {
            save.disabled = false;
          }
        };
        const scenes = await call(host, "scenes", { runId });
        if (!scenes.scenes.length) {
          status.textContent = "\uC800\uC7A5\uB41C \uC7A5\uBA74\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC2A4\uD1A0\uB9AC \uC7A5\uBA74\uC744 \uBA3C\uC800 \uC5F4\uC5B4 \uC8FC\uC138\uC694.";
          return;
        }
        const label = node("label", "\uC7A5\uBA74", content);
        const select = node("select", null, label);
        for (const scene of scenes.scenes) {
          const readable = `${scene.chapter ?? "?"}\uC7A5 \xB7 \uC7A5\uBA74 ${Number.isFinite(Number(scene.storyIndex)) ? Number(scene.storyIndex) + 1 : "?"}`;
          const option = node("option", floating ? `${scene.id === currentScene(host) ? "\uD604\uC7AC \xB7 " : ""}${readable}` : `${scene.title} \xB7 ${scene.id.slice(runId.length + 6)}`, select);
          option.value = scene.id;
        }
        if (scenes.scenes.some((scene) => scene.id === currentScene(host))) select.value = currentScene(host);
        const targets = node("div", null, content);
        const editor = node("div", null, content);
        let selectionVersion = 0;
        async function showEditor(kind, slug2) {
          const request = ++selectionVersion;
          status.textContent = "\uD504\uB86C\uD504\uD2B8\uB97C \uC900\uBE44\uD558\uB294 \uC911\u2026";
          editor.replaceChildren();
          dialog.querySelectorAll("[data-gf-submit]").forEach((button) => button.remove());
          targets.querySelectorAll("button").forEach((button) => {
            button.disabled = true;
          });
          try {
            const sceneId = select.value;
            const plan = await call(host, "preview", { runId, sceneId, kind, slug: slug2 });
            if (request !== selectionVersion || !dialog.isConnected) return;
            editor.replaceChildren();
            node("h3", plan.name, editor);
            node("p", `${plan.notice} ${plan.native ? "NAI \uB124\uC774\uD2F0\uBE0C \uC778\uBB3C\uBCC4 \uC804\uC1A1" : "\uAE30\uC874 \uC774\uBBF8\uC9C0 \uC0DD\uC131 \uACBD\uB85C"}`, editor);
            const field = (title, value, parent = editor) => {
              const label2 = node("label", title, parent);
              const area = node("textarea", null, label2);
              area.value = value ?? "";
              return area;
            };
            const prompt = field("\uACF5\uD1B5 \uC7A5\uBA74 \uD504\uB86C\uD504\uD2B8", plan.prompt);
            const negative = field("\uACF5\uD1B5 \uB124\uAC70\uD2F0\uBE0C \uD504\uB86C\uD504\uD2B8", plan.negativePrompt);
            const characters = plan.characterPrompts.map((character) => {
              const box = node("fieldset", null, editor);
              node("legend", character.name, box);
              const positive = field("\uC678\uD615\xB7\uBCF5\uC7A5\xB7\uB3D9\uC791\xB7\uD45C\uC815", character.prompt, box);
              const negative2 = field("\uC774 \uC778\uBB3C\uC758 \uB124\uAC70\uD2F0\uBE0C", character.negativePrompt, box);
              const coordinate = (key) => {
                const label2 = node("label", `${key.toUpperCase()} \uC704\uCE58 (0~1)`, box);
                const input = node("input", null, label2);
                input.type = "number";
                input.min = "0";
                input.max = "1";
                input.step = "0.01";
                input.value = character.position[key];
                return input;
              };
              return { name: character.name, positive, negative: negative2, x: coordinate("x"), y: coordinate("y") };
            });
            const submit = node("button", "\uC774 \uD504\uB86C\uD504\uD2B8\uB85C \uC7AC\uC0DD\uC131", editor);
            floating?.placeSubmit(host, submit, dialog);
            submit.onclick = async () => {
              submit.disabled = true;
              select.disabled = true;
              close.disabled = !floating;
              targets.querySelectorAll("button").forEach((button) => {
                button.disabled = true;
              });
              status.textContent = "\uC774\uBBF8\uC9C0\uB97C \uC0DD\uC131\uD558\uB294 \uC911\u2026 \uAE30\uC874 \uC774\uBBF8\uC9C0\uC640 \uC2A4\uD1A0\uB9AC\uB294 \uC720\uC9C0\uB429\uB2C8\uB2E4.";
              try {
                const result = await call(host, "generate", { token: plan.token, prompt: prompt.value, negativePrompt: negative.value, characterPrompts: characters.map((character) => ({ name: character.name, prompt: character.positive.value, negativePrompt: character.negative.value, position: { x: Number(character.x.value), y: Number(character.y.value) } })) });
                if (options.isActive?.() !== false && host._run?.runId === runId && currentScene(host) === sceneId && host._beatState === "ready") {
                  if (kind === "cg" && host._beatCg) host._beatCg = { ...host._beatCg, url: result.url };
                  if (kind === "background") {
                    const place = (await call(host, "scene", { runId, sceneId })).places.find((place2) => place2.slug === slug2);
                    if (place) host._beatPlaces = { ...host._beatPlaces ?? {}, [place.name]: result.url };
                  }
                  host._renderKey = null;
                  host._renderBrowser();
                }
                status.textContent = "\uAC8C\uC784\uC5D0 \uC0C8 \uC774\uBBF8\uC9C0\uB97C \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC5F4\uC5B4\uB3C4 \uC774 \uC7A5\uBA74\uC5D0 \uC720\uC9C0\uB429\uB2C8\uB2E4. \uC774\uC804 \uC774\uBBF8\uC9C0\uB294 \uAC24\uB7EC\uB9AC\uC5D0 \uB0A8\uC544 \uC788\uC2B5\uB2C8\uB2E4.";
                submit.remove();
              } catch (error) {
                status.textContent = `${error.message}
\uAE30\uC874 \uC774\uBBF8\uC9C0\uC640 \uC2A4\uD1A0\uB9AC\uB294 \uC720\uC9C0\uB429\uB2C8\uB2E4.`;
                submit.disabled = false;
              } finally {
                select.disabled = false;
                close.disabled = false;
                targets.querySelectorAll("button").forEach((button) => {
                  button.disabled = false;
                });
              }
            };
            status.textContent = "\uC0DD\uC131 \uC804\uC5D0 \uD504\uB86C\uD504\uD2B8\uC640 \uC778\uBB3C \uC704\uCE58\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.";
          } catch (error) {
            if (request === selectionVersion) status.textContent = error.message;
          } finally {
            if (request === selectionVersion) targets.querySelectorAll("button").forEach((button) => {
              button.disabled = false;
            });
          }
        }
        async function loadTargets() {
          const request = ++selectionVersion;
          targets.replaceChildren();
          editor.replaceChildren();
          dialog.querySelectorAll("[data-gf-submit]").forEach((button) => button.remove());
          try {
            const info = await call(host, "scene", { runId, sceneId: select.value });
            if (request !== selectionVersion || !dialog.isConnected) return;
            if (info.cg) {
              const button = node("button", "CG \uC7AC\uC0DD\uC131 \xB7 \uD504\uB86C\uD504\uD2B8 \uD655\uC778", targets);
              button.onclick = () => showEditor("cg");
            }
            for (const place of info.places) {
              const button = node("button", `\uBC30\uACBD \uC7AC\uC0DD\uC131: ${place.name}`, targets);
              button.onclick = () => showEditor("background", place.slug);
            }
            status.textContent = info.cg || info.places.length ? "\uC7AC\uC0DD\uC131\uD560 \uC774\uBBF8\uC9C0\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694." : "\uC774 \uC7A5\uBA74\uC5D0\uB294 CG\xB7\uBC30\uACBD \uC0DD\uC131 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.";
          } catch (error) {
            status.textContent = error.message;
          }
        }
        select.onchange = loadTargets;
        await loadTargets();
      } catch (error) {
        status.textContent = error.message;
      }
    }
    prototype._renderBrowser = function(...args) {
      const dialog = this._gfImageDialog;
      const wasOpen = dialog?.isConnected && dialog.open;
      const focused = wasOpen ? this._root.activeElement : null;
      const result = render.apply(this, args);
      if (this._run?.runId && floating) floating.render(this, () => open(this));
      else if (this._run?.runId && !this._root.querySelector("[data-gf-image-tools]")) {
        const button = node("button", "\uC774\uBBF8\uC9C0 \uB3C4\uAD6C", this._root);
        button.type = "button";
        button.dataset.gfImageTools = "";
        button.style.cssText = "position:absolute;right:12px;bottom:12px;z-index:80;padding:8px 12px;border-radius:6px;border:1px solid #8b9bb0;background:#142032;color:#fff;cursor:pointer;font:14px system-ui";
        button.onclick = (event) => {
          event.stopPropagation();
          open(this);
        };
      }
      if (wasOpen && !dialog.isConnected) {
        dialog.removeAttribute("open");
        this._root.append(dialog);
        floating ? dialog.show() : dialog.showModal();
        focused?.focus();
      }
      return result;
    };
  }

  // gacha-external/floating-controls.mjs
  function createFloatingControls({ load, save, isActive = () => true }) {
    const hosts = /* @__PURE__ */ new Map();
    let disposed = false;
    const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
    const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
    const dimensions = () => ({ width: document.documentElement.clientWidth || innerWidth, height: innerHeight });
    const css = `
    [data-gf-image-tools]{position:fixed;z-index:1001;display:grid;place-items:center;width:48px;height:48px;padding:0;border:1px solid #8b9bb0;border-radius:50%;background:#142032;color:#fff;touch-action:none;user-select:none;box-shadow:0 3px 12px #0005;cursor:pointer}
    [data-gf-image-tools] svg{width:23px;height:23px;pointer-events:none}
    .gf-image-dialog.gf-floating-window{position:fixed;z-index:1000;margin:0;padding:0;max-width:none;max-height:none;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 32px #0007}
    .gf-floating-window:not([open]){display:none}
    .gf-floating-head{display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid #71839b;flex-shrink:0}
    .gf-floating-window .gf-window-move{flex:1;min-width:0;text-align:left;border:0;background:transparent;color:inherit;font:inherit;font-weight:600;touch-action:none;cursor:move;margin:0}
    .gf-floating-window .gf-window-close{margin:0;background:transparent;color:inherit;border:1px solid #71839b;border-radius:5px}
    .gf-floating-body{flex:1;min-height:0;overflow:auto;padding:4px 16px 16px;overscroll-behavior:contain}
    .gf-floating-footer{flex-shrink:0;padding:8px 42px 10px 16px;border-top:1px solid #71839b}
    .gf-floating-footer [role=status]{margin:0 0 6px}
    .gf-floating-footer:empty{display:none}
    .gf-floating-window .gf-window-resize{position:absolute;right:0;bottom:0;width:32px;height:32px;padding:0;margin:0;border:0;background:transparent;color:inherit;cursor:nwse-resize;touch-action:none}
    .gf-floating-window button:disabled{cursor:default;opacity:.6}
    .gf-floating-window details{margin:10px 0}
    .gf-floating-window summary{cursor:pointer}
    .gf-floating-window button{min-height:40px}
    @media(pointer:coarse){.gf-floating-window .gf-window-resize{width:44px;height:44px}.gf-floating-footer{padding-right:50px}.gf-floating-window textarea,.gf-floating-window select{font-size:16px}}
  `;
    function geometry(saved = {}) {
      return { button: { x: clamp(finite(saved.button?.x, 0.96), 0, 1), y: clamp(finite(saved.button?.y, 0.86), 0, 1) }, panel: { x: clamp(finite(saved.panel?.x, 0.93), 0, 1), y: clamp(finite(saved.panel?.y, 0.15), 0, 1), w: clamp(finite(saved.panel?.w, 400), 280, 1600), h: clamp(finite(saved.panel?.h, 560), 240, 1400) } };
    }
    function box(state, key) {
      const view = dimensions(), value = state.layout[key];
      const w = key === "button" ? 48 : clamp(value.w, Math.min(280, view.width - 16), view.width - 16);
      const h = key === "button" ? 48 : clamp(value.h, Math.min(240, view.height - 16), view.height - 16);
      return { x: 8 + value.x * Math.max(0, view.width - w - 16), y: 8 + value.y * Math.max(0, view.height - h - 16), w, h };
    }
    function position(state) {
      for (const [key, element] of [["button", state.button], ["panel", state.dialog]]) {
        if (!element) continue;
        const b = box(state, key);
        Object.assign(element.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
      }
    }
    function persist(state) {
      state.changed++;
      state.saving = state.saving.catch(() => {
      }).then(() => save(structuredClone(state.layout)));
      state.saving.catch((error) => {
        if (state.status?.isConnected) state.status.textContent = `\uCC3D \uC704\uCE58\uB97C \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4: ${error.message}`;
      });
    }
    function attach(state, element, key, resize = false, toggle = null, eventSignal = null) {
      let drag = null;
      const signal = eventSignal ?? state.controller.signal;
      element.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || drag) return;
        if (!toggle) event.preventDefault();
        element.setPointerCapture(event.pointerId);
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, initial: box(state, key), moved: false };
      }, { signal });
      element.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.id) return;
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 6) return;
        drag.moved = true;
        const view = dimensions(), b = { ...drag.initial };
        if (resize) {
          b.w = clamp(b.w + dx, Math.min(280, view.width - 16), view.width - b.x - 8);
          b.h = clamp(b.h + dy, Math.min(240, view.height - 16), view.height - b.y - 8);
        } else {
          b.x = clamp(b.x + dx, 8, view.width - b.w - 8);
          b.y = clamp(b.y + dy, 8, view.height - b.h - 8);
        }
        Object.assign(state.layout[key], { x: (b.x - 8) / Math.max(1, view.width - b.w - 16), y: (b.y - 8) / Math.max(1, view.height - b.h - 16) }, resize ? { w: b.w, h: b.h } : {});
        position(state);
      }, { signal });
      const finish = (event) => {
        if (!drag || event.pointerId !== drag.id) return;
        const tapped = toggle && !drag.moved && event.type === "pointerup" && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6;
        const moved = drag.moved;
        drag = null;
        if (moved) persist(state);
        if (tapped && !disposed && isActive()) toggle();
      };
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) element.addEventListener(name, finish, { signal });
      if (toggle) element.addEventListener("click", (event) => {
        event.stopPropagation();
        if (event.detail !== 0) {
          event.preventDefault();
          return;
        }
        if (!disposed && isActive()) toggle();
      }, { signal });
      element.addEventListener("keydown", (event) => {
        const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
        if (!delta) return;
        event.preventDefault();
        event.stopPropagation();
        const step = event.shiftKey ? 10 : 2, view = dimensions(), b = box(state, key);
        if (resize) {
          b.w = clamp(b.w + delta[0] * step, Math.min(280, view.width - 16), view.width - b.x - 8);
          b.h = clamp(b.h + delta[1] * step, Math.min(240, view.height - 16), view.height - b.y - 8);
        } else {
          b.x = clamp(b.x + delta[0] * step, 8, view.width - b.w - 8);
          b.y = clamp(b.y + delta[1] * step, 8, view.height - b.h - 8);
        }
        Object.assign(state.layout[key], { x: (b.x - 8) / Math.max(1, view.width - b.w - 16), y: (b.y - 8) / Math.max(1, view.height - b.h - 16) }, resize ? { w: b.w, h: b.h } : {});
        position(state);
        persist(state);
      }, { signal });
    }
    function get(host) {
      if (hosts.has(host)) return hosts.get(host);
      const state = { host, layout: geometry(), controller: new AbortController(), saving: Promise.resolve(), changed: 0 };
      hosts.set(host, state);
      state.style = document.createElement("style");
      state.style.dataset.gfFloatingStyle = "";
      state.style.textContent = css;
      window.addEventListener("resize", () => position(state), { signal: state.controller.signal });
      load().then((value) => {
        if (!disposed && !state.changed) {
          state.layout = geometry(value);
          position(state);
        }
      }).catch(() => {
      });
      return state;
    }
    return {
      render(host, open) {
        if (disposed) return;
        const state = get(host);
        if (!state.style.isConnected) host._root.append(state.style);
        if (!state.button) {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.gfImageTools = "";
          button.setAttribute("aria-label", "\uC774\uBBF8\uC9C0 \uB3C4\uAD6C");
          button.title = "\uC774\uBBF8\uC9C0 \uB3C4\uAD6C \xB7 \uB4DC\uB798\uADF8\uD558\uC5EC \uC774\uB3D9";
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("viewBox", "0 0 24 24");
          svg.setAttribute("fill", "none");
          svg.setAttribute("stroke", "currentColor");
          svg.setAttribute("stroke-width", "1.8");
          svg.setAttribute("aria-hidden", "true");
          for (const [tag, attrs] of [["rect", { x: 3, y: 3, width: 18, height: 18, rx: 3 }], ["circle", { cx: 8, cy: 8, r: 1.5 }], ["path", { d: "M3 16l5-5 4 4 3-3 6 6" }]]) {
            const node = document.createElementNS(svg.namespaceURI, tag);
            for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
            svg.append(node);
          }
          button.append(svg);
          state.button = button;
          button.addEventListener("pointerdown", (event) => event.stopPropagation(), { signal: state.controller.signal });
          button.addEventListener("keydown", (event) => event.stopPropagation(), { signal: state.controller.signal });
          attach(state, button, "button", false, () => host._gfImageDialog?.isConnected ? host._gfImageDialog.close() : open());
        }
        if (!state.button.isConnected) host._root.append(state.button);
        state.button.setAttribute("aria-expanded", String(!!host._gfImageDialog?.isConnected));
        position(state);
      },
      decorateDialog(host, dialog, { close, status, content }) {
        const state = get(host);
        state.dialog = dialog;
        state.status = status;
        const dialogController = new AbortController();
        state.controller.signal.addEventListener("abort", () => dialogController.abort(), { once: true, signal: dialogController.signal });
        dialog.classList.add("gf-floating-window");
        const heading = dialog.querySelector("h2"), intro = heading.nextElementSibling;
        const head = document.createElement("div");
        head.className = "gf-floating-head";
        const move = document.createElement("button");
        move.type = "button";
        move.className = "gf-window-move";
        move.textContent = "\uC774\uBBF8\uC9C0 \uD3B8\uC9D1";
        move.setAttribute("aria-label", "\uC774\uBBF8\uC9C0 \uD3B8\uC9D1\uCC3D \uC774\uB3D9");
        close.classList.add("gf-window-close");
        head.append(move, close);
        heading.replaceWith(head);
        const body = document.createElement("div");
        body.className = "gf-floating-body";
        head.after(body);
        body.append(intro, content);
        const footer = document.createElement("div");
        footer.className = "gf-floating-footer";
        footer.append(status);
        dialog.append(footer);
        state.footer = footer;
        const resize = document.createElement("button");
        resize.type = "button";
        resize.className = "gf-window-resize";
        resize.textContent = "\u2198";
        resize.setAttribute("aria-label", "\uC774\uBBF8\uC9C0 \uD3B8\uC9D1\uCC3D \uD06C\uAE30 \uC870\uC808");
        dialog.append(resize);
        attach(state, move, "panel", false, null, dialogController.signal);
        attach(state, resize, "panel", true, null, dialogController.signal);
        dialog.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            dialog.close();
          }
        }, { signal: dialogController.signal });
        dialog.addEventListener("close", () => {
          dialogController.abort();
          if (state.dialog === dialog) {
            state.dialog = null;
            state.button?.setAttribute("aria-expanded", "false");
          }
        }, { once: true });
        state.button?.setAttribute("aria-expanded", "true");
        position(state);
      },
      placeSubmit(host, submit, dialog) {
        const state = hosts.get(host);
        if (state?.dialog !== dialog || !state?.footer?.isConnected) return;
        state.footer.querySelectorAll("[data-gf-submit]").forEach((node) => node.remove());
        submit.dataset.gfSubmit = "";
        state.footer.append(submit);
      },
      async dispose() {
        disposed = true;
        for (const state of hosts.values()) {
          state.controller.abort();
          state.style.remove();
          state.button?.remove();
          state.dialog?.remove();
          await state.saving.catch(() => {
          });
        }
        hosts.clear();
      }
    };
  }

  // gacha-external/image-editor.mjs
  async function openImageEditor(host, { floating, isActive, call, currentScene, node }) {
    const runId = host._run?.runId;
    if (!runId || host._gfImageDialog?.isConnected) return;
    const focusBefore = host._root.activeElement;
    const dialog = node("dialog", null, host._root);
    host._gfImageDialog = dialog;
    dialog.className = "gf-image-dialog";
    dialog.setAttribute("aria-label", "\uC7A5\uBA74 \uC774\uBBF8\uC9C0 \uB3C4\uAD6C");
    const style = node("style", null, dialog);
    style.textContent = `.gf-image-dialog{box-sizing:border-box;background:var(--ink-2,#172334);color:var(--text,#f3f6fa);border:1px solid #7c8da5;border-radius:12px;font:14px/1.5 system-ui}.gf-image-dialog label{display:block;margin:10px 0}.gf-image-dialog textarea,.gf-image-dialog select{box-sizing:border-box;width:100%;padding:8px;color:#fafafa;background:#142032;border:1px solid #71839b;border-radius:5px;font:inherit}.gf-image-dialog textarea{min-height:76px;resize:vertical}.gf-image-dialog button{padding:8px 12px;cursor:pointer;font:inherit;border:1px solid #71839b;border-radius:5px;background:#24364a;color:inherit}.gf-image-dialog input[type=number]{width:80px}.gf-image-dialog fieldset{margin:12px 0;border:1px solid #71839b}.gf-image-dialog [role=status]{white-space:pre-wrap}.gf-image-dialog [role=status]:empty{display:none}.gf-picture-list{display:grid;gap:8px}.gf-image-dialog .gf-picture-card{display:flex;align-items:center;gap:10px;text-align:left;width:100%}.gf-picture-card[aria-pressed=true]{outline:2px solid #b9d4ff;outline-offset:-2px}.gf-picture-card img{width:80px;height:50px;object-fit:cover;border-radius:3px}.gf-selected-image img{display:block;width:100%;max-height:160px;object-fit:contain;margin:10px 0;background:#101b28}.gf-picture-title{font-weight:600;margin:12px 0 8px}.gf-image-actions{display:flex;flex-wrap:wrap;gap:8px}.gf-image-actions button{flex:1}.gf-image-dialog button:disabled{opacity:.6;cursor:default}`;
    node("h2", "\uC774\uBBF8\uC9C0 \uD3B8\uC9D1", dialog);
    const intro = node("p", "", dialog);
    intro.hidden = true;
    const status = node("p", "\uBD88\uB7EC\uC624\uB294 \uC911\u2026", dialog);
    status.setAttribute("role", "status");
    const content = node("div", null, dialog);
    const close = node("button", "\uB2EB\uAE30", dialog);
    close.type = "button";
    close.onclick = () => dialog.close();
    floating.decorateDialog(host, dialog, { close, status, content });
    dialog.show();
    dialog.addEventListener("click", (event) => event.stopPropagation());
    dialog.addEventListener("keydown", (event) => event.stopPropagation());
    dialog.addEventListener("close", () => {
      dialog.remove();
      focusBefore?.focus();
    });
    try {
      let actionsState = function() {
        regenerate.disabled = inspect.disabled = !selection || busy;
        select.disabled = busy;
        targets.querySelectorAll("button").forEach((button) => {
          button.disabled = busy;
        });
      }, picture = function(url, parent, alt, thumbnail = false) {
        if (!url) return;
        const img = node("img", null, parent);
        img.alt = alt;
        img.src = url;
        img.onerror = () => {
          img.hidden = true;
        };
        img.onload = () => {
          img.hidden = false;
        };
        if (thumbnail) img.loading = "lazy";
        return img;
      }, drawSelection = function() {
        selectedView.replaceChildren();
        if (!selection) return;
        const title = node("div", selection.label, selectedView);
        title.className = "gf-picture-title";
        picture(selection.url, selectedView, `\uC120\uD0DD\uD55C \uC774\uBBF8\uC9C0: ${selection.label}`);
      }, choose = function(target) {
        if (busy) return;
        sequence++;
        selection = target;
        fields = null;
        editor.replaceChildren();
        editor.hidden = true;
        inspect.setAttribute("aria-expanded", "false");
        status.textContent = "";
        for (const button of targets.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset.gfTargetKind === target.kind && (button.dataset.gfTargetSlug || "") === (target.slug || "")));
        drawSelection();
        actionsState();
      }, drawFields = function(plan) {
        editor.replaceChildren();
        editor.hidden = false;
        const field = (title, value, parent = editor) => {
          const label = node("label", title, parent), area = node("textarea", null, label);
          area.value = value ?? "";
          return area;
        };
        const prompt = field(selection.kind === "background" ? "\uBC30\uACBD \uD504\uB86C\uD504\uD2B8 (\uC778\uBB3C \uC5C6\uC74C)" : "\uACF5\uD1B5 \uC7A5\uBA74 \uD504\uB86C\uD504\uD2B8", plan.prompt);
        const negative = field(selection.kind === "background" ? "\uBC30\uACBD \uB124\uAC70\uD2F0\uBE0C \uD504\uB86C\uD504\uD2B8" : "\uACF5\uD1B5 \uB124\uAC70\uD2F0\uBE0C \uD504\uB86C\uD504\uD2B8", plan.negativePrompt);
        const characters = plan.characterPrompts.map((character) => {
          const box = node("fieldset", null, editor);
          node("legend", character.name, box);
          const positive = field("\uC678\uD615\xB7\uBCF5\uC7A5\xB7\uB3D9\uC791\xB7\uD45C\uC815", character.prompt, box), negative2 = field("\uC774 \uC778\uBB3C\uC758 \uB124\uAC70\uD2F0\uBE0C", character.negativePrompt, box);
          const coordinate = (key) => {
            const label = node("label", `${key.toUpperCase()} \uC704\uCE58 (0~1)`, box), input = node("input", null, label);
            Object.assign(input, { type: "number", min: "0", max: "1", step: "0.01", value: character.position[key] });
            return input;
          };
          return { name: character.name, positive, negative: negative2, x: coordinate("x"), y: coordinate("y") };
        });
        fields = { native: plan.native, prompt, negative, characters };
      };
      const config = await call(host, "settings");
      if (!dialog.isConnected) return;
      const settingsBox = node("details", null, content);
      node("summary", "\uD655\uC7A5 \uC124\uC815", settingsBox);
      const checkbox = (text2, checked) => {
        const label = node("label", null, settingsBox), input = node("input", null, label);
        input.type = "checkbox";
        input.checked = checked;
        label.append(document.createTextNode(` ${text2}`));
        return input;
      };
      const enabled = checkbox("\uC774\uBBF8\uC9C0 \uD655\uC7A5 \uCF1C\uAE30", config.settings.enabled), native = checkbox("\uC9C0\uC6D0\uB418\uB294 NAI \uBAA8\uB378\uC5D0\uC11C \uC778\uBB3C\uBCC4 \uD504\uB86C\uD504\uD2B8 \uC0AC\uC6A9", config.settings.nativeCharacters);
      const save = node("button", "\uC124\uC815 \uC800\uC7A5", settingsBox);
      save.type = "button";
      save.onclick = async () => {
        save.disabled = true;
        try {
          await call(host, "settings", { save: true, enabled: enabled.checked, nativeCharacters: native.checked });
          status.textContent = "";
        } catch (error) {
          status.textContent = error.message;
        } finally {
          save.disabled = false;
        }
      };
      const scenes = await call(host, "scenes", { runId });
      if (!scenes.scenes.length) {
        status.textContent = "\uC800\uC7A5\uB41C \uC2A4\uD1A0\uB9AC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.";
        return;
      }
      const sceneLabel = node("label", "\uC7A5\uBA74", content), select = node("select", null, sceneLabel);
      select.setAttribute("aria-label", "\uC7A5\uBA74");
      for (const scene of scenes.scenes) {
        const chapter = Number.isFinite(Number(scene.chapter)) ? `${scene.chapter}\uC7A5` : "\uC778\uC5F0 \uC774\uC57C\uAE30";
        const title = `${scene.id === currentScene(host) ? "\uD604\uC7AC \xB7 " : ""}${chapter} \xB7 ${scene.title}${scene.places?.length ? ` \xB7 ${scene.places.join(", ")}` : ""}`;
        node("option", title, select).value = scene.id;
      }
      if (scenes.scenes.some((scene) => scene.id === currentScene(host))) select.value = currentScene(host);
      const targets = node("div", null, content);
      targets.className = "gf-picture-list";
      const selectedView = node("div", null, content);
      selectedView.className = "gf-selected-image";
      const editor = node("div", null, content);
      editor.hidden = true;
      const actions = node("div", null, content);
      actions.className = "gf-image-actions";
      const regenerate = node("button", "\uC7AC\uC0DD\uC131", actions), inspect = node("button", "\uD504\uB86C\uD504\uD2B8 \uD655\uC778", actions);
      inspect.setAttribute("aria-expanded", "false");
      regenerate.type = inspect.type = "button";
      floating.placeSubmit(host, actions, dialog);
      let selection = null, fields = null, sequence = 0, busy = false;
      const preview = (target) => call(host, "preview", { runId, sceneId: target.sceneId, kind: target.kind, slug: target.slug });
      inspect.onclick = async () => {
        if (!selection || busy) return;
        if (fields) {
          editor.hidden = !editor.hidden;
          inspect.setAttribute("aria-expanded", String(!editor.hidden));
          return;
        }
        const target = selection, request = sequence;
        busy = true;
        actionsState();
        try {
          const plan = await preview(target);
          if (request !== sequence || !dialog.isConnected) return;
          drawFields(plan);
          inspect.setAttribute("aria-expanded", "true");
          status.textContent = "";
        } catch (error) {
          status.textContent = error.message;
        } finally {
          busy = false;
          actionsState();
        }
      };
      regenerate.onclick = async () => {
        if (!selection || busy) return;
        const target = selection;
        busy = true;
        actionsState();
        regenerate.textContent = "\uC7AC\uC0DD\uC131 \uC911\u2026";
        status.textContent = "";
        try {
          const plan = await preview(target);
          if (fields && (fields.native !== plan.native || JSON.stringify(fields.characters.map((person) => person.name)) !== JSON.stringify(plan.characterPrompts.map((person) => person.name)))) throw new Error("\uC778\uBB3C \uB610\uB294 \uC5F0\uACB0 \uC124\uC815\uC774 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4. \uC774\uBBF8\uC9C0\uB97C \uB2E4\uC2DC \uC120\uD0DD\uD558\uACE0 \uD504\uB86C\uD504\uD2B8\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
          const edited = fields ? { prompt: fields.prompt.value, negativePrompt: fields.negative.value, characterPrompts: fields.characters.map((person) => ({ name: person.name, prompt: person.positive.value, negativePrompt: person.negative.value, position: { x: Number(person.x.value), y: Number(person.y.value) } })) } : plan;
          const result = await call(host, "generate", { ...edited, token: plan.token });
          target.url = result.url;
          drawSelection();
          const card = targets.querySelector(`[data-gf-target-index="${target.index}"]`), thumb = card?.querySelector("img");
          if (thumb) {
            thumb.hidden = false;
            thumb.src = result.url;
          } else if (card) card.prepend(picture(result.url, card, "", true));
          if (isActive() && host._run?.runId === runId && currentScene(host) === target.sceneId && host._beatState === "ready") {
            if (target.kind === "cg" && host._beatCg) host._beatCg = { ...host._beatCg, url: result.url };
            if (target.kind === "background") {
              host._beatPlaces = { ...host._beatPlaces ?? {}, [target.name]: result.url };
              if (target.fallback) host._gfImageSceneBackground = { sceneId: target.sceneId, url: result.url };
            }
            host._renderKey = null;
            host._renderBrowser();
          }
          status.textContent = "";
        } catch (error) {
          status.textContent = `${error.message}
\uAE30\uC874 \uC774\uBBF8\uC9C0\uC640 \uC2A4\uD1A0\uB9AC\uB294 \uC720\uC9C0\uB429\uB2C8\uB2E4.`;
        } finally {
          busy = false;
          regenerate.textContent = "\uC7AC\uC0DD\uC131";
          actionsState();
        }
      };
      async function loadTargets() {
        const request = ++sequence, sceneId = select.value;
        selection = null;
        fields = null;
        editor.replaceChildren();
        editor.hidden = true;
        inspect.setAttribute("aria-expanded", "false");
        selectedView.replaceChildren();
        targets.replaceChildren();
        actionsState();
        status.textContent = "";
        try {
          const info = await call(host, "scene", { runId, sceneId });
          if (request !== sequence || !dialog.isConnected) return;
          const images = info.places.map((place) => ({ ...place, kind: "background", sceneId, label: `\uBC30\uACBD \xB7 ${place.name}` }));
          if (info.cg) images.push({ ...info.cg, kind: "cg", sceneId, name: info.cg.title || "\uC7A5\uBA74 CG", label: `${info.cg.characterCount ? "\uC778\uBB3C CG" : "\uC7A5\uBA74 CG"} \xB7 ${info.cg.title || "\uC81C\uBAA9 \uC5C6\uC74C"} \xB7 \uB300\uC0AC ${info.cg.from + 1}\u2013${info.cg.to + 1}` });
          images.forEach((target, index) => {
            target.index = index;
            const button = node("button", null, targets);
            button.type = "button";
            button.className = "gf-picture-card";
            button.dataset.gfTargetKind = target.kind;
            button.dataset.gfTargetSlug = target.slug || "";
            button.dataset.gfTargetIndex = index;
            button.setAttribute("aria-pressed", "false");
            button.setAttribute("aria-label", `${target.kind === "background" ? "\uBC30\uACBD" : "CG"} \uC120\uD0DD: ${target.name}`);
            picture(target.url, button, "", true);
            node("span", target.label, button);
            button.onclick = () => choose(target);
          });
          if (sceneId === currentScene(host)) {
            const at = Number(host._beatAt) || 0;
            const shownCg = host._beatCg;
            const cg = shownCg?.url && at >= (Number(shownCg.from) || 0) && at <= (Number(shownCg.to) || 0) ? images.find((target) => target.kind === "cg" && target.url && at >= target.from && at <= target.to) : null;
            const name = host._beat?.[at]?.place || host._activeStoryNode?.location;
            const background = images.find((target) => target.kind === "background" && target.name === name) || (!name ? images.find((target) => target.kind === "background" && target.fallback) : null);
            if (cg || background) choose(cg || background);
            else status.textContent = "\uD604\uC7AC \uD654\uBA74\uC758 \uC774\uBBF8\uC9C0\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC378\uB124\uC77C\uC744 \uBCF4\uACE0 \uC7AC\uC0DD\uC131\uD560 \uC774\uBBF8\uC9C0\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.";
          } else status.textContent = images.length ? "\uC7AC\uC0DD\uC131\uD560 \uC774\uBBF8\uC9C0\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694." : "\uC774 \uC2A4\uD1A0\uB9AC\uC5D0\uB294 \uC800\uC7A5\uB41C \uC774\uBBF8\uC9C0 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.";
          actionsState();
        } catch (error) {
          if (request === sequence) status.textContent = error.message;
        }
      }
      select.onchange = loadTargets;
      await loadTargets();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  // gacha-external/entry.mjs
  async function start(marinara2) {
    let alive = true;
    const cleanups = [];
    marinara2.onCleanup(async () => {
      alive = false;
      for (const cleanup of cleanups.reverse()) await cleanup();
    });
    await customElements.whenDefined("marinara-capability-gacha-forge");
    if (!alive) return;
    const service = await makeService(marinara2);
    if (!alive) return;
    const prototype = customElements.get("marinara-capability-gacha-forge").prototype;
    const originalPost = prototype._postJson;
    const originalRender = prototype._renderBrowser;
    const originalNodeBackground = prototype._nodeBackground;
    let imagesEnabled = true;
    const locks = /* @__PURE__ */ new Map();
    const dedupe = (key, task) => {
      if (locks.has(key)) return locks.get(key);
      const promise = Promise.resolve().then(task).finally(() => {
        if (locks.get(key) === promise) locks.delete(key);
      });
      locks.set(key, promise);
      return promise;
    };
    const sceneId = (path, body) => {
      const part = Number(body.part) || 1;
      const chapter = path === "/bond-chapter/beat" ? `bond-${String(body.unitId).split(":unit:")[1] || body.unitId}${part > 1 ? `-${part}` : ""}` : body.chapter;
      return `${body.runId}:beat:${chapter}:${body.storyIndex}`;
    };
    async function restoreHost(host) {
      delete host._gfImageSceneBackground;
      if (!host._run?.runId || !host._activeStoryNode || host._beatState !== "ready") return;
      const runId = host._run.runId, active = host._activeStoryNode;
      const body = { runId, chapter: active.chapter, storyIndex: active.storyIndex, unitId: host._bondUnit, part: host._bondPart };
      const id2 = sceneId(host._bondUnit ? "/bond-chapter/beat" : "/beat", body);
      const [cg, beat, run] = await Promise.all([service.raw(id2.replace(":beat:", ":cg:")), service.raw(id2), service.getRun(runId)]);
      if (host._run?.runId !== runId || host._activeStoryNode !== active || !beat) return;
      host._beatCg = cg ? { from: cg.data.from, to: cg.data.to, title: cg.data.title, url: cg.data.url || "" } : null;
      const places = await service.places(runId, beat.data.places, run);
      host._beatPlaces = Object.fromEntries(places.filter((place) => place.url).map((place) => [place.name, place.url]));
      host._renderKey = null;
      host._renderBrowser();
    }
    const overlayBeat = async (path, body, response) => {
      if (!response?.ok || !response.segments) return response;
      const config = await service.invoke("/image-addon/settings", {});
      if (!config.settings.enabled) return response;
      const id2 = sceneId(path, body);
      const cg = await service.documents.getById("gacha-forge", id2.replace(":beat:", ":cg:"));
      return { ...response, places: await service.addon.scenePlaces(id2, response.places ?? []), gachaForgeBackground: await service.addon.sceneBackground(id2), cg: cg ? { ...response.cg, from: cg.data.from, to: cg.data.to, title: cg.data.title, url: cg.data.url || "" } : response.cg };
    };
    prototype._nodeBackground = function(...args) {
      const active = this._activeStoryNode;
      const id2 = active && sceneId(this._bondUnit ? "/bond-chapter/beat" : "/beat", { runId: this._run?.runId, chapter: active.chapter, storyIndex: active.storyIndex, unitId: this._bondUnit, part: this._bondPart });
      return alive && this._gfImageSceneBackground?.sceneId === id2 ? this._gfImageSceneBackground.url : originalNodeBackground.apply(this, args);
    };
    const addonNodeBackground = prototype._nodeBackground;
    prototype._postJson = async function(path, body = {}, ...rest) {
      if (!alive) return originalPost.call(this, path, body, ...rest);
      let baseResponse;
      try {
        if (path.startsWith("/image-addon/")) {
          const result2 = await service.invoke(path, body);
          if (path === "/image-addon/settings" && result2.ok) imagesEnabled = result2.settings.enabled;
          if (path === "/image-addon/settings" && result2.ok && body.save && body.enabled === false) await restoreHost(this);
          return result2;
        }
        if (path === "/cg-art" && await service.nativeEnabled(body.runId)) {
          const id2 = sceneId("/beat", body);
          return await dedupe(id2, async () => {
            const cg = await service.documents.getById("gacha-forge", id2.replace(":beat:", ":cg:"));
            if (cg?.data.url) return { ok: true, url: cg.data.url, cached: true };
            const plan = await service.invoke("/image-addon/preview", { runId: body.runId, sceneId: id2, kind: "cg" });
            if (!plan.ok) return plan;
            return service.invoke("/image-addon/generate", plan);
          });
        }
        if (path === "/banner-art" && await service.nativeEnabled(body.runId)) {
          const result2 = await service.bannerArt(body);
          if (result2) return result2;
        }
        const result = await originalPost.call(this, path, body, ...rest);
        baseResponse = result;
        if (path === "/beat" || path === "/bond-chapter/beat") {
          const response = await overlayBeat(path, body, result);
          if (response?.ok) this._gfImageSceneBackground = { sceneId: sceneId(path, body), url: response.gachaForgeBackground || "" };
          if (!response?.gachaForgeBackground) delete this._gfImageSceneBackground;
          return response;
        }
        if (path === "/summon-banner" && result?.ok) {
          const config = await service.invoke("/image-addon/settings", {});
          if (config.settings.enabled) {
            const session = await service.raw(`${body.runId}:session`), sequence = Math.max(1, Math.round(Number(session?.data.featured?.seq) || 1));
            for (const banner of result.banners ?? []) {
              const doc = await service.documents.getById("gacha-forge", `${body.runId}:banner:${banner.id.endsWith("standard") ? "standard" : `char:f${sequence}`}`);
              if (doc?.data.art?.[banner.id]) banner.art = doc.data.art[banner.id];
            }
            const current = result.banners?.find((banner) => banner.id === (body.banner || "char-featured"));
            if (current?.art && result.banner) result.banner.art = current.art;
          }
        }
        return result;
      } catch (error) {
        marinara2.log.error("\uC774\uBBF8\uC9C0 \uD655\uC7A5 \uC694\uCCAD \uC2E4\uD328", path, error.message);
        if (path === "/beat" || path === "/bond-chapter/beat") return baseResponse ?? originalPost.call(this, path, body, ...rest);
        return { ok: false, error: error.message };
      }
    };
    const addonPost = prototype._postJson;
    const floating = createFloatingControls({ load: async () => (await service.invoke("/image-addon/layout", {})).layout, save: (layout) => service.invoke("/image-addon/layout", { save: true, layout }).then((result) => {
      if (!result.ok) throw new Error(result.error);
    }), isActive: () => alive });
    installUi({ floating, isActive: () => alive, openEditor: (host, helpers) => openImageEditor(host, { ...helpers, floating, isActive: () => alive && imagesEnabled }) });
    const addonRender = prototype._renderBrowser;
    cleanups.push(async () => {
      await floating.dispose();
      if (prototype._postJson === addonPost) prototype._postJson = originalPost;
      if (prototype._renderBrowser === addonRender) prototype._renderBrowser = originalRender;
      if (prototype._nodeBackground === addonNodeBackground) prototype._nodeBackground = originalNodeBackground;
      delete prototype._gfImageAddon;
      for (const host of document.querySelectorAll("marinara-capability-gacha-forge")) {
        host._root?.querySelectorAll("[data-gf-image-tools],.gf-image-dialog").forEach((element) => element.remove());
        try {
          await restoreHost(host);
        } catch (error) {
          marinara2.log.warn("\uC6D0\uBCF8 \uC774\uBBF8\uC9C0 \uD45C\uC2DC\uB97C \uB2E4\uC2DC \uBD88\uB7EC\uC624\uB824\uBA74 \uC7A5\uBA74\uC744 \uC7AC\uC9C4\uC785\uD574 \uC8FC\uC138\uC694.", error.message);
        }
        host._renderKey = null;
        host._renderBrowser();
      }
    });
    for (const host of document.querySelectorAll("marinara-capability-gacha-forge")) host._renderBrowser();
    marinara2.log.info("Gacha Forge \uC774\uBBF8\uC9C0 \uD655\uC7A5 0.3.1 \uC900\uBE44 \uC644\uB8CC. \uC5D4\uC9C4 \uD30C\uC77C\uC744 \uC218\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  }
  start(marinara).catch((error) => marinara.log.error("Gacha Forge \uC774\uBBF8\uC9C0 \uD655\uC7A5 \uC2DC\uC791 \uC2E4\uD328", error.message));
})();
