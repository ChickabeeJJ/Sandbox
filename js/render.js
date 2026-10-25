'use strict';
/* =========================================================================
   Renderer: writes the grid into an ImageData at cell resolution, plus a
   separate emissive "glow" buffer that CSS blurs into a bloom layer.
   ========================================================================= */

const Renderer = (() => {
  let main, mctx, glow, gctx, bloom, bctx;
  let img, buf, gbuf, bg;
  let W = 0, H = 0;
  // downsampled bloom layers: A = 1/2 res soft glow, B = 1/6 res wide bloom
  const FA = 2, FB = 6;
  let wA, hA, wB, hB, aimg, abuf, bimg, bbuf;
  let aR, aG, aB, bR, bG, bB, tmp;
  const PAL = new Uint32Array(N_EL * 16);
  const HUE = new Uint32Array(360);
  const FIRE_RAMP = new Uint32Array(64);
  const HOT_RAMP = new Uint32Array(64);
  let bgTop = [13, 14, 17], bgBot = [4, 4, 6];

  const pack = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  const R = c => c & 255, G = c => (c >> 8) & 255, B = c => (c >> 16) & 255;
  function mix(c1, c2, f) {
    const r = R(c1) + (R(c2) - R(c1)) * f, g = G(c1) + (G(c2) - G(c1)) * f, b = B(c1) + (B(c2) - B(c1)) * f;
    return pack(r | 0, g | 0, b | 0);
  }
  function scale(c, f) {
    let r = R(c) * f, g = G(c) * f, b = B(c) * f;
    return pack(r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, b > 255 ? 255 : b | 0);
  }
  function ramp(stops, n, out) {
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1) * (stops.length - 1);
      const a = Math.floor(f), b = Math.min(stops.length - 1, a + 1), t = f - a;
      const ca = hexToRgb(stops[a]), cb = hexToRgb(stops[b]);
      out[i] = pack((ca[0] + (cb[0] - ca[0]) * t) | 0, (ca[1] + (cb[1] - ca[1]) * t) | 0, (ca[2] + (cb[2] - ca[2]) * t) | 0);
    }
  }

  function buildPalettes() {
    let s = 1337;
    const r01 = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    ELEMENTS.forEach(d => {
      for (let k = 0; k < 16; k++) {
        const base = hexToRgb(d.col[k % d.col.length]);
        const j = 0.92 + r01() * 0.16;
        PAL[d.id * 16 + k] = pack(Math.min(255, base[0] * j) | 0, Math.min(255, base[1] * j) | 0, Math.min(255, base[2] * j) | 0);
      }
    });
    for (let h = 0; h < 360; h++) HUE[h] = Sim.hsl(h, 1, 0.6) >>> 0;
    ramp(['#5a0d05', '#b3200b', '#ff4d1f', '#ff9a1f', '#ffd23d', '#fff6c2'], 64, FIRE_RAMP);
    ramp(['#3a0500', '#a01c00', '#ff4a00', '#ff9a1a', '#ffe680', '#ffffff'], 64, HOT_RAMP);
  }

  function init(mainCv, glowCv, bloomCv) {
    main = mainCv; glow = glowCv; bloom = bloomCv;
    mctx = main.getContext('2d', { alpha: false });
    gctx = glow.getContext('2d');
    bctx = bloom.getContext('2d');
    buildPalettes();
  }

  function setTheme(top, bot) { bgTop = top; bgBot = bot; if (W) buildBg(); }

  function buildBg() {
    bg = new Uint32Array(W * H);
    let s = 99;
    const r01 = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < H; y++) {
      const f = y / (H - 1);
      const r = bgTop[0] + (bgBot[0] - bgTop[0]) * f, g = bgTop[1] + (bgBot[1] - bgTop[1]) * f, b = bgTop[2] + (bgBot[2] - bgTop[2]) * f;
      for (let x = 0; x < W; x++) {
        let k = 1;
        if (x % 10 === 0 || y % 10 === 0) k = 1.18;
        const star = r01();
        if (star < 0.0025) k = 2.4;
        else if (star < 0.006) k = 1.6;
        bg[y * W + x] = pack(Math.min(255, r * k) | 0, Math.min(255, g * k) | 0, Math.min(255, b * k) | 0);
      }
    }
  }

  function resize(w, h) {
    W = w; H = h;
    main.width = w; main.height = h;
    img = mctx.createImageData(w, h);
    buf = new Uint32Array(img.data.buffer);
    gbuf = new Uint32Array(w * h);
    wA = Math.ceil(w / FA); hA = Math.ceil(h / FA);
    wB = Math.ceil(w / FB); hB = Math.ceil(h / FB);
    glow.width = wA; glow.height = hA;
    bloom.width = wB; bloom.height = hB;
    aimg = gctx.createImageData(wA, hA); abuf = new Uint32Array(aimg.data.buffer);
    bimg = bctx.createImageData(wB, hB); bbuf = new Uint32Array(bimg.data.buffer);
    aR = new Float32Array(wA * hA); aG = new Float32Array(wA * hA); aB = new Float32Array(wA * hA);
    bR = new Float32Array(wB * hB); bG = new Float32Array(wB * hB); bB = new Float32Array(wB * hB);
    tmp = new Float32Array(Math.max(wA * hA, wB * hB));
    buildBg();
  }

  /* separable box blur, radius r, in place */
  function blur(ch, w, h, r) {
    const inv = 1 / (2 * r + 1);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) acc += ch[row + xx]; }
        tmp[row + x] = acc * inv;
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let acc = 0;
        for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) acc += tmp[yy * w + x]; }
        ch[y * w + x] = acc * inv;
      }
    }
  }

  function writeLayer(out, r, g, b, n, gain) {
    for (let i = 0; i < n; i++) {
      let rr = r[i] * gain, gg = g[i] * gain, bb = b[i] * gain;
      const m = rr > gg ? (rr > bb ? rr : bb) : (gg > bb ? gg : bb);
      if (m < 1) { out[i] = 0; continue; }
      const a = m > 255 ? 255 : m;
      // premultiplied-looking output: alpha follows brightness so 'screen' blends cleanly
      const k = 255 / m;
      out[i] = ((a | 0) << 24 | (Math.min(255, bb * k) << 16) | (Math.min(255, gg * k) << 8) | Math.min(255, rr * k)) >>> 0;
    }
  }

  function buildBloom() {
    aR.fill(0); aG.fill(0); aB.fill(0); bR.fill(0); bG.fill(0); bB.fill(0);
    for (let y = 0; y < H; y++) {
      const row = y * W, ra = ((y / FA) | 0) * wA, rb = ((y / FB) | 0) * wB;
      for (let x = 0; x < W; x++) {
        const c = gbuf[row + x];
        if (c === 0) continue;
        const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
        const ia = ra + ((x / FA) | 0), ib = rb + ((x / FB) | 0);
        aR[ia] += r; aG[ia] += g; aB[ia] += b;
        bR[ib] += r; bG[ib] += g; bB[ib] += b;
      }
    }
    blur(aR, wA, hA, 1); blur(aG, wA, hA, 1); blur(aB, wA, hA, 1);
    for (let k = 0; k < 2; k++) { blur(bR, wB, hB, 1); blur(bG, wB, hB, 1); blur(bB, wB, hB, 1); }
    writeLayer(abuf, aR, aG, aB, wA * hA, 0.9);
    writeLayer(bbuf, bR, bG, bB, wB * hB, 0.32);
    gctx.putImageData(aimg, 0, 0);
    bctx.putImageData(bimg, 0, 0);
  }

  function draw() {
    const type = Sim.type, shade = Sim.shade, life = Sim.life, temp = Sim.temp, charge = Sim.charge;
    const tick = Sim.tick;
    const n = W * H;
    gbuf.fill(0);
    const sparkleT = tick >> 1;
    for (let i = 0; i < n; i++) {
      const t = type[i];
      if (t === 0) { buf[i] = bg[i]; continue; }
      const sh = shade[i];
      let c = PAL[(t << 4) | (sh & 15)];
      const def = ELEMENTS[t];
      const fx = def.fx;
      let g = GLOW[t];
      if (fx) {
        switch (fx) {
          case 'fire': {
            let k = life[i] * 2 + (sh & 7) - 4; k = k < 0 ? 0 : k > 63 ? 63 : k;
            c = FIRE_RAMP[k]; g = 1; break;
          }
          case 'lava': c = PAL[(t << 4) | ((sh + (tick >> 3) + (i % W >> 1)) & 15)]; break;
          case 'water': {
            const x = i % W;
            c = PAL[(t << 4) | ((sh + ((tick + x * 3) >> 5)) & 15)];
            const y = (i / W) | 0;
            if (y > 0 && type[i - W] === 0) c = mix(c, 0xffffffff, 0.25);
            break;
          }
          case 'gas': {
            let a = 0.55;
            if (LIFE_MAX[t]) { a = life[i] / 120; if (a > 0.6) a = 0.6; }
            c = mix(bg[i], c, a); break;
          }
          case 'glass': c = mix(bg[i], c, (sh & 31) === 0 ? 0.85 : 0.5); break;
          case 'rainbow': {
            const x = i % W, y = (i / W) | 0;
            c = HUE[(x * 3 + y * 2 + tick * 2 + (sh >> 3)) % 360]; break;
          }
          case 'glitter':
            if (((sh * 7 + sparkleT) % 53) === 0) { c = 0xffffffff; g = 1; }
            break;
          case 'neon': c = HUE[(sh + (tick >> 1)) % 360]; if (charge[i]) { c = mix(c, 0xffffffff, 0.6); g = 1.6; } break;
          case 'firefly':
            if (((tick + sh * 5) % 110) < 45) { c = pack(246, 255, 122); g = 1; } else { c = pack(70, 90, 40); g = 0; }
            break;
          case 'spark': c = (tick + sh) & 1 ? 0xffffffff : pack(255, 249, 168); break;
          case 'plasma': c = PAL[(t << 4) | ((sh + tick) & 15)]; break;
          case 'ember': if (((sh + tick) & 7) === 0) c = mix(c, 0xffffffff, 0.4); break;
          case 'torch': c = FIRE_RAMP[40 + ((sh + tick) & 15)]; break;
          case 'conveyorL': case 'conveyorR': {
            const x = i % W;
            const ph = fx === 'conveyorR' ? -(tick >> 1) : (tick >> 1);
            c = ((x + ph) & 3) === 0 ? pack(255, 210, 63) : pack(58, 63, 82);
            break;
          }
          case 'sponge': c = mix(c, pack(150, 110, 20), Math.min(1, life[i] / 30) * 0.7); break;
          case 'cloner': {
            const lt = life[i];
            c = lt ? mix(PAL[(t << 4) | (sh & 15)], PAL[(lt << 4) | (sh & 15)], 0.35 + 0.25 * Math.sin(tick * 0.1 + sh)) : c;
            break;
          }
          case 'void': c = PAL[(t << 4) | ((sh + (tick >> 2)) & 15)]; break;
          case 'blackhole': c = 0xff000000; break;
          case 'heater': c = scale(c, 0.85 + 0.2 * Math.sin(tick * 0.08 + (i % W) * 0.4)); break;
          case 'battery': c = ((i / W | 0) & 1) ? pack(61, 255, 139) : pack(31, 43, 36); break;
          case 'antimatter': c = ((sh + tick) & 2) ? pack(255, 43, 214) : pack(43, 240, 255); break;
          case 'bomb': if (((tick >> 3) & 1) && (sh & 3) === 0) { c = pack(255, 40, 40); g = 0.8; } break;
          case 'tnt': if (((i / W) | 0) % 4 === 0) c = pack(40, 30, 30); break;
          case 'barrel': if (((i / W) | 0) % 3 === 0) c = pack(120, 128, 140); break;
          case 'flower': g = 0.12; break;
          case 'wood': if (((i % W) + (sh & 1)) % 3 === 0) c = scale(c, 0.88); break;
        }
      }
      // incandescence for hot matter
      const tp = temp[i];
      const st = STATE[t];
      if (tp > 480 && st !== ST.ENERGY && st !== ST.GAS && fx !== 'lava') {
        let k = (tp - 480) / 1400; if (k > 1) k = 1;
        const hc = HOT_RAMP[(k * 63) | 0];
        c = mix(c, hc, 0.25 + k * 0.7);
        if (k > 0.05) { const gk = k * 1.2; if (gk > g) g = gk; }
      }
      if (charge[i] > 0) {
        c = charge[i] >= 3 ? 0xffffffff : pack(160, 210, 255);
        g = 1.2;
      }
      buf[i] = c;
      if (g > 0) gbuf[i] = scale(c, g);
    }

    // black hole halos
    const bhs = Sim.blackholes;
    for (let k = 0; k < bhs.length && k < 20; k++) {
      const i = bhs[k], cx = i % W, cy = (i / W) | 0;
      for (let a = 0; a < 48; a++) {
        const ang = a / 48 * Math.PI * 2 + tick * 0.05;
        for (let rr = 3; rr <= 6; rr++) {
          const x = (cx + Math.cos(ang + rr * 0.4) * rr) | 0, y = (cy + Math.sin(ang + rr * 0.4) * rr * 0.8) | 0;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const j = y * W + x;
          const col = rr < 5 ? pack(255, 140, 60) : pack(150, 70, 255);
          gbuf[j] = scale(col, 0.7);
          if (type[j] === 0) buf[j] = mix(buf[j], col, 0.35);
        }
      }
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy > 5) continue;
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = 0xff000000;
      }
    }

    // particles
    const P = Sim.particles, pc = P.count;
    for (let p = 0; p < pc; p++) {
      const x = P.px[p] | 0, y = P.py[p] | 0;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      if (P.pkind[p] === 1) {
        const c = P.pcol[p];
        const fade = P.plife[p] < 12 ? P.plife[p] / 12 : 1;
        buf[i] = mix(buf[i], c, fade);
        gbuf[i] = scale(c, 0.4 * fade);
      } else {
        const t = P.ptype[p];
        buf[i] = PAL[(t << 4) | (P.pshade[p] & 15)];
        if (GLOW[t]) gbuf[i] = scale(buf[i], GLOW[t]);
      }
    }

    mctx.putImageData(img, 0, 0);
    if (glowOn) buildBloom();
  }
  let glowOn = true;
  function setGlow(v) { glowOn = v; }

  /* swatch for UI buttons */
  function swatchCss(id) {
    const d = ELEMENTS[id];
    if (d.fx === 'rainbow') return 'linear-gradient(135deg,#ff4d4d,#ffd23d,#4dff88,#4dd2ff,#b24dff)';
    if (d.fx === 'neon') return 'linear-gradient(135deg,#ff3df2,#7a3dff,#3dd6ff)';
    if (d.key === 'FIRE') return 'linear-gradient(0deg,#ff4d1f,#ff9a1f 55%,#ffde3d)';
    const cs = d.col.slice(0, 3);
    if (cs.length === 1) cs.push(cs[0]);
    return `linear-gradient(135deg,${cs.join(',')})`;
  }

  return { init, resize, draw, swatchCss, setTheme, setGlow, get PAL() { return PAL; } };
})();
