'use strict';
/* =========================================================================
   UI: panels, element palette, pointer/keyboard input, camera, overlays,
   toasts, popups and modals.
   ========================================================================= */

const UI = (() => {
  const $ = id => document.getElementById(id);
  const TEMPS = [-200, -100, -50, -20, -10, 0, 10, 22, 40, 60, 80, 100, 150, 200, 300];
  const SPEEDS = [10, 20, 30, 45, 60, 90, 120, 180, 240];
  const CANVASES = [
    { name: 'Small', cells: 22000 }, { name: 'Medium', cells: 42000 },
    { name: 'Large', cells: 72000 }, { name: 'Huge', cells: 115000 },
  ];
  const BRUSHES = [['circle', 'Circle'], ['square', 'Square'], ['line', 'Line'], ['spray', 'Spray']];
  const TOOLS = [['mix', 'Mix'], ['heat', 'Heat'], ['cool', 'Cool'], ['select', 'Select'], ['zoom', 'Zoom'], ['pick', 'Pick']];
  const CAT_COLORS = {
    all: ['#ffffff', '#c9bfff'], powder: ['#ffe17a', '#f2b84b'], liquid: ['#6ac8ff', '#2f8cff'], gas: ['#e0ecf7', '#9fb6cc'],
    solid: ['#c9d2db', '#8d97a3'], life: ['#7dff8a', '#2fc24c'], energy: ['#ffd23d', '#ff7a1a'], explosive: ['#ff6a6a', '#e8373e'],
    special: ['#e0a8ff', '#a45cff'],
  };
  const LASER_DIR_MAP = [2, 1, 0, 7, 6, 5, 4, 3];
  const isTouch = () => matchMedia('(hover: none) and (pointer: coarse)').matches || innerWidth < 860;

  const s = {
    el: E.SAND, brush: 'circle', tool: 'draw', size: 4, cat: 'all', search: '',
    paused: false, speedIdx: 4, tempIdx: 7, canvasIdx: 1,
    view: { z: 1, ox: 0, oy: 0 }, base: { s: 1, left: 0, top: 0, w: 0, h: 0 },
    ptr: { down: false, button: 0, inside: false, cx: 0, cy: 0, gx: -1, gy: -1, lgx: -1, lgy: -1, sgx: 0, sgy: 0, scx: 0, scy: 0, moved: false, dir: 0, cool: 0, id: null },
    sel: null, clip: null, stamp: false,
    undo: [],
    shake: 0, modalOpen: false, queue: [],
  };
  let wrap, stage, overlay, octx, dpr = 1;
  let ghostCanvas = null;
  let onClear = null, onCanvasSize = null;

  /* ====================================================================== */
  /*  Build                                                                  */
  /* ====================================================================== */
  function build(opts) {
    onClear = opts.onClear; onCanvasSize = opts.onCanvasSize;
    wrap = $('stageWrap'); stage = $('stage'); overlay = $('cvOverlay'); octx = overlay.getContext('2d');

    const bg = $('brushGrid');
    BRUSHES.forEach(([id, name]) => {
      const b = document.createElement('button');
      b.className = 'tbtn'; b.dataset.brush = id;
      b.innerHTML = `${icon(id)}<span>${name}</span>`;
      b.onclick = () => { setBrush(id); Sfx.click(); };
      bg.appendChild(b);
    });
    const tg = $('toolGrid');
    TOOLS.forEach(([id, name]) => {
      const b = document.createElement('button');
      b.className = 'tbtn'; b.dataset.tool = id;
      b.innerHTML = `${icon(id)}<span>${name}</span>`;
      b.onclick = () => { setTool(s.tool === id ? 'draw' : id); Sfx.click(); };
      tg.appendChild(b);
    });

    const ct = $('catTabs');
    CATEGORIES.forEach(c => {
      const b = document.createElement('button');
      b.className = 'cat'; b.dataset.cat = c.id;
      b.style.setProperty('--c1', CAT_COLORS[c.id][0]); b.style.setProperty('--c2', CAT_COLORS[c.id][1]);
      b.innerHTML = icon(c.icon);
      b.onclick = () => { s.cat = c.id; s.search = ''; $('search').value = ''; renderPalette(); Sfx.tab(); };
      b.onmouseenter = e => showTip(e, `<b>${c.name}</b>`);
      b.onmouseleave = hideTip;
      ct.appendChild(b);
    });
    $('search').addEventListener('input', e => { s.search = e.target.value.trim().toLowerCase(); renderPalette(); });
    $('search').addEventListener('keydown', e => e.stopPropagation());
    $('btnEraser').onclick = () => { selectElement(0); Sfx.click(); };

    $('sizeRange').addEventListener('input', e => setSize(+e.target.value));
    $('btnUndo').onclick = undo;
    $('btnFit').onclick = fitView;
    $('btnPause').onclick = togglePause;
    $('btnClear').onclick = () => onClear();
    document.querySelectorAll('.stepper').forEach(st => {
      st.querySelectorAll('button').forEach(b => b.onclick = () => { stepSetting(st.dataset.step, +b.dataset.d); Sfx.click(); });
    });

    $('btnMenu').onclick = openMenu;
    $('btnCodex').onclick = openCodex;
    $('btnMissionsM').onclick = openMissionsModal;
    $('btnSound').onclick = () => {
      const m = !Sfx.muted; Sfx.setMuted(m); Progress.state.settings.muted = m; Progress.save(); updateSoundBtn();
    };

    document.querySelectorAll('#selBar button').forEach(b => b.onclick = () => selAction(b.dataset.sel));

    buildMobileBar();
    hydrateIcons();
    bindInput();
    setSize(s.size);
    setBrush('circle');
    setTool('draw');
    updateSettings();
    updateSoundBtn();
    renderPalette();
    window.addEventListener('resize', () => requestAnimationFrame(layout));
  }

  function buildMobileBar() {
    const mb = $('mobileBar');
    mb.innerHTML = `
      <div class="mb-size"><button class="mb-btn" data-m="size-">−</button><span id="mbSize">4</span><button class="mb-btn" data-m="size+">+</button></div>
      <button class="mb-btn" data-m="brush" id="mbBrush">${icon('circle')}</button>
      <div class="mb-sep"></div>
      ${TOOLS.filter(t => t[0] !== 'pick').map(([id]) => `<button class="mb-btn" data-m="tool" data-tool="${id}">${icon(id)}</button>`).join('')}
      <div class="mb-sep"></div>
      <button class="mb-btn" data-m="undo">${icon('undo')}</button>
      <button class="mb-btn" data-m="fit" id="mbFit">${icon('fit')}</button>
      <button class="mb-btn" data-m="temp" id="mbTemp">22°</button>
      <button class="mb-btn" data-m="speed" id="mbSpeed">60</button>
      <button class="mb-btn" data-m="pause" id="mbPause">${icon('pause')}</button>
      <button class="mb-btn danger" data-m="clear">${icon('trash')}</button>`;
    mb.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
      const m = b.dataset.m;
      Sfx.click();
      if (m === 'size-') setSize(s.size - 1);
      else if (m === 'size+') setSize(s.size + 1);
      else if (m === 'brush') { const i = BRUSHES.findIndex(x => x[0] === s.brush); setBrush(BRUSHES[(i + 1) % BRUSHES.length][0]); }
      else if (m === 'tool') setTool(s.tool === b.dataset.tool ? 'draw' : b.dataset.tool);
      else if (m === 'undo') undo();
      else if (m === 'fit') fitView();
      else if (m === 'temp') { s.tempIdx = (s.tempIdx + 1) % TEMPS.length; updateSettings(); }
      else if (m === 'speed') { s.speedIdx = (s.speedIdx + 1) % SPEEDS.length; updateSettings(); }
      else if (m === 'pause') togglePause();
      else if (m === 'clear') onClear();
    });
  }

  /* ====================================================================== */
  /*  Palette                                                                */
  /* ====================================================================== */
  function renderPalette(animateId) {
    document.querySelectorAll('.cat').forEach(b => b.classList.toggle('on', b.dataset.cat === s.cat && !s.search));
    const cat = CATEGORIES.find(c => c.id === s.cat);
    $('catName').textContent = s.search ? 'Search' : cat.name;
    const grid = $('elGrid');
    grid.innerHTML = '';
    const list = Progress.visible.filter(d => {
      if (s.search) return d.name.toLowerCase().includes(s.search) || d.key.toLowerCase().includes(s.search);
      return s.cat === 'all' || d.cat === s.cat;
    });
    // unlocked first, keep definition order
    list.sort((a, b) => (Progress.isUnlocked(b.id) - Progress.isUnlocked(a.id)) || a.id - b.id);
    const st = Progress.state;
    list.forEach(d => {
      const b = document.createElement('button');
      const un = Progress.isUnlocked(d.id);
      b.className = 'el' + (un ? '' : ' locked') + (d.id === s.el && s.tool === 'draw' ? ' on' : '');
      b.dataset.id = d.id;
      if (un) {
        b.style.setProperty('--sw', Renderer.swatchCss(d.id));
        b.style.setProperty('--glow', d.col[0]);
        b.innerHTML = `<span class="el-name">${d.name}</span>` + (!st.tried[d.key] && d.unlock !== 'base' ? '<span class="badge-new">NEW</span>' : '');
      } else {
        b.innerHTML = `<span class="el-name">${icon('lock')}${d.unlock.lvl && !d.unlock.disc ? 'LV ' + d.unlock.lvl : '???'}</span>`;
      }
      if (animateId === d.id) b.classList.add('unlock-anim');
      b.onclick = () => {
        if (Progress.isUnlocked(d.id)) { selectElement(d.id); Sfx.click(); }
        else { showLocked(d.id); Sfx.denied(); }
      };
      b.onmouseenter = e => {
        if (Progress.isUnlocked(d.id)) showTip(e, `<b>${d.name}</b>${d.desc || ''}`);
        else showTip(e, `<b>Locked</b>${lockText(d.id)}`);
      };
      b.onmouseleave = hideTip;
      grid.appendChild(b);
    });
    $('btnEraser').classList.toggle('on', s.el === 0 && s.tool === 'draw');
  }

  function lockText(id) {
    const r = Progress.unlockReq(id);
    const parts = [];
    if (r.disc) parts.push('Discover: ' + r.disc);
    if (r.lvl) parts.push('or reach Level ' + r.lvl);
    return parts.join('<br>').replace(/^or /, '');
  }

  function selectElement(id) {
    s.el = id;
    if (s.tool !== 'draw') setTool('draw');
    document.querySelectorAll('#elGrid .el').forEach(b => b.classList.toggle('on', +b.dataset.id === id));
    $('btnEraser').classList.toggle('on', id === 0);
    const d = ELEMENTS[id];
    if (id && d.single && s.brush === 'line') setBrush('circle');
  }

  function setBrush(id) {
    s.brush = id;
    document.querySelectorAll('[data-brush]').forEach(b => b.classList.toggle('on', b.dataset.brush === id));
    const mb = $('mbBrush'); if (mb) { mb.innerHTML = icon(id); }
    if (s.tool === 'select' || s.tool === 'zoom' || s.tool === 'pick') setTool('draw');
  }

  function setTool(id) {
    s.tool = id;
    if (id !== 'select') { s.sel = null; $('selBar').classList.add('hidden'); }
    if (id !== 'select') s.stamp = false;
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === id));
    document.querySelectorAll('#elGrid .el').forEach(b => b.classList.toggle('on', id === 'draw' && +b.dataset.id === s.el));
    $('btnEraser').classList.toggle('on', id === 'draw' && s.el === 0);
    wrap.style.cursor = id === 'zoom' ? 'zoom-in' : id === 'pick' ? 'copy' : 'none';
  }

  function setSize(v) {
    s.size = Math.max(1, Math.min(40, v | 0));
    $('sizeVal').textContent = s.size;
    const r = $('sizeRange'); r.value = s.size; r.style.setProperty('--p', ((s.size - 1) / 39 * 100) + '%');
    const m = $('mbSize'); if (m) m.textContent = s.size;
  }

  function togglePause() {
    s.paused = !s.paused;
    const b = $('btnPause');
    b.innerHTML = s.paused ? `${icon('play')}<span>Play</span>` : `${icon('pause')}<span>Pause</span>`;
    b.classList.toggle('playing', s.paused);
    const m = $('mbPause'); m.innerHTML = icon(s.paused ? 'play' : 'pause'); m.classList.toggle('playing', s.paused);
    $('pausedTag').classList.toggle('hidden', !s.paused);
    Sfx.click();
  }

  function stepSetting(k, d) {
    if (k === 'temp') s.tempIdx = Math.max(0, Math.min(TEMPS.length - 1, s.tempIdx + d));
    if (k === 'speed') s.speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, s.speedIdx + d));
    if (k === 'canvas') {
      const n = Math.max(0, Math.min(CANVASES.length - 1, s.canvasIdx + d));
      if (n !== s.canvasIdx) { s.canvasIdx = n; onCanvasSize(CANVASES[n].cells); }
    }
    updateSettings();
  }

  function updateSettings() {
    const t = TEMPS[s.tempIdx];
    Sim.ambient = t;
    $('tempVal').textContent = t + '°C';
    $('tempVal').style.color = t < 0 ? 'var(--cyan)' : t > 60 ? 'var(--orange)' : '';
    $('speedVal').textContent = SPEEDS[s.speedIdx] + ' t/s' + (SPEEDS[s.speedIdx] > 60 ? ' ⚡' : '');
    $('canvasVal').textContent = CANVASES[s.canvasIdx].name;
    $('mbTemp').textContent = t + '°';
    $('mbSpeed').textContent = SPEEDS[s.speedIdx] + '';
  }

  function updateSoundBtn() {
    const b = $('btnSound');
    b.innerHTML = icon(Sfx.muted ? 'mute' : 'sound');
  }

  /* ====================================================================== */
  /*  Camera                                                                 */
  /* ====================================================================== */
  function layout() {
    const W = Sim.W, H = Sim.H;
    const r = wrap.getBoundingClientRect();
    const pad = 0;
    const sc = Math.min((r.width - pad) / W, (r.height - pad) / H);
    s.base = { s: sc, w: W * sc, h: H * sc, left: (r.width - W * sc) / 2, top: (r.height - H * sc) / 2, ww: r.width, wh: r.height };
    stage.style.width = s.base.w + 'px';
    stage.style.height = s.base.h + 'px';
    stage.style.left = s.base.left + 'px';
    stage.style.top = s.base.top + 'px';
    dpr = Math.min(2, window.devicePixelRatio || 1);
    overlay.width = Math.round(r.width * dpr);
    overlay.height = Math.round(r.height * dpr);
    clampView();
    applyView();
  }

  function clampView() {
    const v = s.view, b = s.base;
    const w = b.w * v.z, h = b.h * v.z;
    if (w <= b.ww) v.ox = (b.ww - w) / 2 - b.left;
    else v.ox = Math.min(-b.left, Math.max(b.ww - b.left - w, v.ox));
    if (h <= b.wh) v.oy = (b.wh - h) / 2 - b.top;
    else v.oy = Math.min(-b.top, Math.max(b.wh - b.top - h, v.oy));
  }
  function applyView() {
    const v = s.view;
    stage.style.transform = `translate(${v.ox}px, ${v.oy}px) scale(${v.z})`;
    $('btnFit').disabled = v.z === 1;
  }
  function zoomAt(cx, cy, factor) {
    const v = s.view, b = s.base;
    const r = wrap.getBoundingClientRect();
    const mx = cx - r.left, my = cy - r.top;
    const nz = Math.max(1, Math.min(8, v.z * factor));
    // keep the point under the cursor fixed
    const lx = (mx - b.left - v.ox) / v.z, ly = (my - b.top - v.oy) / v.z;
    v.z = nz;
    v.ox = mx - b.left - lx * nz;
    v.oy = my - b.top - ly * nz;
    clampView(); applyView();
  }
  function fitView() { s.view = { z: 1, ox: 0, oy: 0 }; clampView(); applyView(); }

  function toGrid(cx, cy) {
    const r = stage.getBoundingClientRect();
    return [Math.floor((cx - r.left) / r.width * Sim.W), Math.floor((cy - r.top) / r.height * Sim.H)];
  }
  function gridToWrap(gx, gy) {
    const r = stage.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    const cs = r.width / Sim.W;
    return [r.left - w.left + gx * cs, r.top - w.top + gy * cs, cs];
  }

  /* ====================================================================== */
  /*  Input                                                                  */
  /* ====================================================================== */
  function bindInput() {
    wrap.addEventListener('contextmenu', e => e.preventDefault());
    wrap.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    wrap.addEventListener('pointerleave', () => { s.ptr.inside = false; });
    wrap.addEventListener('pointerenter', () => { s.ptr.inside = true; });
    wrap.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.ctrlKey || s.tool === 'zoom') zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
      else setSize(s.size + (e.deltaY < 0 ? 1 : -1));
    }, { passive: false });
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', () => { Sfx.unlock(); Platform.gameplayStart(); }, { capture: true });
  }

  function onDown(e) {
    if (s.modalOpen) return;
    const p = s.ptr;
    if (p.down) return;
    wrap.setPointerCapture && wrap.setPointerCapture(e.pointerId);
    p.id = e.pointerId;
    p.down = true; p.button = e.button; p.inside = true;
    p.cx = e.clientX; p.cy = e.clientY; p.scx = e.clientX; p.scy = e.clientY; p.moved = false;
    const [gx, gy] = toGrid(e.clientX, e.clientY);
    p.gx = p.lgx = p.sgx = gx; p.gy = p.lgy = p.sgy = gy;
    p.cool = 0;
    p.panOx = s.view.ox; p.panOy = s.view.oy;
    hideTip();

    if (e.button === 1 || s.tool === 'pick') { pickAt(gx, gy); p.down = false; return; }
    if (s.tool === 'zoom') return;
    if (s.tool === 'select') {
      if (s.stamp && s.clip) {
        pushUndo();
        Sim.pasteRegion(s.clip, gx - (s.clip.w >> 1), gy - (s.clip.h >> 1));
        Sfx.place(ST.SOLID);
        p.down = false;
        return;
      }
      s.sel = { x0: gx, y0: gy, x1: gx, y1: gy };
      $('selBar').classList.add('hidden');
      return;
    }
    pushUndo();
  }

  function onMove(e) {
    const p = s.ptr;
    if (p.id !== null && p.down && e.pointerId !== p.id) return;
    p.cx = e.clientX; p.cy = e.clientY;
    const [gx, gy] = toGrid(e.clientX, e.clientY);
    p.gx = gx; p.gy = gy;
    if (Math.abs(e.clientX - p.scx) + Math.abs(e.clientY - p.scy) > 6) p.moved = true;
    if (!p.down) return;
    if (s.tool === 'zoom' && p.moved) {
      s.view.ox = p.panOx + (e.clientX - p.scx);
      s.view.oy = p.panOy + (e.clientY - p.scy);
      clampView(); applyView();
    }
    if (s.tool === 'select' && s.sel) { s.sel.x1 = gx; s.sel.y1 = gy; }
    // track drag direction for lasers
    const dx = gx - p.lgx, dy = gy - p.lgy;
    if (dx * dx + dy * dy >= 4) {
      const k = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
      p.dir = LASER_DIR_MAP[k];
    }
  }

  function onUp(e) {
    const p = s.ptr;
    if (!p.down || (p.id !== null && e.pointerId !== p.id)) return;
    p.down = false; p.id = null;
    if (s.tool === 'zoom' && !p.moved) zoomAt(e.clientX, e.clientY, p.button === 2 || e.altKey || e.shiftKey ? 0.5 : 2);
    if (s.tool === 'draw' && s.brush === 'line' && p.button !== 1) {
      const el = p.button === 2 ? 0 : s.el;
      line(p.sgx, p.sgy, p.gx, p.gy, el);
    }
    if (s.tool === 'select' && s.sel) {
      normSel();
      const r = s.sel;
      if (r.x1 - r.x0 < 1 && r.y1 - r.y0 < 1) { s.sel = null; return; }
      const [sx, sy, cs] = gridToWrap(r.x0, r.y1 + 1);
      const bar = $('selBar');
      bar.classList.remove('hidden');
      const w = wrap.getBoundingClientRect();
      bar.style.left = Math.max(6, Math.min(w.width - 260, sx)) + 'px';
      bar.style.top = Math.max(6, Math.min(w.height - 44, sy + 6)) + 'px';
    }
  }

  function normSel() {
    const r = s.sel, W = Sim.W, H = Sim.H;
    const x0 = Math.max(0, Math.min(r.x0, r.x1)), x1 = Math.min(W - 1, Math.max(r.x0, r.x1));
    const y0 = Math.max(0, Math.min(r.y0, r.y1)), y1 = Math.min(H - 1, Math.max(r.y0, r.y1));
    s.sel = { x0, y0, x1, y1 };
  }

  function selAction(a) {
    const r = s.sel;
    if (!r) return;
    Sfx.click();
    if (a === 'copy' || a === 'cut') {
      s.clip = Sim.copyRegion(r.x0, r.y0, r.x1, r.y1);
      buildGhost();
      if (a === 'cut') { pushUndo(); Sim.fillRegion(r.x0, r.y0, r.x1, r.y1, 0); }
      s.stamp = true;
      toast({ k: 'STAMP MODE', n: isTouch() ? 'Tap to paste' : 'Click to paste', c: 'var(--cyan)', life: 2 });
    } else if (a === 'fill') {
      pushUndo(); Sim.fillRegion(r.x0, r.y0, r.x1, r.y1, s.el);
      Sim.stats.placed[s.el] += (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
    } else if (a === 'delete') {
      pushUndo(); Sim.fillRegion(r.x0, r.y0, r.x1, r.y1, 0);
    }
    s.sel = null;
    $('selBar').classList.add('hidden');
  }

  function buildGhost() {
    const c = s.clip;
    ghostCanvas = document.createElement('canvas');
    ghostCanvas.width = c.w; ghostCanvas.height = c.h;
    const g = ghostCanvas.getContext('2d');
    const im = g.createImageData(c.w, c.h);
    const b = new Uint32Array(im.data.buffer);
    const PAL = Renderer.PAL;
    for (let i = 0; i < c.w * c.h; i++) if (c.type[i]) b[i] = PAL[(c.type[i] << 4) | (c.shade[i] & 15)];
    g.putImageData(im, 0, 0);
  }

  function pickAt(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= Sim.W || gy >= Sim.H) return;
    let t = Sim.type[gy * Sim.W + gx];
    if (t === E.TBURN) t = E.THERMITE;
    if (t && Progress.isUnlocked(t)) {
      selectElement(t);
      revealInPalette(t);
      Sfx.click();
    }
  }

  function revealInPalette(id) {
    const d = ELEMENTS[id];
    if (s.cat !== 'all' && s.cat !== d.cat) { s.cat = d.cat; renderPalette(); selectElement(id); }
    const b = document.querySelector(`#elGrid .el[data-id="${id}"]`);
    if (b) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function onKey(e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') {
      if (s.modalOpen) { closeModal(); return; }
      if (s.stamp || s.sel) { s.stamp = false; s.sel = null; $('selBar').classList.add('hidden'); return; }
    }
    if (s.modalOpen) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') { e.preventDefault(); togglePause(); }
    else if (k === '[') setSize(s.size - 1);
    else if (k === ']') setSize(s.size + 1);
    else if (k === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
    else if (k === 'e') selectElement(0);
    else if (k === 'f') fitView();
    else if (k >= '1' && k <= '4') setBrush(BRUSHES[+k - 1][0]);
    else if (k === 'm') setTool(s.tool === 'mix' ? 'draw' : 'mix');
    else if (k === 'h') setTool(s.tool === 'heat' ? 'draw' : 'heat');
    else if (k === 'c' && !e.ctrlKey && !e.metaKey) setTool(s.tool === 'cool' ? 'draw' : 'cool');
    else if (k === 'p') setTool('pick');
  }

  /* called once per frame by the main loop */
  function applyInput() {
    const p = s.ptr;
    if (!p.down || s.modalOpen) return;
    const gx = p.gx, gy = p.gy;
    if (s.tool === 'heat' || s.tool === 'cool') {
      Sim.heatBrush(gx, gy, s.size, s.brush, s.tool === 'heat' ? 45 : -45);
    } else if (s.tool === 'mix') {
      Sim.mixBrush(gx, gy, s.size);
    } else if (s.tool === 'draw' && s.brush !== 'line') {
      const el = p.button === 2 ? 0 : s.el;
      const d = ELEMENTS[el];
      if (el && d.single) {
        if (p.cool-- <= 0) {
          Sim.paint(gx, gy, 1, 'circle', el, { dir: p.dir });
          p.cool = el === E.LASER ? 5 : 12;
          Sfx.place(d.st);
        }
      } else {
        stroke(p.lgx, p.lgy, gx, gy, el);
      }
    }
    p.lgx = gx; p.lgy = gy;
  }

  function dab(x, y, el) {
    const n = Sim.paint(x, y, s.size, s.brush, el);
    if (el === 0) Sfx.erase();
    else if (n) Sfx.place(ELEMENTS[el].st);
  }
  function stroke(x0, y0, x1, y1, el) {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    const step = Math.max(1, (s.size / 2) | 0);
    if (dist <= step) { dab(x1, y1, el); return; }
    const n = Math.ceil(dist / step);
    for (let i = 1; i <= n; i++) dab(Math.round(x0 + dx * i / n), Math.round(y0 + dy * i / n), el);
  }
  function line(x0, y0, x1, y1, el) {
    const dx = x1 - x0, dy = y1 - y0;
    const n = Math.max(Math.abs(dx), Math.abs(dy), 1);
    const saved = s.brush; s.brush = 'circle';
    for (let i = 0; i <= n; i++) Sim.paint(Math.round(x0 + dx * i / n), Math.round(y0 + dy * i / n), s.size, 'circle', el);
    s.brush = saved;
    Sfx.place(el ? ELEMENTS[el].st : ST.SOLID);
  }

  function pushUndo() {
    s.undo.push(Sim.snapshot());
    if (s.undo.length > 20) s.undo.shift();
  }
  function undo() {
    const snap = s.undo.pop();
    if (snap) { Sim.restore(snap); Sfx.click(); }
    else Sfx.denied();
  }

  /* ====================================================================== */
  /*  Overlay (brush cursor, selection, line preview)                        */
  /* ====================================================================== */
  function drawOverlay() {
    const W = overlay.width, H = overlay.height;
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, W, H);
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const p = s.ptr;
    const touchIdle = !p.down && !matchMedia('(hover: hover)').matches;
    if ((!p.inside && !p.down) || s.modalOpen || touchIdle) return;
    const [ox, oy, cs] = gridToWrap(0, 0);
    const gx = p.gx, gy = p.gy;
    octx.lineWidth = 1.5;

    if (s.tool === 'select') {
      if (s.stamp && ghostCanvas) {
        const x = ox + (gx - (s.clip.w >> 1)) * cs, y = oy + (gy - (s.clip.h >> 1)) * cs;
        octx.globalAlpha = 0.6; octx.imageSmoothingEnabled = false;
        octx.drawImage(ghostCanvas, x, y, s.clip.w * cs, s.clip.h * cs);
        octx.globalAlpha = 1;
        octx.strokeStyle = '#3de0ff'; octx.setLineDash([5, 4]);
        octx.strokeRect(x, y, s.clip.w * cs, s.clip.h * cs);
        octx.setLineDash([]);
        return;
      }
      if (s.sel) {
        const r = s.sel;
        const x0 = Math.min(r.x0, r.x1), x1 = Math.max(r.x0, r.x1), y0 = Math.min(r.y0, r.y1), y1 = Math.max(r.y0, r.y1);
        octx.fillStyle = '#3de0ff22';
        octx.fillRect(ox + x0 * cs, oy + y0 * cs, (x1 - x0 + 1) * cs, (y1 - y0 + 1) * cs);
        octx.strokeStyle = '#3de0ff'; octx.setLineDash([6, 4]); octx.lineDashOffset = -performance.now() / 40;
        octx.strokeRect(ox + x0 * cs, oy + y0 * cs, (x1 - x0 + 1) * cs, (y1 - y0 + 1) * cs);
        octx.setLineDash([]);
      }
      crosshair(ox + (gx + 0.5) * cs, oy + (gy + 0.5) * cs);
      return;
    }
    if (s.tool === 'zoom' || s.tool === 'pick') return;

    const col = s.tool === 'heat' ? '#ff8a3d' : s.tool === 'cool' ? '#3de0ff' : s.tool === 'mix' ? '#c59bff'
      : (s.el === 0 || p.button === 2 && p.down) ? '#ff5d8f' : ELEMENTS[s.el].col[0];
    const single = s.tool === 'draw' && s.el && ELEMENTS[s.el].single;
    const r = single ? 0.5 : Math.max(0.5, s.size - 0.5);
    const cx = ox + (gx + 0.5) * cs, cy = oy + (gy + 0.5) * cs;

    if (s.tool === 'draw' && s.brush === 'line' && p.down) {
      const sx = ox + (p.sgx + 0.5) * cs, sy = oy + (p.sgy + 0.5) * cs;
      octx.strokeStyle = col; octx.globalAlpha = 0.5;
      octx.lineWidth = Math.max(1, s.size * 2 - 1) * cs; octx.lineCap = 'round';
      octx.beginPath(); octx.moveTo(sx, sy); octx.lineTo(cx, cy); octx.stroke();
      octx.globalAlpha = 1; octx.lineWidth = 1.5;
    }
    octx.strokeStyle = '#000a';
    octx.lineWidth = 3;
    shapePath(cx, cy, r * cs, single);
    octx.stroke();
    octx.strokeStyle = col;
    octx.lineWidth = 1.5;
    shapePath(cx, cy, r * cs, single);
    octx.stroke();
    if (single && s.el === E.LASER) {
      const DX = [0, 1, 1, 1, 0, -1, -1, -1], DY = [1, 1, 0, -1, -1, -1, 0, 1];
      octx.strokeStyle = '#ff2d55'; octx.setLineDash([4, 4]);
      octx.beginPath(); octx.moveTo(cx, cy); octx.lineTo(cx + DX[p.dir] * 40, cy + DY[p.dir] * 40); octx.stroke();
      octx.setLineDash([]);
    }
  }
  function shapePath(cx, cy, r, single) {
    octx.beginPath();
    if (single) { octx.arc(cx, cy, Math.max(6, r + 4), 0, Math.PI * 2); return; }
    if (s.brush === 'square') octx.rect(cx - r, cy - r, r * 2, r * 2);
    else octx.arc(cx, cy, Math.max(2, r), 0, Math.PI * 2);
  }
  function crosshair(x, y) {
    octx.strokeStyle = '#fff';
    octx.beginPath(); octx.moveTo(x - 7, y); octx.lineTo(x + 7, y); octx.moveTo(x, y - 7); octx.lineTo(x, y + 7); octx.stroke();
  }

  function updateHover(fps) {
    const p = s.ptr;
    let txt = '-';
    if (p.inside && p.gx >= 0 && p.gy >= 0 && p.gx < Sim.W && p.gy < Sim.H) {
      const i = p.gy * Sim.W + p.gx;
      const t = Sim.type[i];
      const tc = Math.round(Sim.temp[i]);
      txt = `${p.gx}, ${p.gy}<br><span style="color:${t ? ELEMENTS[t].col[0] : '#898b90'}">${ELEMENTS[t].name}</span> · ${tc}°C`;
    }
    $('hoverInfo').innerHTML = txt;
    $('fpsInfo').textContent = fps + ' FPS · ' + Sim.particles.count + ' fx';
  }

  /* ====================================================================== */
  /*  HUD: XP, missions, combo                                               */
  /* ====================================================================== */
  function updateXp() {
    const st = Progress.state;
    const need = Progress.xpForLevel(st.level);
    const pct = Math.min(100, st.xp / need * 100);
    $('lvlNum').textContent = st.level;
    $('xpFill').style.width = pct + '%';
    $('xpGhost').style.width = pct + '%';
    $('xpText').textContent = `${st.xp} / ${need} XP`;
    $('discText').textContent = `${Progress.discoveredCount} / ${Progress.visible.length} found`;
  }

  function missionHtml(m, idx) {
    const pct = Math.min(100, m.progress / m.goal * 100);
    const sw = m.el && E[m.el] != null ? Renderer.swatchCss(E[m.el]) : '#555';
    return `<div class="mission${m.done ? ' done' : ''}${m.fresh ? ' fresh' : ''}" data-idx="${idx}">
      <div class="m-sw" style="background:${sw}"></div>
      <div class="m-text">${m.text}</div>
      <div class="m-bar"><i style="width:${pct}%"></i></div>
      <div class="m-meta"><span>${fmt(Math.min(m.progress, m.goal))} / ${fmt(m.goal)}</span><b>+${m.reward} XP</b></div>
      ${m.done ? '' : `<button class="m-reroll" data-reroll="${idx}" title="Swap mission">${icon('reroll')}</button>`}
    </div>`;
  }
  const seenMissions = new WeakSet();
  function renderMissions() {
    const ms = Progress.state.missions;
    ms.forEach(m => { m.fresh = !seenMissions.has(m); seenMissions.add(m); });
    const html = ms.map(missionHtml).join('');
    $('missionList').innerHTML = html;
    $('missionCount').textContent = ms.filter(m => !m.done).length;
    const mm = document.getElementById('missionListModal');
    if (mm) mm.innerHTML = html;
    document.querySelectorAll('[data-reroll]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      if (Progress.reroll(+b.dataset.reroll)) Sfx.tab();
      else { Sfx.denied(); toast({ k: 'HOLD ON', n: 'You can swap again soon', c: 'var(--orange)', life: 1.6 }); }
    });
    ms.forEach(m => { m.fresh = false; });
  }
  function updateMissionBars() {
    const ms = Progress.state.missions;
    document.querySelectorAll('.mission').forEach(div => {
      const m = ms[+div.dataset.idx];
      if (!m) return;
      const bar = div.querySelector('.m-bar i');
      if (bar) bar.style.width = Math.min(100, m.progress / m.goal * 100) + '%';
      const meta = div.querySelector('.m-meta span');
      if (meta) meta.textContent = `${fmt(Math.min(m.progress, m.goal))} / ${fmt(m.goal)}`;
    });
  }

  function setCombo(n, frac) {
    const box = $('comboBox');
    if (n < 2) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const num = $('comboNum');
    if (+num.textContent !== n) {
      num.textContent = n;
      box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump');
    }
    $('comboFill').style.width = (frac * 100) + '%';
  }

  /* ====================================================================== */
  /*  Juice: popups, toasts, shake, flash                                    */
  /* ====================================================================== */
  function pop(gx, gy, text, sub, color, size) {
    const fx = $('fx');
    if (fx.childElementCount > 14) return;
    const [x, y] = gridToWrap(gx, gy);
    const d = document.createElement('div');
    d.className = 'pop';
    d.style.left = x + 'px'; d.style.top = y + 'px';
    d.style.color = color || '#ffd23d';
    d.style.fontSize = (size || 20) + 'px';
    d.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    fx.appendChild(d);
    setTimeout(() => d.remove(), 1150);
  }

  function toast(o) {
    const stack = $('toastStack');
    while (stack.childElementCount > 2) stack.firstChild.remove();
    const d = document.createElement('div');
    d.className = 'toast';
    if (o.c) d.style.setProperty('--c', o.c);
    const life = o.life || 3;
    d.style.setProperty('--life', life + 's');
    d.innerHTML = (o.sw ? `<div class="t-sw" style="background:${o.sw}"></div>` : '') +
      `<div><div class="t-k">${o.k}</div><div class="t-n">${o.n}${o.xp ? `<span class="t-x">+${o.xp} XP</span>` : ''}</div></div>`;
    stack.appendChild(d);
    setTimeout(() => d.remove(), (life + 0.5) * 1000);
  }

  function shake(m) { if (Progress.state.settings.shake) s.shake = Math.max(s.shake, m); }
  function tickShake() {
    const el = $('shake');
    if (s.shake > 0.3) {
      el.style.transform = `translate(${(Math.random() - 0.5) * s.shake}px, ${(Math.random() - 0.5) * s.shake}px)`;
      s.shake *= 0.86;
    } else if (s.shake) { s.shake = 0; el.style.transform = ''; }
  }
  function flash(a) {
    const f = $('flash');
    f.style.transition = 'none'; f.style.opacity = a;
    void f.offsetWidth;
    f.style.transition = 'opacity 0.9s ease-out'; f.style.opacity = 0;
  }

  /* ====================================================================== */
  /*  Tooltip                                                                */
  /* ====================================================================== */
  function showTip(e, html) {
    if (!matchMedia('(hover: hover)').matches) return;
    const t = $('tooltip');
    t.innerHTML = html; t.classList.remove('hidden');
    const r = e.currentTarget.getBoundingClientRect();
    const tr = t.getBoundingClientRect();
    let x = r.left + r.width / 2 - tr.width / 2, y = r.top - tr.height - 10;
    if (y < 6) y = r.bottom + 10;
    x = Math.max(6, Math.min(innerWidth - tr.width - 6, x));
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  function hideTip() { $('tooltip').classList.add('hidden'); }

  /* ====================================================================== */
  /*  Modals                                                                 */
  /* ====================================================================== */
  function openModal(html, opts = {}) {
    if (s.modalOpen && !opts.force) { s.queue.push([html, opts]); return; }
    if (typeof html === 'function') html = html();
    s.modalOpen = true;
    s.modalKind = opts.kind || null;
    s.ptr.down = false;
    hideTip();
    const card = $('modalCard');
    card.className = 'modal-card' + (opts.wide ? ' wide' : '') + (opts.cls ? ' ' + opts.cls : '');
    card.innerHTML = (opts.noX ? '' : '<button class="modal-x" data-close>✕</button>') + html;
    hydrateIcons(card);
    $('modal').classList.remove('hidden');
    card.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { Sfx.click(); closeModal(); });
    $('modal').onclick = e => { if (e.target.id === 'modal' && !opts.sticky) closeModal(); };
    if (opts.pause !== false) Platform.gameplayStop();
    s.onModalClose = opts.onClose || null;
    if (opts.bind) opts.bind(card);
  }
  function closeModal() {
    if (!s.modalOpen) return;
    s.modalOpen = false;
    $('modal').classList.add('hidden');
    document.querySelectorAll('.confetti').forEach(c => c.remove());
    const f = s.onModalClose; s.onModalClose = null;
    if (f) f();
    Platform.gameplayStart();
    if (s.modalKind === 'levelup') lu = null;
    s.modalKind = null;
    if (s.queue.length) { const [h, o] = s.queue.shift(); setTimeout(() => openModal(h, o), 120); }
  }

  function openMenu() {
    Sfx.click();
    const st = Progress.state, set = st.settings;
    openModal(`
      <h2>Menu</h2>
      <div class="set-row"><label>Sound effects</label><input type="range" id="mSfx" min="0" max="1" step="0.05" value="${set.sfx}"></div>
      <div class="set-row"><label>Music</label><input type="range" id="mMusic" min="0" max="1" step="0.05" value="${set.music}"></div>
      <div class="set-row"><div><label>Glow effects</label><small>Turn off for better performance</small></div><button class="switch ${set.glow ? 'on' : ''}" id="mGlow"></button></div>
      <div class="set-row"><div><label>Screen shake</label></div><button class="switch ${set.shake ? 'on' : ''}" id="mShake"></button></div>
      <div class="btn-row">
        <button class="btn" id="mSave">${icon('save')} Save creation</button>
        <button class="btn ghost" id="mLoad">${icon('load')} Load creation</button>
      </div>
      <div class="btn-row">
        <button class="btn yellow" id="mHelp">How to play</button>
        <button class="btn pink" data-close>Resume</button>
      </div>
      <div class="btn-row" style="justify-content:flex-end"><button class="btn danger" id="mReset" style="font-size:11px;padding:8px 12px">Reset progress</button></div>`,
    { bind: card => {
      const sfx = card.querySelector('#mSfx'), mus = card.querySelector('#mMusic');
      const paint = r => r.style.setProperty('--p', (r.value * 100) + '%');
      paint(sfx); paint(mus);
      sfx.oninput = () => { set.sfx = +sfx.value; Sfx.setSfx(set.sfx); paint(sfx); Progress.save(); };
      mus.oninput = () => { set.music = +mus.value; Sfx.setMusic(set.music); paint(mus); Progress.save(); };
      card.querySelector('#mGlow').onclick = e => { set.glow = !set.glow; e.currentTarget.classList.toggle('on', set.glow); document.body.classList.toggle('noglow', !set.glow); Renderer.setGlow(set.glow); Progress.save(); };
      card.querySelector('#mShake').onclick = e => { set.shake = !set.shake; e.currentTarget.classList.toggle('on', set.shake); Progress.save(); };
      card.querySelector('#mSave').onclick = () => { Platform.setItem('slot1', JSON.stringify(Sim.serialize())); toast({ k: 'SAVED', n: 'Creation saved', c: 'var(--lime)', life: 1.8 }); Sfx.mission(); };
      card.querySelector('#mLoad').onclick = () => {
        const raw = Platform.getItem('slot1');
        if (!raw) { toast({ k: 'NOTHING HERE', n: 'Save a creation first', c: 'var(--orange)', life: 1.8 }); Sfx.denied(); return; }
        pushUndo();
        try { Sim.deserialize(JSON.parse(raw)); layout(); } catch (e) { /* ignore */ }
        closeModal();
        toast({ k: 'LOADED', n: 'Creation restored', c: 'var(--lime)', life: 1.8 });
      };
      card.querySelector('#mHelp').onclick = () => { closeModal(); setTimeout(openHelp, 150); };
      card.querySelector('#mReset').onclick = () => {
        const b = card.querySelector('#mReset');
        if (b.dataset.armed) Progress.reset();
        else { b.dataset.armed = 1; b.textContent = 'Tap again to confirm'; }
      };
    } });
  }

  function openHelp() {
    openModal(`
      <h2>How to play</h2>
      <p>Pick an element below and draw on the canvas. Mix materials, heat them up, freeze them, zap them - and watch what happens. Every new reaction you trigger can <b style="color:var(--yellow)">discover a new element</b>!</p>
      ${isTouch() ? `<div class="help-list" style="margin-top:14px">
        <div><kbd>Drag</kbd>Draw selected element</div>
        <div><kbd>Eraser</kbd>Pick it in the palette to erase</div>
        <div><kbd>− / +</kbd>Brush size</div>
        <div><kbd>Toolbar</kbd>Mix, heat, cool, select, zoom, undo, pause</div>
      </div>` : `<div class="help-list" style="margin-top:14px">
        <div><kbd>Left click</kbd>Draw selected element</div>
        <div><kbd>Right click</kbd>Erase</div>
        <div><kbd>Middle click / P</kbd>Pick element under cursor</div>
        <div><kbd>Scroll · [ ]</kbd>Brush size</div>
        <div><kbd>Ctrl + Scroll</kbd>Zoom · drag with Zoom tool to pan</div>
        <div><kbd>Space</kbd>Pause / play</div>
        <div><kbd>Ctrl + Z</kbd>Undo</div>
        <div><kbd>1 - 4</kbd>Circle · Square · Line · Spray</div>
        <div><kbd>M · H · C</kbd>Mix · Heat · Cool tools</div>
        <div><kbd>E</kbd>Eraser</div>
      </div>`}
      <p style="margin-top:14px">Complete <b style="color:var(--lime)">missions</b> and discoveries to earn XP. Level up to unlock TNT, lasers, black holes, nukes and more.</p>
      <div class="btn-row"><button class="btn pink" data-close>Let's go!</button></div>`);
  }

  function openCodex() {
    Sfx.click();
    const st = Progress.state;
    const total = Progress.visible.length, found = Progress.discoveredCount;
    let html = `<h2>Element Codex</h2>
      <div class="codex-head"><div class="codex-bar"><i style="width:${found / total * 100}%"></i></div><b style="font-family:var(--pix)">${found} / ${total}</b></div>`;
    CATEGORIES.slice(1).forEach(c => {
      const list = Progress.visible.filter(d => d.cat === c.id);
      html += `<div class="codex-cat">${c.name}</div><div class="codex-grid">`;
      list.forEach(d => {
        const un = Progress.isEarned(d.id);
        html += un
          ? `<div class="cx" data-cx="${d.id}"><div class="cx-sw" style="background:${Renderer.swatchCss(d.id)}"></div><div><b>${d.name}</b><span>${d.desc || ''}</span></div></div>`
          : `<div class="cx locked" data-cx="${d.id}"><div class="cx-sw">${icon('lock')}</div><div><b>???</b><span>${lockText(d.id)}</span></div></div>`;
      });
      html += '</div>';
    });
    openModal(html, { wide: true, bind: card => {
      card.querySelectorAll('[data-cx]').forEach(div => div.onclick = () => {
        const id = +div.dataset.cx;
        if (Progress.isUnlocked(id)) { selectElement(id); revealInPalette(id); closeModal(); }
        else { closeModal(); setTimeout(() => showLocked(id), 150); }
      });
    } });
  }

  function openMissionsModal() {
    Sfx.click();
    $('missionDot').classList.add('hidden');
    openModal(`<h2>Missions</h2><div id="missionListModal" style="display:flex;flex-direction:column;gap:8px"></div>`,
      { onClose: () => {} });
    renderMissions();
  }

  function showLocked(id) {
    const d = ELEMENTS[id];
    const r = Progress.unlockReq(id);
    const lvl = Progress.state.level;
    openModal(`
      <div class="el-card">
        <div class="big-sw" style="background:repeating-linear-gradient(-45deg,#1b1c1f 0 10px,#131417 10px 20px)">${icon('lock')}</div>
        <div><div style="font-family:var(--pix);font-size:11px;color:var(--ink3);letter-spacing:1px">LOCKED ${(CATEGORIES.find(c => c.id === d.cat) || {}).name || ''}</div>
        <h2 style="margin:4px 0 6px">${r.disc ? '???' : d.name}</h2>
        <p>${r.disc ? 'A mystery element. Find it by experimenting!' : d.desc}</p></div>
      </div>
      <div class="req">
        ${r.disc ? `<div><b>DISCOVER</b>${r.disc}</div>` : ''}
        ${r.lvl ? `<div><b>LEVEL ${r.lvl}</b>${lvl >= r.lvl ? 'Reached!' : `You are level ${lvl} - ${r.lvl - lvl} to go`}</div>` : ''}
      </div>
      <div class="btn-row">
        <button class="btn yellow" id="adUnlock">${icon('ad')} Unlock now</button>
        <button class="btn ghost" data-close>Keep exploring</button>
      </div>`,
    { bind: card => {
      card.querySelector('#adUnlock').onclick = () => {
        closeModal();
        Platform.requestAd('rewarded', ok => {
          if (ok) { Progress.unlockByAd(id); renderPalette(id); selectElement(id); revealInPalette(id); }
          else toast({ k: 'NO AD AVAILABLE', n: 'Try again in a bit', c: 'var(--orange)', life: 2 });
        });
      };
    } });
  }

  /* several level-ups in a row collapse into one celebration */
  let lu = null;
  function showLevelUp(level, fresh) {
    if (lu) {
      lu.level = level;
      fresh.forEach(d => { if (!lu.fresh.includes(d)) lu.fresh.push(d); });
      if (s.modalOpen && s.modalKind === 'levelup') {
        const card = $('modalCard');
        card.innerHTML = levelUpHtml(lu.level, lu.fresh);
        bindLevelUp(card, lu.fresh);
      }
      return;
    }
    lu = { level, fresh: fresh.slice() };
    const mine = lu;
    openModal(() => levelUpHtml(mine.level, mine.fresh), { kind: 'levelup', noX: true, bind: card => { bindLevelUp(card, mine.fresh); confetti(); } });
  }
  function bindLevelUp(card, fresh) {
    card.querySelector('#luGo').onclick = () => {
      lu = null;
      closeModal();
      if (fresh.length) { selectElement(fresh[0].id); revealInPalette(fresh[0].id); }
    };
  }
  function levelUpHtml(level, fresh) {
    const chips = fresh.map((d, k) => `<div class="chip" style="animation-delay:${0.3 + k * 0.08}s"><i style="background:${Renderer.swatchCss(d.id)}"></i>${d.name}</div>`).join('');
    return `
      <div class="levelup">
        <div class="lu-k">LEVEL UP!</div>
        <div class="lu-n">${level}</div>
        ${fresh.length ? `<p>New elements unlocked:</p><div class="chips">${chips}</div>` : '<p>Keep experimenting - more surprises await.</p>'}
        <div class="btn-row" style="justify-content:center"><button class="btn yellow" id="luGo">${fresh.length ? 'Try ' + fresh[0].name + '!' : 'Awesome!'}</button></div>
      </div>`;
  }

  function confetti() {
    const cols = ['#ffd23d', '#ff3d8b', '#3de0ff', '#7dff5a', '#8b5cff', '#ff8a3d'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = cols[i % cols.length];
      c.style.animationDuration = 1.8 + Math.random() * 1.8 + 's';
      c.style.animationDelay = Math.random() * 0.6 + 's';
      c.style.transform = `rotate(${Math.random() * 360}deg)`;
      $('modal').appendChild(c);
    }
  }

  const fmt = n => n >= 10000 ? (n / 1000).toFixed(1) + 'k' : Math.floor(n).toLocaleString();

  return {
    build, layout, applyInput, drawOverlay, updateHover, renderPalette, selectElement, revealInPalette,
    updateXp, renderMissions, updateMissionBars, setCombo, pop, toast, shake, tickShake, flash,
    openModal, closeModal, openHelp, showLevelUp, pushUndo, fitView,
    isTouch,
    get state() { return s; },
    get speed() { return SPEEDS[s.speedIdx]; },
    get canvasCells() { return CANVASES[s.canvasIdx].cells; },
    setCanvasIdx(i) { s.canvasIdx = i; updateSettings(); },
  };
})();
