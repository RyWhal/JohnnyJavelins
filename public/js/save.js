// Persistent roguelite progression: gold, permanent upgrades, unlocks, records.
'use strict';

JJ.META = [
  { id: 'toughness', name: 'Toughness', icon: '❤️', max: 5, base: 40, growth: 1.6, desc: '+10 max HP per rank' },
  { id: 'might', name: 'Might', icon: '💪', max: 5, base: 60, growth: 1.65, desc: '+8% javelin damage per rank' },
  { id: 'haste', name: 'Haste', icon: '🤾', max: 5, base: 60, growth: 1.65, desc: '+6% throw rate per rank' },
  { id: 'fleet', name: 'Fleet Foot', icon: '👟', max: 3, base: 50, growth: 1.7, desc: '+5% move speed per rank' },
  { id: 'magnet', name: 'Magnetism', icon: '🧲', max: 3, base: 40, growth: 1.6, desc: '+15% pickup range per rank' },
  { id: 'recovery', name: 'Recovery', icon: '🌿', max: 3, base: 70, growth: 1.7, desc: '+0.2 HP regen/sec per rank' },
  { id: 'armor', name: 'Thick Hide', icon: '🛡️', max: 3, base: 90, growth: 1.8, desc: '+1 armor per rank' },
  { id: 'growth', name: 'Growth', icon: '📜', max: 5, base: 50, growth: 1.6, desc: '+8% XP gain per rank' },
  { id: 'greed', name: 'Greed', icon: '💰', max: 5, base: 50, growth: 1.6, desc: '+10% gold gain per rank' },
  { id: 'reroll', name: 'Second Opinion', icon: '🎲', max: 5, base: 80, growth: 1.55, desc: '+1 reroll per run per rank' },
  { id: 'insight', name: 'Insight', icon: '🔮', max: 1, base: 900, growth: 1, desc: 'See 4 upgrade choices instead of 3' },
  { id: 'phoenix', name: 'Phoenix Feather', icon: '🪶', max: 1, base: 750, growth: 1, desc: 'Revive once per run at 50% HP' },
  { id: 'extraArm', name: 'Extra Arm', icon: '🦾', max: 2, base: 600, growth: 2.5, desc: '+1 javelin per throw, from the start' },
];

// Upgrade cards that must be bought in the Armory before they show up in runs.
JJ.UNLOCKS = [
  { id: 'split', cost: 150 },
  { id: 'boomerang', cost: 200 },
  { id: 'lightning', cost: 300 },
  { id: 'orbit', cost: 350 },
  { id: 'rain', cost: 500 },
  { id: 'nova', cost: 650 },
];

JJ.Save = (() => {
  const KEY = 'johnny-javelins-save-v1';
  const fresh = () => ({
    gold: 0,
    meta: {},
    unlocks: {},
    stats: { runs: 0, wins: 0, bestTime: 0, bestLevel: 0, totalKills: 0, bossKills: 0, legendaries: {} },
    settings: { aim: 'auto', sound: true, damageNumbers: true, shake: true, quality: 'high' },
    johnny: JJ.defaultLook(),
  });

  let data = fresh();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const base = fresh();
        data = {
          ...base,
          ...parsed,
          stats: { ...base.stats, ...(parsed.stats || {}) },
          settings: { ...base.settings, ...(parsed.settings || {}) },
          meta: parsed.meta || {},
          johnny: { ...base.johnny, ...(parsed.johnny || {}) },
          unlocks: parsed.unlocks || {},
        };
      }
    } catch (e) {
      data = fresh();
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      /* storage unavailable (private mode) - progress lasts for this tab only */
    }
  }

  function metaLevel(id) {
    return data.meta[id] || 0;
  }

  function metaCost(def) {
    return Math.round(def.base * Math.pow(def.growth, metaLevel(def.id)));
  }

  function buyMeta(id) {
    const def = JJ.META.find((m) => m.id === id);
    if (!def || metaLevel(id) >= def.max) return false;
    const cost = metaCost(def);
    if (data.gold < cost) return false;
    data.gold -= cost;
    data.meta[id] = metaLevel(id) + 1;
    save();
    return true;
  }

  function buyUnlock(id) {
    const def = JJ.UNLOCKS.find((u) => u.id === id);
    if (!def || data.unlocks[id] || data.gold < def.cost) return false;
    data.gold -= def.cost;
    data.unlocks[id] = true;
    save();
    return true;
  }

  // Refund everything spent on permanent upgrades (unlocks stay).
  function refundMeta() {
    let refund = 0;
    for (const def of JJ.META) {
      const lvl = metaLevel(def.id);
      for (let i = 0; i < lvl; i++) refund += Math.round(def.base * Math.pow(def.growth, i));
    }
    data.meta = {};
    data.gold += refund;
    save();
    return refund;
  }

  function reset() {
    data = fresh();
    save();
  }

  load();

  return {
    get data() {
      return data;
    },
    save,
    metaLevel,
    metaCost,
    buyMeta,
    buyUnlock,
    refundMeta,
    reset,
    isUnlocked: (id) => !!data.unlocks[id],
  };
})();
