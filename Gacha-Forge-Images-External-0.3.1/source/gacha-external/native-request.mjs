import { DEFAULT_NOVELAI_DEFAULTS, IMAGE_DEFAULTS_STORAGE_KEY, normalizeImageGenerationProfile } from '../upstream/Marinara-Engine/packages/shared/src/constants/image-generation-defaults.ts';
import { nativeLimit, validateEditedPrompt } from '../gacha-image-addon/native-prompts.mjs';
const join = (...values) => values.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()).join(', ');
export const parameterRoot = connection => {
  try { return typeof connection.defaultParameters === 'string' ? JSON.parse(connection.defaultParameters) : structuredClone(connection.defaultParameters ?? {}); }
  catch { throw new Error('이미지 연결의 생성 설정을 읽을 수 없습니다.'); }
};
export function nativeParameters(connection, request) {
  const limit = nativeLimit(connection);
  if (!limit) return null;
  const edit = validateEditedPrompt(request, request, limit);
  const allowUnicode=/^nai-diffusion-5(?:-|$)/i.test(connection.model);
  const clean=value=>{
    const normalized=value.replace(/[\u2018\u2019\u201A\u201B]/g,"'").replace(/[\u201C\u201D\u201E\u201F]/g,'"').replace(/[\u2010-\u2015\u2212]/g,'-').replace(/\u2026/g,'...').replace(/\u00A0/g,' ').replace(/[\u200B-\u200D\uFEFF]/g,'').normalize(allowUnicode?'NFC':'NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x09\x0A\x0D\x20-\x7E]/g,allowUnicode?'$&':' ').replace(/[ \t]+/g,' ').replace(/\s*\n\s*/g,'\n').trim();
    if(value.trim()&&!normalized)throw new Error('이 NAI 모델은 입력한 문자를 지원하지 않습니다. 영어 태그를 확인해 주세요.');
    return normalized;
  };
  edit.prompt=clean(edit.prompt);edit.negativePrompt=clean(edit.negativePrompt);
  edit.characterPrompts=edit.characterPrompts.map(entry=>({...entry,prompt:clean(entry.prompt),negativePrompt:clean(entry.negativePrompt)}));
  const root = parameterRoot(connection);
  const profile = normalizeImageGenerationProfile(root[IMAGE_DEFAULTS_STORAGE_KEY], 'novelai').profile;
  const defaults = { ...DEFAULT_NOVELAI_DEFAULTS, ...profile.novelai };
  let width = request.width, height = request.height;
  if (defaults.dynamicResolutionBySubjectCount) {
    const count = edit.characterPrompts.length;
    if (count === 1) { width = 832; height = 1216; }
    else if (count === 2) { width = 1024; height = 1024; }
    else if (count >= 3) { width = 1216; height = 832; }
  }
  const dimension = value => Math.max(64, Math.min(2048, Math.round(Number(value) / 64) * 64));
  width = dimension(width || 1216); height = dimension(height || 832);
  if (width * height > 1048576) { const scale = Math.sqrt(1048576 / (width * height)); width = Math.max(64, Math.floor(width * scale / 64) * 64); height = Math.max(64, Math.floor(height * scale / 64) * 64); }
  const center = position => ({x:position.x,y:position.y});
  const parameters = {
    width, height, n_samples: 1, ucPreset: defaults.undesiredContentPreset,
    negative_prompt: clean(join(defaults.negativePromptPrefix, edit.negativePrompt)),
    seed: typeof profile.seed === 'number' && profile.seed >= 0 ? profile.seed : crypto.getRandomValues(new Uint32Array(1))[0],
    scale: defaults.promptGuidance, steps: defaults.steps, sampler: defaults.sampler,
    cfg_rescale: defaults.promptGuidanceRescale, params_version: 3,
    reference_image_multiple: [], reference_information_extracted_multiple: [], reference_strength_multiple: [],
    ...(defaults.noiseSchedule ? { noise_schedule: defaults.noiseSchedule } : {}),
    ...(root.customParameters?.parameters ?? {}),
  };
  parameters.v4_prompt = { caption: { base_caption: clean(join(defaults.promptPrefix, edit.prompt)), char_captions: edit.characterPrompts.map(entry => ({ char_caption: entry.prompt, centers: [center(entry.position)] })) }, use_coords: edit.characterPrompts.length > 1, use_order: true };
  parameters.v4_negative_prompt = { caption: { base_caption: parameters.negative_prompt, char_captions: edit.characterPrompts.map(entry => ({ char_caption: entry.negativePrompt, centers: [center(entry.position)] })) }, use_coords: edit.characterPrompts.length > 1, use_order: true };
  // The Engine still prepares and uploads the style-reference bytes itself.
  if (defaults.styleReferenceImage && /^nai-diffusion-4-5(?:-|$)/i.test(connection.model)) {
    parameters.director_reference_descriptions = [{ caption: { base_caption: 'style', char_captions: [] }, legacy_uc: false }];
    parameters.director_reference_information_extracted = [1];
    parameters.director_reference_strength_values = [defaults.styleReferenceStrength];
    parameters.director_reference_secondary_strength_values = [1 - defaults.styleReferenceFidelity];
  }
  return { ...root, customParameters: { ...(root.customParameters ?? {}), parameters } };
}
