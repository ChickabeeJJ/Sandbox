'use strict';
/* =========================================================================
   Element definitions. Every material in the sandbox lives here; the
   simulation reads the flattened lookup tables built at the bottom.
   ========================================================================= */

const ST = { EMPTY: 0, SOLID: 1, POWDER: 2, LIQUID: 3, GAS: 4, ENERGY: 5 };

const CATEGORIES = [
  { id: 'all',       name: 'All',        icon: 'all' },
  { id: 'powder',    name: 'Powders',    icon: 'powder' },
  { id: 'liquid',    name: 'Liquids',    icon: 'liquid' },
  { id: 'gas',       name: 'Gases',      icon: 'gas' },
  { id: 'solid',     name: 'Solids',     icon: 'solid' },
  { id: 'life',      name: 'Life',       icon: 'life' },
  { id: 'energy',    name: 'Energy',     icon: 'energy' },
  { id: 'explosive', name: 'Explosives', icon: 'explosive' },
  { id: 'special',   name: 'Special',    icon: 'special' },
];

/* unlock: 'base' = available from the start
           { lvl: n }            = unlocked on reaching level n
           { disc: 'hint', lvl } = unlocked by creating it in the sandbox (or by level) */
const ELEMENT_DEFS = [
  { key: 'EMPTY', name: 'Air', st: ST.EMPTY, col: ['#000000'], dens: 0, hidden: true },

  /* ---------------------------- POWDERS ---------------------------- */
  { key: 'SAND', name: 'Sand', cat: 'powder', st: ST.POWDER, col: ['#f6d77a', '#eec665', '#f9e19a', '#e2b955', '#fbe7a8'],
    dens: 50, hi: [1250, 'MOLTEN_GLASS'], unlock: 'base', desc: 'Classic grains. Melts into glass when things get really hot.' },
  { key: 'SNOW', name: 'Snow', cat: 'powder', st: ST.POWDER, col: ['#ffffff', '#eef6ff', '#dcebff', '#f6fbff'],
    dens: 28, t0: -8, k: 0.25, hi: [2, 'WATER', 0.05], visc: 0.35, unlock: 'base', desc: 'Fluffy and cold. Melts above 2°.' },
  { key: 'DIRT', name: 'Dirt', cat: 'powder', st: ST.POWDER, col: ['#8a5a32', '#7a4e2b', '#9b6a3f', '#6d4426', '#a5744a'],
    dens: 55, unlock: 'base', desc: 'Seeds love it. Add water to make mud.' },
  { key: 'SALT', name: 'Salt', cat: 'powder', st: ST.POWDER, col: ['#ffffff', '#f2f0ec', '#e4e2de', '#fbfaf7'],
    dens: 52, unlock: 'base', desc: 'Dissolves in water and melts ice.' },
  { key: 'SAWDUST', name: 'Sawdust', cat: 'powder', st: ST.POWDER, col: ['#e9c58d', '#dab27a', '#f2d4a2', '#cfa46a'],
    dens: 15, flam: 220, burn: 0.07, burnTo: ['FIRE', 'ASH', 'FIRE'], unlock: 'base', desc: 'Light, floaty and extremely flammable.' },
  { key: 'ASH', name: 'Ash', cat: 'powder', st: ST.POWDER, col: ['#a8a4a0', '#8f8b87', '#bdb9b4', '#77736f'],
    dens: 18, visc: 0.3, unlock: { disc: 'Burn something flammable', lvl: 4 }, desc: 'What is left when the party is over.' },
  { key: 'COAL', name: 'Coal', cat: 'powder', st: ST.POWDER, col: ['#2b2b30', '#1f1f24', '#38383f', '#151519'],
    dens: 60, flam: 380, burn: 0.0035, bheat: 1450, burnTo: ['ASH', 'EMBER'], unlock: { disc: 'Burning wood sometimes leaves coal', lvl: 5 },
    desc: 'Burns slow and very hot. Hot enough to melt stone.' },
  { key: 'RUST', name: 'Rust', cat: 'powder', st: ST.POWDER, col: ['#b5562a', '#9c4521', '#c96a36', '#8a3b1b'],
    dens: 54, unlock: { disc: 'Leave metal in water', lvl: 9 }, desc: 'Metal that stayed wet for too long.' },
  { key: 'GLITTER', name: 'Glitter', cat: 'powder', st: ST.POWDER, col: ['#ff4fd8', '#4fe3ff', '#ffe34f', '#8b5cff', '#5cff9d'],
    dens: 40, fx: 'glitter', glow: 0.5, unlock: { disc: 'Shatter glass with an explosion', lvl: 11 }, desc: 'Sparkly shards of shattered glass.' },
  { key: 'RAINBOW', name: 'Rainbow', cat: 'powder', st: ST.POWDER, col: ['#ff0000'], dens: 48, fx: 'rainbow', glow: 0.35,
    unlock: { lvl: 13 }, desc: 'Sand that cannot decide on a color.' },

  /* ---------------------------- LIQUIDS ---------------------------- */
  { key: 'WATER', name: 'Water', cat: 'liquid', st: ST.LIQUID, col: ['#2f8cff', '#3a97ff', '#2a80f2', '#4aa2ff'],
    dens: 20, k: 0.45, spread: 5, hi: [100, 'STEAM', 0.12], lo: [0, 'ICE', 0.08], cond: true, fx: 'water', unlock: 'base',
    desc: 'Flows, boils at 100°, freezes at 0°. Conducts electricity.' },
  { key: 'SALTWATER', name: 'Salt Water', cat: 'liquid', st: ST.LIQUID, col: ['#3fb0e8', '#4bbdf0', '#37a4dc'],
    dens: 22, k: 0.45, spread: 5, hi: [102, 'STEAM', 0.12], lo: [-21, 'ICE', 0.08], cond: true, fx: 'water',
    unlock: { disc: 'Dissolve salt in water', lvl: 3 }, desc: 'Boils away into steam and salt. Great conductor.' },
  { key: 'LN2', name: 'Liquid Nitrogen', cat: 'liquid', st: ST.LIQUID, col: ['#c8f4ff', '#b5eeff', '#dafaff'],
    dens: 18, t0: -196, k: 0.6, spread: 6, hi: [-190, 'NITROGEN', 0.04], glow: 0.15, unlock: { lvl: 5 }, desc: 'Brutally cold. Freezes almost anything it touches.' },
  { key: 'LAVA', name: 'Lava', cat: 'liquid', st: ST.LIQUID, col: ['#ff5a1f', '#ff7a1a', '#ff3d1f', '#ffa21a'],
    dens: 42, t0: 1400, k: 0.3, loss: 0.0009, spread: 2, visc: 0.55, lo: [820, 'STONE', 0.03], glow: 1, fx: 'lava',
    unlock: { disc: 'Melt stone (over 1100°)', lvl: 2 }, desc: 'Molten rock. Sets things on fire and cools into stone.' },
  { key: 'ACID', name: 'Acid', cat: 'liquid', st: ST.LIQUID, col: ['#9dff3a', '#b6ff4f', '#85f02a'],
    dens: 21, spread: 4, glow: 0.45, acidproof: true, unlock: { lvl: 2 }, desc: 'Dissolves almost everything. Glass and walls resist it.' },
  { key: 'OIL', name: 'Oil', cat: 'liquid', st: ST.LIQUID, col: ['#5a3a1a', '#4a2f14', '#6b4520'],
    dens: 12, spread: 3, visc: 0.2, flam: 180, burn: 0.04, bheat: 900, burnTo: ['FIRE', 'SMOKE', 'FIRE'], unlock: 'base',
    desc: 'Floats on water and burns for a long time.' },
  { key: 'MUD', name: 'Mud', cat: 'liquid', st: ST.LIQUID, col: ['#5e3d22', '#6b4628', '#52351d'],
    dens: 45, spread: 1, visc: 0.8, hi: [100, 'DIRT', 0.02], unlock: { disc: 'Mix dirt and water', lvl: 2 }, desc: 'Squishy. Dries back into dirt when heated.' },
  { key: 'HONEY', name: 'Honey', cat: 'liquid', st: ST.LIQUID, col: ['#ffb627', '#ffa514', '#ffc94a'],
    dens: 35, spread: 2, visc: 0.88, glow: 0.12, unlock: { lvl: 9 }, desc: 'Thick, golden and slow.' },
  { key: 'MOLTEN_GLASS', name: 'Molten Glass', cat: 'liquid', st: ST.LIQUID, col: ['#ffb347', '#ff9a3d', '#ffc56b'],
    dens: 44, t0: 1500, k: 0.3, spread: 2, visc: 0.6, lo: [1000, 'GLASS', 0.05], glow: 0.9, fx: 'lava',
    unlock: { disc: 'Melt sand', lvl: 7 }, desc: 'Cools into glass.' },
  { key: 'MOLTEN_METAL', name: 'Molten Metal', cat: 'liquid', st: ST.LIQUID, col: ['#fff1b0', '#ffd36b', '#ffe68f'],
    dens: 75, t0: 1900, k: 0.7, spread: 2, visc: 0.4, lo: [1300, 'METAL', 0.05], glow: 1, fx: 'lava', cond: true,
    unlock: { disc: 'Melt metal (thermite works)', lvl: 12 }, desc: 'Liquid metal. Glows white hot.' },
  { key: 'MOLTEN_WAX', name: 'Molten Wax', cat: 'liquid', st: ST.LIQUID, col: ['#fff3c9', '#ffe9a8', '#fff8de'],
    dens: 15, t0: 85, spread: 2, visc: 0.5, lo: [52, 'WAX', 0.04], flam: 260, burn: 0.01, burnTo: ['FIRE', 'SMOKE'],
    unlock: { disc: 'Melt some wax', lvl: 8 }, desc: 'Drips and hardens back into wax.' },

  /* ----------------------------- GASES ----------------------------- */
  { key: 'STEAM', name: 'Steam', cat: 'gas', st: ST.GAS, col: ['#d9e8f5', '#c7dbee', '#e9f2fa'],
    dens: 0.5, t0: 110, lo: [94, 'WATER', 0.006], fx: 'gas', unlock: { disc: 'Boil water', lvl: 2 }, desc: 'Hot vapor. Condenses back into water as it cools.' },
  { key: 'SMOKE', name: 'Smoke', cat: 'gas', st: ST.GAS, col: ['#4a4a52', '#5b5b63', '#3c3c43', '#6a6a72'],
    dens: 1, life: [90, 220], fx: 'gas', unlock: 'base', desc: 'Drifts upward and fades away.' },
  { key: 'GAS', name: 'Gas', cat: 'gas', st: ST.GAS, col: ['#9fe39a', '#b1eaa9', '#8cd987'],
    dens: 0.8, flam: 120, expl: 3, fx: 'gas', unlock: { lvl: 10 }, desc: 'Invisible-ish and highly explosive.' },
  { key: 'NITROGEN', name: 'Nitrogen', cat: 'gas', st: ST.GAS, col: ['#cfeeff', '#bfe4f7'],
    dens: 0.9, t0: -170, life: [120, 260], fx: 'gas', unlock: { disc: 'Boil liquid nitrogen', lvl: 6 }, desc: 'Freezing cold vapor.' },
  { key: 'NEON', name: 'Neon', cat: 'gas', st: ST.GAS, col: ['#ff3df2'], dens: 0.7, fx: 'neon', glow: 1, cond: true,
    unlock: { lvl: 9 }, desc: 'Glowing gas. Shines brighter with electricity.' },
  { key: 'TOXIC', name: 'Toxic Gas', cat: 'gas', st: ST.GAS, col: ['#7dff5a', '#66e04a', '#93ff74'],
    dens: 1.2, life: [200, 400], glow: 0.4, fx: 'gas', unlock: { disc: 'Let acid eat something', lvl: 8 }, desc: 'Kills plants and fish. Do not breathe.' },

  /* ----------------------------- SOLIDS ---------------------------- */
  { key: 'STONE', name: 'Stone', cat: 'solid', st: ST.SOLID, col: ['#8a8d96', '#7b7e87', '#9a9da6', '#6d7079'],
    hi: [1100, 'LAVA', 0.02], blast: 0.35, unlock: 'base', desc: 'Solid rock. Melts into lava above 1100°.' },
  { key: 'WOOD', name: 'Wood', cat: 'solid', st: ST.SOLID, col: ['#8b5a2b', '#7a4c22', '#9c6833', '#6e431d'],
    flam: 300, burn: 0.008, bheat: 750, burnTo: ['FIRE', 'ASH', 'EMBER', 'COAL', 'FIRE', 'SMOKE'], fx: 'wood', unlock: 'base',
    desc: 'Burns steadily. Sometimes leaves coal behind.' },
  { key: 'METAL', name: 'Metal', cat: 'solid', st: ST.SOLID, col: ['#b8c2cc', '#a6b1bc', '#c9d2db', '#97a2ad'],
    k: 0.9, hi: [1500, 'MOLTEN_METAL', 0.02], cond: true, blast: 0.7, unlock: 'base', desc: 'Conducts heat and electricity. Reflects lasers.' },
  { key: 'WALL', name: 'Wall', cat: 'solid', st: ST.SOLID, col: ['#4b4f63', '#43475a', '#535870'], k: 0, indes: true, acidproof: true,
    unlock: 'base', desc: 'Indestructible. Nothing gets through.' },
  { key: 'GLASS', name: 'Glass', cat: 'solid', st: ST.SOLID, col: ['#bfe9ff', '#a9def7', '#d4f1ff'],
    hi: [1250, 'MOLTEN_GLASS', 0.02], acidproof: true, fx: 'glass', unlock: { disc: 'Let molten glass cool', lvl: 4 },
    desc: 'Acid-proof and see-through. Shatters into glitter.' },
  { key: 'ICE', name: 'Ice', cat: 'solid', st: ST.SOLID, col: ['#a8e4ff', '#bfeeff', '#93d8f7'], t0: -15, k: 0.5,
    hi: [1, 'WATER', 0.02], unlock: 'base', desc: 'Frozen water. Salt and heat melt it.' },
  { key: 'RUBBER', name: 'Rubber', cat: 'solid', st: ST.SOLID, col: ['#e2457a', '#cf386b', '#f05a8b'], k: 0.02,
    flam: 520, burn: 0.004, burnTo: ['SMOKE', 'FIRE'], unlock: { lvl: 4 }, desc: 'Insulator. Bouncy - drop sand on it!' },
  { key: 'WAX', name: 'Wax', cat: 'solid', st: ST.SOLID, col: ['#fff1c4', '#f7e5b0', '#fff7dc'],
    hi: [60, 'MOLTEN_WAX', 0.05], flam: 280, burn: 0.004, burnTo: ['FIRE', 'SMOKE'], unlock: { lvl: 3 }, desc: 'Melts easily. Build candles with wick!' },
  { key: 'WICK', name: 'Wick', cat: 'solid', st: ST.SOLID, col: ['#f2eee4', '#e3ddcf'], flam: 190, burn: 0.004, bheat: 650,
    burnTo: ['ASH', 'FIRE'], unlock: { lvl: 3 }, desc: 'Burns slowly and steadily.' },
  { key: 'OBSIDIAN', name: 'Obsidian', cat: 'solid', st: ST.SOLID, col: ['#2a1d3d', '#1d142c', '#3a2856', '#120c1c'],
    hi: [1600, 'LAVA', 0.02], blast: 0.8, acidproof: true, fx: 'glass', unlock: { disc: 'Pour water onto lava', lvl: 7 },
    desc: 'Volcanic glass. Very blast resistant.' },
  { key: 'TORCH', name: 'Torch', cat: 'solid', st: ST.SOLID, col: ['#ffb000', '#ff8c00'], t0: 900, glow: 0.9, fx: 'torch',
    unlock: { lvl: 2 }, desc: 'Endless flame.' },
  { key: 'CONVEYOR_L', name: 'Conveyor ◀', cat: 'solid', st: ST.SOLID, col: ['#3a3f52', '#ffd23f'], fx: 'conveyorL', indes: true,
    unlock: { lvl: 4 }, desc: 'Moves things on top to the left.' },
  { key: 'CONVEYOR_R', name: 'Conveyor ▶', cat: 'solid', st: ST.SOLID, col: ['#3a3f52', '#ffd23f'], fx: 'conveyorR', indes: true,
    unlock: { lvl: 4 }, desc: 'Moves things on top to the right.' },
  { key: 'SPONGE', name: 'Sponge', cat: 'solid', st: ST.SOLID, col: ['#ffe14d', '#f5d23a', '#ffeb7a'], fx: 'sponge',
    flam: 350, burn: 0.01, burnTo: ['FIRE', 'ASH'], unlock: { lvl: 7 }, desc: 'Soaks up liquids. Heat squeezes it dry.' },
  { key: 'CRYSTAL', name: 'Crystal', cat: 'solid', st: ST.SOLID, col: ['#9ef0ff', '#c59bff', '#7fe0ff', '#e0b8ff'], glow: 0.55,
    acidproof: true, fx: 'glitter', unlock: { disc: 'Drop salt into molten glass', lvl: 11 }, desc: 'Grows slowly through salt water.' },

  /* ------------------------------ LIFE ----------------------------- */
  { key: 'SEED', name: 'Seed', cat: 'life', st: ST.POWDER, col: ['#c9e265', '#b4d14f', '#a3c43d'], dens: 40,
    flam: 250, burn: 0.1, burnTo: ['FIRE'], unlock: 'base', desc: 'Drop on dirt or mud and watch it grow.' },
  { key: 'PLANT', name: 'Plant', cat: 'life', st: ST.SOLID, col: ['#3fd65a', '#2fc24c', '#52e66a', '#26ad41'],
    flam: 260, burn: 0.03, burnTo: ['FIRE', 'ASH', 'SMOKE'], lo: [-25, 'ASH', 0.01], unlock: { disc: 'Plant a seed in dirt', lvl: 2 },
    desc: 'Grows toward water. Burns well.' },
  { key: 'FLOWER', name: 'Flower', cat: 'life', st: ST.SOLID, col: ['#ff4f8b', '#ffd93d', '#b26bff', '#ff8a3d', '#4fd8ff', '#ff5ad1'],
    flam: 240, burn: 0.05, burnTo: ['FIRE', 'ASH'], fx: 'flower', glow: 0.15, unlock: { disc: 'Let a plant grow tall', lvl: 6 },
    desc: 'Pretty. Drops seeds now and then.' },
  { key: 'FUNGUS', name: 'Fungus', cat: 'life', st: ST.SOLID, col: ['#38e8c6', '#2bd0b0', '#55ffd9'], glow: 0.4,
    flam: 220, burn: 0.04, burnTo: ['FIRE', 'ASH'], unlock: { disc: 'Let mud rot some wood', lvl: 10 }, desc: 'Glowing mold that creeps over wood and plants.' },
  { key: 'VIRUS', name: 'Virus', cat: 'life', st: ST.SOLID, col: ['#c02cff', '#a41ce6', '#d65cff'], life: [420, 460],
    flam: 120, burn: 0.3, burnTo: ['FIRE'], glow: 0.5, unlock: { lvl: 8 }, desc: 'Infects everything nearby, then burns out.' },
  { key: 'FISH', name: 'Fish', cat: 'life', st: ST.POWDER, col: ['#ff8c2b', '#ffa54f', '#ff7a1a'], dens: 21, life: [400, 400],
    flam: 300, burn: 0.2, burnTo: ['ASH'], unlock: { lvl: 8 }, desc: 'Swims in water. Needs water to live.' },
  { key: 'FIREFLY', name: 'Firefly', cat: 'life', st: ST.GAS, col: ['#f6ff7a'], dens: 2, glow: 1, fx: 'firefly',
    flam: 150, burn: 1, burnTo: ['EMBER'], unlock: { lvl: 10 }, desc: 'Blinks happily in the dark.' },

  /* ----------------------------- ENERGY ---------------------------- */
  { key: 'FIRE', name: 'Fire', cat: 'energy', st: ST.ENERGY, col: ['#ffde3d', '#ff9a1f', '#ff4d1f'], t0: 900, life: [18, 50],
    k: 0.5, glow: 1, fx: 'fire', unlock: 'base', desc: 'Hot, hungry and short-lived.' },
  { key: 'SPARK', name: 'Spark', cat: 'energy', st: ST.ENERGY, col: ['#fff9a8', '#ffffff'], life: [8, 14], glow: 1, fx: 'spark',
    unlock: 'base', desc: 'Electricity! Runs through metal and water.' },
  { key: 'LIGHTNING', name: 'Lightning', cat: 'energy', st: ST.ENERGY, col: ['#e8f4ff'], glow: 1, single: true,
    unlock: { lvl: 5 }, desc: 'Strikes downward with a huge burst of heat and power.' },
  { key: 'LASER', name: 'Laser', cat: 'energy', st: ST.ENERGY, col: ['#ff2d55'], glow: 1, single: true,
    unlock: { lvl: 7 }, desc: 'Fires in the direction you drag. Bounces off metal.' },
  { key: 'PLASMA', name: 'Plasma', cat: 'energy', st: ST.ENERGY, col: ['#ff6bf5', '#c56bff', '#ffffff'], t0: 3000, life: [10, 35],
    glow: 1, fx: 'plasma', unlock: { disc: 'Strike something with lightning', lvl: 11 }, desc: 'Superheated matter.' },
  { key: 'EMBER', name: 'Ember', cat: 'energy', st: ST.POWDER, col: ['#ff7b1c', '#ffa53a', '#ff5a14'], dens: 10, t0: 700, life: [90, 260],
    glow: 0.9, fx: 'ember', unlock: { disc: 'Burn some wood', lvl: 3 }, desc: 'Glowing bits that light whatever they land on.' },
  { key: 'BOLT', name: 'Bolt', st: ST.ENERGY, col: ['#ffffff', '#cfe6ff'], t0: 2000, life: [3, 7], glow: 1, hidden: true },
  { key: 'BEAM', name: 'Beam', st: ST.ENERGY, col: ['#ff2d55', '#ff7a90'], life: [2, 4], glow: 1, hidden: true },
  { key: 'ROCKET', name: 'Rocket', st: ST.ENERGY, col: ['#ffffff'], glow: 1, hidden: true },
  { key: 'TBURN', name: 'Burning Thermite', st: ST.POWDER, col: ['#ffffff', '#fff2b0', '#ffd27a'], dens: 60, t0: 2800,
    life: [140, 220], glow: 1, fx: 'ember', hidden: true },

  /* --------------------------- EXPLOSIVES -------------------------- */
  { key: 'GUNPOWDER', name: 'Gunpowder', cat: 'explosive', st: ST.POWDER, col: ['#3d3d44', '#2e2e34', '#4b4b53', '#26262b'],
    dens: 50, flam: 170, expl: 3, unlock: 'base', desc: 'Light it up and stand back.' },
  { key: 'THERMITE', name: 'Thermite', cat: 'explosive', st: ST.POWDER, col: ['#9b5b4b', '#86493b', '#ab6c5c'], dens: 58,
    flam: 600, unlock: { lvl: 6 }, desc: 'Burns at 2800°. Melts straight through metal.' },
  { key: 'BOMB', name: 'Bomb', cat: 'explosive', st: ST.POWDER, col: ['#2a2a2a', '#3a3a3a'], dens: 90, expl: 13, flam: 400,
    single: true, fx: 'bomb', unlock: { lvl: 5 }, desc: 'Explodes on impact.' },
  { key: 'FUSE', name: 'Fuse', cat: 'explosive', st: ST.SOLID, col: ['#d1c39b', '#bfb088'], flam: 140, burn: 0.12, bheat: 600,
    burnTo: ['FIRE', 'FIRE', 'SMOKE'], unlock: { lvl: 3 }, desc: 'Burns along its length - perfect for timed blasts.' },
  { key: 'FIREWORK', name: 'Firework', cat: 'explosive', st: ST.POWDER, col: ['#ff3d6e', '#3dd6ff', '#ffd23d', '#a45cff'], dens: 45,
    flam: 180, unlock: { lvl: 6 }, desc: 'Light it to launch a colorful burst!' },
  { key: 'NITRO', name: 'Nitroglycerin', cat: 'explosive', st: ST.LIQUID, col: ['#f4f7a6', '#e9ef8c', '#fbfcc4'], dens: 24, spread: 3,
    flam: 140, expl: 8, unlock: { lvl: 7 }, desc: 'Explodes from heat, sparks - or a hard landing.' },
  { key: 'TNT', name: 'TNT', cat: 'explosive', st: ST.SOLID, col: ['#e8373e', '#d42c33', '#f24a50'], flam: 240, expl: 10, fx: 'tnt',
    unlock: { lvl: 4 }, desc: 'The good stuff.' },
  { key: 'C4', name: 'C4', cat: 'explosive', st: ST.SOLID, col: ['#d9d3b0', '#cbc4a0', '#e4dfc1'], flam: 1600, expl: 15,
    unlock: { lvl: 9 }, desc: 'Stable until it gets an electric shock.' },
  { key: 'NUKE', name: 'Nuke', cat: 'explosive', st: ST.POWDER, col: ['#5aff3d', '#3dd626'], dens: 95, expl: 48, flam: 900, single: true,
    fx: 'bomb', glow: 0.6, unlock: { lvl: 14 }, desc: 'Ends everything. Use responsibly.' },
  { key: 'BARREL', name: 'Barrel', cat: 'explosive', st: ST.SOLID, col: ['#c73b2b', '#a8301f', '#e04a38'], flam: 260, expl: 6,
    fx: 'barrel', unlock: { lvl: 9 }, desc: 'Full of oil. Explodes into a burning mess.' },

  /* ----------------------------- SPECIAL --------------------------- */
  { key: 'CLONER', name: 'Cloner', cat: 'special', st: ST.SOLID, col: ['#ffd700', '#e6c200'], indes: true, acidproof: true, k: 0,
    fx: 'cloner', glow: 0.35, unlock: { lvl: 10 }, desc: 'Copies the first thing that touches it. Forever.' },
  { key: 'VOID', name: 'Void', cat: 'special', st: ST.SOLID, col: ['#0d0221', '#1a0640'], indes: true, acidproof: true, k: 0,
    fx: 'void', unlock: { lvl: 10 }, desc: 'Deletes whatever touches it.' },
  { key: 'BLACKHOLE', name: 'Black Hole', cat: 'special', st: ST.SOLID, col: ['#000000'], indes: true, acidproof: true, k: 0,
    fx: 'blackhole', glow: 1, single: true, unlock: { lvl: 12 }, desc: 'Pulls everything in. Nothing escapes.' },
  { key: 'HEATER', name: 'Heater', cat: 'special', st: ST.SOLID, col: ['#ff4b2b', '#e63a1d'], indes: true, k: 0.6, glow: 0.6, fx: 'heater',
    unlock: { lvl: 8 }, desc: 'Heats up everything around it.' },
  { key: 'COOLER', name: 'Cooler', cat: 'special', st: ST.SOLID, col: ['#2bd9ff', '#1dbbe6'], indes: true, k: 0.6, glow: 0.6, fx: 'heater',
    unlock: { lvl: 8 }, desc: 'Freezes everything around it.' },
  { key: 'BATTERY', name: 'Battery', cat: 'special', st: ST.SOLID, col: ['#3dff8b', '#1f2b24'], indes: true, fx: 'battery', glow: 0.4,
    unlock: { lvl: 6 }, desc: 'Sends pulses of electricity into touching metal or water.' },
  { key: 'ANTIMATTER', name: 'Antimatter', cat: 'special', st: ST.POWDER, col: ['#ff2bd6', '#2bf0ff'], dens: 30, glow: 1, fx: 'antimatter',
    acidproof: true, unlock: { lvl: 12 }, desc: 'Annihilates anything it touches.' },
];

/* ------------------------------------------------------------------------
   Flattened lookup tables for fast access in the simulation hot loop.
   ------------------------------------------------------------------------ */
const E = {};             // key -> id
const ELEMENTS = [];      // id -> def
ELEMENT_DEFS.forEach((d, i) => { d.id = i; E[d.key] = i; ELEMENTS.push(d); });
const N_EL = ELEMENTS.length;

const STATE = new Uint8Array(N_EL);
const DENS = new Float32Array(N_EL);
const COND_K = new Float32Array(N_EL);
const LOSS = new Float32Array(N_EL);
const T0 = new Float32Array(N_EL);
const HAS_T0 = new Uint8Array(N_EL);
const HI_T = new Float32Array(N_EL), HI_TO = new Int16Array(N_EL), HI_P = new Float32Array(N_EL);
const LO_T = new Float32Array(N_EL), LO_TO = new Int16Array(N_EL), LO_P = new Float32Array(N_EL);
const FLAM = new Float32Array(N_EL);
const BURN = new Float32Array(N_EL);
const BHEAT = new Float32Array(N_EL);
const BURN_TO = [];
const EXPL = new Uint8Array(N_EL);
const SPREAD = new Uint8Array(N_EL);
const VISC = new Float32Array(N_EL);
const GLOW = new Float32Array(N_EL);
const CONDUCT = new Uint8Array(N_EL);
const ACIDPROOF = new Uint8Array(N_EL);
const INDES = new Uint8Array(N_EL);
const BLAST = new Float32Array(N_EL);
const LIFE_MIN = new Int16Array(N_EL), LIFE_MAX = new Int16Array(N_EL);

const DEFAULT_K = [0.1, 0.3, 0.2, 0.4, 0.08, 0.45];
const DEFAULT_LOSS = [0.04, 0.0015, 0.003, 0.003, 0.012, 0];

ELEMENTS.forEach(d => {
  const i = d.id;
  STATE[i] = d.st;
  DENS[i] = d.dens != null ? d.dens : (d.st === ST.SOLID ? 1000 : 0);
  COND_K[i] = d.k != null ? d.k : DEFAULT_K[d.st];
  LOSS[i] = d.loss != null ? d.loss : DEFAULT_LOSS[d.st];
  if (d.t0 != null) { T0[i] = d.t0; HAS_T0[i] = 1; }
  HI_T[i] = 1e9; LO_T[i] = -1e9; HI_TO[i] = -1; LO_TO[i] = -1;
  FLAM[i] = d.flam || 0;
  BURN[i] = d.burn || 0;
  BHEAT[i] = d.bheat || 700;
  EXPL[i] = d.expl || 0;
  SPREAD[i] = d.spread != null ? d.spread : 3;
  VISC[i] = d.visc || 0;
  GLOW[i] = d.glow || 0;
  CONDUCT[i] = d.cond ? 1 : 0;
  ACIDPROOF[i] = d.acidproof ? 1 : 0;
  INDES[i] = d.indes ? 1 : 0;
  BLAST[i] = d.blast || 0;
  LIFE_MIN[i] = d.life ? d.life[0] : 0;
  LIFE_MAX[i] = d.life ? d.life[1] : 0;
});
// second pass: resolve key references
ELEMENTS.forEach(d => {
  const i = d.id;
  if (d.hi) { HI_T[i] = d.hi[0]; HI_TO[i] = E[d.hi[1]]; HI_P[i] = d.hi[2] || 0.05; }
  if (d.lo) { LO_T[i] = d.lo[0]; LO_TO[i] = E[d.lo[1]]; LO_P[i] = d.lo[2] || 0.05; }
  BURN_TO[i] = (d.burnTo || ['FIRE']).map(k => E[k]);
});
INDES[E.EMPTY] = 1;

/* elements that ignore explosions entirely */
const isImmovable = t => INDES[t] === 1;

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
