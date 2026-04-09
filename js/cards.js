window.DCB = window.DCB || {};

DCB.CARD_LIBRARY = {
  strike: {
    id: "strike",
    name: "Strike",
    type: "Attack",
    cost: 1,
    desc: "Deal 6 damage.",
    play: (G) => DCB.dealDamage(G, "enemy", 6),
  },
  defend: {
    id: "defend",
    name: "Defend",
    type: "Skill",
    cost: 1,
    desc: "Gain 5 Block.",
    play: (G) => DCB.gainBlock(G, "hero", 5),
  },
  strikePlus: {
    id: "strikePlus",
    name: "Strike+",
    type: "Attack",
    cost: 1,
    desc: "Deal 8 damage.",
    play: (G) => DCB.dealDamage(G, "enemy", 8),
  },
  defendPlus: {
    id: "defendPlus",
    name: "Defend+",
    type: "Skill",
    cost: 1,
    desc: "Gain 7 Block.",
    play: (G) => DCB.gainBlock(G, "hero", 7),
  },
  fireball: {
    id: "fireball",
    name: "Fireball",
    type: "Attack",
    cost: 2,
    desc: "Deal 12 damage. Gain 1 energy next turn.",
    play: (G) => {
      DCB.dealDamage(G, "enemy", 12);
      if (G.over) return;
      G.hero.nextTurnEnergy = (G.hero.nextTurnEnergy || 0) + 1;
      DCB.log(G, "You will gain +1 energy next turn.");
    },
  },
  quickStab: {
    id: "quickStab",
    name: "Quick Stab",
    type: "Attack",
    cost: 0,
    desc: "Deal 3 damage.",
    play: (G) => DCB.dealDamage(G, "enemy", 3),
  },

  quickStabPlus: {
    id: "quickStabPlus",
    name: "Quick Stab+",
    type: "Attack",
    cost: 0,
    desc: "Deal 3 damage. Draw 1 card.",
    play: (G) => {
      DCB.dealDamage(G, "enemy", 3);
      if (G.over) return;
      DCB.drawCards(G, 1);
      DCB.log(G, "You draw 1 card.", true);
    },
  },

  poisonDart: {
    id: "poisonDart",
    name: "Poison Dart",
    type: "Attack",
    cost: 1,
    desc: "Deal 4 damage. Apply 3 Poison.",
    play: (G) => {
      DCB.dealDamage(G, "enemy", 4);
      if (G.over) return;
      DCB.applyPoison(G, "enemy", 3);
    },
  },
  heal: {
    id: "heal",
    name: "Bandage",
    type: "Skill",
    cost: 1,
    desc: "Heal 6 HP (can’t exceed max HP).",
    play: (G) => DCB.healTarget(G, "hero", 6),
  },
  bigShield: {
    id: "bigShield",
    name: "Iron Wall",
    type: "Skill",
    cost: 2,
    desc: "Gain 15 Block.",
    play: (G) => DCB.gainBlock(G, "hero", 15),
  },
  focus: {
    id: "focus",
    name: "Focus",
    type: "Power",
    cost: 1,
    desc: "Gain +1 Strength (your attacks deal +1 damage each).",
    play: (G) => {
      G.hero.strength += 1;
      DCB.log(G, "You focus. +1 Strength.");
    },
  },
  antidote: {
    id: "antidote",
    name: "Antidote",
    type: "Skill",
    cost: 1,
    desc: "Remove up to 3 Poison.",
    play: (G) => {
      if (G.hero.poison === 0) {
        DCB.log(G, "No poison to remove.", true);
        return;
      }
      const removed = Math.min(3, G.hero.poison);
      G.hero.poison -= removed;
      DCB.log(G, `You remove ${removed} Poison.`);
    },
  },
};