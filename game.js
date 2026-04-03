(() => {
  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function rng(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children) {
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }

  let nextCardInstanceId = 1;
  let mapResizeTimer = null;

  function makeCard(id) {
    return {
      ...CARD_LIBRARY[id],
      instanceId: nextCardInstanceId++
    };
  }

  function log(G, msg, muted = false) {
    const logBox = document.getElementById("log");
    const p = document.createElement("p");
    p.textContent = msg;
    if (muted) p.classList.add("muted");
    logBox.appendChild(p);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function closeOverlay() {
    const existing = document.getElementById("overlay");
    if (existing) existing.remove();
  }

  function applyPoison(G, who, amount) {
    const target = who === "hero" ? G.hero : G.enemy;
    target.poison = clamp(target.poison + amount, 0, 999);
    log(G, `${who === "hero" ? "You" : G.enemy.name} gain${amount === 1 ? "s" : ""} ${amount} Poison.`);
  }

  function gainBlock(G, who, amount) {
    const target = who === "hero" ? G.hero : G.enemy;
    target.block = clamp(target.block + amount, 0, 999);
    log(G, `${who === "hero" ? "You" : G.enemy.name} gain${amount === 1 ? "s" : ""} ${amount} Block.`);
  }

  function healTarget(G, who, amount) {
    const target = who === "hero" ? G.hero : G.enemy;
    const before = target.hp;
    target.hp = clamp(target.hp + amount, 0, target.maxHp);
    const healed = target.hp - before;
    log(G, `${who === "hero" ? "You" : G.enemy.name} heal${healed === 1 ? "s" : ""} ${healed} HP.`);
  }

  function dealDamage(G, who, baseAmount) {
    const attacker = who === "enemy" ? G.hero : G.enemy;
    const target = who === "enemy" ? G.enemy : G.hero;
    const amount = Math.max(0, baseAmount + (attacker.strength || 0));

    if (amount === 0) {
      log(G, "No damage dealt.", true);
      return;
    }

    const blocked = Math.min(target.block, amount);
    target.block -= blocked;
    const remaining = amount - blocked;

    if (remaining > 0) {
      target.hp = clamp(target.hp - remaining, 0, target.maxHp);
    }

    const attackerName = who === "enemy" ? "You" : G.enemy.name;
    const targetName = who === "enemy" ? G.enemy.name : "you";

    let msg = `${attackerName} deal${attackerName === "You" ? "" : "s"} ${amount} damage to ${targetName}.`;
    if (blocked > 0) msg += ` (${blocked} blocked)`;
    log(G, msg);

    if (target.hp <= 0) {
      endBattle(G, who === "enemy" ? "win" : "lose");
    }
  }

  function startOfTurnPoison(G, who) {
    const target = who === "hero" ? G.hero : G.enemy;
    if (target.poison > 0) {
      const dmg = target.poison;
      target.hp = clamp(target.hp - dmg, 0, target.maxHp);
      log(G, `${who === "hero" ? "You" : G.enemy.name} take${dmg === 1 ? "s" : ""} ${dmg} poison damage.`);
      target.poison = Math.max(0, target.poison - 1);

      if (target.hp <= 0) {
        endBattle(G, who === "enemy" ? "win" : "lose");
      }
    }
  }

  const CARD_LIBRARY = {
    strike: {
      id: "strike",
      name: "Strike",
      type: "Attack",
      cost: 1,
      desc: "Deal 6 damage.",
      play: (G) => dealDamage(G, "enemy", 6),
    },
    defend: {
      id: "defend",
      name: "Defend",
      type: "Skill",
      cost: 1,
      desc: "Gain 5 Block.",
      play: (G) => gainBlock(G, "hero", 5),
    },
    strikePlus: {
      id: "strikePlus",
      name: "Strike+",
      type: "Attack",
      cost: 1,
      desc: "Deal 8 damage.",
      play: (G) => dealDamage(G, "enemy", 8),
    },
    defendPlus: {
      id: "defendPlus",
      name: "Defend+",
      type: "Skill",
      cost: 1,
      desc: "Gain 7 Block.",
      play: (G) => gainBlock(G, "hero", 7),
    },
    fireball: {
      id: "fireball",
      name: "Fireball",
      type: "Attack",
      cost: 2,
      desc: "Deal 12 damage. Gain 1 energy next turn.",
      play: (G) => {
        dealDamage(G, "enemy", 12);
        if (G.over) return;
        G.hero.nextTurnEnergy = (G.hero.nextTurnEnergy || 0) + 1;
        log(G, "You will gain +1 energy next turn.");
      },
    },
    quickStab: {
      id: "quickStab",
      name: "Quick Stab",
      type: "Attack",
      cost: 0,
      desc: "Deal 3 damage.",
      play: (G) => dealDamage(G, "enemy", 3),
    },
    poisonDart: {
      id: "poisonDart",
      name: "Poison Dart",
      type: "Attack",
      cost: 1,
      desc: "Deal 4 damage. Apply 3 Poison.",
      play: (G) => {
        dealDamage(G, "enemy", 4);
        if (G.over) return;
        applyPoison(G, "enemy", 3);
      },
    },
    heal: {
      id: "heal",
      name: "Bandage",
      type: "Skill",
      cost: 1,
      desc: "Heal 6 HP (can’t exceed max HP).",
      play: (G) => healTarget(G, "hero", 6),
    },
    bigShield: {
      id: "bigShield",
      name: "Iron Wall",
      type: "Skill",
      cost: 2,
      desc: "Gain 12 Block.",
      play: (G) => gainBlock(G, "hero", 12),
    },
    focus: {
      id: "focus",
      name: "Focus",
      type: "Power",
      cost: 1,
      desc: "Gain +1 Strength (your attacks deal +1 damage each).",
      play: (G) => {
        G.hero.strength += 1;
        log(G, "You focus. +1 Strength.");
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
          log(G, "No poison to remove.", true);
          return;
        }
        const removed = Math.min(3, G.hero.poison);
        G.hero.poison -= removed;
        log(G, `You remove ${removed} Poison.`);
      },
    },
  };

  function makeStarterDeck() {
    const ids = [
      "strike","strike","strike","strike","strike",
      "defend","defend","defend","defend","defend",
      "quickStab",
      "poisonDart",
      "heal"
    ];
    return shuffle(ids.map(id => makeCard(id)));
  }

  const MAP_TEMPLATE = [
    ["fight", "fight", "fight"],
    ["shop", "fight", "campfire"],
    ["fight", "elite", "fight"],
    ["campfire", "fight", "shop"],
    ["fight", "elite"],
    ["boss"]
  ];

  const G = {
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

  function generateMapFromTemplate() {
    const map = [];
    for (let row = 0; row < MAP_TEMPLATE.length; row++) {
      const rowTypes = MAP_TEMPLATE[row];
      const nodes = rowTypes.map((type, col) => ({
        id: `r${row}c${col}`,
        row,
        col,
        type,
        connectsTo: [],
        completed: false,
      }));
      map.push(nodes);
    }

    for (let row = 0; row < map.length - 1; row++) {
      const currentRow = map[row];
      const nextRow = map[row + 1];

      currentRow.forEach(node => {
        const candidates = [];

        if (nextRow[node.col]) candidates.push(nextRow[node.col].id);
        if (nextRow[node.col - 1]) candidates.push(nextRow[node.col - 1].id);
        if (nextRow[node.col + 1]) candidates.push(nextRow[node.col + 1].id);

        if (candidates.length === 0) {
          candidates.push(nextRow[Math.min(node.col, nextRow.length - 1)].id);
        }

        const unique = [...new Set(candidates)];
        const chosen = [];

        if (nextRow[node.col]) chosen.push(nextRow[node.col].id);

        const adjacent = unique.filter(id => !chosen.includes(id));
        if (adjacent.length > 0) {
          const pick = adjacent[Math.floor(Math.random() * adjacent.length)];
          chosen.push(pick);
        }

        node.connectsTo = [...new Set(chosen)];
      });
    }

    for (let row = 1; row < map.length; row++) {
      const prevRow = map[row - 1];
      const thisRow = map[row];
      thisRow.forEach(targetNode => {
        const hasIncoming = prevRow.some(n => n.connectsTo.includes(targetNode.id));
        if (!hasIncoming) {
          const closestPrev = prevRow[Math.min(targetNode.col, prevRow.length - 1)];
          if (!closestPrev.connectsTo.includes(targetNode.id)) {
            closestPrev.connectsTo.push(targetNode.id);
          }
        }
      });
    }

    return map;
  }

  function getNodeById(id) {
    for (const row of G.map) {
      for (const node of row) {
        if (node.id === id) return node;
      }
    }
    return null;
  }

  function getSelectableNodeIds() {
    if (G.runComplete) return [];

    if (G.currentMapNodeId === null) {
      return G.map[0].map(node => node.id);
    }

    const current = getNodeById(G.currentMapNodeId);
    if (!current) return [];
    return current.connectsTo || [];
  }

  function nodeLabel(type) {
    if (type === "fight") return "Fight";
    if (type === "campfire") return "Campfire";
    if (type === "shop") return "Shop";
    if (type === "elite") return "Elite";
    if (type === "boss") return "Boss";
    if (type === "start") return "Start";
    return "Unknown";
  }

  function nodeBadgeClass(type) {
    if (type === "fight") return "node-fight";
    if (type === "campfire") return "node-campfire";
    if (type === "shop") return "node-shop";
    if (type === "elite") return "node-elite";
    if (type === "boss") return "node-boss";
    return "";
  }

  function drawCards(G, n) {
    for (let i = 0; i < n; i++) {
      if (G.deck.length === 0) {
        if (G.discard.length === 0) break;
        G.deck = shuffle(G.discard);
        G.discard = [];
        log(G, "Shuffled discard into deck.", true);
      }
      const card = G.deck.pop();
      if (card) G.hand.push(card);
    }
  }

  function discardHand(G) {
    while (G.hand.length) {
      G.discard.push(G.hand.pop());
    }
  }

  function rollEnemyIntent(G) {
    const f = Math.max(1, G.floor);
    const attackBase = 6 + Math.floor((f - 1) * 1.5);
    const bigAttack = 10 + Math.floor((f - 1) * 2);
    const blockAmt = 6 + Math.floor((f - 1) * 1.2);
    const poisonAmt = 2 + Math.floor((f - 1) * 0.6);

    const options = [
      { type: "attack", label: `Attack (${attackBase})`, do: () => dealDamage(G, "hero", attackBase), w: 5 },
      { type: "block", label: `Guard (+${blockAmt} Block)`, do: () => gainBlock(G, "enemy", blockAmt), w: 3 },
      { type: "big", label: `Heavy Hit (${bigAttack})`, do: () => dealDamage(G, "hero", bigAttack), w: 2 },
      {
        type: "poison",
        label: `Toxic Jab (4 + ${poisonAmt} Poison)`,
        do: () => {
          dealDamage(G, "hero", 4);
          if (!G.over) applyPoison(G, "hero", poisonAmt);
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
  }

  function startHeroTurn(G) {
    G.turn = "hero";
    G.energy = G.maxEnergy + (G.hero.nextTurnEnergy || 0);

    if (G.hero.nextTurnEnergy > 0) {
      log(G, `You gain +${G.hero.nextTurnEnergy} bonus energy this turn.`, true);
      G.hero.nextTurnEnergy = 0;
    }

    G.hero.block = 0;
    log(G, "— Your turn —", true);

    startOfTurnPoison(G, "hero");
    if (G.over) return;

    drawCards(G, 5);
    G.enemyIntent = rollEnemyIntent(G);
    renderAll();
  }

  function endHeroTurn(G) {
    if (G.over || G.turn !== "hero") return;
    discardHand(G);
    G.turn = "enemy";
    renderAll();
    enemyTurn(G);
  }

  function enemyTurn(G) {
    if (G.over) return;

    log(G, `— ${G.enemy.name}'s turn —`, true);

    G.enemy.block = 0;
    startOfTurnPoison(G, "enemy");
    if (G.over) return;

    if (!G.enemyIntent) {
      G.enemyIntent = rollEnemyIntent(G);
    }

    log(G, `${G.enemy.name} uses: ${G.enemyIntent.label}`);
    G.enemyIntent.do();

    if (!G.over) {
      G.enemyIntent = rollEnemyIntent(G);
    }

    if (!G.over) {
      startHeroTurn(G);
    }
  }

  function playCardAtIndex(G, idx) {
    if (G.over || G.turn !== "hero") return;

    const card = G.hand[idx];
    if (!card) return;

    if (card.cost > G.energy) {
      log(G, `Not enough energy to play ${card.name}.`, true);
      return;
    }

    G.energy -= card.cost;
    G.hand.splice(idx, 1);
    G.discard.push(card);

    log(G, `You play ${card.name}.`);
    card.play(G);

    if (G.over) {
      renderAll();
      return;
    }

    renderAll();
  }

  function makeEnemyForNode(nodeType, mapRow) {
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

    let hp = 26 + Math.floor(f * 6) + rng(-2, 4);
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
  }

  function rewardChoices(count = 3) {
    const poolIds = [
      "fireball",
      "bigShield",
      "poisonDart",
      "quickStab",
      "focus",
      "heal",
      "strikePlus",
      "defendPlus",
      "antidote"
    ];
    return shuffle(poolIds).slice(0, count).map(id => makeCard(id));
  }

  function resetCombatStateAfterBattle(G) {
    G.deck = shuffle([...G.deck, ...G.discard, ...G.hand]);
    G.discard = [];
    G.hand = [];
    G.hero.block = 0;
    G.hero.poison = 0;
    G.enemy.block = 0;
    G.enemy.poison = 0;
    G.enemyIntent = null;
    G.turn = "hero";
    G.energy = G.maxEnergy;
    G.over = false;
  }

  function getUpgradedCardId(cardId) {
    if (cardId === "strike") return "strikePlus";
    if (cardId === "defend") return "defendPlus";
    return null;
  }

  function upgradeCardInstance(instanceId) {
    const zones = [G.deck, G.discard, G.hand];

    for (const zone of zones) {
      const idx = zone.findIndex(card => card.instanceId === instanceId);
      if (idx !== -1) {
        const oldCard = zone[idx];
        const upgradedId = getUpgradedCardId(oldCard.id);
        if (!upgradedId) return null;

        const upgradedCard = makeCard(upgradedId);
        zone[idx] = upgradedCard;
        return { oldCard, upgradedCard };
      }
    }

    return null;
  }

  function enterNode(nodeId) {
    closeOverlay();

    const node = getNodeById(nodeId);
    if (!node) return;

    const selectable = getSelectableNodeIds();
    if (!selectable.includes(nodeId)) return;

    G.currentMapNodeId = node.id;
    G.currentMapRow = node.row;
    G.floor = node.row + 1;
    G.nodeType = node.type;

    log(G, "", true);
    log(G, `=== Map Row ${G.floor}: ${nodeLabel(node.type)} ===`, true);

    if (node.type === "fight" || node.type === "elite" || node.type === "boss") {
      startEncounter(node.type, node.row);
    } else if (node.type === "campfire") {
      showCampfireModal();
    } else if (node.type === "shop") {
      showShopModal();
    }

    renderAll();
  }

  function startEncounter(nodeType, mapRow) {
    G.enemy = makeEnemyForNode(nodeType, mapRow);
    G.over = false;
    const intro =
      nodeType === "boss" ? "The Dungeon Boss blocks your path!"
      : nodeType === "elite" ? `A ${G.enemy.name} appears! It looks dangerous.`
      : `A ${G.enemy.name} appears!`;
    log(G, intro, false);
    startHeroTurn(G);
  }

  function returnToMapAfterRoom() {
    closeOverlay();
    resetCombatStateAfterBattle(G);

    const currentNode = getNodeById(G.currentMapNodeId);
    if (currentNode) currentNode.completed = true;

    if (G.nodeType === "boss") {
      G.runComplete = true;
      showVictoryModal();
      renderAll();
      return;
    }

    showMapModal();
    renderAll();
  }

  function endBattle(G, result) {
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

      log(G, `✅ You defeated the ${G.enemy.name}!`);
      log(G, `You gain ${goldEarned} gold.`, true);

      const healAmt = 6 + Math.floor(G.floor * 0.5);
      G.hero.hp = clamp(G.hero.hp + healAmt, 0, G.hero.maxHp);
      log(G, `You catch your breath and heal ${healAmt} HP.`, true);

      showRewardModal(rewardChoices(rewardCount));
    } else {
      log(G, `💀 You were defeated on Map Row ${G.floor}.`);
      document.getElementById("endTurnBtn").disabled = true;
      G.runComplete = true;
    }

    renderAll();
  }

  function showRewardModal(cards) {
    closeOverlay();

    const overlay = document.createElement("div");
    overlay.id = "overlay";
    overlay.className = "overlay";

    const box = document.createElement("div");
    box.className = "panel modal";

    const header = document.createElement("div");
    header.className = "row";
    header.style.marginBottom = "10px";
    header.innerHTML = `
      <div>
        <div class="big">Choose a reward</div>
        <div class="mini">Pick one card to add to your deck, then return to the map.</div>
      </div>
      <div class="spacer"></div>
      <button id="skipReward" class="btn">Skip</button>
    `;

    const cardRow = document.createElement("div");
    cardRow.className = "cards";

    cards.forEach((c) => {
      const node = document.createElement("div");
      node.className = "card";
      node.innerHTML = `
        <div class="tag ${c.type.toLowerCase()}">${c.type}</div>
        <div class="top">
          <div class="cost">${c.cost}</div>
          <div>
            <div class="cname">${c.name}</div>
            <div class="ctype">Reward</div>
          </div>
        </div>
        <div class="desc">${c.desc}</div>
      `;
      node.addEventListener("click", () => {
        G.discard.push(c);
        log(G, `🎁 You add ${c.name} to your deck.`);
        returnToMapAfterRoom();
      });
      cardRow.appendChild(node);
    });

    box.appendChild(header);
    box.appendChild(cardRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById("skipReward").addEventListener("click", () => {
      log(G, "You skip the reward.", true);
      returnToMapAfterRoom();
    });
  }

  function showUpgradeCardModal() {
    closeOverlay();

    const overlay = document.createElement("div");
    overlay.id = "overlay";
    overlay.className = "overlay";

    const box = document.createElement("div");
    box.className = "panel modal";

    const upgradableCards = getAllDeckCards().filter(card => getUpgradedCardId(card.id));

    box.innerHTML = `
      <div class="row" style="margin-bottom:10px;">
        <div>
          <div class="big">Upgrade a card</div>
          <div class="mini">Choose a Strike or Defend to upgrade.</div>
        </div>
        <div class="spacer"></div>
        <button id="backToCampfire" class="btn">Back</button>
      </div>
    `;

    const cardRow = document.createElement("div");
    cardRow.className = "cards";

    upgradableCards.forEach((c) => {
      const upgradedId = getUpgradedCardId(c.id);
      const upgradedPreview = CARD_LIBRARY[upgradedId];

      const node = document.createElement("div");
      node.className = "card";
      node.innerHTML = `
        <div class="tag ${c.type.toLowerCase()}">${c.type}</div>
        <div class="top">
          <div class="cost">${c.cost}</div>
          <div>
            <div class="cname">${c.name} → ${upgradedPreview.name}</div>
            <div class="ctype">Upgrade</div>
          </div>
        </div>
        <div class="desc">
          Current: ${c.desc}
          <br><br>
          Upgraded: ${upgradedPreview.desc}
        </div>
      `;

      node.addEventListener("click", () => {
        const result = upgradeCardInstance(c.instanceId);
        if (result) {
          log(G, `⬆️ You upgrade ${result.oldCard.name} to ${result.upgradedCard.name}.`, true);
        }

        const currentNode = getNodeById(G.currentMapNodeId);
        if (currentNode) currentNode.completed = true;

        showMapModal();
        renderAll();
      });

      cardRow.appendChild(node);
    });

    if (upgradableCards.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mini";
      empty.textContent = "You have no upgradeable cards.";
      box.appendChild(empty);
    } else {
      box.appendChild(cardRow);
    }

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById("backToCampfire").addEventListener("click", () => {
      showCampfireModal();
    });
  }

  function showCampfireModal() {
    closeOverlay();

    const overlay = document.createElement("div");
    overlay.id = "overlay";
    overlay.className = "overlay";

    const box = document.createElement("div");
    box.className = "panel modal";

    const healAmount = Math.max(1, Math.floor(G.hero.maxHp * 0.3));

    box.innerHTML = `
      <div class="row" style="margin-bottom:14px;">
        <div>
          <div class="big">Campfire</div>
          <div class="mini">A safe place to recover or improve your deck.</div>
        </div>
      </div>

      <div class="row" style="align-items:stretch;">
        <div class="optionBox">
          <h3>Rest</h3>
          <p>Recover <strong>${healAmount} HP</strong>.</p>
          <button id="campfireRest" class="btn primary">Rest</button>
        </div>

        <div class="optionBox">
          <h3>Upgrade</h3>
          <p>Upgrade a <strong>Strike</strong> into <strong>Strike+</strong> or a <strong>Defend</strong> into <strong>Defend+</strong>.</p>
          <button id="campfireUpgrade" class="btn warn">Upgrade</button>
        </div>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById("campfireRest").addEventListener("click", () => {
      healTarget(G, "hero", healAmount);
      log(G, "You rest by the fire.", true);

      const currentNode = getNodeById(G.currentMapNodeId);
      if (currentNode) currentNode.completed = true;
      showMapModal();
      renderAll();
    });

    document.getElementById("campfireUpgrade").addEventListener("click", () => {
      showUpgradeCardModal();
    });
  }

  function getAllDeckCards() {
    return [...G.deck, ...G.discard, ...G.hand];
  }

  function removeCardInstance(instanceId) {
    const zones = [G.deck, G.discard, G.hand];
    for (const zone of zones) {
      const idx = zone.findIndex(card => card.instanceId === instanceId);
      if (idx !== -1) {
        const [removed] = zone.splice(idx, 1);
        return removed;
      }
    }
    return null;
  }

  function showRemoveCardModal() {
    closeOverlay();

    const overlay = document.createElement("div");
    overlay.id = "overlay";
    overlay.className = "overlay";

    const box = document.createElement("div");
    box.className = "panel modal";

    const allCards = getAllDeckCards();

    box.innerHTML = `
      <div class="row" style="margin-bottom:10px;">
        <div>
          <div class="big">Remove a card</div>
          <div class="mini">Choose one card to permanently remove from your deck for 75 gold.</div>
        </div>
        <div class="spacer"></div>
        <button id="backToShop" class="btn">Back</button>
      </div>
    `;

    const cardRow = document.createElement("div");
    cardRow.className = "cards";

    allCards.forEach((c) => {
      const node = document.createElement("div");
      node.className = "card";
      node.innerHTML = `
        <div class="tag ${c.type.toLowerCase()}">${c.type}</div>
        <div class="top">
          <div class="cost">${c.cost}</div>
          <div>
            <div class="cname">${c.name}</div>
            <div class="ctype">Remove</div>
          </div>
        </div>
        <div class="desc">${c.desc}</div>
      `;
      node.addEventListener("click", () => {
        if (G.gold < 75) return;
        const removed = removeCardInstance(c.instanceId);
        if (removed) {
          G.gold -= 75;
          log(G, `🗑️ You remove ${removed.name} from your deck for 75 gold.`, true);
        }

        const currentNode = getNodeById(G.currentMapNodeId);
        if (currentNode) currentNode.completed = true;
        showMapModal();
        renderAll();
      });
      cardRow.appendChild(node);
    });

    if (allCards.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mini";
      empty.textContent = "Your deck is empty.";
      box.appendChild(empty);
    } else {
      box.appendChild(cardRow);
    }

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById("backToShop").addEventListener("click", () => {
      showShopModal();
    });
  }

  function showShopModal() {
    closeOverlay();

    const overlay = document.createElement("div");
    overlay.id = "overlay";
    overlay.className = "overlay";

    const box = document.createElement("div");
    box.className = "panel modal";

    const shopCards = rewardChoices(3);

    const header = document.createElement("div");
    header.className = "row";
    header.style.marginBottom = "10px";
    header.innerHTML = `
      <div>
        <div class="big">Shop</div>
        <div class="mini">Spend your gold on new cards or remove weak ones from your deck.</div>
      </div>
      <div class="spacer"></div>
      <div class="badge gold">Gold: ${G.gold}</div>
    `;

    const controls = document.createElement("div");
    controls.className = "row";
    controls.style.marginBottom = "10px";

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn warn";
    removeBtn.textContent = "Remove a card (75)";
    removeBtn.disabled = G.gold < 75 || getAllDeckCards().length === 0;
    removeBtn.addEventListener("click", () => {
      showRemoveCardModal();
    });

    const leaveBtn = document.createElement("button");
    leaveBtn.className = "btn";
    leaveBtn.textContent = "Leave shop";
    leaveBtn.addEventListener("click", () => {
      log(G, "You leave the shop.", true);
      const currentNode = getNodeById(G.currentMapNodeId);
      if (currentNode) currentNode.completed = true;
      showMapModal();
      renderAll();
    });

    controls.appendChild(removeBtn);
    controls.appendChild(leaveBtn);

    const cardRow = document.createElement("div");
    cardRow.className = "cards";

    shopCards.forEach((c) => {
      const affordable = G.gold >= 50;
      const node = document.createElement("div");
      node.className = "card" + (affordable ? "" : " disabled");
      node.innerHTML = `
        <div class="tag ${c.type.toLowerCase()}">${c.type}</div>
        <div class="top">
          <div class="cost">${c.cost}</div>
          <div>
            <div class="cname">${c.name}</div>
            <div class="ctype">Shop</div>
          </div>
        </div>
        <div class="desc">${c.desc}</div>
        <div class="price">Cost: 50 gold</div>
      `;
      node.addEventListener("click", () => {
        if (G.gold < 50) return;
        G.gold -= 50;
        G.discard.push(c);
        log(G, `🛒 You buy ${c.name} for 50 gold.`, true);

        const currentNode = getNodeById(G.currentMapNodeId);
        if (currentNode) currentNode.completed = true;
        showMapModal();
        renderAll();
      });
      cardRow.appendChild(node);
    });

    box.appendChild(header);
    box.appendChild(controls);
    box.appendChild(cardRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  function buildMapNodePositions(boardWidth, boardHeight) {
    const positions = {};
    const totalRows = G.map.length;

    for (let row = 0; row < totalRows; row++) {
      const nodes = G.map[row];
      const count = nodes.length;
      const y = boardHeight - 80 - (row * ((boardHeight - 160) / Math.max(1, totalRows - 1)));

      for (let col = 0; col < count; col++) {
        const x = ((col + 1) / (count + 1)) * boardWidth;
        positions[nodes[col].id] = { x, y };
      }
    }

    return positions;
  }

  function renderMapIntoBoard(board) {
    if (!board) return;

    board.innerHTML = "";

    const selectableIds = getSelectableNodeIds();
    const currentNode = G.currentMapNodeId ? getNodeById(G.currentMapNodeId) : null;

    const boardWidth = board.clientWidth;
    const boardHeight = board.clientHeight;
    const positions = buildMapNodePositions(boardWidth, boardHeight);

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "mapSvg");
    svg.setAttribute("viewBox", `0 0 ${boardWidth} ${boardHeight}`);
    svg.setAttribute("width", boardWidth);
    svg.setAttribute("height", boardHeight);

    for (const row of G.map) {
      for (const node of row) {
        const from = positions[node.id];
        for (const targetId of node.connectsTo) {
          const to = positions[targetId];
          if (!from || !to) continue;

          const line = document.createElementNS(svgNS, "line");
          line.setAttribute("x1", from.x);
          line.setAttribute("y1", from.y);
          line.setAttribute("x2", to.x);
          line.setAttribute("y2", to.y);

          const isPathFromCurrent =
            currentNode &&
            currentNode.connectsTo.includes(targetId) &&
            currentNode.id === node.id;

          line.setAttribute("stroke", isPathFromCurrent ? "rgba(96,165,250,0.65)" : "rgba(255,255,255,0.18)");
          line.setAttribute("stroke-width", isPathFromCurrent ? "4" : "2");
          line.setAttribute("stroke-linecap", "round");

          svg.appendChild(line);
        }
      }
    }

    board.appendChild(svg);

    for (const row of G.map) {
      for (const node of row) {
        const pos = positions[node.id];
        const nodeEl = document.createElement("button");
        nodeEl.type = "button";
        nodeEl.className = `mapNode ${node.type}`;
        nodeEl.textContent = nodeLabel(node.type);
        nodeEl.style.left = `${pos.x}px`;
        nodeEl.style.top = `${pos.y}px`;

        if (node.completed) nodeEl.classList.add("completed");
        if (G.currentMapNodeId === node.id) nodeEl.classList.add("current");
        if (selectableIds.includes(node.id)) nodeEl.classList.add("selectable");

        const canSelect = selectableIds.includes(node.id);
        nodeEl.disabled = !canSelect;

        if (!canSelect) {
          nodeEl.style.cursor = "default";
        } else {
          nodeEl.addEventListener("click", () => {
            enterNode(node.id);
          });
        }

        board.appendChild(nodeEl);
      }
    }
  }

  function rerenderOpenMapOnResize() {
    if (mapResizeTimer) clearTimeout(mapResizeTimer);

    mapResizeTimer = setTimeout(() => {
      const board = document.getElementById("mapBoard");
      if (board) {
        renderMapIntoBoard(board);
      }
    }, 50);
  }

  function showMapModal() {
    closeOverlay();

    const overlay = document.createElement("div");
    overlay.id = "overlay";
    overlay.className = "overlay";

    const box = document.createElement("div");
    box.className = "panel modal";

    const currentNode = G.currentMapNodeId ? getNodeById(G.currentMapNodeId) : null;

    box.innerHTML = `
      <div class="row" style="margin-bottom:10px;">
        <div>
          <div class="big">Dungeon Map</div>
          <div class="mini">${currentNode ? `Current position: ${nodeLabel(currentNode.type)} on row ${currentNode.row + 1}.` : "Choose your first node on row 1."}</div>
        </div>
        <div class="spacer"></div>
        <button id="closeMapBtn" class="btn">Close</button>
      </div>

      <div class="mapWrap">
        <div id="mapBoard" class="mapBoard"></div>
      </div>

      <div class="mapLegend">
        <div class="legendItem fight">Fight</div>
        <div class="legendItem campfire">Campfire</div>
        <div class="legendItem shop">Shop</div>
        <div class="legendItem elite">Elite</div>
        <div class="legendItem boss">Boss</div>
        <div class="legendItem path">Blue outline = selectable</div>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const board = document.getElementById("mapBoard");
    renderMapIntoBoard(board);

    document.getElementById("closeMapBtn").addEventListener("click", () => {
      closeOverlay();
    });
  }

  function showVictoryModal() {
    closeOverlay();

    const overlay = document.createElement("div");
    overlay.id = "overlay";
    overlay.className = "overlay";

    const box = document.createElement("div");
    box.className = "panel modal";
    box.innerHTML = `
      <div class="big" style="font-size:22px; margin-bottom:8px;">🏆 Victory</div>
      <div class="mini" style="margin-bottom:16px;">
        You defeated the Dungeon Boss and cleared the map.
      </div>
      <div class="row">
        <div class="badge gold">Final Gold: ${G.gold}</div>
        <div class="badge">Final Strength: ${G.hero.strength}</div>
        <div class="badge">HP: ${G.hero.hp}/${G.hero.maxHp}</div>
      </div>
      <div style="margin-top:16px;">
        <button id="victoryNewRun" class="btn primary">Start New Run</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById("victoryNewRun").addEventListener("click", () => {
      newRun();
    });
  }

  const handEl = document.getElementById("hand");
  const endTurnBtn = document.getElementById("endTurnBtn");
  const newRunBtn = document.getElementById("newRunBtn");
  const showMapBtn = document.getElementById("showMapBtn");

  endTurnBtn.addEventListener("click", () => endHeroTurn(G));
  newRunBtn.addEventListener("click", () => newRun());
  showMapBtn.addEventListener("click", () => showMapModal());
  window.addEventListener("resize", rerenderOpenMapOnResize);

  function renderAll() {
    document.getElementById("floorText").textContent = `Map Row ${Math.max(0, G.floor)}`;
    document.getElementById("goldText").textContent = `Gold: ${G.gold}`;
    document.getElementById("energyText").textContent = `Energy: ${G.energy}/${G.maxEnergy}`;
    document.getElementById("deckText").textContent = `Deck: ${G.deck.length}`;
    document.getElementById("discardText").textContent = `Discard: ${G.discard.length}`;

    const nodeEl = document.getElementById("nodeText");
    nodeEl.textContent = nodeLabel(G.nodeType);
    nodeEl.className = `badge ${nodeBadgeClass(G.nodeType)}`;

    document.getElementById("heroHpText").textContent = `HP: ${G.hero.hp}/${G.hero.maxHp} (Str ${G.hero.strength})`;
    document.getElementById("heroBlockText").textContent = `Block: ${G.hero.block}`;
    document.getElementById("heroPoisonText").textContent = `Poison: ${G.hero.poison}`;
    document.getElementById("heroHpFill").style.width = `${clamp((G.hero.hp / G.hero.maxHp) * 100, 0, 100)}%`;

    document.getElementById("enemyHpText").textContent = `${G.enemy.name} HP: ${G.enemy.hp}/${G.enemy.maxHp} (Str ${G.enemy.strength})`;
    document.getElementById("enemyBlockText").textContent = `Block: ${G.enemy.block}`;
    document.getElementById("enemyPoisonText").textContent = `Poison: ${G.enemy.poison}`;
    document.getElementById("enemyHpFill").style.width = `${clamp((G.enemy.hp / G.enemy.maxHp) * 100, 0, 100)}%`;

    const inCombat = G.nodeType === "fight" || G.nodeType === "elite" || G.nodeType === "boss";

    document.getElementById("intentText").textContent =
      inCombat
        ? ((G.enemyIntent && !G.over) ? G.enemyIntent.label : (G.over ? "Battle ended" : "—"))
        : "No enemy here";

    endTurnBtn.disabled = (G.over || G.turn !== "hero" || !inCombat || G.runComplete);

    handEl.innerHTML = "";

    G.hand.forEach((card, idx) => {
      const canPlay = (!G.over && G.turn === "hero" && card.cost <= G.energy);
      const tagClass = card.type.toLowerCase();

      const node = el("div", {
        class: "card" + (canPlay ? "" : " disabled"),
        title: canPlay ? "Click to play" : "Not enough energy"
      });

      node.appendChild(el("div", { class: "tag " + tagClass, text: card.type }));
      node.appendChild(el("div", { class: "top" }, [
        el("div", { class: "cost", text: String(card.cost) }),
        el("div", {}, [
          el("div", { class: "cname", text: card.name }),
          el("div", { class: "ctype", text: "Card" })
        ])
      ]));
      node.appendChild(el("div", { class: "desc", text: card.desc }));

      node.addEventListener("click", () => {
        if (canPlay) playCardAtIndex(G, idx);
      });

      handEl.appendChild(node);
    });
  }

  function newRun() {
    closeOverlay();

    G.floor = 0;
    G.nodeType = "start";
    G.turn = "hero";
    G.energy = 3;
    G.maxEnergy = 3;
    G.gold = 50;
    G.deck = makeStarterDeck();
    G.discard = [];
    G.hand = [];
    G.hero = { hp: 50, maxHp: 50, block: 0, poison: 0, strength: 0, nextTurnEnergy: 0 };
    G.enemy = { name: "No Enemy", hp: 1, maxHp: 1, block: 0, poison: 0, strength: 0 };
    G.enemyIntent = null;
    G.over = false;
    G.map = generateMapFromTemplate();
    G.currentMapRow = -1;
    G.currentMapNodeId = null;
    G.runComplete = false;

    const logBox = document.getElementById("log");
    logBox.innerHTML = "";
    log(G, "Welcome to the Dungeon Card Battler!", true);
    log(G, "Choose your path on the dungeon map.", true);

    showMapModal();
    renderAll();
  }

  newRun();
  renderAll();
})();