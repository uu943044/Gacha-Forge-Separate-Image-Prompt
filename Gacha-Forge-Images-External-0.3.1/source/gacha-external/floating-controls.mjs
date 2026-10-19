// Only presentation state lives here. Generation, authentication and scene storage stay in the existing adapter.
export function createFloatingControls({ load, save, isActive = () => true }) {
  const hosts = new Map();
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
    return { button: { x: clamp(finite(saved.button?.x, .96), 0, 1), y: clamp(finite(saved.button?.y, .86), 0, 1) }, panel: { x: clamp(finite(saved.panel?.x, .93), 0, 1), y: clamp(finite(saved.panel?.y, .15), 0, 1), w: clamp(finite(saved.panel?.w, 400), 280, 1600), h: clamp(finite(saved.panel?.h, 560), 240, 1400) } };
  }
  function box(state, key) {
    const view = dimensions(), value = state.layout[key];
    const w = key === 'button' ? 48 : clamp(value.w, Math.min(280, view.width - 16), view.width - 16);
    const h = key === 'button' ? 48 : clamp(value.h, Math.min(240, view.height - 16), view.height - 16);
    return { x: 8 + value.x * Math.max(0, view.width - w - 16), y: 8 + value.y * Math.max(0, view.height - h - 16), w, h };
  }
  function position(state) {
    for (const [key, element] of [['button', state.button], ['panel', state.dialog]]) {
      if (!element) continue;
      const b = box(state, key);
      Object.assign(element.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
    }
  }
  function persist(state) {
    state.changed++;
    state.saving = state.saving.catch(() => {}).then(() => save(structuredClone(state.layout)));
    state.saving.catch(error => {
      if (state.status?.isConnected) state.status.textContent = `창 위치를 저장하지 못했습니다: ${error.message}`;
    });
  }
  function attach(state, element, key, resize = false, toggle = null, eventSignal = null) {
    let drag = null;
    const signal = eventSignal ?? state.controller.signal;
    element.addEventListener('pointerdown', event => {
      if (event.button !== 0 || drag) return;
      if (!toggle) event.preventDefault();
      element.setPointerCapture(event.pointerId);
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, initial: box(state, key), moved: false };
    }, { signal });
    element.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      const view = dimensions(), b = { ...drag.initial };
      if (resize) {
        b.w = clamp(b.w + dx, Math.min(280, view.width - 16), view.width - b.x - 8);
        b.h = clamp(b.h + dy, Math.min(240, view.height - 16), view.height - b.y - 8);
      } else { b.x = clamp(b.x + dx, 8, view.width - b.w - 8); b.y = clamp(b.y + dy, 8, view.height - b.h - 8); }
      Object.assign(state.layout[key], { x: (b.x - 8) / Math.max(1, view.width - b.w - 16), y: (b.y - 8) / Math.max(1, view.height - b.h - 16) }, resize ? { w: b.w, h: b.h } : {});
      position(state);
    }, { signal });
    const finish = event => {
      if (!drag || event.pointerId !== drag.id) return;
      const tapped = toggle && !drag.moved && event.type === 'pointerup' && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6;
      const moved = drag.moved;
      drag = null;
      if (moved) persist(state);
      if (tapped && !disposed && isActive()) toggle();
    };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(name, finish, { signal });
    if (toggle) element.addEventListener('click', event => {
      event.stopPropagation();
      if (event.detail !== 0) { event.preventDefault(); return; }
      if (!disposed && isActive()) toggle();
    }, { signal });
    element.addEventListener('keydown', event => {
      const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!delta) return;
      event.preventDefault(); event.stopPropagation();
      const step = event.shiftKey ? 10 : 2, view = dimensions(), b = box(state, key);
      if (resize) {
        b.w = clamp(b.w + delta[0] * step, Math.min(280, view.width - 16), view.width - b.x - 8);
        b.h = clamp(b.h + delta[1] * step, Math.min(240, view.height - 16), view.height - b.y - 8);
      } else { b.x = clamp(b.x + delta[0] * step, 8, view.width - b.w - 8); b.y = clamp(b.y + delta[1] * step, 8, view.height - b.h - 8); }
      Object.assign(state.layout[key], { x: (b.x - 8) / Math.max(1, view.width - b.w - 16), y: (b.y - 8) / Math.max(1, view.height - b.h - 16) }, resize ? { w: b.w, h: b.h } : {});
      position(state); persist(state);
    }, { signal });
  }
  function get(host) {
    if (hosts.has(host)) return hosts.get(host);
    const state = { host, layout: geometry(), controller: new AbortController(), saving: Promise.resolve(), changed: 0 };
    hosts.set(host, state);
    state.style = document.createElement('style'); state.style.dataset.gfFloatingStyle = ''; state.style.textContent = css;
    window.addEventListener('resize', () => position(state), { signal: state.controller.signal });
    load().then(value => { if (!disposed && !state.changed) { state.layout = geometry(value); position(state); } }).catch(() => {});
    return state;
  }
  return {
    render(host, open) {
      if (disposed) return;
      const state = get(host);
      if (!state.style.isConnected) host._root.append(state.style);
      if (!state.button) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.gfImageTools = '';
        button.setAttribute('aria-label', '이미지 도구'); button.title = '이미지 도구 · 드래그하여 이동';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('aria-hidden', 'true');
        for (const [tag, attrs] of [['rect', { x: 3, y: 3, width: 18, height: 18, rx: 3 }], ['circle', { cx: 8, cy: 8, r: 1.5 }], ['path', { d: 'M3 16l5-5 4 4 3-3 6 6' }]]) {
          const node = document.createElementNS(svg.namespaceURI, tag); for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value); svg.append(node);
        }
        button.append(svg); state.button = button;
        button.addEventListener('pointerdown', event => event.stopPropagation(), { signal: state.controller.signal });
        button.addEventListener('keydown', event => event.stopPropagation(), { signal: state.controller.signal });
        attach(state, button, 'button', false, () => host._gfImageDialog?.isConnected ? host._gfImageDialog.close() : open());
      }
      if (!state.button.isConnected) host._root.append(state.button);
      state.button.setAttribute('aria-expanded', String(!!host._gfImageDialog?.isConnected));
      position(state);
    },
    decorateDialog(host, dialog, { close, status, content }) {
      const state = get(host); state.dialog = dialog; state.status = status;
      const dialogController = new AbortController();
      state.controller.signal.addEventListener('abort', () => dialogController.abort(), { once: true, signal: dialogController.signal });
      dialog.classList.add('gf-floating-window');
      const heading = dialog.querySelector('h2'), intro = heading.nextElementSibling;
      const head = document.createElement('div'); head.className = 'gf-floating-head';
      const move = document.createElement('button'); move.type = 'button'; move.className = 'gf-window-move'; move.textContent = '이미지 편집'; move.setAttribute('aria-label', '이미지 편집창 이동');
      close.classList.add('gf-window-close'); head.append(move, close); heading.replaceWith(head);
      const body = document.createElement('div'); body.className = 'gf-floating-body'; head.after(body); body.append(intro, content);
      const footer = document.createElement('div'); footer.className = 'gf-floating-footer'; footer.append(status); dialog.append(footer); state.footer = footer;
      const resize = document.createElement('button'); resize.type = 'button'; resize.className = 'gf-window-resize'; resize.textContent = '↘'; resize.setAttribute('aria-label', '이미지 편집창 크기 조절'); dialog.append(resize);
      attach(state, move, 'panel', false, null, dialogController.signal); attach(state, resize, 'panel', true, null, dialogController.signal);
      dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); dialog.close(); } }, { signal: dialogController.signal });
      dialog.addEventListener('close', () => { dialogController.abort(); if (state.dialog === dialog) { state.dialog = null; state.button?.setAttribute('aria-expanded', 'false'); } }, { once: true });
      state.button?.setAttribute('aria-expanded', 'true'); position(state);
    },
    placeSubmit(host, submit, dialog) {
      const state = hosts.get(host);
      if (state?.dialog !== dialog || !state?.footer?.isConnected) return;
      state.footer.querySelectorAll('[data-gf-submit]').forEach(node => node.remove()); submit.dataset.gfSubmit = ''; state.footer.append(submit);
    },
    async dispose() {
      disposed = true;
      for (const state of hosts.values()) { state.controller.abort(); state.style.remove(); state.button?.remove(); state.dialog?.remove(); await state.saving.catch(() => {}); }
      hosts.clear();
    },
  };
}
