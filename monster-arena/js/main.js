'use strict';
// =====================================================================
// 進入點與主迴圈
// =====================================================================
(async function boot() {
  loadLocalCustoms();
  initUI();
  let hq = !touchMode; try { const v = localStorage.getItem('ma_hq'); if (v !== null) hq = v === '1'; } catch (e) {}
  setHQ(hq);
  show('title');
  const n = await loadFolderMods();
  const custom = SPECIES.length - BUILTIN_SPECIES.size;
  $('modInfo').textContent = custom ? `・已載入 ${custom} 隻自訂／模組怪獸${n ? `（mods 資料夾 ${n} 隻）` : ''}` : '';
  if (MOD_LOG.length) console.warn(MOD_LOG.join('\n'));
  // 模組是非同步載入的：如果玩家已經在選角畫面，重新整理名單
  if (n && !$('select').classList.contains('hidden')) { buildFilters(); buildRoster(); }
})();
let lastTs = 0;
function loop(ts) {
  const dt = Math.min(.033, (ts - lastTs) / 1000 || 0); lastTs = ts;
  try {
    updateInput(dt);
    if (G) {
      if (G.net === 'client') clientTick(dt);
      else if (!G.paused && !G.over) { let sdt = dt; if (G.hs > 0) { G.hs -= dt; sdt = dt * .08; } update(sdt); }
      else if (G.over) updateCosmetic(dt);
      netTick(dt);
    }
    render3D(dt); ctx.clearRect(0, 0, W, H); if (G) { drawOverlay(); drawHUD(); } updateTouchUI();
    if (PV && !$('select').classList.contains('hidden')) PV.frame(dt, true);
    if (CR && !$('creator').classList.contains('hidden')) CR.frame(dt, true);
  } catch (e) { console.error(e); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
