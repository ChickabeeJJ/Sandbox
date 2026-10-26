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

  { key: 'GRAVEL', name: 'Gravel', cat: 'powder', st: ST.POWDER, col: ['#8d8579', '#77705f', '#a39b8d', '#655e52'], dens: 66,
    unlock: { lvl: 2 }, desc: 'Chunky, heavy little rocks.' },
  { key: 'CLAY', name: 'Clay', cat: 'powder', st: ST.POWDER, col: ['#c97f52', '#b86f45', '#d98f60'], dens: 54, visc: 0.4,
    hi: [900, 'BRICK', 0.03], unlock: { lvl: 3 }, desc: 'Bake it past 900° to make bricks.' },
  { key: 'CEMENT', name: 'Cement', cat: 'powder', st: ST.POWDER, col: ['#b9b9b4', '#a7a7a1', '#cacac5'], dens: 56,
    unlock: { lvl: 5 }, desc: 'Add water and it sets into concrete.' },
  { key: 'SUGAR', name: 'Sugar', cat: 'powder', st: ST.POWDER, col: ['#ffffff', '#f6f4ff', '#ecf2ff'], dens: 45, hi: [186, 'CARAMEL', 0.05],
    unlock: { lvl: 3 }, desc: 'Sweet. Melts into caramel and dissolves into syrup.' },
  { key: 'FLOUR', name: 'Flour', cat: 'powder', st: ST.POWDER, col: ['#fbf3e2', '#f2e8d2', '#fff9ee'], dens: 20, visc: 0.35, flam: 210, expl: 2,
    unlock: { lvl: 5 }, desc: 'Harmless... until a spark makes it a dust explosion.' },
  { key: 'IRON', name: 'Iron Filings', cat: 'powder', st: ST.POWDER, col: ['#5b6068', '#4a4e55', '#6c727b'], dens: 72, k: 0.8, cond: true,
    hi: [1500, 'MOLTEN_METAL', 0.02], unlock: { lvl: 7 }, desc: 'Magnetic metal dust. Conducts electricity.' },
  { key: 'URANIUM', name: 'Uranium', cat: 'powder', st: ST.POWDER, col: ['#5aff6a', '#3fe052', '#7aff86'], dens: 90, glow: 0.55, fx: 'uranium',
    unlock: { lvl: 12 }, desc: 'Radioactive and self-heating. Pile too much and it melts down.' },
  { key: 'MOONDUST', name: 'Moon Dust', cat: 'powder', st: ST.POWDER, col: ['#c9c6d8', '#b4b0c7', '#ddd9ea'], dens: 30, glow: 0.15,
    unlock: { lvl: 11 }, desc: 'Falls like there is barely any gravity.' },
  { key: 'STARDUST', name: 'Stardust', cat: 'powder', st: ST.POWDER, col: ['#fff6b0', '#b0e8ff', '#ffc4f2', '#ffffff'], dens: 25, glow: 0.8, fx: 'glitter',
    unlock: { cost: 150 }, desc: 'Cosmic powder that falls UP.' },
  { key: 'CONFETTI', name: 'Confetti', cat: 'powder', st: ST.POWDER, col: ['#ff3d6e', '#ffd23d', '#3dd6ff', '#7dff5a', '#b25cff', '#ff8a3d'], dens: 5, visc: 0.6,
    flam: 200, burn: 0.2, burnTo: ['FIRE', 'ASH'], unlock: { lvl: 6 }, desc: 'Party time. Floats gently down.' },

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

  { key: 'CARAMEL', name: 'Caramel', cat: 'liquid', st: ST.LIQUID, col: ['#c97a1e', '#b8691a', '#d98a2a'], dens: 38, t0: 190, spread: 1, visc: 0.85,
    lo: [140, 'CANDY', 0.03], flam: 350, burn: 0.01, burnTo: ['SMOKE', 'FIRE'], unlock: { disc: 'Melt sugar', lvl: 10 }, desc: 'Gooey melted sugar. Hardens into candy.' },
  { key: 'MERCURY', name: 'Mercury', cat: 'liquid', st: ST.LIQUID, col: ['#d6dbe2', '#c3c9d2', '#e8ecf1'], dens: 95, k: 0.7, spread: 4, cond: true,
    hi: [357, 'TOXIC', 0.04], fx: 'water', unlock: { lvl: 8 }, desc: 'Heavy liquid metal. Everything floats on it.' },
  { key: 'SOAP', name: 'Soap', cat: 'liquid', st: ST.LIQUID, col: ['#ff9ad6', '#f58bcb', '#ffb3e1'], dens: 19, spread: 3, visc: 0.4,
    unlock: { lvl: 6 }, desc: 'Mix with water for bubbles.' },
  { key: 'FOAM', name: 'Foam', cat: 'liquid', st: ST.LIQUID, col: ['#f4f8ff', '#e6eef9', '#ffffff'], dens: 8, spread: 1, visc: 0.75, life: [600, 1000],
    unlock: { lvl: 4 }, desc: 'Fire-fighting foam. Smothers flames, then fades.' },
  { key: 'GASOLINE', name: 'Gasoline', cat: 'liquid', st: ST.LIQUID, col: ['#e8d36a', '#dcc457', '#f2e081'], dens: 11, spread: 5,
    flam: 110, burn: 0.15, bheat: 1150, burnTo: ['FIRE', 'FIRE', 'SMOKE'], unlock: { lvl: 6 }, desc: 'Burns violently fast.' },
  { key: 'ETHANOL', name: 'Ethanol', cat: 'liquid', st: ST.LIQUID, col: ['#e3f3ff', '#d4ecff'], dens: 13, spread: 5, flam: 140, burn: 0.05, bheat: 1200,
    burnTo: ['BLUEFIRE', 'BLUEFIRE', 'STEAM'], fx: 'water', unlock: { lvl: 7 }, desc: 'Burns with an eerie blue flame.' },
  { key: 'SLIME', name: 'Slime', cat: 'liquid', st: ST.LIQUID, col: ['#6dff4a', '#58e83a', '#84ff66'], dens: 30, spread: 1, visc: 0.94, glow: 0.35,
    acidproof: true, unlock: { lvl: 10 }, desc: 'Gloopy, glowing and acid-proof.' },
  { key: 'GLOWSTICK', name: 'Glow Juice', cat: 'liquid', st: ST.LIQUID, col: ['#ff3df2'], dens: 20, spread: 4, glow: 1, fx: 'glowstick',
    unlock: { lvl: 9 }, desc: 'Every drop glows a different color.' },
  { key: 'MOLTEN_GOLD', name: 'Molten Gold', cat: 'liquid', st: ST.LIQUID, col: ['#ffd84a', '#ffc21f', '#ffe680'], dens: 90, t0: 1200, k: 0.7, spread: 2,
    visc: 0.3, lo: [1000, 'GOLD', 0.05], glow: 1, fx: 'lava', cond: true, unlock: { disc: 'Melt some gold', lvl: 15 }, desc: 'Liquid treasure.' },
  { key: 'MOLTEN_LEAD', name: 'Molten Lead', cat: 'liquid', st: ST.LIQUID, col: ['#9aa3b5', '#8a93a6', '#adb5c5'], dens: 85, t0: 420, k: 0.5, spread: 3,
    lo: [320, 'LEAD', 0.05], glow: 0.3, unlock: { disc: 'Melt lead (327°)', lvl: 12 }, desc: 'Melts at a low temperature.' },
  { key: 'GREEK_FIRE', name: 'Greek Fire', cat: 'liquid', st: ST.LIQUID, col: ['#ff7a1a', '#ff9a2a', '#ffb347'], dens: 15, t0: 1000, spread: 3, visc: 0.3,
    life: [600, 1200], glow: 1, fx: 'lava', unlock: { cost: 200 }, desc: 'Liquid fire that burns even on water.' },

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

  { key: 'BUBBLE', name: 'Bubbles', cat: 'gas', st: ST.GAS, col: ['#bfe9ff', '#ffd1f2', '#d6ffe9'], dens: 0.3, life: [90, 260], fx: 'bubble',
    unlock: { disc: 'Mix soap and water', lvl: 12 }, desc: 'Float up and pop.' },
  { key: 'HYDROGEN', name: 'Hydrogen', cat: 'gas', st: ST.GAS, col: ['#e8f0ff', '#dce8ff'], dens: 0.1, flam: 80, expl: 4, fx: 'gas',
    unlock: { lvl: 9 }, desc: 'Lightest gas there is. Extremely explosive.' },
  { key: 'OXYGEN', name: 'Oxygen', cat: 'gas', st: ST.GAS, col: ['#c9e6ff', '#b8dcff'], dens: 1.1, flam: 220, burn: 1, bheat: 1600,
    burnTo: ['FIRE', 'BLUEFIRE'], fx: 'gas', unlock: { lvl: 7 }, desc: 'Makes fire burn much hotter.' },
  { key: 'HELIUM', name: 'Helium', cat: 'gas', st: ST.GAS, col: ['#ffe9f7', '#ffd9f0'], dens: 0.05, fx: 'gas', unlock: { lvl: 5 }, desc: 'Inert and rises fast.' },
  { key: 'CHLORINE', name: 'Chlorine', cat: 'gas', st: ST.GAS, col: ['#d8f27a', '#c6e65e'], dens: 2.5, life: [400, 700], glow: 0.2, fx: 'gas',
    unlock: { lvl: 11 }, desc: 'Heavy poison gas. Sinks and turns water acidic.' },
  { key: 'CLOUD', name: 'Rain Cloud', cat: 'gas', st: ST.GAS, col: ['#e9edf3', '#d9dfe8', '#f4f6fa'], dens: 0.4, fx: 'cloud',
    unlock: { lvl: 8 }, desc: 'Drifts and rains. Snows when it is cold.' },
  { key: 'STORM', name: 'Storm Cloud', cat: 'gas', st: ST.GAS, col: ['#4b5160', '#3e4351', '#596072'], dens: 0.4, fx: 'cloud',
    unlock: { cost: 300 }, desc: 'Pours rain and throws lightning bolts.' },

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

  { key: 'BRICK', name: 'Brick', cat: 'solid', st: ST.SOLID, col: ['#b5452e', '#a23c28', '#c45236', '#8f3322'], hi: [1600, 'LAVA', 0.02], blast: 0.55,
    fx: 'brick', unlock: { disc: 'Bake clay (900°+)', lvl: 9 }, desc: 'Sturdy building block.' },
  { key: 'CONCRETE', name: 'Concrete', cat: 'solid', st: ST.SOLID, col: ['#9fa0a0', '#929393', '#adaeae'], blast: 0.65,
    unlock: { disc: 'Wet some cement', lvl: 8 }, desc: 'Tough stuff. Resists blasts.' },
  { key: 'CANDY', name: 'Candy', cat: 'solid', st: ST.SOLID, col: ['#ff4f7a', '#ffffff'], hi: [160, 'CARAMEL', 0.03], fx: 'candy',
    unlock: { disc: 'Let caramel cool', lvl: 13 }, desc: 'Hard candy. Melts back into caramel.' },
  { key: 'GOLD', name: 'Gold', cat: 'solid', st: ST.SOLID, col: ['#ffd23d', '#f2bf1f', '#ffe36b', '#e0ab12'], k: 0.9, hi: [1064, 'MOLTEN_GOLD', 0.02],
    cond: true, acidproof: true, fx: 'glitter', glow: 0.2, unlock: { disc: 'Strike lead with lightning', lvl: 15 }, desc: 'Alchemy! Acid-proof and conductive.' },
  { key: 'LEAD', name: 'Lead', cat: 'solid', st: ST.SOLID, col: ['#6f7686', '#626979', '#7c8394'], hi: [327, 'MOLTEN_LEAD', 0.03], blast: 0.4,
    unlock: { lvl: 8 }, desc: 'Blocks radiation. Melts easily.' },
  { key: 'DIAMOND', name: 'Diamond', cat: 'solid', st: ST.SOLID, col: ['#d8fbff', '#b8f1ff', '#ffffff', '#c8e8ff'], blast: 0.97, acidproof: true,
    fx: 'glitter', glow: 0.35, unlock: { disc: 'Heat coal to 2800°+', lvl: 14 }, desc: 'Practically indestructible.' },
  { key: 'PLASTIC', name: 'Plastic', cat: 'solid', st: ST.SOLID, col: ['#4fa3ff', '#3d8fe8', '#62b0ff'], k: 0.05, flam: 300, burn: 0.02,
    burnTo: ['SMOKE', 'TOXIC', 'FIRE'], unlock: { lvl: 4 }, desc: 'Insulates. Burns into toxic smoke.' },
  { key: 'MAGNET', name: 'Magnet', cat: 'solid', st: ST.SOLID, col: ['#e8373e', '#c9ced6'], indes: true, fx: 'magnet',
    unlock: { lvl: 10 }, desc: 'Pulls in iron filings and molten metal.' },
  { key: 'BULB', name: 'Light Bulb', cat: 'solid', st: ST.SOLID, col: ['#fff6c4', '#5c5a4a'], cond: true, fx: 'bulb',
    unlock: { lvl: 6 }, desc: 'Lights up when electricity flows through it.' },
  { key: 'FAN', name: 'Fan', cat: 'solid', st: ST.SOLID, col: ['#9aa6b8', '#6c7688'], indes: true, fx: 'fan',
    unlock: { lvl: 7 }, desc: 'Blows everything above it upward.' },
  { key: 'DRAIN', name: 'Drain', cat: 'solid', st: ST.SOLID, col: ['#2a2f3a', '#1d212a'], indes: true, fx: 'drain',
    unlock: { lvl: 5 }, desc: 'Swallows liquids and gases.' },

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

  { key: 'SAPLING', name: 'Sapling', cat: 'life', st: ST.POWDER, col: ['#7a5230', '#4fd65f'], dens: 40, flam: 250, burn: 0.1, burnTo: ['FIRE'],
    unlock: { cost: 150 }, desc: 'Grows into a full tree with trunk and leaves.' },
  { key: 'TRUNK', name: 'Growing Trunk', st: ST.SOLID, col: ['#7a5230', '#6b4728'], flam: 300, burn: 0.008, burnTo: ['FIRE', 'ASH'], hidden: true },
  { key: 'LEAF', name: 'Leaves', cat: 'life', st: ST.SOLID, col: ['#2fc24c', '#3fd65a', '#25a83f', '#5ee66f', '#8ae65a'], flam: 230, burn: 0.05,
    burnTo: ['FIRE', 'ASH', 'SMOKE'], unlock: { disc: 'Grow a sapling', lvl: 15 }, desc: 'Leafy canopy.' },
  { key: 'CACTUS', name: 'Cactus', cat: 'life', st: ST.SOLID, col: ['#3f9e4a', '#358a3f', '#4fb35a'], flam: 320, burn: 0.02, burnTo: ['FIRE', 'ASH'],
    fx: 'cactus', unlock: { lvl: 9 }, desc: 'Plant on sand and it grows arms.' },
  { key: 'MOSS', name: 'Moss', cat: 'life', st: ST.SOLID, col: ['#5f9e3a', '#4f8a2f', '#71b046'], flam: 260, burn: 0.04, burnTo: ['FIRE', 'ASH'],
    unlock: { lvl: 6 }, desc: 'Creeps over stone and brick.' },
  { key: 'ALGAE', name: 'Algae', cat: 'life', st: ST.SOLID, col: ['#2f8f5a', '#24784b', '#3aa86b'], glow: 0.1, unlock: { lvl: 7 }, desc: 'Spreads through water.' },
  { key: 'ANT', name: 'Ant', cat: 'life', st: ST.POWDER, col: ['#2a1a12', '#3b2418'], dens: 30, flam: 200, burn: 1, burnTo: ['ASH'],
    unlock: { lvl: 8 }, desc: 'Busy little diggers.' },
  { key: 'WORM', name: 'Worm', cat: 'life', st: ST.POWDER, col: ['#e88a9a', '#d97888'], dens: 40, flam: 200, burn: 1, burnTo: ['ASH'],
    unlock: { lvl: 7 }, desc: 'Wriggles through dirt and mud.' },
  { key: 'BIRD', name: 'Bird', cat: 'life', st: ST.GAS, col: ['#4fb3ff', '#ffd23d'], dens: 3, flam: 220, burn: 1, burnTo: ['ASH'], fx: 'bird',
    unlock: { lvl: 9 }, desc: 'Flaps around the sky.' },
  { key: 'BEE', name: 'Bee', cat: 'life', st: ST.GAS, col: ['#ffd23d', '#1a1a1a'], dens: 3, flam: 180, burn: 1, burnTo: ['ASH'], fx: 'bee',
    unlock: { lvl: 11 }, desc: 'Visits flowers and makes honey.' },
  { key: 'PHOENIX', name: 'Phoenix', cat: 'life', st: ST.GAS, col: ['#ff7a1a', '#ffd23d', '#ff3d1f'], dens: 3, t0: 1200, glow: 1, fx: 'phoenix',
    unlock: { cost: 450 }, desc: 'A firebird that sets the sky ablaze.' },

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
  { key: 'BLUEFIRE', name: 'Blue Fire', cat: 'energy', st: ST.ENERGY, col: ['#3dd6ff'], t0: 1400, life: [18, 45], k: 0.5, glow: 1, fx: 'bluefire',
    unlock: { disc: 'Burn ethanol', lvl: 9 }, desc: 'Hotter than normal fire.' },
  { key: 'FROSTFIRE', name: 'Frostfire', cat: 'energy', st: ST.ENERGY, col: ['#bff6ff'], t0: -150, life: [20, 50], k: 0.5, glow: 1, fx: 'frostfire',
    unlock: { cost: 250 }, desc: 'Burns cold. Freezes everything it licks.' },
  { key: 'RAINBOWFIRE', name: 'Rainbow Fire', cat: 'energy', st: ST.ENERGY, col: ['#ff3df2'], t0: 900, life: [20, 55], k: 0.5, glow: 1, fx: 'rainbowfire',
    unlock: { cost: 200 }, desc: 'Fire in every color.' },
  { key: 'RADIATION', name: 'Radiation', cat: 'energy', st: ST.ENERGY, col: ['#8bff5a', '#c4ff9a'], life: [25, 50], glow: 1, fx: 'spark',
    unlock: { lvl: 12 }, desc: 'Mutates plants and heats whatever it hits. Lead stops it.' },
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

  { key: 'MINE', name: 'Mine', cat: 'explosive', st: ST.SOLID, col: ['#4a4f3a', '#3b3f2e'], flam: 220, expl: 8, fx: 'bomb',
    unlock: { lvl: 8 }, desc: 'Explodes when anything touches it.' },
  { key: 'FIRECRACKER', name: 'Firecracker', cat: 'explosive', st: ST.POWDER, col: ['#ff3d3d', '#ffd23d'], dens: 40, flam: 150, expl: 1,
    unlock: { lvl: 5 }, desc: 'Crackle crackle pop.' },
  { key: 'SMOKEBOMB', name: 'Smoke Bomb', cat: 'explosive', st: ST.POWDER, col: ['#7a5cff', '#ff5cd6'], dens: 45, flam: 160,
    unlock: { lvl: 6 }, desc: 'Light it for a huge cloud of colorful smoke.' },
  { key: 'NAPALM', name: 'Napalm', cat: 'explosive', st: ST.LIQUID, col: ['#ff6a1a', '#e85a12'], dens: 25, spread: 1, visc: 0.8, flam: 120,
    burn: 0.003, bheat: 1300, burnTo: ['FIRE', 'SMOKE'], unlock: { lvl: 11 }, desc: 'Sticky gel that burns for ages.' },
  { key: 'CRYOBOMB', name: 'Cryo Bomb', cat: 'explosive', st: ST.POWDER, col: ['#3de0ff', '#c4f6ff'], dens: 90, single: true, fx: 'bomb', glow: 0.5,
    unlock: { lvl: 10 }, desc: 'Flash-freezes everything around it.' },
  { key: 'CLUSTERBOMB', name: 'Cluster Bomb', cat: 'explosive', st: ST.POWDER, col: ['#5a5f3a', '#7a7f4a'], dens: 92, expl: 6, flam: 400, single: true,
    fx: 'bomb', unlock: { cost: 350 }, desc: 'Bursts into a rain of bomblets.' },
  { key: 'BOMBLET', name: 'Bomblet', st: ST.POWDER, col: ['#3a3a2a'], dens: 90, expl: 5, flam: 400, hidden: true },
  { key: 'METEOR', name: 'Meteor', cat: 'explosive', st: ST.ENERGY, col: ['#ff7a1a', '#ffd23d'], t0: 1500, glow: 1, single: true,
    unlock: { cost: 400 }, desc: 'Calls down a flaming rock from space.' },

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
  { key: 'PORTAL_A', name: 'Portal In', cat: 'special', st: ST.SOLID, col: ['#3d8bff', '#3de0ff'], indes: true, acidproof: true, k: 0, fx: 'portal', glow: 0.8,
    unlock: { cost: 400, also: ['PORTAL_B'] }, desc: 'Whatever touches it comes out of a Portal Out.' },
  { key: 'PORTAL_B', name: 'Portal Out', cat: 'special', st: ST.SOLID, col: ['#ff8a1a', '#ffd23d'], indes: true, acidproof: true, k: 0, fx: 'portal', glow: 0.8,
    unlock: { via: 'PORTAL_A' }, desc: 'Exit for Portal In.' },
  { key: 'WHITEHOLE', name: 'White Hole', cat: 'special', st: ST.SOLID, col: ['#ffffff'], indes: true, acidproof: true, k: 0, fx: 'whitehole', glow: 1, single: true,
    unlock: { cost: 500 }, desc: 'Spews random matter into the world.' },
  { key: 'VORTEX', name: 'Vortex', cat: 'special', st: ST.SOLID, col: ['#8b5cff'], indes: true, acidproof: true, k: 0, fx: 'vortex', glow: 1, single: true,
    unlock: { cost: 350 }, desc: 'A swirling whirlpool that spins everything around it.' },
  { key: 'STASIS', name: 'Stasis Field', cat: 'special', st: ST.SOLID, col: ['#7af0ff', '#4fd2e8'], indes: true, acidproof: true, k: 0, fx: 'stasis', glow: 0.6,
    unlock: { cost: 300 }, desc: 'Freezes time for everything nearby.' },
  { key: 'TRANSMUTER', name: 'Transmuter', cat: 'special', st: ST.SOLID, col: ['#ff3df2', '#8b5cff'], indes: true, acidproof: true, k: 0, fx: 'cloner', glow: 0.6,
    unlock: { cost: 350 }, desc: 'Learns the first element it touches and turns everything else into it.' },
  { key: 'VOLCANO', name: 'Volcano', cat: 'special', st: ST.SOLID, col: ['#3a2a24', '#2a1d18'], indes: true, t0: 1200, glow: 0.4, fx: 'volcano',
    unlock: { cost: 300 }, desc: 'Erupts lava, embers and smoke.' },
  { key: 'GEYSER', name: 'Geyser', cat: 'special', st: ST.SOLID, col: ['#5a6a7a', '#4a5868'], indes: true, unlock: { lvl: 9 }, desc: 'Blasts water and steam into the air.' },
  { key: 'SUN', name: 'Mini Sun', cat: 'special', st: ST.SOLID, col: ['#fff2a8'], indes: true, acidproof: true, k: 0, glow: 1, fx: 'sun', single: true,
    unlock: { cost: 600 }, desc: 'A tiny star. Scorches everything nearby.' },
  { key: 'GHOST', name: 'Ghost', cat: 'special', st: ST.GAS, col: ['#e8f4ff', '#c4e0ff'], dens: 1, glow: 0.6, fx: 'ghost',
    unlock: { cost: 250 }, desc: 'Drifts through walls. Spooky.' },
  { key: 'COLORSMOKE', name: 'Colored Smoke', st: ST.GAS, col: ['#ff5cd6'], dens: 0.9, life: [150, 320], fx: 'colorsmoke', hidden: true },
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
