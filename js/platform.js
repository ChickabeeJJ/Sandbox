'use strict';
/* =========================================================================
   Platform layer: wraps the CrazyGames SDK v3 (ads, gameplay events, cloud
   data) and degrades gracefully to localStorage when running standalone.
   ========================================================================= */

const Platform = (() => {
  let sdk = null;
  let ready = false;
  let inGameplay = false;
  let lastMidgame = 0;
  const MIDGAME_GAP = 3 * 60 * 1000;
  const PREFIX = 'powderlab_';

  async function init() {
    try {
      if (window.CrazyGames && window.CrazyGames.SDK) {
        await window.CrazyGames.SDK.init();
        sdk = window.CrazyGames.SDK;
        if (sdk.environment === 'disabled') sdk = null;
      }
    } catch (e) { sdk = null; }
    ready = true;
    lastMidgame = Date.now();
  }

  function store() {
    if (sdk && sdk.data) return sdk.data;
    try { localStorage.setItem(PREFIX + 't', '1'); return localStorage; } catch (e) { return null; }
  }

  const memory = {};
  function getItem(k) {
    const s = store();
    try { return s ? s.getItem(PREFIX + k) : (memory[k] ?? null); } catch (e) { return memory[k] ?? null; }
  }
  function setItem(k, v) {
    const s = store();
    try { if (s) s.setItem(PREFIX + k, v); else memory[k] = v; } catch (e) { memory[k] = v; }
  }
  function removeItem(k) {
    const s = store();
    try { if (s) s.removeItem(PREFIX + k); } catch (e) { /* ignore */ }
    delete memory[k];
  }

  function loadingStart() { try { sdk && sdk.game.loadingStart(); } catch (e) { /* ignore */ } }
  function loadingStop() { try { sdk && sdk.game.loadingStop(); } catch (e) { /* ignore */ } }
  function gameplayStart() {
    if (inGameplay) return; inGameplay = true;
    try { sdk && sdk.game.gameplayStart(); } catch (e) { /* ignore */ }
  }
  function gameplayStop() {
    if (!inGameplay) return; inGameplay = false;
    try { sdk && sdk.game.gameplayStop(); } catch (e) { /* ignore */ }
  }
  function happytime() { try { sdk && sdk.game.happytime(); } catch (e) { /* ignore */ } }

  function requestAd(kind, cb) {
    // cb(success:boolean)
    if (!sdk) { cb(kind === 'rewarded'); return; }
    let done = false;
    const finish = ok => { if (done) return; done = true; Sfx.setAdMuted(false); cb(ok); };
    try {
      sdk.ad.requestAd(kind, {
        adStarted: () => { Sfx.setAdMuted(true); },
        adFinished: () => finish(true),
        adError: () => finish(false),
      });
    } catch (e) { finish(false); }
  }

  /* midgame ad at natural breaks, rate-limited */
  function maybeMidgame(cb) {
    if (!sdk || Date.now() - lastMidgame < MIDGAME_GAP) { cb && cb(); return; }
    lastMidgame = Date.now();
    const wasPlaying = inGameplay;
    gameplayStop();
    requestAd('midgame', () => { if (wasPlaying) gameplayStart(); cb && cb(); });
  }

  return {
    init, getItem, setItem, removeItem, loadingStart, loadingStop, gameplayStart, gameplayStop,
    happytime, requestAd, maybeMidgame,
    get hasSdk() { return !!sdk; }, get ready() { return ready; },
  };
})();
