window.DCB = window.DCB || {};

DCB.ARTIFACT_LIBRARY = {
  reinforcedBuckler: {
    id: "reinforcedBuckler",
    name: "Reinforced Buckler",
    tier: "common",
    desc: "Whenever you gain Block from a Skill, gain +1 extra Block.",
  },
  trainingManual: {
    id: "trainingManual",
    name: "Training Manual",
    tier: "common",
    desc: "The first Attack you play each combat deals +6 damage.",
  },
  cushionedBoots: {
    id: "cushionedBoots",
    name: "Cushioned Boots",
    tier: "common",
    desc: "Start each combat with 6 Block.",
  },
  mirrorShield: {
    id: "mirrorShield",
    name: "Mirror Shield",
    tier: "common",
    desc: "The first time you gain 10 or more Block in a turn, apply 2 Poison to the enemy.",
  },
  bloodRuby: {
    id: "bloodRuby",
    name: "Blood Ruby",
    tier: "common",
    desc: "Whenever you heal in combat, deal 3 damage to the enemy.",
  },
  toxicNeedle: {
    id: "toxicNeedle",
    name: "Toxic Needle",
    tier: "common",
    desc: "Whenever you apply Poison to an enemy, apply +1 additional Poison.",
  },
  whetstoneCharm: {
    id: "whetstoneCharm",
    name: "Whetstone Charm",
    tier: "uncommon",
    desc: "When gained, upgrade all Strikes into Strike+.",
    onGain: (G) => {
      const upgraded = DCB.upgradeAllCardsById(G, "strike", "strikePlus");
      DCB.log(G, `Whetstone Charm upgrades ${upgraded} Strike${upgraded === 1 ? "" : "s"}.`, true);
    },
  },
  luckyThread: {
    id: "luckyThread",
    name: "Lucky Thread",
    tier: "uncommon",
    desc: "Draw 2 extra cards on the first turn of each combat.",
  },
  batteryStone: {
    id: "batteryStone",
    name: "Battery Stone",
    tier: "uncommon",
    desc: "Carry over up to 1 unused energy to your next turn.",
  },
  smithsEmber: {
    id: "smithsEmber",
    name: "Smith's Ember",
    tier: "uncommon",
    desc: "When gained and after every fight, upgrade a random upgradeable card.",
    onGain: (G) => {
      const result = DCB.upgradeRandomUpgradeableCard(G);
      if (result) {
        DCB.log(G, `Smith's Ember upgrades ${result.oldCard.name} to ${result.upgradedCard.name}.`, true);
      } else {
        DCB.log(G, "Smith's Ember finds no upgradeable cards.", true);
      }
    },
  },
  quietBell: {
    id: "quietBell",
    name: "Quiet Bell",
    tier: "uncommon",
    desc: "The first Skill you play each turn costs 1 less.",
  },
};

DCB.hasArtifact = function (G, id) {
  return G.artifacts.some(artifact => artifact.id === id);
};

DCB.getArtifactPoolByTier = function (G, tier) {
  return Object.values(DCB.ARTIFACT_LIBRARY)
    .filter(artifact => artifact.tier === tier && !DCB.hasArtifact(G, artifact.id));
};

DCB.artifactRewardChoices = function (G) {
  const commons = DCB.shuffle(DCB.getArtifactPoolByTier(G, "common")).slice(0, 2);
  const uncommons = DCB.shuffle(DCB.getArtifactPoolByTier(G, "uncommon")).slice(0, 1);
  return DCB.shuffle([...commons, ...uncommons]);
};

DCB.addArtifact = function (G, artifactId) {
  const artifact = DCB.ARTIFACT_LIBRARY[artifactId];
  if (!artifact || DCB.hasArtifact(G, artifactId)) return null;

  G.artifacts.push({ id: artifact.id, name: artifact.name, desc: artifact.desc });
  DCB.log(G, `You gain ${artifact.name}.`);

  if (artifact.onGain) {
    artifact.onGain(G);
  }

  return artifact;
};

DCB.resetArtifactCombatState = function (G) {
  G.artifactCombatState = {
    firstHeroTurn: true,
    trainingManualUsed: false,
  };
};

DCB.resetArtifactTurnState = function (G) {
  G.artifactTurnState = {
    heroBlockGained: 0,
    mirrorShieldTriggered: false,
    quietBellUsed: false,
  };
};

DCB.upgradeAllCardsById = function (G, fromId, toId) {
  let upgraded = 0;
  const zones = [G.deck, G.discard, G.hand];

  zones.forEach((zone) => {
    zone.forEach((card) => {
      if (card.id === fromId) {
        DCB.setCardToLibraryEntry(card, toId);
        upgraded += 1;
      }
    });
  });

  return upgraded;
};

DCB.upgradeRandomUpgradeableCard = function (G) {
  const upgradableCards = DCB.getAllDeckCards().filter(card => DCB.getUpgradedCardId(card.id));
  if (upgradableCards.length === 0) return null;

  const card = upgradableCards[Math.floor(Math.random() * upgradableCards.length)];
  return DCB.upgradeCardInstance(card.instanceId);
};
