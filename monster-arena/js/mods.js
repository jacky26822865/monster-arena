'use strict';
// =====================================================================
// 模組：自訂怪獸（怪獸工坊）、mods/ 資料夾的 JSON 模組、連線時同步定義
// =====================================================================
ABIL['無'] = '沒有特性';
const BUILTIN_SPECIES = new Set(SPECIES.map(s => s.id)), BUILTIN_MOVES = new Set(Object.keys(MOVES));
const MOD_LOG = [];
function cleanId(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32); }
function normSpecies(s, src) {
  if (!s || typeof s !== 'object') throw new Error('格式錯誤');
  const id = cleanId(s.id); if (!id) throw new Error('缺少 id');
  const types = (Array.isArray(s.types) ? s.types : [s.types]).map(t => String(t).toUpperCase()).filter(t => TYPE_KEYS.includes(t)).slice(0, 2);
  if (!types.length) throw new Error(`${id}：屬性錯誤`);
  if (types[1] === types[0]) types.pop();
  const base = {}; for (const k of STAT_KEYS) base[k] = clamp(Math.round(+((s.base || {})[k]) || 50), 1, 255);
  const evs = {}; let tot = 0; for (const k of STAT_KEYS) { const v = clamp(Math.round(+((s.evs || {})[k]) || 0), 0, 252); if (tot + v <= 510) { evs[k] = v; tot += v; } }
  const moves = (Array.isArray(s.moves) ? s.moves : []).map(String).filter(m => MOVES[m] && m !== 'struggle' && !MOVES[m].basic).slice(0, 4);
  const fill = ['quick', 'bodyslam', 'recover', 'dteam']; for (const f of fill) if (moves.length < 4 && !moves.includes(f)) moves.push(f);
  const look = Object.assign({ body: 'round', parts: [], legs: 'two', arms: false, acc: '#ffffff' }, s.look || {});
  look.body = BODIES[look.body] ? look.body : 'round'; look.parts = (look.parts || []).filter(p => PARTS[p]); look.legs = ['two', 'four', 'none'].includes(look.legs) ? look.legs : 'two'; look.arms = !!look.arms; look.eye = look.eye === 'dot' ? 'dot' : 'normal';
  return { id, name: String(s.name || id).slice(0, 12), types, base, ability: ABIL[s.ability] !== undefined ? s.ability : '無', nature: NATURES.some(n => n[0] === s.nature) ? s.nature : '認真', evs, moves, look,
    model: typeof s.model === 'string' ? s.model : undefined, modelYaw: +s.modelYaw || 0, scale: clamp(+s.scale || 1, .5, 2), src: src || 'mod', author: s.author ? String(s.author).slice(0, 30) : undefined };
}
function registerSpecies(s, src) {
  try {
    const n = normSpecies(s, src);
    if (BUILTIN_SPECIES.has(n.id)) { MOD_LOG.push(`略過 ${n.id}：不能覆蓋內建怪獸`); return null; }
    const i = SPECIES.findIndex(x => x.id === n.id); if (i >= 0) SPECIES[i] = n; else SPECIES.push(n); return n;
  } catch (e) { MOD_LOG.push('模組錯誤：' + e.message); return null; }
}
function registerMoves(obj) {
  for (const [id0, mv] of Object.entries(obj || {})) {
    const id = cleanId(id0); if (!id || BUILTIN_MOVES.has(id) || !mv) continue;
    const type = String(mv.type || 'NORMAL').toUpperCase(); if (!TYPES[type]) continue;
    const shape = ['proj', 'melee', 'dash', 'aoeSelf', 'zone', 'self', 'blink'].includes(mv.shape) ? mv.shape : 'proj';
    MOVES[id] = Object.assign({}, mv, { name: String(mv.name || id).slice(0, 10), type, shape, power: clamp(+mv.power || 0, 0, 150), acc: clamp(+mv.acc || 0, 0, 100), pp: clamp(+mv.pp || 10, 1, 40) });
  }
  finalizeMoves();
}
function applyMod(m, src) { if (!m) return 0; if (m.moves) registerMoves(m.moves); let n = 0; for (const s of m.species || []) if (registerSpecies(s, src)) n++; return n; }
function registerDefs(d) { try { if (d.moves) registerMoves(d.moves); for (const s of d.species || []) registerSpecies(s, 'net'); } catch (e) { console.warn(e); } }
function defsFor(ids) {
  const species = [], moves = {};
  for (const id of ids) { const sp = speciesById(id); if (!sp || BUILTIN_SPECIES.has(id)) continue; species.push(sp); for (const mid of sp.moves) if (!BUILTIN_MOVES.has(mid)) moves[mid] = MOVES[mid]; }
  return species.length ? { species, moves } : null;
}
function loadLocalCustoms() {
  try { for (const s of JSON.parse(localStorage.getItem('ma_custom') || '[]')) registerSpecies(s, 'custom'); } catch (e) {}
  try { for (const m of JSON.parse(localStorage.getItem('ma_mods') || '[]')) applyMod(m, 'import'); } catch (e) {}
}
function saveCustoms() { try { localStorage.setItem('ma_custom', JSON.stringify(SPECIES.filter(s => s.src === 'custom'))); } catch (e) { toast('儲存失敗：瀏覽器空間不足'); } }
async function loadFolderMods() {
  try {
    const r = await fetch('mods/index.json', { cache: 'no-cache' }); if (!r.ok) return 0; const list = await r.json(); let n = 0;
    for (const f of (list.mods || list)) { try { const m = await (await fetch('mods/' + f, { cache: 'no-cache' })).json(); n += applyMod(m, 'mods/' + f); } catch (e) { MOD_LOG.push(`${f} 載入失敗：${e.message}`); } }
    return n;
  } catch (e) { return 0; }
}
