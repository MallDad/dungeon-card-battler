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
  hero: { hp: 50, maxHp: 50, block: 0, poison: 0, strength: 0, nextTurnEnergy: 0 },
  enemy: { name: "Goblin", hp: 30, maxHp: 30, block: 0, poison: 0, strength: 0 },
  enemyIntent: null,
  over: false,
  map: [],
  currentMapRow: -1,
  currentMapNodeId: null,
  runComplete: false,
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

DCB.applyPoison = function (G, who, amount) {
  const target = who === "hero" ? G.hero : G.enemy;
  target.poison = DCB.clamp(target.poison + amount, 0, 999);
  DCB.log(G, `${who === "hero" ? "You" : G.enemy.name} gain${amount === 1 ? "s" : ""} ${amount} Poison.`);
};

DCB.gainBlock = function (G, who, amount) {
  const target = who === "hero" ? G.hero : G.enemy;
  target.block = DCB.clamp(target.block + amount, 0, 999);
  DCB.log(G, `${who === "hero" ? "You" : G.enemy.name} gain${amount === 1 ? "s" : ""} ${amount} Block.`);
};

DCB.healTarget = function (G, who, amount) {
  const target = who === "hero" ? G.hero : G.enemy;
  const before = target.hp;
  target.hp = DCB.clamp(target.hp + amount, 0, target.maxHp);
  const healed = target.hp - before;
  DCB.log(G, `${who === "hero" ? "You" : G.enemy.name} heal${healed === 1 ? "s" : ""} ${healed} HP.`);
};

DCB.dealDamage = function (G, who, baseAmount) {
  const attacker = who === "enemy" ? G.hero : G.enemy;
  const target = who === "enemy" ? G.enemy : G.hero;
  const amount = Math.max(0, baseAmount + (attacker.strength || 0));

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
  G.energy = G.maxEnergy + (G.hero.nextTurnEnergy || 0);

  if (G.hero.nextTurnEnergy > 0) {
    DCB.log(G, `You gain +${G.hero.nextTurnEnergy} bonus energy this turn.`, true);
    G.hero.nextTurnEnergy = 0;
  }

  G.hero.block = 0;
  DCB.log(G, "— Your turn —", true);

  DCB.startOfTurnPoison(G, "hero");
  if (G.over) return;

  DCB.drawCards(G, 5);
  G.enemyIntent = DCB.rollEnemyIntent(G);
  DCB.renderAll();
};

DCB.endHeroTurn = function (G) {
  if (G.over || G.turn !== "hero") return;
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

  if (card.cost > G.energy) {
    DCB.log(G, `Not enough energy to play ${card.name}.`, true);
    return;
  }

  G.energy -= card.cost;
  G.hand.splice(idx, 1);
  G.discard.push(card);

  DCB.log(G, `You play ${card.name}.`);
  card.play(G, card);

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

    DCB.showRewardModal(DCB.rewardChoices(rewardCount));
  } else {
    DCB.log(G, `💀 You were defeated on Map Row ${G.floor}.`);
    document.getElementById("endTurnBtn").disabled = true;
    G.runComplete = true;
  }

  DCB.renderAll();
};

DCB.renderAll = function () {
  document.getElementById("floorText").textContent = `Map Row ${Math.max(0, DCB.G.floor)}`;
  document.getElementById("goldText").textContent = `Gold: ${DCB.G.gold}`;
  document.getElementById("energyText").textContent = `Energy: ${DCB.G.energy}/${DCB.G.maxEnergy}`;
  document.getElementById("deckText").textContent = `Deck: ${DCB.G.deck.length}`;
  document.getElementById("discardText").textContent = `Discard: ${DCB.G.discard.length}`;

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

  const inCombat = DCB.G.nodeType === "fight" || DCB.G.nodeType === "elite" || DCB.G.nodeType === "boss";

  document.getElementById("intentText").textContent =
    inCombat
      ? ((DCB.G.enemyIntent && !DCB.G.over) ? DCB.G.enemyIntent.label : (DCB.G.over ? "Battle ended" : "—"))
      : "No enemy here";

  document.getElementById("endTurnBtn").disabled =
    (DCB.G.over || DCB.G.turn !== "hero" || !inCombat || DCB.G.runComplete);

  const handEl = document.getElementById("hand");
  handEl.innerHTML = "";

  DCB.G.hand.forEach((card, idx) => {
    const canPlay = (!DCB.G.over && DCB.G.turn === "hero" && card.cost <= DCB.G.energy);
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
  DCB.G.hero = { hp: 50, maxHp: 50, block: 0, poison: 0, strength: 0, nextTurnEnergy: 0 };
  DCB.G.enemy = { name: "No Enemy", hp: 1, maxHp: 1, block: 0, poison: 0, strength: 0 };
  DCB.G.enemyIntent = null;
  DCB.G.over = false;
  DCB.G.map = DCB.generateMapFromTemplate();
  DCB.G.currentMapRow = -1;
  DCB.G.currentMapNodeId = null;
  DCB.G.runComplete = false;

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
