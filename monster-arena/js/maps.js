'use strict';
// =====================================================================
// 場地。obs：障礙物（k: rock/tree/crystal/column，top＝可站上去的高度）
// lava：岩漿池｜ice：地面滑｜void：沒有圍牆、掉出去會扣血
// =====================================================================
const MAPS = [
  {id:'star', name:'星光競技場', desc:'經典場地，四根岩柱可以擋子彈、跳上去', emoji:'🌌',
    floor:['#2a3a5c','#141d33'], grid:'rgba(150,180,240,.10)', line:'rgba(170,200,255,.30)', bg:'#0a0f1c', fog:'#0a0f1c',
    wall:'#28344f', edge:'#4f86e0', sun:.9, sunColor:'#ffffff', hemi:['#c4d8ff','#1b2236',.8], bloomT:.9,
    obs:[{x:430,y:285,r:36,top:54,k:'rock'},{x:850,y:465,r:36,top:54,k:'rock'},{x:640,y:215,r:24,top:44,k:'rock'},{x:640,y:540,r:24,top:44,k:'rock'}]},
  {id:'meadow', name:'翠綠草原', desc:'陽光草地，大樹可以當掩護', emoji:'🌳',
    floor:['#6fae52','#3f7c36'], grid:'rgba(255,255,255,.05)', line:'rgba(255,255,255,.28)', bg:'#9fd4ff', fog:'#bfe3ff',
    wall:'#7a5a3a', edge:'#d8b27a', sun:1.05, sunColor:'#fff6e0', hemi:['#ffffff','#4a6a3a',.85], bloomT:.97, amb:'leaf',
    obs:[{x:400,y:230,r:30,top:220,k:'tree'},{x:880,y:520,r:30,top:220,k:'tree'},{x:300,y:540,r:24,top:220,k:'tree'},{x:980,y:210,r:24,top:220,k:'tree'},{x:640,y:375,r:26,top:40,k:'rock'}]},
  {id:'volcano', name:'熔岩火山', desc:'踩到岩漿會受傷並可能灼傷（火系與跳在空中免疫）', emoji:'🌋',
    floor:['#4a2c24','#1f110e'], grid:'rgba(255,120,60,.06)', line:'rgba(255,140,80,.25)', bg:'#1a0806', fog:'#2a0c08',
    wall:'#3a2420', edge:'#ff6a2a', sun:.75, sunColor:'#ffb080', hemi:['#ff9a6a','#200a06',.7], bloomT:.88, amb:'ember',
    lava:[{x:640,y:375,r:72},{x:330,y:190,r:56},{x:950,y:560,r:56}],
    obs:[{x:470,y:520,r:34,top:60,k:'rock'},{x:810,y:230,r:34,top:60,k:'rock'}]},
  {id:'ice', name:'冰封雪原', desc:'地面很滑，起步和煞車都要時間', emoji:'❄️',
    floor:['#e4f4ff','#b6d6ea'], grid:'rgba(80,140,200,.12)', line:'rgba(60,120,200,.35)', bg:'#cfe6f7', fog:'#dbeefa',
    wall:'#9cc2dc', edge:'#ffffff', sun:.85, sunColor:'#ffffff', hemi:['#ffffff','#7aa0c0',.75], bloomT:.99, amb:'snow', ice:true,
    obs:[{x:420,y:300,r:30,top:70,k:'crystal'},{x:860,y:450,r:30,top:70,k:'crystal'},{x:640,y:180,r:22,top:56,k:'crystal'},{x:640,y:570,r:22,top:56,k:'crystal'}]},
  {id:'sky', name:'天空神殿', desc:'沒有圍牆！掉出場地會損失 1/4 HP', emoji:'☁️',
    floor:['#efe8d6','#bdb399'], grid:'rgba(120,100,60,.10)', line:'rgba(200,170,90,.55)', bg:'#7fb8ff', fog:'#a8d0ff',
    sun:1.0, sunColor:'#ffffff', hemi:['#ffffff','#6a7fa0',.85], bloomT:.98, amb:'cloud', void:true,
    obs:[{x:520,y:375,r:26,top:90,k:'column'},{x:760,y:375,r:26,top:90,k:'column'}]},
  {id:'desert', name:'沙漠遺跡', desc:'傾倒的石柱散落各處，高低差多', emoji:'🏜️',
    floor:['#e2c48c','#b08a50'], grid:'rgba(120,80,30,.08)', line:'rgba(255,240,200,.32)', bg:'#f0d8a8', fog:'#f2dcb0',
    wall:'#a07a48', edge:'#f8e0a8', sun:1.05, sunColor:'#fff0d0', hemi:['#fff4e0','#8a6a40',.8], bloomT:.98, amb:'sand',
    obs:[{x:360,y:220,r:28,top:110,k:'column'},{x:360,y:530,r:28,top:40,k:'column'},{x:640,y:300,r:24,top:70,k:'column'},{x:640,y:470,r:24,top:30,k:'column'},{x:920,y:220,r:28,top:40,k:'column'},{x:920,y:530,r:28,top:110,k:'column'}]}
];
let MAP = MAPS[0];
let PILLARS = MAP.obs;
function mapById(id) { return MAPS.find(m => m.id === id) || MAPS[0]; }
function setMap(id) { MAP = mapById(id); PILLARS = MAP.obs; }
function randomMapId() { return MAPS[Math.floor(Math.random() * MAPS.length)].id; }
