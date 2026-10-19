// Additive UI adapter for the verified Gacha Forge 1.8.12 custom element.
((options = {}) => {
  const floating = options.floating;
  const Element = customElements.get('marinara-capability-gacha-forge');
  if (!Element || Element.prototype._gfImageAddon) return;
  const prototype = Element.prototype;
  prototype._gfImageAddon = true;
  const render = prototype._renderBrowser;
  const node = (tag, text, parent) => {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    parent?.append(element);
    return element;
  };
  const call = async (host, path, body = {}) => {
    const result = await host._postJson(`/image-addon/${path}`, body);
    if (!result?.ok) throw new Error(result?.error || '서버에 연결하지 못했습니다. 기존 이미지는 유지됩니다.');
    return result;
  };
  function currentScene(host) {
    const runId = host._run?.runId;
    const active = host._activeStoryNode;
    if (!runId || !active) return '';
    const part = Number(host._bondPart) || 1;
    const chapter = host._bondUnit ? `bond-${String(host._bondUnit).split(':unit:')[1] || host._bondUnit}${part > 1 ? `-${part}` : ''}` : active.chapter;
    return `${runId}:beat:${chapter}:${active.storyIndex}`;
  }
  async function open(host) {
    if (options.openEditor) return options.openEditor(host, { call, currentScene, node });
    const runId = host._run?.runId;
    if (!runId || host._gfImageDialog?.isConnected) return;
    const focusBefore = host._root.activeElement;
    const dialog = node('dialog', null, host._root);
    host._gfImageDialog = dialog;
    dialog.className = 'gf-image-dialog';
    dialog.setAttribute('aria-label', '장면 이미지 도구');
    const style = node('style', null, dialog);
    style.textContent = '.gf-image-dialog{box-sizing:border-box;width:min(720px,94vw);max-height:88vh;overflow:auto;background:var(--ink-2,#172334);color:var(--text,#f3f6fa);border:1px solid #7c8da5;border-radius:12px;padding:20px;font:14px/1.5 system-ui}.gf-image-dialog::backdrop{background:#0009}.gf-image-dialog label{display:block;margin:10px 0}.gf-image-dialog textarea,.gf-image-dialog select{box-sizing:border-box;width:100%;padding:8px;color:#fafafa;background:#142032;border:1px solid #71839b;border-radius:5px;font:inherit}.gf-image-dialog textarea{min-height:76px;resize:vertical}.gf-image-dialog button{padding:8px 12px;margin:6px 8px 6px 0;cursor:pointer}.gf-image-dialog input[type=number]{width:80px}.gf-image-dialog [role=status]{white-space:pre-wrap}.gf-image-dialog fieldset{margin:12px 0;border:1px solid #71839b}.gf-image-dialog .gf-image-actions{display:flex;flex-wrap:wrap;gap:6px}';
    node('h2', '장면 이미지 도구', dialog);
    node('p', '저장된 현재·과거 장면의 CG와 배경을 다시 생성합니다. 이미지 생성 비용이 발생할 수 있습니다.', dialog);
    const status = node('p', '불러오는 중…', dialog);
    status.setAttribute('role', 'status');
    const content = node('div', null, dialog);
    const close = node('button', '닫기', dialog);
    close.type = 'button';
    close.onclick = () => dialog.close();
    dialog.addEventListener('close', () => { dialog.remove(); focusBefore?.focus(); });
    dialog.addEventListener('cancel', event => { if (close.disabled) event.preventDefault(); });
    // Prevent the visual novel's keyboard handler from advancing behind the modal.
    dialog.addEventListener('keydown', event => event.stopPropagation());
    dialog.addEventListener('click', event => event.stopPropagation());
    if (floating) { floating.decorateDialog(host, dialog, { close, status, content }); dialog.show(); }
    else dialog.showModal();
    try {
      const config = await call(host, 'settings');
      const settingsBox = floating ? node('details', null, content) : content;
      if (floating) node('summary', '확장 설정', settingsBox);
      const checkbox = (label, checked) => {
        const row = node('label', null, settingsBox);
        const input = node('input', null, row);
        input.type = 'checkbox'; input.checked = checked;
        row.append(document.createTextNode(` ${label}`));
        return input;
      };
      const enabled = checkbox('이미지 확장 켜기', config.settings.enabled);
      const native = checkbox('지원되는 NAI 모델에서 인물별 프롬프트 사용', config.settings.nativeCharacters);
      const save = node('button', '설정 저장', settingsBox);
      save.onclick = async () => {
        save.disabled = true;
        try { await call(host, 'settings', { save: true, enabled: enabled.checked, nativeCharacters: native.checked }); status.textContent = '설정을 저장했습니다.'; }
        catch (error) { status.textContent = error.message; }
        finally { save.disabled = false; }
      };
      const scenes = await call(host, 'scenes', { runId });
      if (!scenes.scenes.length) { status.textContent = '저장된 장면이 없습니다. 스토리 장면을 먼저 열어 주세요.'; return; }
      const label = node('label', '장면', content);
      const select = node('select', null, label);
      for (const scene of scenes.scenes) { const readable = `${scene.chapter ?? '?'}장 · 장면 ${Number.isFinite(Number(scene.storyIndex)) ? Number(scene.storyIndex) + 1 : '?'}`; const option = node('option', floating ? `${scene.id === currentScene(host) ? '현재 · ' : ''}${readable}` : `${scene.title} · ${scene.id.slice(runId.length + 6)}`, select); option.value = scene.id; }
      if (scenes.scenes.some(scene => scene.id === currentScene(host))) select.value = currentScene(host);
      const targets = node('div', null, content);
      const editor = node('div', null, content);
      let selectionVersion = 0;
      async function showEditor(kind, slug) {
        const request = ++selectionVersion;
        status.textContent = '프롬프트를 준비하는 중…';
        editor.replaceChildren(); dialog.querySelectorAll('[data-gf-submit]').forEach(button => button.remove());
        targets.querySelectorAll('button').forEach(button => { button.disabled = true; });
        try {
          const sceneId = select.value;
          const plan = await call(host, 'preview', { runId, sceneId, kind, slug });
          if (request !== selectionVersion || !dialog.isConnected) return;
          editor.replaceChildren();
          node('h3', plan.name, editor);
          node('p', `${plan.notice} ${plan.native ? 'NAI 네이티브 인물별 전송' : '기존 이미지 생성 경로'}`, editor);
          const field = (title, value, parent = editor) => { const label = node('label', title, parent); const area = node('textarea', null, label); area.value = value ?? ''; return area; };
          const prompt = field('공통 장면 프롬프트', plan.prompt);
          const negative = field('공통 네거티브 프롬프트', plan.negativePrompt);
          const characters = plan.characterPrompts.map(character => {
            const box = node('fieldset', null, editor);
            node('legend', character.name, box);
            const positive = field('외형·복장·동작·표정', character.prompt, box);
            const negative = field('이 인물의 네거티브', character.negativePrompt, box);
            const coordinate = key => { const label = node('label', `${key.toUpperCase()} 위치 (0~1)`, box); const input = node('input', null, label); input.type = 'number'; input.min = '0'; input.max = '1'; input.step = '0.01'; input.value = character.position[key]; return input; };
            return { name: character.name, positive, negative, x: coordinate('x'), y: coordinate('y') };
          });
          const submit = node('button', '이 프롬프트로 재생성', editor);
          floating?.placeSubmit(host, submit, dialog);
          submit.onclick = async () => {
            submit.disabled = true; select.disabled = true; close.disabled = !floating;
            targets.querySelectorAll('button').forEach(button => { button.disabled = true; });
            status.textContent = '이미지를 생성하는 중… 기존 이미지와 스토리는 유지됩니다.';
            try {
              const result = await call(host, 'generate', { token: plan.token, prompt: prompt.value, negativePrompt: negative.value, characterPrompts: characters.map(character => ({ name: character.name, prompt: character.positive.value, negativePrompt: character.negative.value, position: { x: Number(character.x.value), y: Number(character.y.value) } })) });
              if (options.isActive?.() !== false && host._run?.runId === runId && currentScene(host) === sceneId && host._beatState === 'ready') {
                if (kind === 'cg' && host._beatCg) host._beatCg = { ...host._beatCg, url: result.url };
                if (kind === 'background') {
                  const place = (await call(host, 'scene', { runId, sceneId })).places.find(place => place.slug === slug);
                  if (place) host._beatPlaces = { ...(host._beatPlaces ?? {}), [place.name]: result.url };
                }
                // The original renderer resumes at max(startAt, beatAt), preserving the reading position.
                host._renderKey = null;
                host._renderBrowser();
              }
              status.textContent = '게임에 새 이미지를 저장했습니다. 다시 열어도 이 장면에 유지됩니다. 이전 이미지는 갤러리에 남아 있습니다.';
              submit.remove();
            } catch (error) { status.textContent = `${error.message}\n기존 이미지와 스토리는 유지됩니다.`; submit.disabled = false; }
            finally { select.disabled = false; close.disabled = false; targets.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
          };
          status.textContent = '생성 전에 프롬프트와 인물 위치를 확인해 주세요.';
        } catch (error) { if (request === selectionVersion) status.textContent = error.message; }
        finally { if (request === selectionVersion) targets.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
      }
      async function loadTargets() {
        const request = ++selectionVersion;
        targets.replaceChildren(); editor.replaceChildren();
        dialog.querySelectorAll('[data-gf-submit]').forEach(button => button.remove());
        try {
          const info = await call(host, 'scene', { runId, sceneId: select.value });
          if (request !== selectionVersion || !dialog.isConnected) return;
          if (info.cg) { const button = node('button', 'CG 재생성 · 프롬프트 확인', targets); button.onclick = () => showEditor('cg'); }
          for (const place of info.places) { const button = node('button', `배경 재생성: ${place.name}`, targets); button.onclick = () => showEditor('background', place.slug); }
          status.textContent = info.cg || info.places.length ? '재생성할 이미지를 선택해 주세요.' : '이 장면에는 CG·배경 생성 데이터가 없습니다.';
        } catch (error) { status.textContent = error.message; }
      }
      select.onchange = loadTargets;
      await loadTargets();
    } catch (error) { status.textContent = error.message; }
  }
  prototype._renderBrowser = function (...args) {
    const dialog = this._gfImageDialog;
    const wasOpen = dialog?.isConnected && dialog.open;
    const focused = wasOpen ? this._root.activeElement : null;
    const result = render.apply(this, args);
    if (this._run?.runId && floating) floating.render(this, () => open(this));
    else if (this._run?.runId && !this._root.querySelector('[data-gf-image-tools]')) {
      const button = node('button', '이미지 도구', this._root);
      button.type = 'button'; button.dataset.gfImageTools = '';
      button.style.cssText = 'position:absolute;right:12px;bottom:12px;z-index:80;padding:8px 12px;border-radius:6px;border:1px solid #8b9bb0;background:#142032;color:#fff;cursor:pointer;font:14px system-ui';
      button.onclick = event => { event.stopPropagation(); open(this); };
    }
    if (wasOpen && !dialog.isConnected) {
      dialog.removeAttribute('open');
      this._root.append(dialog); floating ? dialog.show() : dialog.showModal(); focused?.focus();
    }
    return result;
  };
})();
