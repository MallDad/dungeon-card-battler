window.DCB = window.DCB || {};

DCB.nextCardInstanceId = 1;

DCB.makeCard = function (id) {
  return {
    ...DCB.CARD_LIBRARY[id],
    instanceId: DCB.nextCardInstanceId++
  };
};

DCB.setCardToLibraryEntry = function (card, id) {
  const baseCard = DCB.CARD_LIBRARY[id];
  if (!baseCard) return card;

  card.id = baseCard.id;
  card.name = baseCard.name;
  card.type = baseCard.type;
  card.cost = baseCard.cost;
  card.desc = baseCard.desc;
  card.play = baseCard.play;

  return card;
};

DCB.G = {
  floor: 0,
  nodeType: "start",
  turn: "hero",
  energy: 3,
  maxEnergy: 3,
  gold: 50,
  deck: [],
  discard: [],
  hand: [],
  artifacts: [],
  artifactCombatState: { firstHeroTurn: true, trainingManualUsed: false },
  artifactTurnState: { heroBlockGained: 0, mirrorShieldTriggered: false, quietBellUsed: false },
  currentPlayingCard: null,
  hero: { hp: 50, maxHp: 50, block: 0, poison: 0, strength: 0, nextTurnEnergy: 0 },
  enemy: { name: "Goblin", hp: 30, maxHp: 30, block: 0, poison: 0, strength: 0 },
  enemyIntent: null,
  over: false,
  map: [],
  currentMapRow: -1,
  currentMapNodeId: null,
  runComplete: false,
  statsReported: false,
};

DCB.log = function (G, msg, muted = false) {
  const logBox = document.getElementById("log");
  const p = document.createElement("p");
  p.textContent = msg;
  if (muted) p.classList.add("muted");
  logBox.appendChild(p);
  logBox.scrollTop = logBox.scrollHeight;
};

DCB.closeOverlay = function () {
  const existing = document.getElementById("overlay");
  if (existing) existing.remove();
};

DCB.isCombatNode = function (nodeType) {
  return nodeType === "fight" || nodeType === "elite" || nodeType === "boss";
};

DCB.applyPoison = function (G, who, amount) {
  const target = who === "hero" ? G.hero : G.enemy;
  let poisonAmount = amount;

  if (who === "enemy" && DCB.hasArtifact(G, "toxicNeedle")) {
    poisonAmount += 1;
    DCB.log(G, "Toxic Needle adds +1 Poison.", true);
  }

  target.poison = DCB.clamp(target.poison + poisonAmount, 0, 999);
  DCB.log(G, `${who === "hero" ? "You" : G.enemy.name} gain${poisonAmount === 1 ? "s" : ""} ${poisonAmount} Poison.`);
};

DCB.gainBlock = function (G, who, amount) {
  const target = who === "hero" ? G.hero : G.enemy;
  let blockAmount = amount;

  if (
    who === "hero" &&
    G.currentPlayingCard &&
    G.currentPlayingCard.type === "Skill" &&
    DCB.hasArtifact(G, "reinforcedBuckler")
  ) {
    blockAmount += 1;
    DCB.log(G, "Reinforced Buckler adds +1 Block.", true);
  }

  target.block = DCB.clamp(target.block + blockAmount, 0, 999);
  DCB.log(G, `${who === "hero" ? "You" : G.enemy.name} gain${blockAmount === 1 ? "s" : ""} ${blockAmount} Block.`);

  if (who === "hero" && G.turn === "hero") {
    G.artifactTurnState.heroBlockGained += blockAmount;

    if (
      DCB.hasArtifact(G, "mirrorShield") &&
      !G.artifactTurnState.mirrorShieldTriggered &&
      G.artifactTurnState.heroBlockGained >= 11 &&
      !G.over
    ) {
      G.artifactTurnState.mirrorShieldTriggered = true;
      DCB.log(G, "Mirror Shield applies 2 Poison.", true);
      DCB.applyPoison(G, "enemy", 2);
    }
  }
};

DCB.healTarget = function (G, who, amount) {
  const target = who === "hero" ? G.hero : G.enemy;
  const before = target.hp;
  target.hp = DCB.clamp(target.hp + amount, 0, target.maxHp);
  const healed = target.hp - before;
  DCB.log(G, `${who === "hero" ? "You" : G.enemy.name} heal${healed === 1 ? "s" : ""} ${healed} HP.`);

  if (
    who === "hero" &&
    healed > 0 &&
    DCB.hasArtifact(G, "bloodRuby") &&
    DCB.isCombatNode(G.nodeType) &&
    !G.over
  ) {
    DCB.log(G, "Blood Ruby lashes out for 3 damage.", true);
    DCB.dealDamage(G, "enemy", 3, { ignoreStrength: true });
  }
};

DCB.dealDamage = function (G, who, baseAmount, options = {}) {
  const attacker = who === "enemy" ? G.hero : G.enemy;
  const target = who === "enemy" ? G.enemy : G.hero;
  let damageBonus = 0;

  if (
    who === "enemy" &&
    G.currentPlayingCard &&
    G.currentPlayingCard.type === "Attack" &&
    DCB.hasArtifact(G, "trainingManual") &&
    !G.artifactCombatState.trainingManualUsed
  ) {
    damageBonus += 4;
    G.artifactCombatState.trainingManualUsed = true;
    DCB.log(G, "Training Manual adds +4 damage.", true);
  }

  const strengthBonus = options.ignoreStrength ? 0 : (attacker.strength || 0);
  const amount = Math.max(0, baseAmount + damageBonus + strengthBonus);

  if (amount === 0) {
    DCB.log(G, "No damage dealt.", true);
    return;
  }

  const blocked = Math.min(target.block, amount);
  target.block -= blocked;
  const remaining = amount - blocked;

  if (remaining > 0) {
    target.hp = DCB.clamp(target.hp - remaining, 0, target.maxHp);
  }

  const attackerName = who === "enemy" ? "You" : G.enemy.name;
  const targetName = who === "enemy" ? G.enemy.name : "you";

  let msg = `${attackerName} deal${attackerName === "You" ? "" : "s"} ${amount} damage to ${targetName}.`;
  if (blocked > 0) msg += ` (${blocked} blocked)`;
  DCB.log(G, msg);

  if (target.hp <= 0) {
    DCB.endBattle(G, who === "enemy" ? "win" : "lose");
  }
};

DCB.startOfTurnPoison = function (G, who) {
  const target = who === "hero" ? G.hero : G.enemy;
  if (target.poison > 0) {
    const dmg = target.poison;
    target.hp = DCB.clamp(target.hp - dmg, 0, target.maxHp);
    DCB.log(G, `${who === "hero" ? "You" : G.enemy.name} take${dmg === 1 ? "s" : ""} ${dmg} poison damage.`);
    target.poison = Math.max(0, target.poison - 1);

    if (target.hp <= 0) {
      DCB.endBattle(G, who === "enemy" ? "win" : "lose");
    }
  }
};

DCB.makeStarterDeck = function () {
  const ids = [
    "strike", "strike", "strike", "strike", "strike",
    "defend", "defend", "defend", "defend", "defend",
    "quickStab",
    "poisonDart",
    "heal"
  ];
  return DCB.shuffle(ids.map(id => DCB.makeCard(id)));
};

DCB.getCurrentDeckSize = function () {
  return DCB.G.deck.length + DCB.G.discard.length + DCB.G.hand.length;
};

DCB.formatPercent = function (value) {
  return Number.isFinite(value) ? `${Number(value).toFixed(1)}%` : "--";
};

DCB.formatNumber = function (value) {
  return Number.isFinite(value) ? Number(value).toLocaleString() : "--";
};

DCB.formatDecimal = function (value) {
  return Number.isFinite(value) ? Number(value).toFixed(1) : "--";
};

DCB.createFinalStatsSection = function (won) {
  const deckSize = DCB.getCurrentDeckSize();
  const section = document.createElement("div");
  section.className = "finalStats";
  section.innerHTML = `
    <div class="finalStatsHeader">Global Run Stats</div>
    <div class="finalStatsGrid">
      <div class="statTile">
        <div class="statLabel">Number of runs</div>
        <div class="statValue" data-stat="runs">...</div>
      </div>
      <div class="statTile">
        <div class="statLabel">Win ratio</div>
        <div class="statValue" data-stat="winRatio">...</div>
      </div>
      <div class="statTile">
        <div class="statLabel">Average winning deck size</div>
        <div class="statValue" data-stat="averageWinningDeckSize">...</div>
      </div>
      <div class="statTile yourStat">
        <div class="statLabel">Your deck size</div>
        <div class="statValue">${deckSize}</div>
      </div>
    </div>
    <div class="mini" data-stat="status">Reporting this run...</div>
  `;

  DCB.reportCompletedRun(won, deckSize, section);
  return section;
};

DCB.renderGlobalStats = function (section, stats) {
  section.querySelector('[data-stat="runs"]').textContent = DCB.formatNumber(stats.runs);
  section.querySelector('[data-stat="winRatio"]').textContent = DCB.formatPercent(stats.winRatio);
  section.querySelector('[data-stat="averageWinningDeckSize"]').textContent =
    stats.averageWinningDeckSize === null ? "--" : DCB.formatDecimal(stats.averageWinningDeckSize);
};

DCB.reportCompletedRun = async function (won, deckSize, section) {
  const status = section.querySelector('[data-stat="status"]');

  if (DCB.G.statsReported) {
    status.textContent = "Run already reported.";
    return;
  }

  try {
    const response = await fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ won, deckSize })
    });

    if (!response.ok) throw new Error("Stats request failed.");

    const stats = await response.json();
    DCB.G.statsReported = true;
    DCB.renderGlobalStats(section, stats);
    status.textContent = "Includes this completed run.";
  } catch (error) {
    status.textContent = "Global stats are unavailable right now.";
  }
};

DCB.drawCards = function (G, n) {
  for (let i = 0; i < n; i++) {
    if (G.deck.length === 0) {
      if (G.discard.length === 0) break;
      G.deck = DCB.shuffle(G.discard);
      G.discard = [];
      DCB.log(G, "Shuffled discard into deck.", true);
    }
    const card = G.deck.pop();
    if (card) G.hand.push(card);
  }
};

DCB.discardHand = function (G) {
  while (G.hand.length) {
    G.discard.push(G.hand.pop());
  }
};

DCB.rollEnemyIntent = function (G) {
  const f = Math.max(1, G.floor);
  const attackBase = 6 + Math.floor((f - 1) * 1.5);
  const bigAttack = 10 + Math.floor((f - 1) * 2);
  const blockAmt = 6 + Math.floor((f - 1) * 1.2);
  const poisonAmt = 2 + Math.floor((f - 1) * 0.6);

  const options = [
    { type: "attack", label: `Attack (${attackBase})`, do: () => DCB.dealDamage(G, "hero", attackBase), w: 5 },
    { type: "block", label: `Guard (+${blockAmt} Block)`, do: () => DCB.gainBlock(G, "enemy", blockAmt), w: 3 },
    { type: "big", label: `Heavy Hit (${bigAttack})`, do: () => DCB.dealDamage(G, "hero", bigAttack), w: 2 },
    {
      type: "poison",
      label: `Toxic Jab (4 + ${poisonAmt} Poison)`,
      do: () => {
        DCB.dealDamage(G, "hero", 4);
        if (!G.over) DCB.applyPoison(G, "hero", poisonAmt);
      },
      w: 3
    },
  ];

  const total = options.reduce((sum, option) => sum + option.w, 0);
  let r = Math.random() * total;
  for (const option of options) {
    r -= option.w;
    if (r <= 0) return option;
  }
  return options[0];
};

DCB.startHeroTurn = function (G) {
  G.turn = "hero";
  DCB.resetArtifactTurnState(G);
  G.energy = G.maxEnergy + (G.hero.nextTurnEnergy || 0);

  if (G.hero.nextTurnEnergy > 0) {
    DCB.log(G, `You gain +${G.hero.nextTurnEnergy} bonus energy this turn.`, true);
    G.hero.nextTurnEnergy = 0;
  }

  G.hero.block = 0;
  DCB.log(G, "— Your turn —", true);

  if (G.artifactCombatState.firstHeroTurn && DCB.hasArtifact(G, "cushionedBoots")) {
    DCB.gainBlock(G, "hero", 4);
  }

  DCB.startOfTurnPoison(G, "hero");
  if (G.over) return;

  DCB.drawCards(G, G.artifactCombatState.firstHeroTurn && DCB.hasArtifact(G, "luckyThread") ? 6 : 5);
  if (G.artifactCombatState.firstHeroTurn && DCB.hasArtifact(G, "luckyThread")) {
    DCB.log(G, "Lucky Thread draws 1 extra card.", true);
  }
  G.artifactCombatState.firstHeroTurn = false;

  G.enemyIntent = DCB.rollEnemyIntent(G);
  DCB.renderAll();
};

DCB.endHeroTurn = function (G) {
  if (G.over || G.turn !== "hero") return;
  if (DCB.hasArtifact(G, "batteryStone") && G.energy > 0) {
    const carriedEnergy = Math.min(1, G.energy);
    G.hero.nextTurnEnergy = (G.hero.nextTurnEnergy || 0) + carriedEnergy;
    DCB.log(G, `Battery Stone carries ${carriedEnergy} unused energy forward.`, true);
  }

  DCB.discardHand(G);
  G.turn = "enemy";
  DCB.renderAll();
  DCB.enemyTurn(G);
};

DCB.enemyTurn = function (G) {
  if (G.over) return;

  DCB.log(G, `— ${G.enemy.name}'s turn —`, true);

  G.enemy.block = 0;
  DCB.startOfTurnPoison(G, "enemy");
  if (G.over) return;

  if (!G.enemyIntent) {
    G.enemyIntent = DCB.rollEnemyIntent(G);
  }

  DCB.log(G, `${G.enemy.name} uses: ${G.enemyIntent.label}`);
  G.enemyIntent.do();

  if (!G.over) {
    G.enemyIntent = DCB.rollEnemyIntent(G);
  }

  if (!G.over) {
    DCB.startHeroTurn(G);
  }
};

DCB.playCardAtIndex = function (G, idx) {
  if (G.over || G.turn !== "hero") return;

  const card = G.hand[idx];
  if (!card) return;

  let cardCost = card.cost;
  const quietBellDiscount =
    card.type === "Skill" &&
    DCB.hasArtifact(G, "quietBell") &&
    !G.artifactTurnState.quietBellUsed &&
    cardCost > 0;

  if (quietBellDiscount) {
    cardCost -= 1;
  }

  if (cardCost > G.energy) {
    DCB.log(G, `Not enough energy to play ${card.name}.`, true);
    return;
  }

  G.energy -= cardCost;
  G.hand.splice(idx, 1);
  G.discard.push(card);

  DCB.log(G, `You play ${card.name}.`);
  if (quietBellDiscount) {
    G.artifactTurnState.quietBellUsed = true;
    DCB.log(G, "Quiet Bell reduces its cost by 1.", true);
  }

  G.currentPlayingCard = card;
  card.play(G, card);
  G.currentPlayingCard = null;

  if (G.over) {
    DCB.renderAll();
    return;
  }

  DCB.renderAll();
};

DCB.makeEnemyForNode = function (nodeType, mapRow) {
  const baseNames = ["Goblin", "Skeleton", "Bandit", "Cultist", "Wraith"];
  const eliteNames = ["Brute", "Assassin", "Guardian", "Warlock", "Executioner"];
  const f = mapRow + 1;

  if (nodeType === "boss") {
    let hp = 90 + f * 8;
    return {
      name: "Dungeon Boss",
      hp,
      maxHp: hp,
      block: 0,
      poison: 0,
      strength: 3 + Math.floor(f / 2)
    };
  }

  const isElite = nodeType === "elite";
  const name = isElite
    ? `Elite ${eliteNames[(f - 1) % eliteNames.length]}`
    : baseNames[(f - 1) % baseNames.length];

  let hp = 26 + Math.floor(f * 6) + DCB.rng(-2, 4);
  let strength = Math.floor((f - 1) / 3);

  if (isElite) {
    hp = Math.floor(hp * 1.4);
    strength += 1;
  }

  return {
    name,
    hp,
    maxHp: hp,
    block: 0,
    poison: 0,
    strength
  };
};

DCB.endBattle = function (G, result) {
  if (G.over) return;
  G.over = true;

  if (result === "win") {
    let goldEarned = 15 + Math.floor(G.floor * 2);
    let rewardCount = 3;

    if (G.nodeType === "elite") {
      goldEarned = 30 + Math.floor(G.floor * 3);
      rewardCount = 5;
    } else if (G.nodeType === "boss") {
      goldEarned = 75 + Math.floor(G.floor * 5);
      rewardCount = 5;
    }

    G.gold += goldEarned;

    DCB.log(G, `✅ You defeated the ${G.enemy.name}!`);
    DCB.log(G, `You gain ${goldEarned} gold.`, true);

    const healAmt = 6 + Math.floor(G.floor * 0.5);
    G.hero.hp = DCB.clamp(G.hero.hp + healAmt, 0, G.hero.maxHp);
    DCB.log(G, `You catch your breath and heal ${healAmt} HP.`, true);

    if (DCB.hasArtifact(G, "smithsEmber")) {
      const result = DCB.upgradeRandomUpgradeableCard(G);
      if (result) {
        DCB.log(G, `Smith's Ember upgrades ${result.oldCard.name} to ${result.upgradedCard.name}.`, true);
      } else {
        DCB.log(G, "Smith's Ember finds no upgradeable cards.", true);
      }
    }

    if (G.nodeType === "boss") {
      G.runComplete = true;
      DCB.showVictoryModal();
    } else if (G.nodeType === "elite") {
      DCB.showArtifactRewardModal(DCB.artifactRewardChoices(G));
    } else {
      DCB.showRewardModal(DCB.rewardChoices(rewardCount));
    }
  } else {
    DCB.log(G, `💀 You were defeated on Map Row ${G.floor}.`);
    document.getElementById("endTurnBtn").disabled = true;
    G.runComplete = true;
    DCB.showDefeatModal();
  }

  DCB.renderAll();
};

DCB.renderAll = function () {
  document.getElementById("floorText").textContent = `Map Row ${Math.max(0, DCB.G.floor)}`;
  document.getElementById("goldText").textContent = `Gold: ${DCB.G.gold}`;
  document.getElementById("energyText").textContent = `Energy: ${DCB.G.energy}/${DCB.G.maxEnergy}`;
  document.getElementById("deckText").textContent = `Deck: ${DCB.G.deck.length}`;
  document.getElementById("discardText").textContent = `Discard: ${DCB.G.discard.length}`;
  document.getElementById("artifactText").textContent = `Artifacts: ${DCB.G.artifacts.length}`;

  const nodeEl = document.getElementById("nodeText");
  nodeEl.textContent = DCB.nodeLabel(DCB.G.nodeType);
  nodeEl.className = `badge ${DCB.nodeBadgeClass(DCB.G.nodeType)}`;

  document.getElementById("heroHpText").textContent = `HP: ${DCB.G.hero.hp}/${DCB.G.hero.maxHp} (Str ${DCB.G.hero.strength})`;
  document.getElementById("heroBlockText").textContent = `Block: ${DCB.G.hero.block}`;
  document.getElementById("heroPoisonText").textContent = `Poison: ${DCB.G.hero.poison}`;
  document.getElementById("heroHpFill").style.width = `${DCB.clamp((DCB.G.hero.hp / DCB.G.hero.maxHp) * 100, 0, 100)}%`;

  document.getElementById("enemyHpText").textContent = `${DCB.G.enemy.name} HP: ${DCB.G.enemy.hp}/${DCB.G.enemy.maxHp} (Str ${DCB.G.enemy.strength})`;
  document.getElementById("enemyBlockText").textContent = `Block: ${DCB.G.enemy.block}`;
  document.getElementById("enemyPoisonText").textContent = `Poison: ${DCB.G.enemy.poison}`;
  document.getElementById("enemyHpFill").style.width = `${DCB.clamp((DCB.G.enemy.hp / DCB.G.enemy.maxHp) * 100, 0, 100)}%`;

  const inCombat = DCB.isCombatNode(DCB.G.nodeType);

  document.getElementById("intentText").textContent =
    inCombat
      ? ((DCB.G.enemyIntent && !DCB.G.over) ? DCB.G.enemyIntent.label : (DCB.G.over ? "Battle ended" : "—"))
      : "No enemy here";

  document.getElementById("endTurnBtn").disabled =
    (DCB.G.over || DCB.G.turn !== "hero" || !inCombat || DCB.G.runComplete);

  const artifactShelf = document.getElementById("artifactShelf");
  artifactShelf.innerHTML = "";
  DCB.G.artifacts.forEach((artifact) => {
    artifactShelf.appendChild(DCB.el("div", {
      class: "artifactPill",
      title: artifact.desc,
      text: artifact.name
    }));
  });

  const handEl = document.getElementById("hand");
  handEl.innerHTML = "";

  DCB.G.hand.forEach((card, idx) => {
    const cardCost =
      card.type === "Skill" &&
      DCB.hasArtifact(DCB.G, "quietBell") &&
      !DCB.G.artifactTurnState.quietBellUsed &&
      card.cost > 0
        ? card.cost - 1
        : card.cost;
    const canPlay = (!DCB.G.over && DCB.G.turn === "hero" && cardCost <= DCB.G.energy);
    const tagClass = card.type.toLowerCase();

    const node = DCB.el("div", {
    class: "card " + tagClass + (canPlay ? "" : " disabled"),
    title: canPlay ? "Click to play" : "Not enough energy"
    });
        
    node.appendChild(DCB.el("div", { class: "tag " + tagClass, text: card.type }));
    node.appendChild(DCB.el("div", { class: "top" }, [
      DCB.el("div", { class: "cost", text: String(card.cost) }),
      DCB.el("div", {}, [
        DCB.el("div", { class: "cname", text: card.name }),
        DCB.el("div", { class: "ctype", text: "Card" })
      ])
    ]));
    node.appendChild(DCB.el("div", { class: "desc", text: card.desc }));

    node.addEventListener("click", () => {
      if (canPlay) DCB.playCardAtIndex(DCB.G, idx);
    });

    handEl.appendChild(node);
  });
};

DCB.newRun = function () {
  DCB.closeOverlay();

  DCB.G.floor = 0;
  DCB.G.nodeType = "start";
  DCB.G.turn = "hero";
  DCB.G.energy = 3;
  DCB.G.maxEnergy = 3;
  DCB.G.gold = 50;
  DCB.G.deck = DCB.makeStarterDeck();
  DCB.G.discard = [];
  DCB.G.hand = [];
  DCB.G.artifacts = [];
  DCB.G.currentPlayingCard = null;
  DCB.resetArtifactCombatState(DCB.G);
  DCB.resetArtifactTurnState(DCB.G);
  DCB.G.hero = { hp: 50, maxHp: 50, block: 0, poison: 0, strength: 0, nextTurnEnergy: 0 };
  DCB.G.enemy = { name: "No Enemy", hp: 1, maxHp: 1, block: 0, poison: 0, strength: 0 };
  DCB.G.enemyIntent = null;
  DCB.G.over = false;
  DCB.G.map = DCB.generateMapFromTemplate();
  DCB.G.currentMapRow = -1;
  DCB.G.currentMapNodeId = null;
  DCB.G.runComplete = false;
  DCB.G.statsReported = false;

  const logBox = document.getElementById("log");
  logBox.innerHTML = "";
  DCB.log(DCB.G, "Welcome to the Dungeon Card Battler!", true);
  DCB.log(DCB.G, "Choose your path on the dungeon map.", true);

  DCB.showMapModal();
  DCB.renderAll();
};

document.addEventListener("DOMContentLoaded", () => {
  const endTurnBtn = document.getElementById("endTurnBtn");
  const newRunBtn = document.getElementById("newRunBtn");
  const showMapBtn = document.getElementById("showMapBtn");

  endTurnBtn.addEventListener("click", () => DCB.endHeroTurn(DCB.G));
  newRunBtn.addEventListener("click", () => DCB.newRun());
  showMapBtn.addEventListener("click", () => DCB.showMapModal());
  window.addEventListener("resize", DCB.rerenderOpenMapOnResize);

  DCB.newRun();
  DCB.renderAll();
});
