'use strict';
/* =========================================================================
   Boot + main loop. Glues simulation, renderer, progression and UI.
   ========================================================================= */

(() => {
  const combo = { n: 0, t: 0, max: 2.4 };
  let lastPop = 0, lastSizzles = 0, lastMissionSig = '', autosaveAt = 0;
  let fps = 60, fpsFrames = 0, fpsT = 0;

  function gridDims(cells) {
    const r = document.getElementById('stageWrap').getBoundingClientRect();
    const aspect = Math.max(0.45, Math.min(3.4, (r.width || 800) / (r.height || 500)));
    const w = Math.round(Math.sqrt(cells * aspect));
    return [w, Math.round(cells / w)];
  }

  /* --------------------------------------------------------------------- */
  /*  A pretty little world to greet new players                            */
  /* --------------------------------------------------------------------- */
  function starterScene() {
    const W = Sim.W, H = Sim.H;
    const put = (x, y, t) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      Sim.setNew(i, t);
      Sim.temp[i] = HAS_T0[t] ? T0[t] : Sim.ambient;
      if (t === E.PLANT || t === E.FLOWER) Sim.life[i] = -1;
    };
    const ground = new Int32Array(W);
    const ph = Math.random() * 10;
    const pondL = Math.floor(W * 0.18), pondR = Math.floor(W * 0.42);
    for (let x = 0; x < W; x++) {
      let h = H * 0.2 + Math.sin(x * 0.045 + ph) * H * 0.035 + Math.sin(x * 0.13 + ph * 2) * H * 0.012;
      if (x > pondL && x < pondR) {
        const f = Math.sin((x - pondL) / (pondR - pondL) * Math.PI);
        h -= f * H * 0.1;
      }
      ground[x] = Math.round(H - h);
    }
    for (let x = 0; x < W; x++) {
      const gy = ground[x];
      for (let y = gy; y < H; y++) {
        const depth = y - gy;
        let t = E.DIRT;
        if (y > H - 5 - ((x * 7) % 3)) t = E.STONE;
        else if (x > W * 0.68 && depth < 6 + Math.sin(x * 0.2) * 2) t = E.SAND;
        else if (x > pondL - 8 && x < pondR + 8 && depth < 7) t = E.SAND;
        put(x, y, t);
      }
    }
    // pond, lined with stone so the dirt banks don't turn to mud
    const waterLine = Math.min(ground[pondL], ground[pondR]) + 2;
    for (let x = pondL - 2; x <= pondR + 2; x++) {
      for (let y = waterLine - 1; y < H; y++) {
        const inPond = x >= pondL && x <= pondR && y < ground[x];
        if (inPond) continue;
        let near = false;
        for (let dx = -2; dx <= 2 && !near; dx++) for (let dy = -2; dy <= 2 && !near; dy++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= pondL && xx <= pondR && yy >= waterLine && yy < ground[xx]) near = true;
        }
        if (near && y >= ground[x]) put(x, y, E.STONE);
      }
    }
    for (let x = pondL; x <= pondR; x++) for (let y = waterLine; y < ground[x]; y++) put(x, y, E.WATER);
    // grass tufts
    for (let x = 0; x < W; x++) {
      if (x >= pondL - 3 && x <= pondR + 3) continue;
      if (x > W * 0.68) continue;
      if (Math.random() < 0.55) { put(x, ground[x] - 1, E.PLANT); if (Math.random() < 0.3) put(x, ground[x] - 2, E.PLANT); }
      if (Math.random() < 0.04) put(x, ground[x] - 2, E.FLOWER);
    }
    // a tree
    const tx = Math.floor(W * 0.56), th = Math.floor(H * 0.2);
    for (let y = 0; y < th; y++) { put(tx, ground[tx] - 1 - y, E.WOOD); put(tx + 1, ground[tx] - 1 - y, E.WOOD); }
    const cy = ground[tx] - th, cr = Math.max(5, Math.floor(H * 0.07));
    for (let dy = -cr; dy <= cr; dy++) for (let dx = -cr * 1.4; dx <= cr * 1.4; dx++) {
      if ((dx * dx) / 1.9 + dy * dy <= cr * cr * (0.75 + Math.random() * 0.4)) put(tx + Math.round(dx), cy + dy, Math.random() < 0.06 ? E.FLOWER : E.PLANT);
    }
    // boulders
    for (let k = 0; k < 3; k++) {
      const bx = Math.floor(W * (0.05 + Math.random() * 0.1 + k * 0.32)), r = 2 + Math.floor(Math.random() * 3);
      if (bx > pondL - 4 && bx < pondR + 4) continue;
      for (let dy = -r; dy <= 0; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) put(bx + dx, ground[bx] + dy, E.STONE);
    }
  }

  /* --------------------------------------------------------------------- */
  /*  Simulation events -> juice                                            */
  /* --------------------------------------------------------------------- */
  const WORDS = [[25, 'POP!'], [100, 'BOOM!'], [350, 'KABOOM!'], [1200, 'MEGA BLAST!'], [4000, 'DEVASTATION!'], [1e9, 'OBLITERATED!']];
  const WORD_COLORS = ['#ffd23d', '#ff8a3d', '#ff3d8b', '#c56bff', '#3de0ff', '#7dff5a'];

  function handleEvents(now) {
    const ev = Sim.events;
    if (ev.length) {
      let booms = 0, destroyed = 0, maxR = 0, sx = 0, sy = 0, nuke = false, zap = false, fw = false;
      for (const e of ev) {
        if (e.type === 'boom') {
          booms++; destroyed += e.destroyed; sx += e.x; sy += e.y;
          if (e.r > maxR) maxR = e.r;
          if (e.nuke) nuke = true;
        } else if (e.type === 'zap') zap = true;
        else if (e.type === 'firework') fw = true;
      }
      ev.length = 0;
      if (booms) {
        Sfx.boom(maxR);
        UI.shake(Math.min(nuke ? 46 : 26, 3 + maxR * 0.9 + Math.min(10, booms)));
        if (nuke) UI.flash(0.95);
        else if (maxR >= 12) UI.flash(0.22);
        combo.n += Math.min(3, booms);
        combo.t = combo.max;
        Progress.reportCombo(combo.n);
        if (combo.n > 2) Sfx.combo(combo.n);
        if (now - lastPop > 140 && (destroyed > 6 || maxR >= 8)) {
          lastPop = now;
          let wi = 0; while (destroyed > WORDS[wi][0]) wi++;
          if (nuke) wi = WORDS.length - 1;
          UI.pop(Math.round(sx / booms), Math.round(sy / booms) - 4, WORDS[wi][1], destroyed ? '+' + destroyed.toLocaleString() : '', WORD_COLORS[wi], 16 + wi * 5);
        }
      }
      if (zap) { Sfx.zap(); Sfx.thunder(); UI.shake(6); UI.flash(0.12); }
      if (fw) Sfx.firework();
    }
    const sz = Sim.stats.sizzles;
    if (sz - lastSizzles > 3) Sfx.sizzle();
    lastSizzles = sz;
  }

  function tickCombo(dt) {
    if (combo.n <= 0) return;
    combo.t -= dt;
    if (combo.t <= 0) {
      if (combo.n >= 5) {
        const bonus = Math.min(80, Math.floor(combo.n / 5) * 4);
        UI.toast({ k: 'COMBO FINISHED', n: 'x' + combo.n + ' chain!', xp: bonus, c: 'var(--yellow)', life: 2 });
        Progress.addXp(bonus, 'Combo');
      }
      combo.n = 0;
    }
    UI.setCombo(combo.n, Math.max(0, combo.t / combo.max));
  }

  /* --------------------------------------------------------------------- */
  /*  Main loop                                                             */
  /* --------------------------------------------------------------------- */
  let last = performance.now(), acc = 0, pollT = 0;
  function frame(now) {
    const dt = Math.min(100, now - last);
    last = now;
    UI.applyInput();
    if (!UI.state.paused) {
      acc += dt;
      const interval = 1000 / UI.speed;
      let n = 0;
      while (acc >= interval && n < 6) { Sim.step(); acc -= interval; n++; }
      if (n === 6) acc = 0;
    }
    handleEvents(now);
    Renderer.draw();
    UI.drawOverlay();
    UI.tickShake();
    tickCombo(dt / 1000);

    pollT += dt;
    if (pollT > 250) {
      pollT = 0;
      Progress.poll();
      const sig = Progress.state.missions.map(m => m.text + (m.done ? 1 : 0)).join('|');
      if (sig !== lastMissionSig) { lastMissionSig = sig; UI.renderMissions(); }
      else UI.updateMissionBars();
    }
    fpsFrames++; fpsT += dt;
    if (fpsT >= 500) {
      fps = Math.round(fpsFrames * 1000 / fpsT); fpsFrames = 0; fpsT = 0; UI.updateHover(fps);
      adaptQuality();
    }
    else if (fpsFrames % 4 === 0) UI.updateHover(fps);

    if (now > autosaveAt) { autosaveAt = now + 20000; saveCanvas(); }
    requestAnimationFrame(frame);
  }

  /* low-end devices: drop the bloom layers if the frame rate stays low */
  let lowFps = 0;
  function adaptQuality() {
    const set = Progress.state.settings;
    if (!set.glow || document.hidden || UI.state.modalOpen) { lowFps = 0; return; }
    lowFps = fps < 38 ? lowFps + 1 : 0;
    if (lowFps >= 8) {
      set.glow = false;
      Renderer.setGlow(false);
      document.body.classList.add('noglow');
      Progress.save();
      UI.toast({ k: 'PERFORMANCE MODE', n: 'Glow off - turn it back on in Menu', c: '#3de0ff', life: 3 });
    }
  }

  function saveCanvas() {
    try { Platform.setItem('canvas', JSON.stringify(Sim.serialize())); } catch (e) { /* quota: ignore */ }
  }

  /* --------------------------------------------------------------------- */
  /*  Boot                                                                  */
  /* --------------------------------------------------------------------- */
  async function boot() {
    await Platform.init();
    Platform.loadingStart();
    const fresh = !Platform.getItem('progress');
    Progress.load();
    const set = Progress.state.settings;
    Sfx.setSfx(set.sfx); Sfx.setMusic(set.music); Sfx.setMuted(set.muted);
    document.body.classList.toggle('noglow', !set.glow);
    Renderer.setGlow(set.glow);

    Renderer.init(document.getElementById('cvMain'), document.getElementById('cvGlow'), document.getElementById('cvBloom'));
    UI.applyTheme(set.theme === 'light' ? 'light' : 'dark');
    UI.build({
      onClear() {
        UI.pushUndo();
        Sim.clear();
        Sfx.erase();
        UI.toast({ k: 'CANVAS CLEARED', n: UI.isTouch() ? 'Tap undo to bring it back' : 'Ctrl+Z to undo', c: 'var(--pink)', life: 1.6 });
        Platform.maybeMidgame();
      },
      onCanvasSize(cells) {
        const [w, h] = gridDims(cells);
        Sim.init(w, h, true);
        Renderer.resize(w, h);
        UI.state.undo.length = 0;
        UI.fitView();
        UI.layout();
      },
    });

    const small = innerWidth < 860 || innerHeight < 520;
    if (small) UI.setCanvasIdx(0);

    let restored = false;
    const saved = Platform.getItem('canvas');
    if (saved) {
      try {
        const o = JSON.parse(saved);
        if (o && o.W > 20 && o.H > 20 && o.W * o.H <= 130000) { Sim.init(o.W, o.H); restored = Sim.deserialize(o) && Sim.countNonEmpty() > 0; }
      } catch (e) { restored = false; }
    }
    if (!restored) {
      const [w, h] = gridDims(UI.canvasCells);
      Sim.init(w, h);
      starterScene();
      // let the world settle before anything counts toward discoveries
      for (let k = 0; k < 200; k++) Sim.step();
      const ty = Sim.type, W = Sim.W, N = W * Sim.H;
      for (let i = 0; i < N; i++) {
        if (ty[i] === E.MUD) Sim.setNew(i, E.SAND);
        else if (ty[i] === E.DIRT) {
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const j = i + dy * W + dx;
            if (j >= 0 && j < N && ty[j] === E.WATER) { Sim.setNew(i, E.SAND); dy = dx = 2; }
          }
        }
      }
      Sim.stats.created.fill(0);
      Sim.events.length = 0;
    }
    Renderer.resize(Sim.W, Sim.H);
    UI.layout();

    Progress.on('discover', (d, xp) => {
      UI.toast({ k: xp ? 'NEW ELEMENT DISCOVERED' : 'ELEMENT UNLOCKED', n: d.name, sw: Renderer.swatchCss(d.id), xp, c: d.col[0], life: 3.4 });
      Sfx.discover();
      UI.renderPalette(d.id);
      Platform.happytime();
    });
    Progress.on('levelup', (lvl, freshEls) => {
      Sfx.levelup();
      const b = document.querySelector('.lvl-badge');
      b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
      UI.renderPalette();
      UI.showLevelUp(lvl, freshEls);
      Platform.happytime();
    });
    Progress.on('mission', m => {
      Sfx.mission();
      UI.toast({ k: 'MISSION COMPLETE', n: m.text, xp: m.reward, c: '#7dff5a', life: 2.6 });
      UI.renderMissions();
      document.getElementById('missionDot').classList.remove('hidden');
    });
    Progress.on('xp', () => UI.updateXp());
    Progress.on('change', () => UI.updateXp());

    UI.updateXp();
    UI.renderMissions();
    UI.selectElement(E.SAND);

    window.addEventListener('pagehide', saveCanvas);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { saveCanvas(); Progress.save(); }
    });

    const loader = document.getElementById('loader');
    loader.classList.add('out');
    setTimeout(() => loader.remove(), 500);
    Platform.loadingStop();

    if (fresh) {
      setTimeout(() => UI.toast({ k: 'WELCOME TO POWDER LAB', n: 'Draw, mix & discover!', c: '#ffd23d', life: 4 }), 500);
      setTimeout(() => UI.toast({ k: 'TIP', n: 'Missions on the right earn XP', c: '#3de0ff', life: 3.5 }), 4800);
    }
    requestAnimationFrame(t => { last = t; frame(t); });
  }

  boot();
})();
