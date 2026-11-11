'use strict';
// =====================================================================
// 資料層：屬性、相剋、性格、特性、技能、怪獸
// 第三代（GBA）數值規則；怪獸與技能名稱皆為原創
// =====================================================================
const W = 1280, H = 760, AR = { x0: 20, y0: 96, x1: 1260, y1: 654 };
const TURN = 1.5, LV = 50, VERSION = '2.0.0';
const FONT = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif';

const TYPES = {
  NORMAL:{n:'一般',c:'#a8a878'}, FIRE:{n:'火',c:'#f08030'}, WATER:{n:'水',c:'#6890f0'}, ELECTRIC:{n:'電',c:'#f8d030'},
  GRASS:{n:'草',c:'#78c850'}, ICE:{n:'冰',c:'#98d8d8'}, FIGHTING:{n:'格鬥',c:'#c03028'}, POISON:{n:'毒',c:'#a040a0'},
  GROUND:{n:'地面',c:'#e0c068'}, FLYING:{n:'飛行',c:'#a890f0'}, PSYCHIC:{n:'超能力',c:'#f85888'}, BUG:{n:'蟲',c:'#a8b820'},
  ROCK:{n:'岩石',c:'#b8a038'}, GHOST:{n:'幽靈',c:'#705898'}, DRAGON:{n:'龍',c:'#7038f8'}, DARK:{n:'惡',c:'#705848'},
  STEEL:{n:'鋼',c:'#b8b8d0'}, NONE:{n:'無',c:'#888888'}
};
const TYPE_KEYS = Object.keys(TYPES).filter(k => k !== 'NONE');
// 第三代：物理／特殊由「屬性」決定
const PHYSICAL = new Set(['NORMAL','FIGHTING','FLYING','POISON','GROUND','ROCK','BUG','GHOST','STEEL','NONE']);
const CHART = {
  NORMAL:{ROCK:.5,GHOST:0,STEEL:.5},
  FIRE:{FIRE:.5,WATER:.5,GRASS:2,ICE:2,BUG:2,ROCK:.5,DRAGON:.5,STEEL:2},
  WATER:{FIRE:2,WATER:.5,GRASS:.5,GROUND:2,ROCK:2,DRAGON:.5},
  ELECTRIC:{WATER:2,ELECTRIC:.5,GRASS:.5,GROUND:0,FLYING:2,DRAGON:.5},
  GRASS:{FIRE:.5,WATER:2,GRASS:.5,POISON:.5,GROUND:2,FLYING:.5,BUG:.5,ROCK:2,DRAGON:.5,STEEL:.5},
  ICE:{FIRE:.5,WATER:.5,GRASS:2,ICE:.5,GROUND:2,FLYING:2,DRAGON:2,STEEL:.5},
  FIGHTING:{NORMAL:2,ICE:2,POISON:.5,FLYING:.5,PSYCHIC:.5,BUG:.5,ROCK:2,GHOST:0,DARK:2,STEEL:2},
  POISON:{GRASS:2,POISON:.5,GROUND:.5,ROCK:.5,GHOST:.5,STEEL:0},
  GROUND:{FIRE:2,ELECTRIC:2,GRASS:.5,POISON:2,FLYING:0,BUG:.5,ROCK:2,STEEL:2},
  FLYING:{ELECTRIC:.5,GRASS:2,FIGHTING:2,BUG:2,ROCK:.5,STEEL:.5},
  PSYCHIC:{FIGHTING:2,POISON:2,PSYCHIC:.5,DARK:0,STEEL:.5},
  BUG:{FIRE:.5,GRASS:2,FIGHTING:.5,POISON:.5,FLYING:.5,PSYCHIC:2,GHOST:.5,DARK:2,STEEL:.5},
  ROCK:{FIRE:2,ICE:2,FIGHTING:.5,GROUND:.5,FLYING:2,BUG:2,STEEL:.5},
  GHOST:{NORMAL:0,PSYCHIC:2,GHOST:2,DARK:.5,STEEL:.5},
  DRAGON:{DRAGON:2,STEEL:.5},
  DARK:{FIGHTING:.5,PSYCHIC:2,GHOST:2,DARK:.5,STEEL:.5},
  STEEL:{FIRE:.5,WATER:.5,ELECTRIC:.5,ICE:2,ROCK:2,STEEL:.5},
  NONE:{}
};
const STATN = {hp:'HP',atk:'攻擊',def:'防禦',spa:'特攻',spd:'特防',spe:'速度',acc:'命中',eva:'閃避'};
const STAT_KEYS = ['hp','atk','def','spa','spd','spe'];
const NATURES = [['勤奮',null,null],['怕寂寞','atk','def'],['勇敢','atk','spe'],['固執','atk','spa'],['頑皮','atk','spd'],['大膽','def','atk'],['坦率',null,null],['悠閒','def','spe'],['淘氣','def','spa'],['樂天','def','spd'],['膽小','spe','atk'],['急躁','spe','def'],['認真',null,null],['爽朗','spe','spa'],['天真','spe','spd'],['內斂','spa','atk'],['慢吞吞','spa','def'],['冷靜','spa','spe'],['害羞',null,null],['馬虎','spa','spd'],['溫和','spd','atk'],['溫順','spd','def'],['自大','spd','spe'],['慎重','spd','spa'],['浮躁',null,null]];
const ABIL = {
  '烈心':'HP ≤ 1/3 時，火系技能威力 ×1.5',
  '潮心':'HP ≤ 1/3 時，水系技能威力 ×1.5',
  '森心':'HP ≤ 1/3 時，草系技能威力 ×1.5',
  '蟲心':'HP ≤ 1/3 時，蟲系技能威力 ×1.5',
  '帶電體':'被接觸類技能打中時，30% 讓對手麻痺',
  '威壓':'出場時讓對手的攻擊降低 1 級',
  '懸浮':'地面系技能無效',
  '厚脂':'受到火、冰系技能時，對手的攻擊力減半',
  '疾走':'每 3 回合（4.5 秒）速度提高 1 級',
  '粗糙皮膚':'被接觸類技能打中時，對手受到牠最大 HP 1/16 的傷害',
  '同步':'被對手造成灼傷、麻痺、中毒時，對手也陷入同樣狀態',
  '孢子':'被接觸類技能打中時，10% 讓對手中毒、麻痺或睡著',
  '熔岩鎧':'不會被冰凍',
  '蓄電':'受到電系技能時不受傷害，改為回復 1/4 HP',
  '毅力':'陷入異常狀態時攻擊 ×1.5，且灼傷不會讓攻擊減半',
  '精神力':'不會畏縮'
};
const PINCH = {'烈心':'FIRE','潮心':'WATER','森心':'GRASS','蟲心':'BUG'};

// ---------------------------------------------------------------------
// 技能。shape：proj 射擊彈｜melee 近戰扇形｜dash 突進｜aoeSelf 自身範圍｜zone 指定落點｜self 自身｜blink 瞬移
// acc = 0 代表必中（點選目標的「指定技」）
// ---------------------------------------------------------------------
const MOVES = {
flame:{name:'烈焰噴流',type:'FIRE',power:95,acc:100,pp:15,shape:'proj',spd:540,r:13,range:560,eff:{burn:10}},
blast:{name:'爆炎柱',type:'FIRE',power:120,acc:85,pp:5,shape:'zone',radius:80,range:460,eff:{burn:10}},
wingdash:{name:'疾翔衝',type:'FLYING',power:60,acc:0,pp:20,shape:'dash',dist:260,contact:true},
sunny:{name:'烈陽術',type:'FIRE',power:0,acc:0,pp:5,shape:'self',weather:'SUN'},
vortex:{name:'渦流炮',type:'WATER',power:95,acc:100,pp:15,shape:'proj',spd:520,r:15,range:560},
darkbite:{name:'暗影撕咬',type:'DARK',power:80,acc:100,pp:15,shape:'melee',reach:80,arc:110,contact:true,eff:{flinch:20}},
iceblade:{name:'冰刃束',type:'ICE',power:90,acc:100,pp:10,shape:'proj',spd:640,r:11,range:600,eff:{frz:10}},
rain:{name:'祈雨',type:'WATER',power:0,acc:0,pp:5,shape:'self',weather:'RAIN'},
leafgale:{name:'葉刃風暴',type:'GRASS',power:90,acc:100,pp:10,shape:'proj',spd:560,r:14,range:540},
mtfist:{name:'崩山拳',type:'FIGHTING',power:85,acc:100,pp:15,shape:'melee',reach:82,arc:100,contact:true,highCrit:true},
seed:{name:'寄生種',type:'GRASS',power:0,acc:90,pp:10,shape:'proj',spd:430,r:10,range:480,status:'SEED'},
swords:{name:'劍舞',type:'NORMAL',power:0,acc:0,pp:20,shape:'self',buff:{atk:2}},
bolt:{name:'雷霆彈',type:'ELECTRIC',power:90,acc:100,pp:15,shape:'proj',spd:700,r:11,range:600,eff:{para:10}},
thunder:{name:'落雷',type:'ELECTRIC',power:120,acc:70,pp:10,shape:'zone',radius:80,range:500,eff:{para:30}},
eweb:{name:'電磁網',type:'ELECTRIC',power:0,acc:100,pp:20,shape:'proj',spd:480,r:13,range:500,status:'PAR',typeCheck:true},
wingslash:{name:'翼斬',type:'FLYING',power:70,acc:100,pp:20,shape:'dash',dist:220,contact:true,highCrit:true},
quake:{name:'震地',type:'GROUND',power:100,acc:100,pp:10,shape:'aoeSelf',radius:180},
rockslide:{name:'落岩崩',type:'ROCK',power:75,acc:90,pp:10,shape:'melee',reach:135,arc:80,eff:{flinch:30}},
irondef:{name:'鐵壁',type:'STEEL',power:0,acc:0,pp:15,shape:'self',buff:{def:2}},
steelram:{name:'鋼頭衝',type:'STEEL',power:80,acc:100,pp:15,shape:'dash',dist:210,contact:true,eff:{flinch:30}},
shadowball:{name:'冥影球',type:'GHOST',power:80,acc:100,pp:15,shape:'proj',spd:500,r:15,range:560,eff:{statDown:{s:'spd',ch:20}},note:'第三代幽靈系屬物理，用攻擊計算'},
psyburst:{name:'精神衝擊',type:'PSYCHIC',power:90,acc:100,pp:10,shape:'proj',spd:560,r:13,range:560,eff:{statDown:{s:'spd',ch:10}}},
toxic:{name:'劇毒',type:'POISON',power:0,acc:85,pp:10,shape:'proj',spd:460,r:11,range:500,status:'TOX'},
hypno:{name:'催眠術',type:'PSYCHIC',power:0,acc:60,pp:20,shape:'proj',spd:420,r:12,range:460,status:'SLP'},
blizzard:{name:'暴雪',type:'ICE',power:120,acc:70,pp:5,shape:'aoeSelf',radius:205,eff:{frz:10}},
iceshard:{name:'冰礫',type:'ICE',power:40,acc:100,pp:30,pri:1,shape:'proj',spd:820,r:9,range:520},
bodyslam:{name:'猛撲',type:'NORMAL',power:85,acc:100,pp:15,shape:'dash',dist:210,contact:true,eff:{para:30}},
recover:{name:'自我修復',type:'NORMAL',power:0,acc:0,pp:10,shape:'self',heal:.5},
quick:{name:'瞬擊',type:'NORMAL',power:40,acc:100,pp:30,pri:1,shape:'dash',dist:200,dashSpd:1300,contact:true},
doubleedge:{name:'捨身撞',type:'NORMAL',power:120,acc:100,pp:15,shape:'dash',dist:250,contact:true,recoil:1/3},
brickkick:{name:'碎石踢',type:'FIGHTING',power:75,acc:100,pp:15,shape:'melee',reach:82,arc:100,contact:true},
dteam:{name:'影分身',type:'NORMAL',power:0,acc:0,pp:15,shape:'self',buff:{eva:1}},
// ---- v2 新增 ----
dbreath:{name:'龍息',type:'DRAGON',power:60,acc:100,pp:20,shape:'proj',spd:520,r:16,range:500,eff:{para:30}},
dclaw:{name:'龍爪',type:'DRAGON',power:80,acc:100,pp:15,shape:'melee',reach:85,arc:110,contact:true},
ddance:{name:'龍之舞',type:'DRAGON',power:0,acc:0,pp:20,shape:'self',buff:{atk:1,spe:1}},
mudshot:{name:'泥巴射擊',type:'GROUND',power:55,acc:95,pp:15,shape:'proj',spd:560,r:13,range:520,eff:{statDown:{s:'spe',ch:100}}},
xslash:{name:'十字斬',type:'BUG',power:80,acc:100,pp:15,shape:'melee',reach:85,arc:100,contact:true,highCrit:true},
metalclaw:{name:'金屬爪',type:'STEEL',power:50,acc:95,pp:35,shape:'melee',reach:80,arc:100,contact:true,eff:{selfUp:{s:'atk',ch:10}}},
silk:{name:'吐絲',type:'BUG',power:0,acc:95,pp:40,shape:'proj',spd:520,r:12,range:480,drop:{s:'spe',n:-2}},
mindwave:{name:'念力波',type:'PSYCHIC',power:65,acc:100,pp:20,shape:'zone',radius:70,range:420},
blink:{name:'瞬身',type:'PSYCHIC',power:0,acc:0,pp:15,shape:'blink',range:300},
calmmind:{name:'冥想',type:'PSYCHIC',power:0,acc:0,pp:20,shape:'self',buff:{spa:1,spd:1}},
sludge:{name:'污泥炸彈',type:'POISON',power:90,acc:100,pp:10,shape:'proj',spd:500,r:15,range:520,eff:{psn:30}},
gdrain:{name:'終極吸取',type:'GRASS',power:60,acc:100,pp:10,shape:'proj',spd:520,r:13,range:500,drain:.5},
spore:{name:'孢子彈',type:'GRASS',power:0,acc:75,pp:15,shape:'proj',spd:380,r:13,range:380,status:'SLP'},
acidarmor:{name:'溶化',type:'POISON',power:0,acc:0,pp:40,shape:'self',buff:{def:2}},
lavarush:{name:'熔岩衝',type:'FIRE',power:75,acc:100,pp:15,shape:'dash',dist:230,contact:true,eff:{burn:20}},
stoneedge:{name:'尖石刃',type:'ROCK',power:100,acc:80,pp:5,shape:'zone',radius:70,range:440,highCrit:true},
echo:{name:'回音震',type:'NORMAL',power:90,acc:100,pp:10,shape:'aoeSelf',radius:190},
cotton:{name:'棉花孢子',type:'GRASS',power:0,acc:85,pp:40,shape:'proj',spd:420,r:14,range:460,drop:{s:'spe',n:-2}},
machpunch:{name:'音速拳',type:'FIGHTING',power:40,acc:100,pp:30,pri:1,shape:'dash',dist:190,dashSpd:1300,contact:true},
crosschop:{name:'十字劈',type:'FIGHTING',power:100,acc:80,pp:5,shape:'melee',reach:85,arc:90,contact:true,highCrit:true},
bulkup:{name:'健美',type:'FIGHTING',power:0,acc:0,pp:20,shape:'self',buff:{atk:1,def:1}},
tpunch:{name:'雷電拳',type:'ELECTRIC',power:75,acc:100,pp:15,shape:'melee',reach:80,arc:100,contact:true,eff:{para:10}},
darkpulse:{name:'惡之波動',type:'DARK',power:80,acc:100,pp:15,shape:'proj',spd:600,r:15,range:540,eff:{flinch:20}},
screech:{name:'刺耳聲',type:'NORMAL',power:0,acc:85,pp:40,shape:'proj',spd:620,r:16,range:460,drop:{s:'def',n:-2}},
roost:{name:'羽棲',type:'FLYING',power:0,acc:0,pp:10,shape:'self',heal:.5},
struggle:{name:'掙扎',type:'NONE',power:50,acc:0,pp:1,shape:'melee',reach:78,arc:120,contact:true,recoil:1/4}
};

// ---------------------------------------------------------------------
// 怪獸。look：body 身體｜parts 部件｜legs two/four/none（none＝漂浮）｜arms｜acc 配色
// ---------------------------------------------------------------------
const SPECIES = [
{id:'leo',name:'焰鬃獅',types:['FIRE'],base:{hp:78,atk:84,def:70,spa:109,spd:80,spe:100},ability:'烈心',nature:'膽小',evs:{hp:4,spa:252,spe:252},moves:['flame','blast','wingdash','sunny'],look:{body:'round',parts:['mane','ears','flameTail'],legs:'two',arms:true,acc:'#ffd25e'}},
{id:'shark',name:'潮鰭鯊',types:['WATER','DARK'],base:{hp:80,atk:70,def:75,spa:110,spd:70,spe:95},ability:'潮心',nature:'內斂',evs:{hp:4,spa:252,spe:252},moves:['vortex','darkbite','iceblade','rain'],look:{body:'round',parts:['finDorsal','tailFin','sideFins','jaw','belly'],legs:'two',arms:false,acc:'#2c3d70'}},
{id:'deer',name:'森角鹿',types:['GRASS','FIGHTING'],base:{hp:85,atk:110,def:85,spa:90,spd:75,spe:80},ability:'森心',nature:'固執',evs:{hp:252,atk:252,spe:4},moves:['mtfist','leafgale','seed','swords'],look:{body:'round',parts:['antlers','sideEars','leaf','belly'],legs:'two',arms:true,acc:'#9a6a35'}},
{id:'hawk',name:'雷翼鷹',types:['ELECTRIC','FLYING'],base:{hp:70,atk:75,def:65,spa:115,spd:80,spe:125},ability:'帶電體',nature:'膽小',evs:{hp:4,spa:252,spe:252},moves:['bolt','thunder','eweb','wingslash'],look:{body:'round',parts:['wings','beak','crest','tailFeathers','belly'],legs:'none',arms:false,acc:'#3b3b46'}},
{id:'turtle',name:'岩甲龜',types:['ROCK','STEEL'],base:{hp:95,atk:110,def:140,spa:50,spd:75,spe:40},ability:'威壓',nature:'固執',evs:{hp:252,atk:252,def:4},moves:['quake','rockslide','steelram','irondef'],look:{body:'shell',parts:['shellSpikes'],legs:'four',arms:false,acc:'#5d6275'}},
{id:'ghost',name:'幽燈靈',types:['GHOST','POISON'],base:{hp:65,atk:60,def:70,spa:120,spd:95,spe:110},ability:'懸浮',nature:'膽小',evs:{hp:4,spa:252,spe:252},moves:['psyburst','shadowball','toxic','hypno'],look:{body:'wisp',parts:['flameHead','handOrbs'],legs:'none',arms:false,acc:'#b7f5ff'}},
{id:'bear',name:'冰晶熊',types:['ICE','NORMAL'],base:{hp:110,atk:105,def:90,spa:95,spd:80,spe:55},ability:'厚脂',nature:'勇敢',evs:{hp:252,atk:128,spa:128},moves:['blizzard','bodyslam','iceshard','recover'],look:{body:'round',parts:['roundEars','snout','crystals','belly'],legs:'two',arms:true,acc:'#eafcff'}},
{id:'weasel',name:'疾風鼬',types:['NORMAL'],base:{hp:70,atk:105,def:60,spa:50,spd:60,spe:120},ability:'疾走',nature:'爽朗',evs:{hp:4,atk:252,spe:252},moves:['doubleedge','brickkick','quick','dteam'],look:{body:'round',parts:['ears','longTail','creamBelly'],legs:'two',arms:true,acc:'#c98a4a'}},
{id:'drake',name:'龍角蜥',types:['DRAGON','GROUND'],base:{hp:88,atk:112,def:85,spa:70,spd:70,spe:92},ability:'粗糙皮膚',nature:'固執',evs:{hp:4,atk:252,spe:252},moves:['dclaw','mudshot','dbreath','ddance'],look:{body:'tall',parts:['horns','spikes','longTail','belly'],legs:'two',arms:true,acc:'#e8c070'}},
{id:'mantis',name:'甲刃螳',types:['BUG','STEEL'],base:{hp:70,atk:120,def:100,spa:55,spd:80,spe:75},ability:'蟲心',nature:'固執',evs:{hp:252,atk:252,spd:4},moves:['xslash','metalclaw','silk','swords'],look:{body:'tall',parts:['antenna','blades','smallWings','belly'],legs:'two',arms:false,acc:'#c8d0e0'}},
{id:'fox',name:'靈晶狐',types:['PSYCHIC'],base:{hp:68,atk:60,def:65,spa:118,spd:100,spe:104},ability:'同步',nature:'膽小',evs:{hp:4,spa:252,spe:252},moves:['psyburst','mindwave','blink','calmmind'],look:{body:'round',parts:['bigEars','gem','fluffyTail','creamBelly'],legs:'two',arms:false,acc:'#ffd6f0'}},
{id:'shroom',name:'毒傘菇',types:['POISON','GRASS'],base:{hp:90,atk:70,def:95,spa:95,spd:90,spe:45},ability:'孢子',nature:'大膽',evs:{hp:252,def:252,spa:4},moves:['sludge','gdrain','spore','acidarmor'],look:{body:'blob',parts:['cap','creamBelly'],legs:'two',arms:false,acc:'#b05cc8'}},
{id:'rhino',name:'熔岩犀',types:['FIRE','ROCK'],base:{hp:95,atk:115,def:110,spa:80,spd:65,spe:50},ability:'熔岩鎧',nature:'勇敢',evs:{hp:252,atk:200,spa:56},moves:['lavarush','stoneedge','flame','irondef'],look:{body:'round',parts:['noseHorn','spikes','lavaCracks'],legs:'four',arms:false,acc:'#3a2a26'}},
{id:'sheep',name:'電毛羊',types:['ELECTRIC','NORMAL'],base:{hp:90,atk:60,def:80,spa:105,spd:85,spe:70},ability:'蓄電',nature:'內斂',evs:{hp:252,spa:252,spd:4},moves:['bolt','echo','cotton','recover'],look:{body:'round',parts:['wool','smallHorns'],legs:'four',arms:false,acc:'#fffbe8'}},
{id:'kanga',name:'拳擊袋鼠',types:['FIGHTING'],base:{hp:85,atk:118,def:80,spa:50,spd:70,spe:97},ability:'毅力',nature:'爽朗',evs:{hp:4,atk:252,spe:252},moves:['crosschop','machpunch','tpunch','bulkup'],look:{body:'tall',parts:['roundEars','longTail','gloves','creamBelly'],legs:'two',arms:true,acc:'#e04848'}},
{id:'bat',name:'暗夜蝠',types:['DARK','FLYING'],base:{hp:75,atk:80,def:70,spa:100,spd:75,spe:120},ability:'精神力',nature:'膽小',evs:{hp:4,spa:252,spe:252},moves:['darkpulse','wingdash','screech','roost'],look:{body:'round',parts:['bigEars','batWings','fangs'],legs:'none',arms:false,acc:'#2a2236'}}
];

const STAGE_RATIO = [[10,40],[10,35],[10,30],[10,25],[10,20],[10,15],[10,10],[15,10],[20,10],[25,10],[30,10],[35,10],[40,10]];
const ACC_RATIO = [[33,100],[36,100],[43,100],[50,100],[60,100],[75,100],[1,1],[133,100],[166,100],[2,1],[233,100],[133,50],[3,1]];
const DIFF = {
  easy:{n:'簡單',react:.5,dodge:.12,aimErr:.32,think:.75,lead:.2},
  normal:{n:'普通',react:.3,dodge:.4,aimErr:.14,think:.45,lead:.6},
  hard:{n:'困難',react:.15,dodge:.7,aimErr:.05,think:.25,lead:.92}
};
const STATUSN = {BRN:['灼傷','#f08030'],PAR:['麻痺','#f8d030'],PSN:['中毒','#a040a0'],TOX:['劇毒','#c050c0'],SLP:['睡眠','#9aa5c4'],FRZ:['冰凍','#98d8d8']};

// 怪獸工坊可用的部件（中文標籤）
const PARTS = {
  mane:'鬃毛', ears:'尖耳', bigEars:'大耳', roundEars:'圓耳', sideEars:'側耳', antlers:'鹿角', horns:'雙角', smallHorns:'小角', noseHorn:'鼻角',
  crest:'羽冠', antenna:'觸角', leaf:'頭頂葉', gem:'額頭寶石', cap:'蘑菇傘', wool:'羊毛', flameHead:'頭頂燈火',
  finDorsal:'背鰭', tailFin:'尾鰭', sideFins:'側鰭', wings:'翅膀', batWings:'蝙蝠翼', smallWings:'小翅膀', tailFeathers:'尾羽',
  flameTail:'火焰尾', longTail:'長尾巴', fluffyTail:'蓬鬆尾', spikes:'背刺', crystals:'冰晶', shellSpikes:'殼刺', blades:'刀臂',
  beak:'鳥嘴', snout:'口鼻', jaw:'下顎', fangs:'尖牙', belly:'肚子（第二屬性色）', creamBelly:'奶油色肚子', handOrbs:'浮游手', gloves:'拳套', lavaCracks:'熔岩紋'
};
const BODIES = {round:'圓滾滾', tall:'高個子', blob:'軟糊糊', wisp:'幽靈（漂浮）', shell:'甲殼'};

// =====================================================================
// 共用工具
// =====================================================================
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const roll = p => Math.random() * 100 < p;
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function shade(hex, f) { const n = parseInt(String(hex).slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255; if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } return `rgb(${r | 0},${g | 0},${b | 0})`; }
function applyStage(v, s) { const r = STAGE_RATIO[clamp(s, -6, 6) + 6]; return Math.floor(v * r[0] / r[1]); }
function category(mv) { return mv.power === 0 ? '變化' : (PHYSICAL.has(mv.type) ? '物理' : '特殊'); }
function speciesById(id) { return SPECIES.find(s => s.id === id); }
function calcStats(sp, natureName) {
  const nat = NATURES.find(n => n[0] === natureName) || NATURES[0]; const o = {};
  for (const k of STAT_KEYS) {
    const b = sp.base[k], iv = 31, ev = (sp.evs && sp.evs[k]) || 0;
    const core = Math.floor((2 * b + iv + Math.floor(ev / 4)) * LV / 100);
    if (k === 'hp') o.hp = core + LV + 10;
    else { let v = core + 5; if (nat[1] === k) v = Math.floor(v * 110 / 100); if (nat[2] === k) v = Math.floor(v * 90 / 100); o[k] = v; }
  }
  return o;
}
function typeEff(t, defTypes) { if (t === 'NONE') return 1; let m = 1; for (const d of defTypes) { const r = CHART[t][d]; if (r !== undefined) m *= r; } return m; }
function effOn(mv, def) { let e = typeEff(mv.type, def.types); if (mv.type === 'GROUND' && def.ability === '懸浮') e = 0; return e; }
function effAcc(mv) { if (mv.id === 'thunder' && typeof G !== 'undefined' && G && G.weather) { if (G.weather.type === 'RAIN') return 100; if (G.weather.type === 'SUN') return 50; } return mv.acc; }
function accScale(mv) { const a = effAcc(mv); return a === 0 ? 1 : .4 + .6 * a / 100; }
function projSpeed(mv) { const a = effAcc(mv) || 100; return (mv.spd || 520) * (.6 + .4 * a / 100); }
function baseCd(mv) { if (mv.power === 0) return mv.shape === 'blink' ? 3.2 : 4; let c = .9 + mv.power / 50; if (mv.pri > 0) c *= .6; return c; }
function castTime(mv) { return mv.pri > 0 ? .06 : .28; }
// 施放方式：dir 方向技｜point 落點｜unit 指定目標｜self 自身（立即）
function castMode(mv) {
  if (mv.shape === 'self' || mv.shape === 'aoeSelf') return 'self';
  if (mv.shape === 'zone' || mv.shape === 'blink') return 'point';
  if (mv.acc === 0 && mv.power > 0) return 'unit';
  return 'dir';
}
const CAST_LABEL = {dir:'方向', point:'落點', unit:'指定', self:'自身'};
function moveRange(mv) {
  switch (mv.shape) {
    case 'proj': return mv.range || 560; case 'melee': return (mv.reach || 75) + 26; case 'dash': return mv.dist || 220;
    case 'zone': case 'blink': return mv.range || 400; case 'aoeSelf': return (mv.radius || 170) * accScale(mv); default: return 0;
  }
}
function moveReach(mv) { switch (mv.shape) { case 'proj': return (mv.range || 560) * .8; case 'melee': return (mv.reach || 75) + 40; case 'dash': return (mv.dist || 220) + 30; case 'aoeSelf': return (mv.radius || 170) * accScale(mv) * .9; case 'zone': return (mv.range || 460) + 40; default: return 9999; } }
function moveDesc(mv) {
  const sh = {proj:'射擊彈',melee:'近戰扇形',dash:'突進',aoeSelf:'自身周圍範圍',zone:'指定落點（延遲爆發）',self:'自身',blink:'瞬間移動'}[mv.shape];
  const a = [sh];
  if (mv.acc === 0 && mv.power > 0) a.push('必中・點選目標');
  if (mv.pri > 0) a.push('先制+' + mv.pri);
  if (mv.contact) a.push('接觸');
  if (mv.highCrit) a.push('容易會心');
  if (mv.recoil) a.push('反作用 1/' + Math.round(1 / mv.recoil));
  if (mv.drain) a.push('吸取傷害的 ' + Math.round(mv.drain * 100) + '%');
  const e = mv.eff || {};
  if (e.burn) a.push(e.burn + '% 灼傷'); if (e.para) a.push(e.para + '% 麻痺'); if (e.frz) a.push(e.frz + '% 冰凍'); if (e.psn) a.push(e.psn + '% 中毒'); if (e.flinch) a.push(e.flinch + '% 畏縮');
  if (e.statDown) a.push(e.statDown.ch + '% 降' + STATN[e.statDown.s]);
  if (e.selfUp) a.push(e.selfUp.ch + '% 自己' + STATN[e.selfUp.s] + '+1');
  if (mv.status) a.push({PAR:'使對手麻痺',SLP:'使對手睡著',TOX:'劇毒（傷害遞增）',SEED:'每回合吸取 1/8 HP'}[mv.status]);
  if (mv.drop) a.push('對手' + STATN[mv.drop.s] + ' ' + mv.drop.n);
  if (mv.buff) for (const k in mv.buff) a.push(STATN[k] + ' +' + mv.buff[k]);
  if (mv.heal) a.push('回復 50% HP');
  if (mv.weather) a.push(mv.weather === 'SUN' ? '大晴天 5 回合' : '下雨 5 回合');
  if (mv.id === 'thunder') a.push('雨天必中，晴天命中 50');
  if (mv.note) a.push(mv.note);
  return a.join('・');
}
// 普攻（LoL 式右鍵攻擊）：物理屬性＝近戰，特殊屬性＝追蹤遠程彈；不消耗 PP，間隔由速度決定
for (const t of TYPE_KEYS) {
  MOVES['b_' + t + '_m'] = { name: '普攻', type: t, power: 15, acc: 0, pp: 99, shape: 'melee', reach: 72, arc: 90, contact: true, basic: true };
  MOVES['b_' + t + '_r'] = { name: '普攻', type: t, power: 12, acc: 0, pp: 99, shape: 'proj', spd: 900, r: 9, range: 400, basic: true };
}
function finalizeMoves() { for (const k in MOVES) { MOVES[k].id = k; MOVES[k].pri = MOVES[k].pri || 0; } }
finalizeMoves();
