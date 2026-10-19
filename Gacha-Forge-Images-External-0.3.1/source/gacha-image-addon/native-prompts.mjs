const text = (value) => typeof value === 'string' ? value.trim() : '';
const join = (...parts) => parts.flat().map(text).filter(Boolean).join(', ');
const array = (value) => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
const counted = /^(?:\d+(?:girls?|boys?|others?|women|men)|solo(?: focus)?|multiple (?:girls|boys))$/i;

export function nativeLimit(connection) {
  try {
    const url = new URL(connection?.baseUrl);
    if (url.protocol !== 'https:' || !/(^|\.)novelai\.net$/i.test(url.hostname)) return 0;
    const model = text(connection.model);
    if (!/^nai-diffusion-(?:4(?:-(?:curated-preview|full))?|4-5(?:-(?:curated|full))?|5(?:-(?:curated|full))?)$/i.test(model)) return 0;
    return /^nai-diffusion-5(?:-|$)/i.test(model) ? 22 : 6;
  } catch { return 0; }
}

export function nativePrompts({ units = [], scene = '', framing, profile = {}, background = '' }, limit) {
  if (!units.length) return null;
  if (units.length > limit) throw new Error(`이 모델은 인물 ${limit}명까지 지원합니다. 인물을 줄여 주세요.`);
  const counts = { girl: 0, boy: 0, other: 0 };
  const names = new Set();
  const characterPrompts = units.map((unit, index) => {
    const name = text(unit.name) || `인물 ${index + 1}`;
    if (names.has(name)) throw new Error(`중복 인물 이름: ${name}`);
    names.add(name);
    // These arrays already belong to one character. Never split the merged scene prompt.
    const tags = array(unit.imageTags);
    const traits = tags.length ? tags.filter(tag => !counted.test(tag)) : [text(unit.appearance)];
    if (!traits.some(Boolean)) throw new Error(`${name}의 외형 데이터가 없습니다. 확인 후 인물 프롬프트를 입력해 주세요.`);
    const sex = unit.identitySex === 'male' ? 'boy' : unit.identitySex === 'female' ? 'girl'
      : tags.some(tag => /^(?:1boy|boy|man|male)$/i.test(tag)) ? 'boy'
      : tags.some(tag => /^(?:1girl|girl|woman|female)$/i.test(tag)) ? 'girl' : 'other';
    counts[sex]++;
    const supplied = unit.promptPosition;
    const position = supplied && Number.isFinite(supplied.x) && Number.isFinite(supplied.y)
      ? { x: Math.max(0, Math.min(1, supplied.x)), y: Math.max(0, Math.min(1, supplied.y)) }
      : { x: (index + 1) / (units.length + 1), y: 0.5 };
    return {
      name,
      prompt: join(sex, traits, unit.sceneAction, unit.sceneExpression),
      negativePrompt: unit.backView ? 'looking at viewer, facing viewer, front view' : '',
      position,
    };
  });
  const countTags = Object.entries(counts).filter(([, n]) => n).map(([sex, n]) => `${n}${sex}${n > 1 ? 's' : ''}`);
  return {
    prompt: join(countTags, scene || background, framing === 'scene' ? '' : 'wide shot, full body, dynamic composition, cinematic lighting, detailed background', profile.positiveTags),
    negativePrompt: join(profile.negativeTags, framing === 'scene' ? '' : 'portrait, close-up, headshot, cropped, out of frame, extra figures'),
    characterPrompts,
  };
}

export function validateEditedPrompt(value, original, limit) {
  const bounded = (v, max, label, required = false) => {
    if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new Error(`${label} 입력을 확인해 주세요.`);
    return v.trim();
  };
  const prompt = bounded(value?.prompt, 12000, '공통 프롬프트', true);
  const negativePrompt = bounded(value?.negativePrompt ?? '', 6000, '네거티브 프롬프트');
  const entries = value?.characterPrompts ?? [];
  const expected = original.characterPrompts ?? [];
  if (!Array.isArray(entries) || entries.length !== expected.length || entries.length > limit) throw new Error('인물 목록을 임의로 추가하거나 삭제할 수 없습니다.');
  return { prompt, negativePrompt, characterPrompts: entries.map((entry, index) => {
    if (entry.name !== expected[index].name) throw new Error('인물 이름 또는 순서가 바뀌었습니다.');
    const position = entry.position;
    if (!position || ![position.x, position.y].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)) throw new Error('인물 위치는 0~1 사이 숫자여야 합니다.');
    return { name: entry.name, prompt: bounded(entry.prompt, 1400, '인물 프롬프트', true), negativePrompt: bounded(entry.negativePrompt ?? '', 700, '인물 네거티브'), position: { x: position.x, y: position.y } };
  }) };
}
