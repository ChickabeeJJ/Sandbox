'use strict';
/* =========================================================================
   Falling-sand simulation. Cells live in flat typed arrays; each tick runs a
   heat-diffusion pass, a bottom-up cell update pass, an electricity pass and
   a free-particle pass (explosion debris, firework sparkles, bounces).
   ========================================================================= */

const Sim = (() => {
  let W = 0, H = 0, N = 0;
  let type, shade, life, temp, vel, stamp, charge;
  let tick = 0, tstamp = 1;
  let ambient = 22;

  /* counters read by the progression system */
  const stats = {
    created: new Float64Array(N_EL), placed: new Float64Array(N_EL),
    destroyed: 0, burned: 0, explosions: 0, zapped: 0, dissolved: 0, fireworks: 0, bounced: 0, sizzles: 0,
  };
  const events = [];
  const blackholes = [];
  const halos = [];                      // [index, kind] for sun / white hole / vortex glows
  let portB = [], portBPrev = [], stasisL = [], stasisPrev = [];

  /* ---------------- RNG (xorshift, faster than Math.random) ---------------- */
  let seed = (Math.random() * 0xffffffff) >>> 0 || 1;
  function rnd() {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  }
  const rint = n => (rnd() * n) | 0;

  const NX = [-1, 0, 1, -1, 1, -1, 0, 1];
  const NY = [-1, -1, -1, 0, 0, 1, 1, 1];
  const DX8 = [0, 1, 1, 1, 0, -1, -1, -1];   // laser directions, 0 = down, clockwise
  const DY8 = [1, 1, 0, -1, -1, -1, 0, 1];

  /* ---------------- particles ---------------- */
  const MAXP = 9000;
  const px = new Float32Array(MAXP), py = new Float32Array(MAXP);
  const pvx = new Float32Array(MAXP), pvy = new Float32Array(MAXP);
  const ptype = new Uint8Array(MAXP), pshade = new Uint8Array(MAXP);
  const pcol = new Uint32Array(MAXP), plife = new Int16Array(MAXP);
  const ptemp = new Float32Array(MAXP), pkind = new Uint8Array(MAXP);
  let pcount = 0;

  /* ---------------- electricity ---------------- */
  let elec = [];

  function init(w, h, keepOld) {
    const old = keepOld && type ? { W, H, type, shade, life, temp } : null;
    W = w; H = h; N = w * h;
    type = new Uint8Array(N); shade = new Uint8Array(N); life = new Int16Array(N);
    temp = new Float32Array(N); vel = new Uint8Array(N); stamp = new Uint8Array(N);
    charge = new Int8Array(N);
    temp.fill(ambient);
    for (let i = 0; i < N; i++) shade[i] = rint(256);
    pcount = 0; elec = []; events.length = 0;
    if (old) {
      // copy old content anchored bottom-center
      const ox = ((W - old.W) / 2) | 0, oy = H - old.H;
      for (let y = 0; y < old.H; y++) {
        const ny = y + oy; if (ny < 0 || ny >= H) continue;
        for (let x = 0; x < old.W; x++) {
          const nx = x + ox; if (nx < 0 || nx >= W) continue;
          const a = y * old.W + x, b = ny * W + nx;
          type[b] = old.type[a]; shade[b] = old.shade[a]; life[b] = old.life[a]; temp[b] = old.temp[a];
        }
      }
    }
  }

  function clear() {
    type.fill(0); life.fill(0); vel.fill(0); charge.fill(0); temp.fill(ambient);
    pcount = 0; elec = [];
  }

  function lifeFor(t) {
    const a = LIFE_MIN[t], b = LIFE_MAX[t];
    return b ? a + rint(b - a + 1) : 0;
  }

  /* create a brand new cell (placement / spawning) */
  function setNew(i, t) {
    type[i] = t; shade[i] = rint(256); life[i] = lifeFor(t); vel[i] = 0;
    if (HAS_T0[t]) temp[i] = T0[t];
    stamp[i] = tstamp;
  }
  /* convert a cell as the product of a reaction (counts toward discoveries) */
  function convert(i, t) {
    type[i] = t; life[i] = lifeFor(t); vel[i] = 0;
    if (HAS_T0[t] && T0[t] > 500 && temp[i] < T0[t]) temp[i] = T0[t];
    stats.created[t]++;
  }
  function setEmpty(i) { type[i] = 0; life[i] = 0; vel[i] = 0; }

  function swap(i, j) {
    let a = type[i]; type[i] = type[j]; type[j] = a;
    a = shade[i]; shade[i] = shade[j]; shade[j] = a;
    a = life[i]; life[i] = life[j]; life[j] = a;
    a = vel[i]; vel[i] = vel[j]; vel[j] = a;
    const tt = temp[i]; temp[i] = temp[j]; temp[j] = tt;
  }

  function rndNb(x, y) {
    const k = rint(8), nx = x + NX[k], ny = y + NY[k];
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return -1;
    return ny * W + nx;
  }
  function emptyNbPreferUp(x, y) {
    if (y > 0) {
      const dx = rint(3) - 1, nx = x + dx;
      if (nx >= 0 && nx < W && type[(y - 1) * W + nx] === 0) return (y - 1) * W + nx;
    }
    const j = rndNb(x, y);
    return j >= 0 && type[j] === 0 ? j : -1;
  }

  /* can element t move into a cell holding o? */
  function canDisp(t, o) {
    if (o === 0) return true;
    const so = STATE[o];
    if (so === ST.SOLID || so === ST.POWDER) return false;
    return DENS[o] < DENS[t];
  }

  /* ========================================================================
     Movement
     ======================================================================== */
  let lastMoved = false;

  function fall(i, x, y, t) {
    const v = vel[i];
    let steps = 1 + (v >> 2);
    let ci = i, cy = y;
    lastMoved = false;
    while (steps-- > 0 && cy + 1 < H) {
      const j = ci + W;
      if (canDisp(t, type[j])) { swap(ci, j); ci = j; cy++; lastMoved = true; }
      else break;
    }
    if (lastMoved) { vel[ci] = v < 14 ? v + 1 : v; stamp[ci] = tstamp; return ci; }
    vel[ci] = 0;
    if (cy + 1 >= H) return ci;
    const below = type[ci + W];
    if (v >= 5 && below === E.RUBBER) {          // boing
      setEmpty(ci);
      addParticle(x, cy - 0.5, (rnd() - 0.5) * 0.8, -v * 0.32, t, shade[ci], temp[ci], 0, 0, 0);
      stats.bounced++;
      return -1;
    }
    if (v >= 6 && t === E.NITRO) { detonate(ci, x, cy, t); return -1; }
    return ci;
  }

  function slide(ci, x, y, t) {
    if (y + 1 >= H) return ci;
    if (VISC[t] && rnd() < VISC[t]) return ci;
    const d = rnd() < 0.5 ? -1 : 1;
    for (let k = 0; k < 2; k++) {
      const nx = x + (k ? -d : d);
      if (nx < 0 || nx >= W) continue;
      const j = (y + 1) * W + nx;
      if (canDisp(t, type[j])) { swap(ci, j); stamp[j] = tstamp; lastMoved = true; return j; }
    }
    return ci;
  }

  function movePowder(i, x, y, t) {
    const ci = fall(i, x, y, t);
    if (ci < 0 || lastMoved) return ci;
    return slide(ci, x, y, t);
  }

  function moveLiquid(i, x, y, t) {
    let ci = fall(i, x, y, t);
    if (ci < 0 || lastMoved) return ci;
    ci = slide(ci, x, y, t);
    if (lastMoved) return ci;
    if (VISC[t] && rnd() < VISC[t]) return ci;
    const d = rnd() < 0.5 ? -1 : 1;
    const sp = SPREAD[t];
    const row = y * W;
    for (let k = 0; k < 2; k++) {
      const dir = k ? -d : d;
      let last = -1;
      for (let s = 1; s <= sp; s++) {
        const nx = x + dir * s;
        if (nx < 0 || nx >= W) break;
        const o = type[row + nx];
        if (o === 0 || STATE[o] === ST.GAS || STATE[o] === ST.ENERGY) {
          last = row + nx;
          // falling off a ledge: stop here so it drops next tick
          if (y + 1 < H && type[row + nx + W] === 0) break;
        } else break;
      }
      if (last >= 0) { swap(ci, last); stamp[last] = tstamp; return last; }
    }
    return ci;
  }

  function moveGas(i, x, y, t) {
    const r = rnd();
    let tx = x, ty = y;
    if (r < 0.55) { ty = y - 1; tx = x + rint(3) - 1; }
    else if (r < 0.9) { tx = x + (rnd() < 0.5 ? -1 : 1); }
    else if (r < 0.95) { ty = y + 1; }
    else return i;
    if (tx < 0 || tx >= W || ty < 0 || ty >= H) return i;
    const j = ty * W + tx, o = type[j];
    if (o === 0 || (STATE[o] === ST.GAS && (ty < y ? DENS[o] > DENS[t] : (ty > y ? DENS[o] < DENS[t] : rnd() < 0.3)))) {
      swap(i, j); stamp[j] = tstamp; return j;
    }
    return i;
  }

  /* ========================================================================
     Combustion & explosions
     ======================================================================== */
  function isWet(o) {
    return o === E.WATER || o === E.SALTWATER || o === E.ICE || o === E.SNOW || o === E.LN2 || o === E.MUD || o === E.FOAM;
  }

  function burnStep(i, x, y, t) {
    // water nearby puts it out
    const n = rndNb(x, y);
    if (n >= 0 && isWet(type[n])) {
      temp[i] = FLAM[t] - 60;
      if ((type[n] === E.WATER || type[n] === E.SALTWATER) && rnd() < 0.5) { convert(n, E.STEAM); temp[n] = 120; }
      stats.sizzles++;
      return false;
    }
    if (temp[i] < BHEAT[t]) temp[i] = BHEAT[t];
    if (rnd() < 0.3) {
      const j = emptyNbPreferUp(x, y);
      if (j >= 0) { setNew(j, E.FIRE); if (t === E.COAL || t === E.WOOD) life[j] = 8 + rint(14); }
    }
    if (rnd() < BURN[t]) {
      const list = BURN_TO[t];
      const to = list[rint(list.length)];
      if (to === E.FIRE) { setNew(i, E.FIRE); stats.created[E.FIRE]++; }
      else convert(i, to);
      stats.burned++;
      return true;
    }
    return false;
  }

  function detonate(i, x, y, t) {
    setEmpty(i);
    explode(x, y, EXPL[t], t);
    if (t === E.FIRECRACKER) {
      const hue = rnd() * 360;
      for (let k = 0; k < 8; k++) {
        const a = rnd() * Math.PI * 2, s2 = 0.4 + rnd() * 0.9;
        addParticle(x, y, Math.cos(a) * s2, Math.sin(a) * s2 - 0.4, 0, 0, 0, 1, hsl(hue + rnd() * 60, 1, 0.65), 12 + rint(14));
      }
    }
    if (t === E.CLUSTERBOMB) {
      for (let k = 0; k < 12; k++) {
        const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4, s2 = 1.2 + rnd() * 1.6;
        addParticle(x, y - 1, Math.cos(a) * s2, Math.sin(a) * s2, E.BOMBLET, rint(256), ambient, 0, 0, 0);
      }
    }
    if (t === E.BARREL) {
      for (let k = 0; k < 26; k++) {
        const a = rnd() * Math.PI * 2, s = 0.6 + rnd() * 1.6;
        addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s - 1, E.OIL, rint(256), 400, 0, 0, 0);
      }
    }
  }

  function explode(cx, cy, r, src) {
    const r2 = r * r;
    const nuke = src === E.NUKE;
    const heat = nuke ? 4500 : 700 + r * 40;
    let destroyed = 0;
    for (let dy = -r; dy <= r; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= H) continue;
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const x = cx + dx;
        if (x < 0 || x >= W) continue;
        const j = y * W + x;
        const o = type[j];
        const dist = Math.sqrt(d2) / (r || 1);
        let tj = temp[j] + heat * (1 - dist);
        temp[j] = tj > 6000 ? 6000 : tj;
        if (o === 0) {
          if (dist < 0.6 && rnd() < 0.45) setNew(j, E.FIRE);
          else if (dist < 0.95 && rnd() < 0.08) setNew(j, E.SMOKE);
          continue;
        }
        if (INDES[o]) continue;
        if ((EXPL[o] || o === E.FIREWORK || o === E.THERMITE || o === E.C4) && j !== cy * W + cx) {
          // chain reaction: they go off on their own update for a rippling cascade
          if (temp[j] < FLAM[o] + 50) temp[j] = FLAM[o] + 50;
          continue;
        }
        const so = STATE[o];
        if (so === ST.GAS || so === ST.ENERGY) { if (dist < 0.6) setNew(j, E.FIRE); continue; }
        const res = BLAST[o];
        if (res > 0 && !nuke && rnd() < res * (0.25 + dist)) continue;
        destroyed++;
        let tt = o;
        if (o === E.GLASS && rnd() < 0.7) { tt = E.GLITTER; stats.created[E.GLITTER]++; }
        if (dist > 0.2 && pcount < MAXP - 50 && rnd() < (nuke ? 0.35 : 0.6)) {
          const ang = Math.atan2(dy, dx) + (rnd() - 0.5) * 0.6;
          const sp = (1.15 - dist) * (1.1 + r * 0.09) * (0.6 + rnd() * 0.8);
          addParticle(x, y, Math.cos(ang) * sp, Math.sin(ang) * sp - sp * 0.35, tt, shade[j], temp[j], 0, 0, 0);
          setEmpty(j);
        } else if (dist < 0.55) {
          if (rnd() < 0.55) setNew(j, E.FIRE); else setEmpty(j);
        } else {
          if (rnd() < 0.3) setNew(j, E.SMOKE); else setEmpty(j);
        }
      }
    }
    if (nuke) {
      for (let k = 0; k < 160; k++) {
        const a = rnd() * Math.PI * 2, s = 0.5 + rnd() * 3.2;
        addParticle(cx, cy, Math.cos(a) * s, Math.sin(a) * s - 0.8, 0, 0, 0, 1, hsl(30 + rnd() * 30, 1, 0.6 + rnd() * 0.3), 40 + rint(60));
      }
    }
    stats.destroyed += destroyed;
    stats.explosions++;
    events.push({ type: 'boom', x: cx, y: cy, r, destroyed, nuke });
  }

  /* ========================================================================
     Electricity
     ======================================================================== */
  function electrify(j) {
    if (charge[j] === 0 && CONDUCT[type[j]]) { charge[j] = 4; elec.push(j); stats.zapped++; }
  }

  function electricityPass() {
    if (!elec.length) return;
    const list = elec;
    elec = [];
    for (let n = 0; n < list.length; n++) {
      const i = list[n];
      const t = type[i];
      if (!CONDUCT[t]) { charge[i] = 0; continue; }
      if (charge[i] !== 4) continue;
      const x = i % W, y = (i / W) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = x + NX[k], ny = y + NY[k];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx, o = type[j];
        if (CONDUCT[o]) {
          if (charge[j] === 0 && (k === 1 || k === 3 || k === 4 || k === 6)) { charge[j] = 5; elec.push(j); stats.zapped++; }
        } else if (FLAM[o] > 0 && rnd() < 0.5) {
          if (temp[j] < FLAM[o] + 40) temp[j] = FLAM[o] + 40;
        }
      }
      if (t === E.WATER || t === E.SALTWATER) temp[i] += 2;
      else if (t === E.BULB) life[i] = 40;
    }
    for (let n = 0; n < list.length; n++) {
      const i = list[n];
      if (charge[i] > 0) { charge[i]--; if (charge[i] > 0) elec.push(i); }
    }
    // promote freshly charged cells (5) to heads (4)
    for (let n = 0; n < elec.length; n++) { const i = elec[n]; if (charge[i] === 5) charge[i] = 4; }
  }

  /* ========================================================================
     Particles
     ======================================================================== */
  function addParticle(x, y, vx, vy, t, sh, tp, kind, col, lf) {
    if (pcount >= MAXP) return;
    const p = pcount++;
    px[p] = x + 0.5; py[p] = y + 0.5; pvx[p] = vx; pvy[p] = vy;
    ptype[p] = t; pshade[p] = sh; ptemp[p] = tp; pkind[p] = kind; pcol[p] = col || 0; plife[p] = lf || 0;
  }

  function killParticle(p) {
    const q = --pcount;
    px[p] = px[q]; py[p] = py[q]; pvx[p] = pvx[q]; pvy[p] = pvy[q];
    ptype[p] = ptype[q]; pshade[p] = pshade[q]; ptemp[p] = ptemp[q]; pkind[p] = pkind[q]; pcol[p] = pcol[q]; plife[p] = plife[q];
  }

  function deposit(p, x, y) {
    // place a matter particle at or above (x,y)
    for (let k = 0; k < 6; k++) {
      const yy = y - k;
      if (yy < 0) break;
      if (x < 0 || x >= W) break;
      const j = yy * W + x;
      if (type[j] === 0 || STATE[type[j]] === ST.GAS || STATE[type[j]] === ST.ENERGY) {
        type[j] = ptype[p]; shade[j] = pshade[p]; temp[j] = ptemp[p]; life[j] = lifeFor(ptype[p]);
        vel[j] = 4; stamp[j] = tstamp;
        return;
      }
    }
  }

  function particlesStep() {
    for (let p = pcount - 1; p >= 0; p--) {
      if (pkind[p] === 1) {
        // sparkle: pure visual energy
        pvy[p] += 0.035; pvx[p] *= 0.985; pvy[p] *= 0.985;
        px[p] += pvx[p]; py[p] += pvy[p];
        if (--plife[p] <= 0 || px[p] < 0 || px[p] >= W || py[p] >= H || py[p] < -40) { killParticle(p); continue; }
        if (py[p] >= 0) {
          const j = (py[p] | 0) * W + (px[p] | 0);
          const o = type[j];
          if (o && STATE[o] !== ST.GAS && STATE[o] !== ST.ENERGY) {
            if (FLAM[o] && rnd() < 0.3) temp[j] += 200;
            killParticle(p);
          }
        }
        continue;
      }
      pvy[p] += 0.14;
      if (pvy[p] > 6) pvy[p] = 6;
      const vx = pvx[p], vy = pvy[p];
      const sp = Math.max(Math.abs(vx), Math.abs(vy));
      const steps = Math.max(1, Math.ceil(sp));
      const sx = vx / steps, sy = vy / steps;
      let x = px[p], y = py[p], dead = false;
      for (let s = 0; s < steps; s++) {
        const nx = x + sx, ny = y + sy;
        if (nx < 0 || nx >= W) { pvx[p] = -pvx[p] * 0.4; break; }
        if (ny >= H) { deposit(p, nx | 0, H - 1); dead = true; break; }
        if (ny < 0) { x = nx; y = ny; continue; }
        const o = type[(ny | 0) * W + (nx | 0)];
        if (o !== 0 && STATE[o] !== ST.GAS && STATE[o] !== ST.ENERGY) {
          if (y >= 0) deposit(p, x | 0, y | 0); else deposit(p, nx | 0, 0);
          dead = true; break;
        }
        x = nx; y = ny;
      }
      if (dead) { killParticle(p); continue; }
      px[p] = x; py[p] = y;
      pvx[p] *= 0.99;
    }
  }

  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, pp = 2 * l - q;
    const f = t => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return pp + (q - pp) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return pp + (q - pp) * (2 / 3 - t) * 6;
      return pp;
    };
    const r = (f(h + 1 / 3) * 255) | 0, g = (f(h) * 255) | 0, b = (f(h - 1 / 3) * 255) | 0;
    return (255 << 24) | (b << 16) | (g << 8) | r;   // little-endian ABGR for ImageData
  }

  function fireworkBurst(x, y) {
    const hue = rnd() * 360;
    const hue2 = hue + 60 + rnd() * 180;
    const n = 70 + rint(40);
    const ring = rnd() < 0.4;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rnd() * 0.2;
      const s = ring ? 1.6 + rnd() * 0.2 : 0.4 + rnd() * 1.6;
      const col = rnd() < 0.15 ? hsl(0, 0, 0.95) : hsl(k & 1 ? hue : hue2, 1, 0.62);
      addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0, 0, 0, 1, col, 35 + rint(35));
    }
    explode(x, y, 2, E.FIREWORK);
    stats.fireworks++;
    events.push({ type: 'firework', x, y, hue });
  }

  /* ========================================================================
     Lightning & lasers
     ======================================================================== */
  function bolt(x, y, maxLen, depth) {
    let cx = x, cy = y;
    for (let s = 0; s < maxLen; s++) {
      const nx = Math.min(W - 1, Math.max(0, cx + (rnd() < 0.55 ? rint(3) - 1 : 0)));
      const ny = cy + 1;
      if (ny >= H) { strike(cx, cy); return; }
      const j = ny * W + nx, o = type[j];
      if (o === 0 || STATE[o] === ST.GAS || STATE[o] === ST.ENERGY) {
        setNew(j, E.BOLT);
        cx = nx; cy = ny;
        if (depth < 2 && rnd() < 0.035) bolt(cx, cy, 10 + rint(20), depth + 1);
      } else { strike(nx, ny); return; }
    }
  }

  function strike(x, y) {
    const j = y * W + x;
    if (CONDUCT[type[j]]) electrify(j);
    // alchemy: lightning transmutes lead into gold
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const q = ny * W + nx;
      if (type[q] === E.LEAD && rnd() < 0.45) convert(q, E.GOLD);
    }
    for (let k = 0; k < 14; k++) {
      const nx = x + rint(7) - 3, ny = y + rint(7) - 3;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const q = ny * W + nx;
      temp[q] += 1200;
      if (type[q] === 0 && rnd() < 0.6) convert(q, E.PLASMA);
      else if (CONDUCT[type[q]]) electrify(q);
    }
    explode(x, y, 3, E.LIGHTNING);
    events.push({ type: 'zap', x, y });
  }

  function laserStep(i, x, y) {
    let d = life[i] & 7, hp = life[i] >> 3;
    let ci = i, cx = x, cy = y;
    for (let s = 0; s < 6; s++) {
      let nx = cx + DX8[d], ny = cy + DY8[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) { setEmpty(ci); return; }
      let j = ny * W + nx, o = type[j];
      if (o === E.GLASS || o === E.ICE) {
        // transparent: tunnel through
        let k = 0;
        while (k < 60 && (o === E.GLASS || o === E.ICE)) {
          nx += DX8[d]; ny += DY8[d]; k++;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) { setEmpty(ci); return; }
          j = ny * W + nx; o = type[j];
        }
      }
      if (o === 0 || ((STATE[o] === ST.GAS || STATE[o] === ST.ENERGY) && o !== E.LASER)) {
        setNew(ci, E.BEAM);
        type[j] = E.LASER; shade[j] = shade[ci]; life[j] = (hp << 3) | d; stamp[j] = tstamp; temp[j] = 1500;
        ci = j; cx = nx; cy = ny;
        continue;
      }
      if (o === E.METAL || o === E.MOLTEN_METAL || o === E.CRYSTAL) {
        if (o === E.CRYSTAL && hp > 2) {
          // crystals split the beam
          const d2 = (d + 2) & 7, bx = cx + DX8[d2], by = cy + DY8[d2];
          if (bx >= 0 && by >= 0 && bx < W && by < H && type[by * W + bx] === 0) {
            const b = by * W + bx; type[b] = E.LASER; life[b] = (((hp / 2) | 0) << 3) | d2; stamp[b] = tstamp;
          }
          d = (d + 6) & 7;
        } else {
          d = (d + 4 + (rnd() < 0.3 ? (rnd() < 0.5 ? 1 : -1) : 0)) & 7;
        }
        hp--;
        if (hp <= 0) { setEmpty(ci); return; }
        continue;
      }
      if (INDES[o]) { setEmpty(ci); return; }
      // burn the target
      temp[j] += 900;
      if (FLAM[o]) temp[j] = Math.max(temp[j], FLAM[o] + 100);
      if (STATE[o] !== ST.SOLID || BLAST[o] === 0) {
        if (rnd() < 0.35) { if (rnd() < 0.5) convert(j, E.FIRE); else setEmpty(j); stats.destroyed++; }
      }
      hp--;
      if (hp <= 0) { setEmpty(ci); return; }
      break;
    }
    life[ci] = (hp << 3) | d;
    stamp[ci] = tstamp;
  }

  const WHITE_SPEW = ['SAND', 'WATER', 'FIRE', 'LAVA', 'SNOW', 'GLITTER', 'CONFETTI', 'OIL', 'STARDUST', 'PLASMA', 'SLIME', 'GLOWSTICK', 'SALT', 'SEED', 'EMBER', 'GOLD', 'DIAMOND']
    .map(k => E[k]);

  function meteorImpact(i, x, y) {
    setEmpty(i);
    explode(x, y, 16, E.METEOR);
    for (let k = 0; k < 40; k++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6, sp = 1 + rnd() * 2.6;
      addParticle(x, y - 1, Math.cos(a) * sp, Math.sin(a) * sp, rnd() < 0.6 ? E.LAVA : E.STONE, rint(256), 1300, 0, 0, 0);
    }
  }

  function cryoBlast(i, cx, cy) {
    setEmpty(i);
    const r = 15, r2 = r * r;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const j = y * W + x, o = type[j];
      temp[j] = Math.min(temp[j], -220 + Math.sqrt(d2) * 6);
      if (o === E.WATER || o === E.SALTWATER || o === E.STEAM) convert(j, E.ICE);
      else if (o === E.LAVA) convert(j, E.OBSIDIAN);
      else if (o === E.FIRE || o === E.BLUEFIRE || o === E.PLASMA || o === E.RAINBOWFIRE) setEmpty(j);
      else if (o === 0 && rnd() < 0.25) setNew(j, E.SNOW);
    }
    for (let k = 0; k < 60; k++) { const a = rnd() * 6.283, sp = 0.5 + rnd() * 2; addParticle(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, 0, 0, 0, 1, hsl(190, 1, 0.8), 25 + rint(25)); }
    stats.explosions++;
    events.push({ type: 'boom', x: cx, y: cy, r: 10, destroyed: 0 });
  }

  /* ========================================================================
     Per-cell update
     ======================================================================== */
  function update(i, x, y, t) {
    const tp = temp[i];

    if (t === E.COAL && tp > 2800 && rnd() < 0.05) { convert(i, E.DIAMOND); return; }

    // ---- phase transitions ----
    if (tp > HI_T[t] && rnd() < HI_P[t]) {
      let to = HI_TO[t];
      if (t === E.SALTWATER && rnd() < 0.3) to = E.SALT;
      convert(i, to);
      return;
    }
    if (tp < LO_T[t] && rnd() < LO_P[t]) { convert(i, LO_TO[t]); return; }

    // ---- ignition ----
    const fl = FLAM[t];
    if (fl > 0 && tp > fl) {
      if (EXPL[t]) { detonate(i, x, y, t); return; }
      if (t === E.THERMITE) { setNew(i, E.TBURN); stats.burned++; return; }
      if (t === E.FIREWORK) { type[i] = E.ROCKET; life[i] = 22 + rint(26); temp[i] = 600; return; }
      if (t === E.SMOKEBOMB) {
        for (let k = 0; k < 2; k++) {
          const j = emptyNbPreferUp(x, y);
          if (j >= 0) { setNew(j, E.COLORSMOKE); shade[j] = shade[i] + rint(40); }
        }
        if (temp[i] < 300) temp[i] = 300;
        if (rnd() < 0.012) convert(i, E.ASH);
        return;
      }
      if (burnStep(i, x, y, t)) return;
    }

    switch (t) {
      case E.FIRE: case E.BLUEFIRE: case E.RAINBOWFIRE: {
        const n = rndNb(x, y);
        if (n >= 0) {
          const o = type[n];
          if (isWet(o)) {
            setEmpty(i);
            if (o === E.WATER || o === E.SALTWATER) { if (rnd() < 0.4) { convert(n, E.STEAM); temp[n] = 120; } }
            stats.sizzles++;
            return;
          }
          if (FLAM[o]) temp[n] += 120;
        }
        if (--life[i] <= 0) { if (rnd() < 0.15) setNew(i, E.SMOKE); else setEmpty(i); return; }
        const ft = t === E.BLUEFIRE ? 1300 : 800;
        if (temp[i] < ft) temp[i] = ft;
        const tx = x + rint(3) - 1, ty = rnd() < 0.75 ? y - 1 : y;
        if (tx >= 0 && tx < W && ty >= 0) {
          const j = ty * W + tx, o = type[j];
          if (o === 0 || (STATE[o] === ST.GAS)) { swap(i, j); stamp[j] = tstamp; }
        }
        return;
      }
      case E.SPARK: {
        for (let k = 0; k < 8; k++) {
          const nx = x + NX[k], ny = y + NY[k];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx, o = type[j];
          if (CONDUCT[o]) { electrify(j); setEmpty(i); return; }
          if (FLAM[o]) temp[j] = Math.max(temp[j], FLAM[o] + 30);
        }
        if (--life[i] <= 0) { setEmpty(i); return; }
        const tx = x + rint(3) - 1, ty = y + (rnd() < 0.7 ? 1 : 0);
        if (tx >= 0 && tx < W && ty < H) {
          const j = ty * W + tx;
          if (type[j] === 0) { swap(i, j); stamp[j] = tstamp; }
        }
        return;
      }
      case E.BOLT: case E.BEAM:
        if (--life[i] <= 0) setEmpty(i);
        return;
      case E.PLASMA: {
        if (--life[i] <= 0) { setEmpty(i); return; }
        temp[i] = 3000;
        const j = rndNb(x, y);
        if (j >= 0) {
          const o = type[j];
          if (o === 0 || STATE[o] === ST.GAS) { swap(i, j); stamp[j] = tstamp; }
          else if (FLAM[o]) temp[j] += 400;
        }
        return;
      }
      case E.LIGHTNING:
        setEmpty(i);
        bolt(x, y, H * 2, 0);
        return;
      case E.LASER:
        laserStep(i, x, y);
        return;
      case E.ROCKET: {
        temp[i] = 600;
        if (--life[i] <= 0) { setEmpty(i); fireworkBurst(x, y); return; }
        const ty = y - 1, tx = x + (rnd() < 0.15 ? rint(3) - 1 : 0);
        if (ty < 0) { setEmpty(i); fireworkBurst(x, y); return; }
        const j = ty * W + Math.min(W - 1, Math.max(0, tx)), o = type[j];
        if (o === 0 || STATE[o] === ST.GAS || STATE[o] === ST.ENERGY) {
          swap(i, j); stamp[j] = tstamp;
          setNew(i, rnd() < 0.5 ? E.FIRE : E.SPARK); life[i] = 4 + rint(6);
        } else { setEmpty(i); fireworkBurst(x, y); }
        return;
      }
      case E.EMBER: {
        if (--life[i] <= 0) { convert(i, E.ASH); return; }
        if (temp[i] < 650) temp[i] = 650;
        const n = rndNb(x, y);
        if (n >= 0) {
          const o = type[n];
          if (isWet(o)) { convert(i, E.ASH); stats.sizzles++; return; }
          if (FLAM[o]) temp[n] += 60;
        }
        movePowder(i, x, y, t);
        return;
      }
      case E.TBURN: {
        temp[i] = 2800;
        if (--life[i] <= 0) { convert(i, rnd() < 0.5 ? E.MOLTEN_METAL : E.ASH); return; }
        const n = rndNb(x, y);
        if (n >= 0 && type[n] !== 0) temp[n] += 350;
        if (rnd() < 0.15) {
          const j = emptyNbPreferUp(x, y);
          if (j >= 0) { if (rnd() < 0.3) setNew(j, E.EMBER); else setNew(j, E.FIRE); }
        }
        // sinks through molten metal and liquids
        movePowder(i, x, y, t);
        return;
      }
      case E.TORCH: {
        temp[i] = 900;
        if (y > 0 && rnd() < 0.6) {
          const j = i - W;
          if (type[j] === 0) { setNew(j, E.FIRE); life[j] = 8 + rint(16); }
        }
        return;
      }
      case E.DIRT: {
        if (rnd() < 0.1) {
          const n = rndNb(x, y);
          if (n >= 0 && type[n] === E.WATER) { convert(i, E.MUD); if (rnd() < 0.5) setEmpty(n); return; }
        }
        movePowder(i, x, y, t);
        return;
      }
      case E.SALT: {
        const n = rndNb(x, y);
        if (n >= 0) {
          const o = type[n];
          if (o === E.WATER && rnd() < 0.08) { convert(i, E.SALTWATER); convert(n, E.SALTWATER); return; }
          if ((o === E.ICE || o === E.SNOW) && rnd() < 0.03) { convert(n, E.WATER); }
          if (o === E.MOLTEN_GLASS && rnd() < 0.05) { convert(i, E.CRYSTAL); return; }
        }
        movePowder(i, x, y, t);
        return;
      }
      case E.SEED: {
        const ci = movePowder(i, x, y, t);
        if (ci < 0 || lastMoved || ci + W >= N) return;
        const b = type[ci + W];
        if ((b === E.DIRT || b === E.MUD) && rnd() < (b === E.MUD ? 0.05 : 0.02)) {
          convert(ci, E.PLANT);
          life[ci] = 22 + rint(30) + (b === E.MUD ? 15 : 0);
        }
        return;
      }
      case E.PLANT: {
        if (life[i] < 0) return;   // dormant decoration (starter scene)
        if (rnd() < 0.05) {
          const n = rndNb(x, y);
          if (n >= 0) {
            const o = type[n];
            if (o === E.WATER || o === E.MUD) {
              if (o === E.WATER) setEmpty(n);
              if (life[i] < 45) life[i] += 6;
            }
          }
        }
        const lf = life[i];
        if (lf > 0 && rnd() < 0.09) {
          const r = rnd();
          const dx = r < 0.62 ? 0 : (r < 0.81 ? -1 : 1);
          const nx = x + dx, ny = y - (rnd() < 0.92 ? 1 : 0);
          if (nx >= 0 && nx < W && ny >= 0) {
            const j = ny * W + nx;
            if (type[j] === 0) {
              setNew(j, E.PLANT); shade[j] = shade[i];
              life[j] = lf - 1;
              stats.created[E.PLANT]++;
              life[i] = (rnd() < 0.07 && lf > 10) ? (lf * 0.5) | 0 : 0;
              if (lf - 1 === 0 && rnd() < 0.35 && ny > 0 && type[j - W] === 0) {
                setNew(j - W, E.FLOWER); stats.created[E.FLOWER]++;
              }
            }
          }
        }
        return;
      }
      case E.FLOWER: {
        if (life[i] >= 0 && rnd() < 0.0004) {
          const j = rndNb(x, y);
          if (j >= 0 && type[j] === 0) setNew(j, E.SEED);
        }
        return;
      }
      case E.FUNGUS: {
        if (rnd() < 0.012) {
          const n = rndNb(x, y);
          if (n >= 0) {
            const o = type[n];
            if (o === E.WOOD || o === E.PLANT || o === E.SAWDUST || o === E.FLOWER || o === E.SEED) convert(n, E.FUNGUS);
            else if (o === 0 && n + W < N) {
              const b = type[n + W];
              if ((b === E.DIRT || b === E.MUD || b === E.WOOD) && rnd() < 0.3) convert(n, E.FUNGUS);
            }
          }
        }
        return;
      }
      case E.WOOD: {
        if (rnd() < 0.004) {
          const n = rndNb(x, y);
          if (n >= 0 && type[n] === E.MUD && rnd() < 0.25) convert(i, E.FUNGUS);
        }
        return;
      }
      case E.VIRUS: {
        if (--life[i] <= 0) { setEmpty(i); return; }
        if (rnd() < 0.22) {
          const n = rndNb(x, y);
          if (n >= 0) {
            const o = type[n];
            if (o && o !== E.VIRUS && !INDES[o] && STATE[o] !== ST.GAS && STATE[o] !== ST.ENERGY) {
              type[n] = E.VIRUS; life[n] = life[i] - 28; vel[n] = 0;
            }
          }
        }
        return;
      }
      case E.FISH: {
        if (tp > 60) { convert(i, E.ASH); return; }
        let wet = false;
        if (y > 0 && (type[i - W] === E.WATER || type[i - W] === E.SALTWATER)) wet = true;
        else if (y < H - 1 && (type[i + W] === E.WATER || type[i + W] === E.SALTWATER)) wet = true;
        else if (x > 0 && (type[i - 1] === E.WATER || type[i - 1] === E.SALTWATER)) wet = true;
        else if (x < W - 1 && (type[i + 1] === E.WATER || type[i + 1] === E.SALTWATER)) wet = true;
        if (wet) {
          life[i] = 400;
          if (rnd() < 0.45) {
            const j = rndNb(x, y);
            if (j >= 0 && (type[j] === E.WATER || type[j] === E.SALTWATER)) { swap(i, j); stamp[j] = tstamp; }
          }
          return;
        }
        if (--life[i] <= 0) { convert(i, E.ASH); return; }
        movePowder(i, x, y, t);
        return;
      }
      case E.FIREFLY: {
        if (rnd() < 0.35) {
          const j = rndNb(x, y);
          if (j >= 0 && type[j] === 0) { swap(i, j); stamp[j] = tstamp; }
        }
        return;
      }
      case E.TOXIC: {
        const n = rndNb(x, y);
        if (n >= 0) {
          const o = type[n];
          if ((o === E.PLANT || o === E.FLOWER || o === E.FISH || o === E.SEED || o === E.FUNGUS || o === E.FIREFLY) && rnd() < 0.08) convert(n, E.ASH);
        }
        if (--life[i] <= 0) { setEmpty(i); return; }
        moveGas(i, x, y, t);
        return;
      }
      case E.ACID: {
        if (rnd() < 0.35) {
          const n = rndNb(x, y);
          if (n >= 0) {
            const o = type[n];
            if (o && o !== E.ACID && !ACIDPROOF[o] && !INDES[o] && STATE[o] !== ST.GAS && STATE[o] !== ST.ENERGY) {
              if (o === E.WATER) { if (rnd() < 0.01) convert(i, E.WATER); }
              else {
                if (rnd() < 0.25) convert(n, E.TOXIC); else setEmpty(n);
                stats.dissolved++;
                if (rnd() < 0.2) { setEmpty(i); return; }
              }
            }
          }
        }
        moveLiquid(i, x, y, t);
        return;
      }
      case E.LAVA: {
        const n = rndNb(x, y);
        if (n >= 0) {
          const o = type[n];
          if ((o === E.WATER || o === E.SALTWATER) && rnd() < 0.3) {
            convert(i, E.OBSIDIAN); convert(n, E.STEAM); temp[n] = 140; stats.sizzles++; return;
          }
          if (o === E.SAND && rnd() < 0.012) convert(n, E.MOLTEN_GLASS);
          else if ((o === E.ICE || o === E.SNOW) && rnd() < 0.2) convert(n, E.WATER);
          else if (FLAM[o]) temp[n] += 90;
        }
        moveLiquid(i, x, y, t);
        return;
      }
      case E.METAL: {
        if (rnd() < 0.02) {
          const n = rndNb(x, y);
          if (n >= 0) {
            const o = type[n];
            if ((o === E.WATER && rnd() < 0.02) || (o === E.SALTWATER && rnd() < 0.12)) convert(i, E.RUST);
          }
        }
        return;
      }
      case E.CRYSTAL: {
        if (rnd() < 0.015) {
          const n = rndNb(x, y);
          if (n >= 0 && type[n] === E.SALTWATER) { convert(n, E.CRYSTAL); shade[n] = rint(256); }
        }
        return;
      }
      case E.SPONGE: {
        if (life[i] < 30 && rnd() < 0.3) {
          const n = rndNb(x, y);
          if (n >= 0) {
            const o = type[n];
            if (STATE[o] === ST.LIQUID && o !== E.LAVA && o !== E.MOLTEN_GLASS && o !== E.MOLTEN_METAL) { setEmpty(n); life[i]++; }
          }
        }
        if (tp > 100 && life[i] > 0 && rnd() < 0.12) {
          const j = emptyNbPreferUp(x, y);
          if (j >= 0) { convert(j, E.STEAM); life[i]--; }
        }
        return;
      }
      case E.CONVEYOR_L: case E.CONVEYOR_R: {
        if ((tick & 1) || y === 0) return;
        const a = i - W, o = type[a];
        if (!o || INDES[o] || STATE[o] === ST.SOLID || stamp[a] === tstamp) return;
        const nx = x + (t === E.CONVEYOR_R ? 1 : -1);
        if (nx < 0 || nx >= W) return;
        const j = a + (nx - x);
        if (type[j] === 0 || STATE[type[j]] === ST.GAS) { swap(a, j); stamp[j] = tstamp; }
        return;
      }
      case E.CLONER: {
        if (life[i] === 0) {
          const n = rndNb(x, y);
          if (n >= 0) {
            const o = type[n];
            if (o && o !== E.CLONER && !INDES[o] && o !== E.BOLT && o !== E.BEAM && o !== E.ROCKET) life[i] = o;
          }
        } else if (rnd() < 0.2) {
          const n = rndNb(x, y);
          if (n >= 0 && type[n] === 0) setNew(n, life[i]);
        }
        return;
      }
      case E.VOID: {
        for (let k = 0; k < 8; k++) {
          const nx = x + NX[k], ny = y + NY[k];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (type[j] && !INDES[type[j]]) setEmpty(j);
        }
        return;
      }
      case E.BLACKHOLE: {
        blackholes.push(i);
        const R = 18;
        for (let k = 0; k < 40; k++) {
          const dx = rint(R * 2 + 1) - R, dy = rint(R * 2 + 1) - R;
          const d2 = dx * dx + dy * dy;
          if (d2 === 0 || d2 > R * R) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx, o = type[j];
          if (!o || INDES[o]) continue;
          if (d2 <= 5) { setEmpty(j); stats.destroyed++; continue; }
          const sx = dx > 0 ? -1 : dx < 0 ? 1 : 0, sy = dy > 0 ? -1 : dy < 0 ? 1 : 0;
          const tj = (ny + sy) * W + (nx + sx);
          if (type[tj] === 0) { swap(j, tj); stamp[tj] = tstamp; }
        }
        temp[i] = ambient;
        return;
      }
      case E.HEATER: case E.COOLER: {
        const dt = t === E.HEATER ? 30 : -30;
        for (let k = 0; k < 8; k++) {
          const nx = x + NX[k], ny = y + NY[k];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          let v = temp[j] + dt;
          temp[j] = v > 2200 ? 2200 : v < -273 ? -273 : v;
        }
        temp[i] = t === E.HEATER ? 1200 : -200;
        return;
      }
      case E.BATTERY: {
        if ((tick + (i & 7)) % 24 !== 0) return;
        if (y > 0) electrify(i - W);
        if (y < H - 1) electrify(i + W);
        if (x > 0) electrify(i - 1);
        if (x < W - 1) electrify(i + 1);
        return;
      }
      case E.ANTIMATTER: {
        for (let k = 0; k < 8; k++) {
          const nx = x + NX[k], ny = y + NY[k];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx, o = type[j];
          if (o && o !== E.ANTIMATTER && !INDES[o] && STATE[o] !== ST.ENERGY) {
            setEmpty(i); setEmpty(j);
            explode(x, y, 3, E.ANTIMATTER);
            convert(i, E.PLASMA);
            return;
          }
        }
        movePowder(i, x, y, t);
        return;
      }

      /* ------------------------------ new elements ------------------------------ */
      case E.FROSTFIRE: {
        const n = rndNb(x, y);
        if (n >= 0) {
          const o = type[n];
          if (o === E.WATER || o === E.SALTWATER) convert(n, E.ICE);
          else if (o === E.FIRE || o === E.BLUEFIRE || o === E.RAINBOWFIRE) setEmpty(n);
          else if (o === E.LAVA) convert(n, E.OBSIDIAN);
          else if (o === E.STEAM) convert(n, E.SNOW);
          if (temp[n] > -200) temp[n] -= 70;
        }
        if (--life[i] <= 0) { if (rnd() < 0.2) setNew(i, E.SNOW); else setEmpty(i); return; }
        if (temp[i] > -150) temp[i] = -150;
        const tx = x + rint(3) - 1, ty = rnd() < 0.75 ? y - 1 : y;
        if (tx >= 0 && tx < W && ty >= 0) {
          const j = ty * W + tx, o = type[j];
          if (o === 0 || STATE[o] === ST.GAS) { swap(i, j); stamp[j] = tstamp; }
        }
        return;
      }
      case E.RADIATION: {
        if (--life[i] <= 0) { setEmpty(i); return; }
        let ci = i, cx = x, cy = y;
        for (let s2 = 0; s2 < 2; s2++) {
          const k = rint(8), nx = cx + NX[k], ny = cy + NY[k];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) { setEmpty(ci); return; }
          const j = ny * W + nx, o = type[j];
          if (o === 0 || STATE[o] === ST.GAS) { swap(ci, j); stamp[j] = tstamp; ci = j; cx = nx; cy = ny; continue; }
          if (o === E.RADIATION || o === E.URANIUM) continue;
          if (o === E.PLANT || o === E.FLOWER || o === E.LEAF || o === E.MOSS || o === E.SEED || o === E.ALGAE) convert(j, E.FUNGUS);
          else if (o === E.FISH || o === E.ANT || o === E.WORM || o === E.BIRD || o === E.BEE) convert(j, E.ASH);
          else if (o !== E.LEAD && !INDES[o]) temp[j] += 40;
          setEmpty(ci);
          return;
        }
        return;
      }
      case E.METEOR: {
        if (life[i] === 0) life[i] = rnd() < 0.5 ? 1 : 2;
        const dx = life[i] === 1 ? 1 : -1;
        let ci = i, cx = x, cy = y;
        for (let s2 = 0; s2 < 3; s2++) {
          const nx = cx + (s2 === 1 ? 0 : dx), ny = cy + 1;
          if (ny >= H || nx < 0 || nx >= W) { meteorImpact(ci, cx, cy); return; }
          const j = ny * W + nx, o = type[j];
          if (o === 0 || STATE[o] === ST.GAS || STATE[o] === ST.ENERGY) {
            type[j] = E.METEOR; life[j] = life[ci]; shade[j] = shade[ci]; temp[j] = 1500; stamp[j] = tstamp;
            setNew(ci, E.FIRE); life[ci] = 6 + rint(10);
            ci = j; cx = nx; cy = ny;
          } else { meteorImpact(ci, cx, cy); return; }
        }
        return;
      }
      case E.URANIUM: {
        temp[i] += 1.4;
        if (temp[i] > 2400 && rnd() < 0.004) {
          setEmpty(i); explode(x, y, 12, E.URANIUM);
          for (let k = 0; k < 20; k++) { const a = rnd() * 6.283; addParticle(x, y, Math.cos(a) * 2, Math.sin(a) * 2, 0, 0, 0, 1, hsl(110, 1, 0.6), 30 + rint(20)); }
          return;
        }
        if (rnd() < 0.006) { const j = rndNb(x, y); if (j >= 0 && type[j] === 0) setNew(j, E.RADIATION); }
        movePowder(i, x, y, t);
        return;
      }
      case E.MOONDUST:
        if (rnd() < 0.22) movePowder(i, x, y, t);
        return;
      case E.STARDUST: {
        if (y === 0) return;
        const j = i - W, o = type[j];
        if (o === 0 || STATE[o] === ST.GAS || STATE[o] === ST.LIQUID || STATE[o] === ST.ENERGY) { swap(i, j); stamp[j] = tstamp; return; }
        const d = rnd() < 0.5 ? -1 : 1;
        for (let k = 0; k < 2; k++) {
          const nx = x + (k ? -d : d);
          if (nx < 0 || nx >= W) continue;
          const q = (y - 1) * W + nx;
          if (type[q] === 0 || STATE[type[q]] === ST.GAS) { swap(i, q); stamp[q] = tstamp; return; }
        }
        return;
      }
      case E.CEMENT: {
        if (rnd() < 0.1) {
          const n = rndNb(x, y);
          if (n >= 0 && type[n] === E.WATER) { convert(i, E.CONCRETE); if (rnd() < 0.5) setEmpty(n); return; }
        }
        movePowder(i, x, y, t);
        return;
      }
      case E.SUGAR: {
        const n = rndNb(x, y);
        if (n >= 0 && type[n] === E.WATER && rnd() < 0.03) { convert(i, E.HONEY); return; }
        movePowder(i, x, y, t);
        return;
      }
      case E.IRON: {
        if (rnd() < 0.01) { const n = rndNb(x, y); if (n >= 0 && (type[n] === E.WATER || type[n] === E.SALTWATER) && rnd() < 0.1) { convert(i, E.RUST); return; } }
        movePowder(i, x, y, t);
        return;
      }
      case E.SOAP: {
        const n = rndNb(x, y);
        if (n >= 0 && type[n] === E.WATER && rnd() < 0.05) {
          const j = emptyNbPreferUp(x, y);
          if (j >= 0) { setNew(j, E.BUBBLE); stats.created[E.BUBBLE]++; }
          if (rnd() < 0.08) { setEmpty(i); return; }
        }
        moveLiquid(i, x, y, t);
        return;
      }
      case E.FOAM:
        if (--life[i] <= 0) { setEmpty(i); return; }
        moveLiquid(i, x, y, t);
        return;
      case E.GREEK_FIRE: {
        if (--life[i] <= 0) { setNew(i, E.SMOKE); return; }
        if (temp[i] < 1000) temp[i] = 1000;
        if (rnd() < 0.3) { const j = emptyNbPreferUp(x, y); if (j >= 0) { setNew(j, E.FIRE); life[j] = 6 + rint(12); } }
        const n = rndNb(x, y);
        if (n >= 0 && FLAM[type[n]]) temp[n] += 100;
        moveLiquid(i, x, y, t);
        return;
      }
      case E.HELIUM:
        moveGas(i, x, y, t);
        if (rnd() < 0.8 && y > 0) { const j = i - W; if (type[j] === 0) { swap(i, j); stamp[j] = tstamp; } }
        return;
      case E.CHLORINE: {
        const n = rndNb(x, y);
        if (n >= 0) {
          const o = type[n];
          if ((o === E.PLANT || o === E.FLOWER || o === E.FISH || o === E.LEAF || o === E.ANT || o === E.WORM || o === E.BEE || o === E.BIRD || o === E.MOSS) && rnd() < 0.08) convert(n, E.ASH);
          else if (o === E.WATER && rnd() < 0.01) { convert(n, E.ACID); setEmpty(i); return; }
        }
        if (--life[i] <= 0) { setEmpty(i); return; }
        // heavy gas: sinks
        const r = rnd();
        const tx = x + rint(3) - 1, ty = r < 0.5 ? y + 1 : (r < 0.6 ? y - 1 : y);
        if (tx >= 0 && tx < W && ty >= 0 && ty < H) {
          const j = ty * W + tx, o = type[j];
          if (o === 0 || (STATE[o] === ST.GAS && o !== E.CHLORINE && ty > y)) { swap(i, j); stamp[j] = tstamp; }
        }
        return;
      }
      case E.CLOUD: case E.STORM: {
        const storm = t === E.STORM;
        if (rnd() < 0.06) {
          const j = x + (rnd() < 0.5 ? -1 : 1);
          if (j >= 0 && j < W && type[y * W + j] === 0) { swap(i, y * W + j); stamp[y * W + j] = tstamp; }
        }
        if (y < H - 1 && rnd() < (storm ? 0.03 : 0.012) && type[i + W] === 0) {
          setNew(i + W, ambient <= 0 ? E.SNOW : E.WATER);
          if (++life[i] > (storm ? 90 : 60) && rnd() < 0.3) { setEmpty(i); return; }
        }
        if (storm && y < H - 2 && rnd() < 0.0006) { bolt(x, y + 1, H * 2, 0); events.push({ type: 'zap', x, y }); }
        return;
      }
      case E.MAGNET: {
        const R = 14;
        for (let k = 0; k < 30; k++) {
          const dx = rint(R * 2 + 1) - R, dy = rint(R * 2 + 1) - R;
          if (dx * dx + dy * dy > R * R || (dx === 0 && dy === 0)) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx, o = type[j];
          if (o !== E.IRON && o !== E.MOLTEN_METAL) continue;
          const sx = dx > 0 ? -1 : dx < 0 ? 1 : 0, sy = dy > 0 ? -1 : dy < 0 ? 1 : 0;
          const tj = (ny + sy) * W + (nx + sx), to = type[tj];
          if (to === 0 || STATE[to] === ST.GAS || STATE[to] === ST.LIQUID && to !== E.MOLTEN_METAL) { swap(j, tj); stamp[tj] = tstamp; vel[tj] = 0; }
        }
        return;
      }
      case E.BULB:
        if (life[i] > 0) life[i]--;
        return;
      case E.FAN: {
        for (let k = 14; k >= 1; k--) {
          const yy = y - k;
          if (yy < 1) continue;
          const j = yy * W + x, o = type[j];
          if (!o || INDES[o] || STATE[o] === ST.SOLID) continue;
          const a = j - W;
          if (type[a] === 0) { swap(j, a); stamp[a] = tstamp; vel[a] = 0; }
        }
        return;
      }
      case E.DRAIN: {
        for (let k = 0; k < 8; k++) {
          const nx = x + NX[k], ny = y + NY[k];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx, o = type[j];
          if (o && (STATE[o] === ST.LIQUID || STATE[o] === ST.GAS)) setEmpty(j);
        }
        return;
      }
      case E.MINE: {
        for (let k = 0; k < 8; k++) {
          const nx = x + NX[k], ny = y + NY[k];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const o = type[ny * W + nx];
          if (o && o !== E.MINE && (STATE[o] === ST.POWDER || STATE[o] === ST.LIQUID || o === E.BIRD || o === E.BEE)) { detonate(i, x, y, t); return; }
        }
        return;
      }
      case E.SAPLING: {
        const ci = movePowder(i, x, y, t);
        if (ci < 0 || lastMoved || ci + W >= N) return;
        const b = type[ci + W];
        if ((b === E.DIRT || b === E.MUD || b === E.SAND || b === E.GRAVEL || b === E.CLAY) && rnd() < 0.06) {
          type[ci] = E.TRUNK; life[ci] = 14 + rint(16);
        }
        return;
      }
      case E.TRUNK: {
        if (rnd() > 0.18) return;
        const lf = life[i];
        type[i] = E.WOOD;
        stats.created[E.WOOD]++;
        if (lf > 1 && y > 1) {
          const j = i - W, o = type[j];
          if (o === 0 || STATE[o] === ST.GAS || o === E.LEAF) {
            setNew(j, E.TRUNK); life[j] = lf - 1;
            if (lf > 6 && lf < 14 && rnd() < 0.18) {
              const bx = x + (rnd() < 0.5 ? -1 : 1);
              if (bx >= 0 && bx < W && type[j - W + (bx - x)] === 0) { const q = j - W + (bx - x); setNew(q, E.TRUNK); life[q] = 3 + rint(3); }
            }
            return;
          }
        }
        // canopy
        const r = 3 + rint(3);
        for (let dy = -r; dy <= r; dy++) for (let dx = -r - 2; dx <= r + 2; dx++) {
          if ((dx * dx) / 1.6 + dy * dy > r * r * (0.8 + rnd() * 0.35)) continue;
          const nx = x + dx, ny = y + dy - 1;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const q = ny * W + nx;
          if (type[q] === 0 || STATE[type[q]] === ST.GAS) { setNew(q, rnd() < 0.04 ? E.FLOWER : E.LEAF); stats.created[E.LEAF]++; }
        }
        return;
      }
      case E.CACTUS: {
        if (life[i] === 0 && y < H - 1 && type[i + W] === E.SAND) life[i] = 6 + rint(9);
        if (life[i] > 0 && rnd() < 0.05 && y > 0) {
          const j = i - W;
          if (type[j] === 0) {
            setNew(j, E.CACTUS); life[j] = life[i] - 1; stats.created[E.CACTUS]++;
            if (life[i] > 3 && life[i] < 9 && rnd() < 0.35) {
              const ax = x + (rnd() < 0.5 ? -1 : 1);
              if (ax >= 0 && ax < W && type[y * W + ax] === 0) { const q = y * W + ax; setNew(q, E.CACTUS); life[q] = 3; }
            }
            if (life[i] === 1 && y > 1 && type[j - W] === 0 && rnd() < 0.6) { setNew(j - W, E.FLOWER); shade[j - W] = 0; }
            life[i] = -1;
          }
        }
        return;
      }
      case E.MOSS: {
        if (rnd() < 0.006) {
          const n = rndNb(x, y);
          if (n >= 0 && type[n] === 0) {
            const nx = n % W, ny = (n / W) | 0;
            for (let k = 1; k < 8; k += 2) {
              const ax = nx + NX[k], ay = ny + NY[k];
              if (ax < 0 || ay < 0 || ax >= W || ay >= H) continue;
              const o = type[ay * W + ax];
              if (o === E.STONE || o === E.BRICK || o === E.CONCRETE || o === E.GRAVEL || o === E.OBSIDIAN) { setNew(n, E.MOSS); stats.created[E.MOSS]++; break; }
            }
          }
        }
        return;
      }
      case E.ALGAE: {
        if (rnd() < 0.004) {
          const n = rndNb(x, y);
          if (n >= 0 && type[n] === E.WATER) convert(n, E.ALGAE);
        }
        return;
      }
      case E.ANT: {
        if (rnd() > 0.5) return;
        if (life[i] === 0) life[i] = rnd() < 0.5 ? 1 : -1;
        if (y < H - 1) {
          const b = i + W;
          if (type[b] === 0 || STATE[type[b]] === ST.GAS) { swap(i, b); stamp[b] = tstamp; return; }
        }
        const nx = x + life[i];
        if (nx < 0 || nx >= W) { life[i] = -life[i]; return; }
        const j = y * W + nx, o = type[j];
        if (o === 0) { swap(i, j); stamp[j] = tstamp; return; }
        if (y > 0 && type[j - W] === 0) { swap(i, j - W); stamp[j - W] = tstamp; return; }
        if ((o === E.DIRT || o === E.SAND || o === E.MUD) && rnd() < 0.15) { swap(i, j); stamp[j] = tstamp; return; }
        life[i] = -life[i];
        return;
      }
      case E.WORM: {
        let inDirt = false;
        for (let k = 1; k < 8; k += 2) {
          const ax = x + NX[k], ay = y + NY[k];
          if (ax < 0 || ay < 0 || ax >= W || ay >= H) continue;
          const o = type[ay * W + ax];
          if (o === E.DIRT || o === E.MUD) { inDirt = true; break; }
        }
        if (inDirt) {
          if (rnd() < 0.3) { const j = rndNb(x, y); if (j >= 0 && (type[j] === E.DIRT || type[j] === E.MUD)) { swap(i, j); stamp[j] = tstamp; } }
          return;
        }
        movePowder(i, x, y, t);
        return;
      }
      case E.BIRD: case E.PHOENIX: {
        const fast = t === E.PHOENIX;
        if (fast) {
          temp[i] = 1200;
          const n = rndNb(x, y);
          if (n >= 0 && (type[n] === E.WATER || type[n] === E.SALTWATER)) { convert(i, E.EMBER); return; }
        }
        if (life[i] === 0) life[i] = rnd() < 0.5 ? 1 : -1;
        const steps = fast ? 2 : 1;
        let ci = i, cx = x, cy = y;
        for (let s2 = 0; s2 < steps; s2++) {
          if (rnd() > 0.65) continue;
          const nx = cx + life[ci], ny = cy + (rnd() < 0.35 ? rint(3) - 1 : 0) - (cy > H - 6 ? 1 : 0);
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) { life[ci] = -life[ci]; continue; }
          const j = ny * W + nx, o = type[j];
          if (o === 0 || (fast && STATE[o] === ST.ENERGY)) {
            swap(ci, j); stamp[j] = tstamp;
            if (fast && rnd() < 0.7) { setNew(ci, E.FIRE); life[ci] = 8 + rint(12); }
            ci = j; cx = nx; cy = ny;
          } else life[ci] = -life[ci];
        }
        return;
      }
      case E.BEE: {
        const n = rndNb(x, y);
        if (n >= 0) {
          if (type[n] === E.FLOWER && rnd() < 0.02) {
            const j = rndNb(x, y);
            if (j >= 0 && type[j] === 0) { setNew(j, E.HONEY); stats.created[E.HONEY]++; }
          } else if (type[n] === 0 && rnd() < 0.5) { swap(i, n); stamp[n] = tstamp; }
        }
        return;
      }
      case E.GHOST: {
        if (rnd() < 0.4) {
          const k = rint(8), nx = x + NX[k], ny = y + NY[k] - (rnd() < 0.15 ? 1 : 0);
          if (nx >= 0 && ny >= 0 && nx < W && ny < H) {
            const j = ny * W + nx;
            if (!INDES[type[j]] || type[j] === 0) { swap(i, j); stamp[j] = tstamp; }
          }
        }
        return;
      }
      case E.PORTAL_B:
        portB.push(i);
        return;
      case E.PORTAL_A: {
        if (!portBPrev.length) return;
        for (let k = 0; k < 2; k++) {
          const n = rndNb(x, y);
          if (n < 0) continue;
          const o = type[n];
          if (!o || INDES[o] || STATE[o] === ST.SOLID) continue;
          const b = portBPrev[rint(portBPrev.length)];
          if (type[b] !== E.PORTAL_B) continue;
          const bx = b % W, by = (b / W) | 0;
          for (let q = 0; q < 4; q++) {
            const e = rndNb(bx, by);
            if (e >= 0 && type[e] === 0) {
              type[e] = o; shade[e] = shade[n]; life[e] = life[n]; temp[e] = temp[n]; vel[e] = vel[n]; stamp[e] = tstamp;
              setEmpty(n);
              break;
            }
          }
        }
        return;
      }
      case E.STASIS:
        stasisL.push(i);
        return;
      case E.TRANSMUTER: {
        if (life[i] === 0) {
          const n = rndNb(x, y);
          if (n >= 0) { const o = type[n]; if (o && !INDES[o] && o !== E.TRANSMUTER && !ELEMENTS[o].hidden) life[i] = o; }
          return;
        }
        for (let k = 0; k < 3; k++) {
          const nx = x + rint(7) - 3, ny = y + rint(7) - 3;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx, o = type[j];
          if (o && o !== life[i] && !INDES[o] && rnd() < 0.12) { const tp2 = temp[j]; setNew(j, life[i]); if (!HAS_T0[life[i]]) temp[j] = tp2; }
        }
        return;
      }
      case E.VOLCANO: {
        temp[i] = 1200;
        if (y === 0 || type[i - W] !== 0) return;
        const erupt = rnd() < 0.004;
        const n = erupt ? 28 : (rnd() < 0.22 ? 1 : 0);
        for (let k = 0; k < n; k++) addParticle(x, y - 1, (rnd() - 0.5) * (erupt ? 3 : 1.4), -(2 + rnd() * (erupt ? 3.5 : 2.2)), E.LAVA, rint(256), 1400, 0, 0, 0);
        if (rnd() < 0.05) addParticle(x, y - 1, (rnd() - 0.5) * 1.6, -2 - rnd() * 2, E.EMBER, rint(256), 700, 0, 0, 0);
        if (rnd() < 0.08) setNew(i - W, E.SMOKE);
        if (erupt) events.push({ type: 'boom', x, y, r: 6, destroyed: 0 });
        return;
      }
      case E.GEYSER: {
        if (y === 0 || type[i - W] !== 0) return;
        if ((tick + (i & 127)) % 160 < 26) {
          if (rnd() < 0.7) addParticle(x, y - 1, (rnd() - 0.5) * 0.7, -(2.8 + rnd() * 1.8), E.WATER, rint(256), 60, 0, 0, 0);
          if (rnd() < 0.3) { setNew(i - W, E.STEAM); stats.created[E.STEAM]++; }
        }
        return;
      }
      case E.SUN: {
        halos.push(i, 1);
        temp[i] = 6000;
        const R = 12;
        for (let k = 0; k < 30; k++) {
          const dx = rint(R * 2 + 1) - R, dy = rint(R * 2 + 1) - R;
          const d2 = dx * dx + dy * dy;
          if (d2 > R * R || d2 === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (INDES[type[j]] && type[j] !== 0) continue;
          temp[j] += 70 * (1 - Math.sqrt(d2) / R);
          if (type[j] === 0 && d2 < 30 && rnd() < 0.03) setNew(j, E.PLASMA);
        }
        return;
      }
      case E.WHITEHOLE: {
        halos.push(i, 2);
        if (rnd() < 0.6) {
          const spew = WHITE_SPEW[rint(WHITE_SPEW.length)];
          const a = rnd() * Math.PI * 2, sp = 0.8 + rnd() * 1.8;
          addParticle(x + Math.cos(a) * 2, y + Math.sin(a) * 2, Math.cos(a) * sp, Math.sin(a) * sp - 0.6, spew, rint(256), HAS_T0[spew] ? T0[spew] : ambient, 0, 0, 0);
        }
        return;
      }
      case E.VORTEX: {
        halos.push(i, 3);
        const R = 18;
        for (let k = 0; k < 60; k++) {
          const dx = rint(R * 2 + 1) - R, dy = rint(R * 2 + 1) - R;
          const d2 = dx * dx + dy * dy;
          if (d2 < 3 || d2 > R * R) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx, o = type[j];
          if (!o || INDES[o] || STATE[o] === ST.SOLID) continue;
          // tangential step (counter-clockwise) with a slight inward pull
          let sx = dy > 0 ? 1 : dy < 0 ? -1 : 0, sy = dx > 0 ? -1 : dx < 0 ? 1 : 0;
          if (rnd() < 0.25) { sx = dx > 0 ? -1 : dx < 0 ? 1 : sx; sy = dy > 0 ? -1 : dy < 0 ? 1 : sy; }
          const tx = nx + sx, ty = ny + sy;
          if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
          const tj = ty * W + tx, to = type[tj];
          if (to === 0 || STATE[to] === ST.GAS) { swap(j, tj); stamp[tj] = tstamp; vel[tj] = 0; }
        }
        return;
      }
      case E.CRYOBOMB: {
        const ci = movePowder(i, x, y, t);
        if (ci < 0 || lastMoved) return;
        const cy = (ci / W) | 0;
        const below = cy + 1 < H ? type[ci + W] : -1;
        if (below !== 0 && below !== E.CRYOBOMB) cryoBlast(ci, ci % W, cy);
        return;
      }
      case E.BOMB: case E.NUKE: case E.CLUSTERBOMB: case E.BOMBLET: {
        const ci = movePowder(i, x, y, t);
        if (ci < 0 || lastMoved) return;
        const cy = (ci / W) | 0;
        const below = cy + 1 < H ? type[ci + W] : -1;
        if (below !== E.BOMB && below !== E.NUKE && below !== E.BOMBLET && below !== E.CLUSTERBOMB && below !== 0) detonate(ci, ci % W, cy, t);
        return;
      }
    }

    // ---- generic behaviour by state ----
    const s = STATE[t];
    if (s === ST.POWDER) { movePowder(i, x, y, t); return; }
    if (s === ST.LIQUID) { moveLiquid(i, x, y, t); return; }
    if (s === ST.GAS) {
      if (LIFE_MAX[t] && --life[i] <= 0) { setEmpty(i); return; }
      moveGas(i, x, y, t);
    }
  }

  /* ========================================================================
     Heat diffusion
     ======================================================================== */
  function heatPass() {
    const amb = ambient;
    for (let y = 0; y < H; y++) {
      const row = y * W, last = y < H - 1;
      for (let x = 0; x < W; x++) {
        const i = row + x;
        const a = type[i];
        let ti = temp[i];
        const ls = LOSS[a];
        if (ls) ti += (amb - ti) * ls;
        const ka = COND_K[a];
        if (ka > 0) {
          if (x < W - 1) {
            const j = i + 1, kb = COND_K[type[j]];
            if (kb > 0) { const d = (temp[j] - ti) * (ka < kb ? ka : kb) * 0.25; ti += d; temp[j] -= d; }
          }
          if (last) {
            const j = i + W, kb = COND_K[type[j]];
            if (kb > 0) { const d = (temp[j] - ti) * (ka < kb ? ka : kb) * 0.25; ti += d; temp[j] -= d; }
          }
        }
        temp[i] = ti;
      }
    }
  }

  /* ========================================================================
     Main tick
     ======================================================================== */
  function step() {
    tick++;
    tstamp = (tstamp + 1) & 255; if (tstamp === 0) tstamp = 1;
    blackholes.length = 0;
    halos.length = 0;
    portBPrev = portB; portB = [];
    stasisPrev = stasisL; stasisL = [];
    heatPass();
    // stasis fields freeze everything around them for this tick
    for (let n = 0; n < stasisPrev.length; n++) {
      const i = stasisPrev[n];
      if (type[i] !== E.STASIS) continue;
      const cx = i % W, cy = (i / W) | 0;
      for (let dy = -5; dy <= 5; dy++) {
        const y = cy + dy; if (y < 0 || y >= H) continue;
        for (let dx = -5; dx <= 5; dx++) {
          const x = cx + dx; if (x < 0 || x >= W || dx * dx + dy * dy > 26) continue;
          const j = y * W + x;
          if (type[j] !== E.STASIS) stamp[j] = tstamp;
        }
      }
      stamp[i] = 0;
    }
    for (let y = H - 1; y >= 0; y--) {
      const row = y * W;
      const ltr = ((y + tick) & 1) === 0;
      for (let c = 0; c < W; c++) {
        const x = ltr ? c : W - 1 - c;
        const i = row + x;
        const t = type[i];
        if (t === 0 || stamp[i] === tstamp) continue;
        update(i, x, y, t);
      }
    }
    electricityPass();
    particlesStep();
  }

  /* ========================================================================
     Player interaction
     ======================================================================== */
  function brushCells(cx, cy, size, shape, fn) {
    const r = size - 1;
    if (r <= 0) { if (cx >= 0 && cy >= 0 && cx < W && cy < H) fn(cy * W + cx, cx, cy); return; }
    const r2 = (r + 0.5) * (r + 0.5);
    for (let dy = -r; dy <= r; dy++) {
      const y = cy + dy; if (y < 0 || y >= H) continue;
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx; if (x < 0 || x >= W) continue;
        if (shape !== 'square' && dx * dx + dy * dy > r2) continue;
        if (shape === 'spray' && rnd() > 0.06) continue;
        fn(y * W + x, x, y);
      }
    }
  }

  const PLACE_DENSITY = [1, 1, 0.85, 0.9, 0.55, 0.5];
  function paint(cx, cy, size, shape, el, opts) {
    let placed = 0;
    const big = size > 1;
    let dens = big ? PLACE_DENSITY[STATE[el]] : 1;
    if (big) {
      if (el === E.SEED) dens = 0.2;
      else if (el === E.FISH) dens = 0.06;
      else if (el === E.FIREFLY) dens = 0.05;
      else if (el === E.FIREWORK) dens = 0.3;
    }
    const replace = opts && opts.replace;
    brushCells(cx, cy, size, shape, (i) => {
      if (el === 0) { if (type[i]) { setEmpty(i); charge[i] = 0; temp[i] = ambient; } return; }
      if (type[i] !== 0 && !(replace && type[i] !== el)) return;
      if (dens < 1 && rnd() > dens) return;
      setNew(i, el);
      if (!HAS_T0[el]) temp[i] = ambient;
      if (el === E.LASER) life[i] = (12 << 3) | ((opts && opts.dir) || 0);
      if (el === E.SPARK) { /* sparks dropped on conductors jump straight in */ }
      placed++;
    });
    stats.placed[el] += placed;
    return placed;
  }

  function heatBrush(cx, cy, size, shape, dt) {
    brushCells(cx, cy, size, shape === 'spray' ? 'circle' : shape, (i) => {
      let v = temp[i] + dt;
      temp[i] = v > 3000 ? 3000 : v < -273 ? -273 : v;
    });
  }

  function mixBrush(cx, cy, size) {
    const cells = [];
    brushCells(cx, cy, Math.max(2, size), 'circle', (i) => {
      if (type[i] && !INDES[type[i]] && STATE[type[i]] !== ST.SOLID) cells.push(i);
    });
    const all = [];
    brushCells(cx, cy, Math.max(2, size), 'circle', (i) => { if (!INDES[type[i]] || type[i] === 0) all.push(i); });
    for (let k = 0; k < cells.length; k++) {
      const a = cells[k], b = all[rint(all.length)];
      if (STATE[type[b]] === ST.SOLID && type[b] !== 0) continue;
      swap(a, b);
    }
  }

  function snapshot() {
    return { W, H, type: type.slice(), shade: shade.slice(), life: life.slice(), temp: temp.slice() };
  }
  function restore(s) {
    if (s.W !== W || s.H !== H) return false;
    type.set(s.type); shade.set(s.shade); life.set(s.life); temp.set(s.temp);
    vel.fill(0); charge.fill(0); elec = []; pcount = 0;
    return true;
  }

  function copyRegion(x0, y0, x1, y1) {
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const r = { w, h, type: new Uint8Array(w * h), shade: new Uint8Array(w * h), life: new Int16Array(w * h), temp: new Float32Array(w * h) };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = (y0 + y) * W + (x0 + x), b = y * w + x;
      r.type[b] = type[a]; r.shade[b] = shade[a]; r.life[b] = life[a]; r.temp[b] = temp[a];
    }
    return r;
  }
  function pasteRegion(r, x0, y0) {
    for (let y = 0; y < r.h; y++) {
      const yy = y0 + y; if (yy < 0 || yy >= H) continue;
      for (let x = 0; x < r.w; x++) {
        const xx = x0 + x; if (xx < 0 || xx >= W) continue;
        const b = y * r.w + x;
        if (!r.type[b]) continue;
        const a = yy * W + xx;
        type[a] = r.type[b]; shade[a] = r.shade[b]; life[a] = r.life[b]; temp[a] = r.temp[b]; vel[a] = 0;
      }
    }
  }
  function fillRegion(x0, y0, x1, y1, el) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (el === 0) setEmpty(i); else { setNew(i, el); if (!HAS_T0[el]) temp[i] = ambient; }
    }
  }

  /* compact run-length encoding of the grid for saves */
  function serialize() {
    const out = [];
    let run = 0, cur = type[0];
    for (let i = 0; i <= N; i++) {
      const t = i < N ? type[i] : -1;
      if (t === cur && run < 4095) { run++; continue; }
      out.push(ELEMENTS[cur].key + (run > 1 ? '*' + run : ''));
      cur = t; run = 1;
    }
    return { v: 1, W, H, d: out.join(',') };
  }
  function deserialize(o) {
    if (!o || !o.d) return false;
    if (o.W !== W || o.H !== H) init(o.W, o.H);
    else clear();
    let i = 0;
    for (const part of o.d.split(',')) {
      const [k, n] = part.split('*');
      const t = E[k] != null ? E[k] : 0, c = n ? +n : 1;
      for (let q = 0; q < c && i < N; q++, i++) {
        if (t) { setNew(i, t); if (!HAS_T0[t]) temp[i] = ambient; }
      }
    }
    return true;
  }

  function countNonEmpty() {
    let c = 0;
    for (let i = 0; i < N; i++) if (type[i]) c++;
    return c;
  }

  return {
    init, clear, step, paint, heatBrush, mixBrush, snapshot, restore, copyRegion, pasteRegion, fillRegion,
    serialize, deserialize, countNonEmpty, explode, setNew, stats, events, blackholes, halos, hsl,
    get W() { return W; }, get H() { return H; }, get tick() { return tick; },
    get type() { return type; }, get shade() { return shade; }, get life() { return life; },
    get temp() { return temp; }, get charge() { return charge; },
    get ambient() { return ambient; }, set ambient(v) { ambient = v; },
    particles: { px, py, ptype, pshade, pcol, pkind, plife, get count() { return pcount; } },
  };
})();
