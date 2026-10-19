// Select a concrete picture first. A beat can contain both a background and a later CG.
export async function openImageEditor(host, { floating, isActive, call, currentScene, node }) {
  const runId = host._run?.runId;
  if (!runId || host._gfImageDialog?.isConnected) return;
  const focusBefore = host._root.activeElement;
  const dialog = node('dialog', null, host._root); host._gfImageDialog = dialog;
  dialog.className = 'gf-image-dialog'; dialog.setAttribute('aria-label', '장면 이미지 도구');
  const style = node('style', null, dialog);
  style.textContent = `.gf-image-dialog{box-sizing:border-box;background:var(--ink-2,#172334);color:var(--text,#f3f6fa);border:1px solid #7c8da5;border-radius:12px;font:14px/1.5 system-ui}.gf-image-dialog label{display:block;margin:10px 0}.gf-image-dialog textarea,.gf-image-dialog select{box-sizing:border-box;width:100%;padding:8px;color:#fafafa;background:#142032;border:1px solid #71839b;border-radius:5px;font:inherit}.gf-image-dialog textarea{min-height:76px;resize:vertical}.gf-image-dialog button{padding:8px 12px;cursor:pointer;font:inherit;border:1px solid #71839b;border-radius:5px;background:#24364a;color:inherit}.gf-image-dialog input[type=number]{width:80px}.gf-image-dialog fieldset{margin:12px 0;border:1px solid #71839b}.gf-image-dialog [role=status]{white-space:pre-wrap}.gf-image-dialog [role=status]:empty{display:none}.gf-picture-list{display:grid;gap:8px}.gf-image-dialog .gf-picture-card{display:flex;align-items:center;gap:10px;text-align:left;width:100%}.gf-picture-card[aria-pressed=true]{outline:2px solid #b9d4ff;outline-offset:-2px}.gf-picture-card img{width:80px;height:50px;object-fit:cover;border-radius:3px}.gf-selected-image img{display:block;width:100%;max-height:160px;object-fit:contain;margin:10px 0;background:#101b28}.gf-picture-title{font-weight:600;margin:12px 0 8px}.gf-image-actions{display:flex;flex-wrap:wrap;gap:8px}.gf-image-actions button{flex:1}.gf-image-dialog button:disabled{opacity:.6;cursor:default}`;
  node('h2', '이미지 편집', dialog);
  const intro = node('p', '', dialog); intro.hidden = true;
  const status = node('p', '불러오는 중…', dialog); status.setAttribute('role', 'status');
  const content = node('div', null, dialog);
  const close = node('button', '닫기', dialog); close.type = 'button'; close.onclick = () => dialog.close();
  floating.decorateDialog(host, dialog, { close, status, content }); dialog.show();
  dialog.addEventListener('click', event => event.stopPropagation());
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('close', () => { dialog.remove(); focusBefore?.focus(); });
  try {
    const config = await call(host, 'settings');
    if (!dialog.isConnected) return;
    const settingsBox = node('details', null, content); node('summary', '확장 설정', settingsBox);
    const checkbox = (text, checked) => { const label = node('label', null, settingsBox), input = node('input', null, label); input.type = 'checkbox'; input.checked = checked; label.append(document.createTextNode(` ${text}`)); return input; };
    const enabled = checkbox('이미지 확장 켜기', config.settings.enabled), native = checkbox('지원되는 NAI 모델에서 인물별 프롬프트 사용', config.settings.nativeCharacters);
    const save = node('button', '설정 저장', settingsBox); save.type = 'button';
    save.onclick = async () => { save.disabled = true; try { await call(host, 'settings', { save: true, enabled: enabled.checked, nativeCharacters: native.checked }); status.textContent = ''; } catch (error) { status.textContent = error.message; } finally { save.disabled = false; } };
    const scenes = await call(host, 'scenes', { runId });
    if (!scenes.scenes.length) { status.textContent = '저장된 스토리가 없습니다.'; return; }
    const sceneLabel = node('label', '장면', content), select = node('select', null, sceneLabel); select.setAttribute('aria-label', '장면');
    for (const scene of scenes.scenes) {
      const chapter = Number.isFinite(Number(scene.chapter)) ? `${scene.chapter}장` : '인연 이야기';
      const title = `${scene.id === currentScene(host) ? '현재 · ' : ''}${chapter} · ${scene.title}${scene.places?.length ? ` · ${scene.places.join(', ')}` : ''}`;
      node('option', title, select).value = scene.id;
    }
    if (scenes.scenes.some(scene => scene.id === currentScene(host))) select.value = currentScene(host);
    const targets = node('div', null, content); targets.className = 'gf-picture-list';
    const selectedView = node('div', null, content); selectedView.className = 'gf-selected-image';
    const editor = node('div', null, content); editor.hidden = true;
    const actions = node('div', null, content); actions.className = 'gf-image-actions';
    const regenerate = node('button', '재생성', actions), inspect = node('button', '프롬프트 확인', actions);
    inspect.setAttribute('aria-expanded', 'false');
    regenerate.type = inspect.type = 'button'; floating.placeSubmit(host, actions, dialog);
    let selection = null, fields = null, sequence = 0, busy = false;
    function actionsState() { regenerate.disabled = inspect.disabled = !selection || busy; select.disabled = busy; targets.querySelectorAll('button').forEach(button => { button.disabled = busy; }); }
    function picture(url, parent, alt, thumbnail = false) {
      if (!url) return;
      const img = node('img', null, parent); img.alt = alt; img.src = url;
      img.onerror = () => { img.hidden = true; }; img.onload = () => { img.hidden = false; }; if (thumbnail) img.loading = 'lazy'; return img;
    }
    function drawSelection() {
      selectedView.replaceChildren(); if (!selection) return;
      const title = node('div', selection.label, selectedView); title.className = 'gf-picture-title'; picture(selection.url, selectedView, `선택한 이미지: ${selection.label}`);
    }
    function choose(target) {
      if (busy) return;
      sequence++; selection = target; fields = null; editor.replaceChildren(); editor.hidden = true; inspect.setAttribute('aria-expanded', 'false'); status.textContent = '';
      for (const button of targets.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.gfTargetKind === target.kind && (button.dataset.gfTargetSlug || '') === (target.slug || '')));
      drawSelection(); actionsState();
    }
    const preview = target => call(host, 'preview', { runId, sceneId: target.sceneId, kind: target.kind, slug: target.slug });
    function drawFields(plan) {
      editor.replaceChildren(); editor.hidden = false;
      const field = (title, value, parent = editor) => { const label = node('label', title, parent), area = node('textarea', null, label); area.value = value ?? ''; return area; };
      const prompt = field(selection.kind === 'background' ? '배경 프롬프트 (인물 없음)' : '공통 장면 프롬프트', plan.prompt);
      const negative = field(selection.kind === 'background' ? '배경 네거티브 프롬프트' : '공통 네거티브 프롬프트', plan.negativePrompt);
      const characters = plan.characterPrompts.map(character => {
        const box = node('fieldset', null, editor); node('legend', character.name, box);
        const positive = field('외형·복장·동작·표정', character.prompt, box), negative = field('이 인물의 네거티브', character.negativePrompt, box);
        const coordinate = key => { const label = node('label', `${key.toUpperCase()} 위치 (0~1)`, box), input = node('input', null, label); Object.assign(input, { type: 'number', min: '0', max: '1', step: '0.01', value: character.position[key] }); return input; };
        return { name: character.name, positive, negative, x: coordinate('x'), y: coordinate('y') };
      });
      fields = { native: plan.native, prompt, negative, characters };
    }
    inspect.onclick = async () => {
      if (!selection || busy) return;
      if (fields) { editor.hidden = !editor.hidden; inspect.setAttribute('aria-expanded', String(!editor.hidden)); return; }
      const target = selection, request = sequence; busy = true; actionsState();
      try { const plan = await preview(target); if (request !== sequence || !dialog.isConnected) return; drawFields(plan); inspect.setAttribute('aria-expanded', 'true'); status.textContent = ''; }
      catch (error) { status.textContent = error.message; }
      finally { busy = false; actionsState(); }
    };
    regenerate.onclick = async () => {
      if (!selection || busy) return;
      const target = selection; busy = true; actionsState(); regenerate.textContent = '재생성 중…'; status.textContent = '';
      try {
        // A fresh token for every attempt permits repeated regeneration without consuming a stale plan.
        const plan = await preview(target);
        if (fields && (fields.native !== plan.native || JSON.stringify(fields.characters.map(person => person.name)) !== JSON.stringify(plan.characterPrompts.map(person => person.name)))) throw new Error('인물 또는 연결 설정이 바뀌었습니다. 이미지를 다시 선택하고 프롬프트를 확인해 주세요.');
        const edited = fields ? { prompt: fields.prompt.value, negativePrompt: fields.negative.value, characterPrompts: fields.characters.map(person => ({ name: person.name, prompt: person.positive.value, negativePrompt: person.negative.value, position: { x: Number(person.x.value), y: Number(person.y.value) } })) } : plan;
        const result = await call(host, 'generate', { ...edited, token: plan.token });
        target.url = result.url; drawSelection(); const card = targets.querySelector(`[data-gf-target-index="${target.index}"]`), thumb = card?.querySelector('img'); if (thumb) { thumb.hidden = false; thumb.src = result.url; } else if (card) card.prepend(picture(result.url, card, '', true));
        if (isActive() && host._run?.runId === runId && currentScene(host) === target.sceneId && host._beatState === 'ready') {
          if (target.kind === 'cg' && host._beatCg) host._beatCg = { ...host._beatCg, url: result.url };
          if (target.kind === 'background') { host._beatPlaces = { ...(host._beatPlaces ?? {}), [target.name]: result.url }; if (target.fallback) host._gfImageSceneBackground = { sceneId: target.sceneId, url: result.url }; }
          host._renderKey = null; host._renderBrowser();
        }
        status.textContent = '';
      } catch (error) { status.textContent = `${error.message}\n기존 이미지와 스토리는 유지됩니다.`; }
      finally { busy = false; regenerate.textContent = '재생성'; actionsState(); }
    };
    async function loadTargets() {
      const request = ++sequence, sceneId = select.value;
      selection = null; fields = null; editor.replaceChildren(); editor.hidden = true; inspect.setAttribute('aria-expanded', 'false'); selectedView.replaceChildren(); targets.replaceChildren(); actionsState(); status.textContent = '';
      try {
        const info = await call(host, 'scene', { runId, sceneId }); if (request !== sequence || !dialog.isConnected) return;
        const images = info.places.map(place => ({ ...place, kind: 'background', sceneId, label: `배경 · ${place.name}` }));
        if (info.cg) images.push({ ...info.cg, kind: 'cg', sceneId, name: info.cg.title || '장면 CG', label: `${info.cg.characterCount ? '인물 CG' : '장면 CG'} · ${info.cg.title || '제목 없음'} · 대사 ${info.cg.from + 1}–${info.cg.to + 1}` });
        images.forEach((target, index) => {
          target.index = index; const button = node('button', null, targets); button.type = 'button'; button.className = 'gf-picture-card'; button.dataset.gfTargetKind = target.kind; button.dataset.gfTargetSlug = target.slug || ''; button.dataset.gfTargetIndex = index; button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-label', `${target.kind === 'background' ? '배경' : 'CG'} 선택: ${target.name}`); picture(target.url, button, '', true); node('span', target.label, button); button.onclick = () => choose(target);
        });
        if (sceneId === currentScene(host)) {
          const at = Number(host._beatAt) || 0;
          const shownCg = host._beatCg;
          const cg = shownCg?.url && at >= (Number(shownCg.from) || 0) && at <= (Number(shownCg.to) || 0) ? images.find(target => target.kind === 'cg' && target.url && at >= target.from && at <= target.to) : null;
          const name = host._beat?.[at]?.place || host._activeStoryNode?.location;
          const background = images.find(target => target.kind === 'background' && target.name === name) || (!name ? images.find(target => target.kind === 'background' && target.fallback) : null);
          if (cg || background) choose(cg || background);
          else status.textContent = '현재 화면의 이미지를 확인하지 못했습니다. 썸네일을 보고 재생성할 이미지를 선택해 주세요.';
        } else status.textContent = images.length ? '재생성할 이미지를 선택해 주세요.' : '이 스토리에는 저장된 이미지 정보가 없습니다.';
        actionsState();
      } catch (error) { if (request === sequence) status.textContent = error.message; }
    }
    select.onchange = loadTargets; await loadTargets();
  } catch (error) { status.textContent = error.message; }
}
