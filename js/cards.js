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
  flurry: {
    id: "flurry",
    name: "Flurry",
    type: "Attack",
    cost: 1,
    desc: "Deal 2 damage for each card already played this turn.",
    play: (G) => DCB.dealDamage(G, "enemy", DCB.getCardsPlayedThisTurn(G) * 2),
  },
  tactician: {
    id: "tactician",
    name: "Tactician",
    type: "Skill",
    cost: 0,
    desc: "Draw 2 cards, then discard 1 card.",
    play: (G) => {
      DCB.drawCards(G, 2);
      DCB.log(G, "You draw 2 cards.", true);
      if (G.hand.length > 0) {
        DCB.showDiscardOneCardModal();
      } else {
        DCB.log(G, "No card to discard.", true);
      }
    },
  },
  masterTactician: {
    id: "masterTactician",
    name: "Master Tactician",
    type: "Skill",
    cost: 0,
    desc: "Draw 2 cards.",
    play: (G) => {
      DCB.drawCards(G, 2);
      DCB.log(G, "You draw 2 cards.", true);
    },
  },
  adrenaline: {
    id: "adrenaline",
    name: "Adrenaline",
    type: "Skill",
    cost: 0,
    desc: "Gain 1 energy. Becomes Exhausted for the rest of battle.",
    play: (G, card) => {
      G.energy += 1;
      DCB.log(G, "You gain 1 energy.", true);

      if (card) {
        DCB.setCardToLibraryEntry(card, "exhausted");
        card.resetsTo = "adrenaline";
      }
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
  poisonBlade: {
    id: "poisonBlade",
    name: "Poison Blade",
    type: "Attack",
    cost: 1,
    desc: "Deal 4 damage. Apply 5 Poison.",
    play: (G) => {
      DCB.dealDamage(G, "enemy", 4);
      if (G.over) return;
      DCB.applyPoison(G, "enemy", 5);
    },
  },
  poisonMaster: {
    id: "poisonMaster",
    name: "Poison Master",
    type: "Skill",
    cost: 0,
    desc: "Once per battle: Double the enemy's Poison. Becomes Own Medicine for the rest of battle.",
    play: (G, card) => {
      if (G.enemy.poison === 0) {
        DCB.log(G, `${G.enemy.name} has no Poison to double.`, true);
      } else {
        const addedPoison = G.enemy.poison;
        G.enemy.poison = DCB.clamp(G.enemy.poison * 2, 0, 999);
        DCB.log(G, `Poison Master adds ${addedPoison} Poison to ${G.enemy.name}.`);
      }

      if (card) {
        DCB.setCardToLibraryEntry(card, "ownMedicine");
        card.resetsTo = "poisonMaster";
      }
    },
  },
  shieldBash: {
    id: "shieldBash",
    name: "Shield Bash",
    type: "Attack",
    cost: 1,
    desc: "Deal damage equal to your current Block.",
    play: (G) => DCB.dealDamage(G, "enemy", G.hero.block),
  },
  barricade: {
    id: "barricade",
    name: "Barricade",
    type: "Skill",
    cost: 1,
    desc: "Gain 3 Block. Retain any unused Block for next turn.",
    play: (G) => {
      DCB.gainBlock(G, "hero", 3);
      G.artifactCombatState.retainBlockNextTurn = true;
      DCB.log(G, "You will retain unused Block next turn.", true);
    },
  },
  barricadePlus: {
    id: "barricadePlus",
    name: "Barricade+",
    type: "Skill",
    cost: 0,
    desc: "Gain 4 Block. Retain any unused Block for next turn.",
    play: (G) => {
      DCB.gainBlock(G, "hero", 4);
      G.artifactCombatState.retainBlockNextTurn = true;
      DCB.log(G, "You will retain unused Block next turn.", true);
    },
  },
  ownMedicine: {
    id: "ownMedicine",
    name: "Own Medicine",
    type: "Skill",
    cost: 0,
    desc: "Deal 1 damage to yourself.",
    mustPlayBeforeEndTurn: true,
    play: (G) => {
      DCB.dealDamage(G, "hero", 1, { ignoreStrength: true });
    },
  },
  exhausted: {
    id: "exhausted",
    name: "Exhausted",
    type: "Skill",
    cost: 0,
    desc: "Cannot be played.",
    unplayable: true,
    play: () => {},
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
    cost: 2,
    desc: "Once per battle: Gain +1 Strength. Becomes Tranquility for the rest of battle.",
    play: (G, card) => {
      G.hero.strength += 1;
      DCB.log(G, "You focus. +1 Strength.");

      if (card) {
        DCB.setCardToLibraryEntry(card, "tranquility");
        card.resetsTo = "focus";
      }
    },
  },
  tranquility: {
    id: "tranquility",
    name: "Tranquility",
    type: "Skill",
    cost: 0,
    desc: "Restore 1 HP.",
    play: (G) => {
      DCB.healTarget(G, "hero", 1);
      DCB.log(G, "Tranquility settles over you.", true);
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
  antivenom: {
    id: "antivenom",
    name: "Antivenom",
    type: "Skill",
    cost: 0,
    desc: "Remove up to 5 Poison.",
    play: (G) => {
      if (G.hero.poison === 0) {
        DCB.log(G, "No poison to remove.", true);
        return;
      }
      const removed = Math.min(5, G.hero.poison);
      G.hero.poison -= removed;
      DCB.log(G, `You remove ${removed} Poison.`);
    },
  },
};
