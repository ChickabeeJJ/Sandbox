'use strict';
/* =========================================================================
   Progression: XP & levels, element discovery, rotating missions.
   The loop: experiment -> discover reactions -> earn XP -> unlock new
   elements -> new missions that use them -> experiment again.
   ========================================================================= */

const Progress = (() => {
  const VISIBLE = ELEMENTS.filter(d => !d.hidden);
  const st = {
    xp: 0, level: 1, unlocked: {}, tried: {}, missions: [], tutorial: 0,
    rerollAt: 0, atoms: 60, slots: 3, daily: { last: '', streak: 0 }, adAt: 0, placedAcc: 0, atomDestroyAcc: 0, totalMissions: 0, bestCombo: 0, destroyedXpAcc: 0,
    settings: { sfx: 0.8, music: 0.35, muted: false, glow: true, shake: true, theme: 'dark' },
  };
  const cb = { discover: [], levelup: [], mission: [], xp: [], change: [], atoms: [] };
  const emit = (k, ...a) => cb[k].forEach(f => f(...a));
  let lastStats = null;
  let dirty = false;

  /* ------------------------------- levels ------------------------------- */
  const xpForLevel = l => Math.round(60 + 45 * Math.pow(l - 1, 1.3));

  function isUnlocked(id) {
    const d = ELEMENTS[id];
    if (!d || d.hidden) return false;
    return d.unlock === 'base' || !!st.unlocked[d.key];
  }
  function isEarned(id) { const d = ELEMENTS[id]; return d.unlock === 'base' || !!st.unlocked[d.key]; }

  function unlockReq(id) {
    const d = ELEMENTS[id];
    if (d.unlock === 'base') return null;
    return { lvl: d.unlock.lvl || null, disc: d.unlock.disc || null, cost: d.unlock.cost || null, via: d.unlock.via || null };
  }

  function addXp(n, reason) {
    if (n <= 0) return;
    st.xp += n;
    emit('xp', n, reason);
    let need = xpForLevel(st.level);
    while (st.xp >= need) {
      st.xp -= need;
      st.level++;
      const fresh = [];
      VISIBLE.forEach(d => {
        if (d.unlock !== 'base' && d.unlock.lvl && d.unlock.lvl <= st.level && !st.unlocked[d.key]) {
          st.unlocked[d.key] = 'lvl'; fresh.push(d);
        }
      });
      emit('levelup', st.level, fresh);
      addAtoms(40 + 10 * st.level, 'Level up');
      need = xpForLevel(st.level);
    }
    save();
    emit('change');
  }

  /* ------------------------------ discovery ----------------------------- */
  function discover(d, how) {
    if (st.unlocked[d.key] || d.unlock === 'base') return;
    st.unlocked[d.key] = how || 'disc';
    const xp = 40 + 8 * Math.min(st.level, 12);
    emit('discover', d, xp);
    bump('discover', 1);
    addAtoms(12, 'Discovery');
    addXp(xp, 'Discovery');
  }

  function unlockByAd(id) {
    const d = ELEMENTS[id];
    if (st.unlocked[d.key]) return;
    st.unlocked[d.key] = 'ad';
    emit('discover', d, 0);
    save(); emit('change');
  }

  function noteTried(id) {
    const d = ELEMENTS[id];
    if (!d || d.hidden || st.tried[d.key]) return;
    st.tried[d.key] = 1;
    addXp(5, 'New experiment');
  }

  /* ------------------------------ missions ------------------------------ */
  const T = (key, n, text, reward, el) => ({ stat: key, goal: n, text, reward, el });
  const TUTORIAL = [
    () => T('p:SAND', 150, 'Pour 150 Sand', 30, 'SAND'),
    () => T('c:MUD', 40, 'Drop Dirt into Water to make Mud', 45, 'MUD'),
    () => T('c:STEAM', 40, 'Heat Water with Fire to make Steam', 50, 'STEAM'),
    () => T('destroyed', 400, 'Light Gunpowder & blow up 400 pixels', 60, 'GUNPOWDER'),
    () => T('c:PLANT', 60, 'Drop Seeds on Dirt - grow 60 plant cells', 60, 'PLANT'),
    () => T('c:ASH', 60, 'Burn Wood or Sawdust into 60 Ash', 60, 'ASH'),
  ];

  const has = k => isUnlocked(E[k]);
  const hasAny = ks => ks.some(has);
  const EXPLOSIVES = ['GUNPOWDER', 'TNT', 'BOMB', 'NITRO', 'C4', 'NUKE', 'BARREL', 'GAS'];
  const nice = n => n >= 1000 ? Math.round(n / 100) * 100 : n >= 100 ? Math.round(n / 10) * 10 : Math.round(n);

  const TEMPLATES = [
    { id: 'place', w: 2, make: s => {
      const pool = VISIBLE.filter(d => isUnlocked(d.id) && !d.single && d.cat !== 'special' && d.key !== 'FISH' && d.key !== 'FIREFLY');
      const d = pool[(Math.random() * pool.length) | 0];
      const n = nice((d.st === ST.SOLID ? 250 : 400) * s);
      return T('p:' + d.key, n, `Place ${n} ${d.name}`, 0, d.key);
    } },
    { id: 'destroy', w: 3, req: () => hasAny(EXPLOSIVES), make: s => { const n = nice(900 * s); return T('destroyed', n, `Blow up ${n} pixels`, 20, 'TNT'); } },
    { id: 'burn', w: 2, make: s => { const n = nice(250 * s); return T('burned', n, `Burn ${n} things to a crisp`, 10, 'FIRE'); } },
    { id: 'steam', w: 1, make: s => { const n = nice(160 * s); return T('c:STEAM', n, `Boil ${n} water into Steam`, 0, 'STEAM'); } },
    { id: 'ice', w: 1, make: s => { const n = nice(150 * s); return T('c:ICE', n, `Freeze ${n} water (tip: lower Temp)`, 10, 'ICE'); } },
    { id: 'grow', w: 2, make: s => { const n = nice(150 * s); return T('c:PLANT', n, `Grow ${n} plant cells`, 0, 'PLANT'); } },
    { id: 'flowers', w: 1, make: s => { const n = nice(8 * s); return T('c:FLOWER', n, `Grow ${n} flowers`, 20, 'FLOWER'); } },
    { id: 'salt', w: 1, make: s => { const n = nice(120 * s); return T('c:SALTWATER', n, `Make ${n} Salt Water`, 0, 'SALTWATER'); } },
    { id: 'lava', w: 1, req: () => st.level >= 2, make: s => { const n = nice(60 * s); return T('c:LAVA', n, `Melt ${n} Stone into Lava`, 30, 'LAVA'); } },
    { id: 'obsidian', w: 2, req: () => has('LAVA'), make: s => { const n = nice(80 * s); return T('c:OBSIDIAN', n, `Cool Lava with Water: ${n} Obsidian`, 20, 'OBSIDIAN'); } },
    { id: 'glass', w: 1, req: () => has('LAVA'), make: s => { const n = nice(40 * s); return T('c:GLASS', n, `Forge ${n} Glass from Sand`, 40, 'GLASS'); } },
    { id: 'zap', w: 2, make: s => { const n = nice(600 * s); return T('zapped', n, `Electrify ${n} metal or water pixels`, 10, 'SPARK'); } },
    { id: 'acid', w: 2, req: () => has('ACID'), make: s => { const n = nice(300 * s); return T('dissolved', n, `Dissolve ${n} pixels with Acid`, 10, 'ACID'); } },
    { id: 'fireworks', w: 2, req: () => has('FIREWORK'), make: s => { const n = nice(6 * s); return T('fireworks', n, `Launch ${n} Fireworks`, 20, 'FIREWORK'); } },
    { id: 'bounce', w: 1, req: () => has('RUBBER'), make: s => { const n = nice(60 * s); return T('bounced', n, `Bounce ${n} grains off Rubber`, 20, 'RUBBER'); } },
    { id: 'combo', w: 2, req: () => hasAny(EXPLOSIVES), make: s => { const n = Math.min(40, Math.round(6 + 3 * s)); return T('combo', n, `Hit a x${n} blast combo`, 30, 'GUNPOWDER'); } },
    { id: 'booms', w: 1, req: () => hasAny(EXPLOSIVES), make: s => { const n = nice(60 * s); return T('explosions', n, `Trigger ${n} explosions`, 0, 'BOMB'); } },
    { id: 'rust', w: 1, req: () => st.level >= 3, make: s => { const n = nice(30 * s); return T('c:RUST', n, `Rust ${n} metal pixels`, 30, 'RUST'); } },
    { id: 'molten', w: 1, req: () => has('THERMITE'), make: s => { const n = nice(40 * s); return T('c:MOLTEN_METAL', n, `Melt ${n} Metal`, 30, 'MOLTEN_METAL'); } },
    { id: 'fungus', w: 1, req: () => has('FUNGUS'), make: s => { const n = nice(120 * s); return T('c:FUNGUS', n, `Spread ${n} Fungus`, 10, 'FUNGUS'); } },
    { id: 'gold', w: 1, req: () => has('LEAD') && has('LIGHTNING'), make: () => T('c:GOLD', 20, 'Turn Lead into Gold with Lightning', 60, 'GOLD') },
    { id: 'brick', w: 1, req: () => has('CLAY'), make: s => { const n = nice(50 * s); return T('c:BRICK', n, `Bake ${n} Clay into Brick`, 30, 'BRICK'); } },
    { id: 'concrete', w: 1, req: () => has('CEMENT'), make: s => { const n = nice(80 * s); return T('c:CONCRETE', n, `Set ${n} Concrete with water`, 20, 'CONCRETE'); } },
    { id: 'bubbles', w: 1, req: () => has('SOAP'), make: s => { const n = nice(60 * s); return T('c:BUBBLE', n, `Blow ${n} bubbles with Soap`, 30, 'BUBBLE'); } },
    { id: 'honey', w: 1, req: () => has('BEE') || has('SUGAR'), make: s => { const n = nice(40 * s); return T('c:HONEY', n, `Make ${n} Honey`, 30, 'HONEY'); } },
    { id: 'discover', w: 2, req: () => VISIBLE.some(d => !isEarned(d.id) && d.unlock.disc), make: () => T('discover', 1, 'Discover a new element', 40, 'GLITTER') },
  ];

  function newMission() {
    if (st.tutorial < TUTORIAL.length) {
      const m = TUTORIAL[st.tutorial++]();
      return finalize(m, 'tut');
    }
    const s = 1 + (st.level - 1) * 0.18;
    const active = new Set(st.missions.map(m => m.tid));
    const pool = TEMPLATES.filter(t => !active.has(t.id) && (!t.req || t.req()));
    let total = pool.reduce((a, t) => a + t.w, 0), r = Math.random() * total;
    let tpl = pool[0];
    for (const t of pool) { r -= t.w; if (r <= 0) { tpl = t; break; } }
    return finalize(tpl.make(s), tpl.id);
  }
  function finalize(m, tid) {
    m.tid = tid;
    m.progress = 0;
    m.reward = Math.round(55 + st.level * 14 + (m.reward || 0));
    m.atoms = 15 + st.level * 3;
    m.done = false;
    return m;
  }
  function fillMissions() {
    while (st.missions.length < 3) st.missions.push(newMission());
  }

  function bump(stat, delta) {
    if (!delta) return;
    st.missions.forEach(m => {
      if (m.done || m.stat !== stat) return;
      if (stat === 'combo') m.progress = Math.max(m.progress, delta);
      else m.progress += delta;
      if (m.progress >= m.goal) completeMission(m);
    });
    dirty = true;
  }

  function completeMission(m) {
    m.done = true;
    m.progress = m.goal;
    st.totalMissions++;
    emit('mission', m);
    addXp(m.reward, 'Mission');
    addAtoms(m.atoms, 'Mission');
    setTimeout(() => {
      const idx = st.missions.indexOf(m);
      if (idx >= 0) { st.missions.splice(idx, 1, newMission()); save(); emit('change'); }
    }, 1400);
  }

  function reroll(idx) {
    const now = Date.now();
    if (now < st.rerollAt) return false;
    const m = st.missions[idx];
    if (!m || m.done) return false;
    st.missions.splice(idx, 1);
    if (m.tid === 'tut') st.tutorial = Math.max(st.tutorial, TUTORIAL.length);
    st.missions.splice(idx, 0, newMission());
    st.rerollAt = now + 45000;
    save(); emit('change');
    return true;
  }

  /* ------------------------------ polling ------------------------------- */
  const STAT_KEYS = ['destroyed', 'burned', 'explosions', 'zapped', 'dissolved', 'fireworks', 'bounced'];
  function poll() {
    const s = Sim.stats;
    if (!lastStats) {
      lastStats = { created: s.created.slice(), placed: s.placed.slice() };
      STAT_KEYS.forEach(k => lastStats[k] = s[k]);
      return;
    }
    // discoveries from anything the simulation produced
    for (let t = 1; t < N_EL; t++) {
      const dc = s.created[t] - lastStats.created[t];
      const dp = s.placed[t] - lastStats.placed[t];
      if (dc > 0) {
        const d = ELEMENTS[t];
        if (!d.hidden && d.unlock !== 'base' && !d.unlock.cost && !d.unlock.via && !st.unlocked[d.key]) discover(d, 'disc');
        bump('c:' + d.key, dc);
      }
      if (dp > 0) { bump('p:' + ELEMENTS[t].key, dp); noteTried(t); st.placedAcc += dp; }
    }
    STAT_KEYS.forEach(k => {
      const d = s[k] - lastStats[k];
      if (d > 0) bump(k, d);
    });
    const dd = s.destroyed - lastStats.destroyed;
    if (dd > 0) {
      st.destroyedXpAcc += dd;
      if (st.destroyedXpAcc >= 500) { const n = Math.floor(st.destroyedXpAcc / 500); st.destroyedXpAcc -= n * 500; addXp(n * 6, 'Destruction'); }
    }
    if (st.placedAcc >= 1500) { const n = Math.floor(st.placedAcc / 1500); st.placedAcc -= n * 1500; addXp(n * 4, 'Experimenting'); }
    if (dd > 0) {
      st.atomDestroyAcc += dd;
      if (st.atomDestroyAcc >= 2500) { const n = Math.floor(st.atomDestroyAcc / 2500); st.atomDestroyAcc -= n * 2500; addAtoms(n * 5, 'Destruction'); }
    }
    lastStats.created.set(s.created); lastStats.placed.set(s.placed);
    STAT_KEYS.forEach(k => lastStats[k] = s[k]);
    if (dirty) { dirty = false; emit('change'); saveSoon(); }
  }

  function reportCombo(n) {
    if (n > st.bestCombo) st.bestCombo = n;
    bump('combo', n);
  }

  /* ------------------------------ persistence --------------------------- */
  let saveTimer = null;
  function saveSoon() { if (!saveTimer) saveTimer = setTimeout(() => { saveTimer = null; save(); }, 2000); }
  function save() {
    try { Platform.setItem('progress', JSON.stringify(st)); } catch (e) { /* ignore */ }
  }
  function load() {
    try {
      const raw = Platform.getItem('progress');
      if (raw) {
        const o = JSON.parse(raw);
        Object.assign(st, o);
        st.settings = Object.assign({ sfx: 0.8, music: 0.35, muted: false, glow: true, shake: true, theme: 'dark' }, o.settings || {});
        st.missions = (st.missions || []).filter(m => m && !m.done);
        delete st.freePlay;
      }
    } catch (e) { /* corrupt save: start fresh */ }
    // safety: level-gated unlocks
    VISIBLE.forEach(d => { if (d.unlock !== 'base' && d.unlock.lvl && d.unlock.lvl <= st.level) st.unlocked[d.key] = st.unlocked[d.key] || 'lvl'; });
    fillMissions();
  }
  function reset() {
    Platform.removeItem('progress');
    Platform.removeItem('canvas');
    location.reload();
  }


  /* ------------------------------ atoms (currency) ---------------------- */
  const SLOT_PRICES = [300, 500, 800, 1200, 1600, 2000, 2600, 3200, 4000];
  const MAX_SLOTS = 12;
  const AD_ATOMS = 75, AD_COOLDOWN = 3 * 60 * 1000;

  function addAtoms(n, reason) {
    if (n <= 0) return;
    st.atoms += n;
    emit('atoms', n, reason);
    saveSoon();
  }
  function spend(n) {
    if (st.atoms < n) return false;
    st.atoms -= n;
    emit('atoms', -n, 'spend');
    save();
    return true;
  }
  function buyElement(id) {
    const d = ELEMENTS[id];
    if (!d.unlock || !d.unlock.cost || st.unlocked[d.key]) return false;
    if (!spend(d.unlock.cost)) return false;
    st.unlocked[d.key] = 'shop';
    (d.unlock.also || []).forEach(k => { st.unlocked[k] = 'shop'; });
    emit('discover', d, 0);
    save(); emit('change');
    return true;
  }
  const slotPrice = () => st.slots >= MAX_SLOTS ? null : SLOT_PRICES[st.slots - 3];
  function buySlot() {
    const p = slotPrice();
    if (p == null || !spend(p)) return false;
    st.slots++;
    save(); emit('change');
    return true;
  }
  const today = () => new Date().toISOString().slice(0, 10);
  function dailyPending() {
    if (st.daily.last === today()) return null;
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const streak = st.daily.last === y ? Math.min(7, st.daily.streak + 1) : 1;
    return { streak, amount: 40 + streak * 20 };
  }
  function claimDaily() {
    const d = dailyPending();
    if (!d) return null;
    st.daily = { last: today(), streak: d.streak };
    addAtoms(d.amount, 'Daily bonus');
    save();
    return d;
  }
  const adReadyIn = () => Math.max(0, st.adAt + AD_COOLDOWN - Date.now());
  function adReward() { st.adAt = Date.now(); addAtoms(AD_ATOMS, 'Ad reward'); save(); }

  return {
    load, save, poll, reportCombo, reroll, isUnlocked, isEarned, unlockReq, unlockByAd, addXp, reset, xpForLevel,
    addAtoms, buyElement, buySlot, slotPrice, dailyPending, claimDaily, adReadyIn, adReward, AD_ATOMS, MAX_SLOTS,
    on: (k, f) => cb[k].push(f),
    get state() { return st; },
    get visible() { return VISIBLE; },
    get discoveredCount() { return VISIBLE.filter(d => isEarned(d.id)).length; },
  };
})();
