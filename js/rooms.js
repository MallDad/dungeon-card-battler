window.DCB = window.DCB || {};

DCB.rewardChoices = function (count = 3) {
  const poolIds = [
    "fireball",
    "bigShield",
    "poisonDart",
    "quickStabPlus",
    "focus",
    "heal",
    "strikePlus",
    "defendPlus",
    "antidote"
  ];

  return DCB.shuffle(poolIds)
    .slice(0, count)
    .map(id => DCB.makeCard(id));
};

DCB.resetCombatStateAfterBattle = function (G) {
  G.deck = DCB.shuffle([...G.deck, ...G.discard, ...G.hand]);
  G.discard = [];
  G.hand = [];

  G.deck.forEach((card) => {
    if (card.resetsTo) {
      DCB.setCardToLibraryEntry(card, card.resetsTo);
      delete card.resetsTo;
    }
  });

  G.hero.block = 0;
  G.hero.poison = 0;
  G.enemy.block = 0;
  G.enemy.poison = 0;
  G.enemyIntent = null;
  G.turn = "hero";
  G.energy = G.maxEnergy;
  G.over = false;
};

DCB.getUpgradedCardId = function (cardId) {
  if (cardId === "strike") return "strikePlus";
  if (cardId === "defend") return "defendPlus";
  if (cardId === "quickStab") return "quickStabPlus";
  return null;
};

DCB.getAllDeckCards = function () {
  return [...DCB.G.deck, ...DCB.G.discard, ...DCB.G.hand];
};

DCB.upgradeCardInstance = function (instanceId) {
  const zones = [DCB.G.deck, DCB.G.discard, DCB.G.hand];

  for (const zone of zones) {
    const idx = zone.findIndex(card => card.instanceId === instanceId);
    if (idx !== -1) {
      const oldCard = zone[idx];
      const upgradedId = DCB.getUpgradedCardId(oldCard.id);
      if (!upgradedId) return null;

      const upgradedCard = DCB.makeCard(upgradedId);
      zone[idx] = upgradedCard;
      return { oldCard, upgradedCard };
    }
  }

  return null;
};

DCB.removeCardInstance = function (instanceId) {
  const zones = [DCB.G.deck, DCB.G.discard, DCB.G.hand];
  for (const zone of zones) {
    const idx = zone.findIndex(card => card.instanceId === instanceId);
    if (idx !== -1) {
      const [removed] = zone.splice(idx, 1);
      return removed;
    }
  }
  return null;
};

DCB.returnToMapAfterRoom = function () {
  DCB.closeOverlay();
  DCB.resetCombatStateAfterBattle(DCB.G);

  const currentNode = DCB.getNodeById(DCB.G.currentMapNodeId);
  if (currentNode) currentNode.completed = true;

  if (DCB.G.nodeType === "boss") {
    DCB.G.runComplete = true;
    DCB.showVictoryModal();
    DCB.renderAll();
    return;
  }

  DCB.showMapModal();
  DCB.renderAll();
};

DCB.showRewardModal = function (cards) {
  DCB.closeOverlay();

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
    node.className = `card ${c.type.toLowerCase()}`;
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
      DCB.G.discard.push(c);
      DCB.log(DCB.G, `🎁 You add ${c.name} to your deck.`);
      DCB.returnToMapAfterRoom();
    });
    cardRow.appendChild(node);
  });

  box.appendChild(header);
  box.appendChild(cardRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById("skipReward").addEventListener("click", () => {
    DCB.log(DCB.G, "You skip the reward.", true);
    DCB.returnToMapAfterRoom();
  });
};

DCB.showUpgradeCardModal = function () {
  DCB.closeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "overlay";
  overlay.className = "overlay";

  const box = document.createElement("div");
  box.className = "panel modal";

  const upgradableCards = DCB.getAllDeckCards().filter(card => DCB.getUpgradedCardId(card.id));

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
    const upgradedId = DCB.getUpgradedCardId(c.id);
    const upgradedPreview = DCB.CARD_LIBRARY[upgradedId];

    const node = document.createElement("div");
    node.className = `card ${c.type.toLowerCase()}`;
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
      const result = DCB.upgradeCardInstance(c.instanceId);
      if (result) {
        DCB.log(DCB.G, `⬆️ You upgrade ${result.oldCard.name} to ${result.upgradedCard.name}.`, true);
      }

      const currentNode = DCB.getNodeById(DCB.G.currentMapNodeId);
      if (currentNode) currentNode.completed = true;

      DCB.showMapModal();
      DCB.renderAll();
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
    DCB.showCampfireModal();
  });
};

DCB.showCampfireModal = function () {
  DCB.closeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "overlay";
  overlay.className = "overlay";

  const box = document.createElement("div");
  box.className = "panel modal";

  const healAmount = Math.max(1, Math.floor(DCB.G.hero.maxHp * 0.3));

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
        <p>Upgrade a card.</p>
        <button id="campfireUpgrade" class="btn warn">Upgrade</button>
      </div>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById("campfireRest").addEventListener("click", () => {
    DCB.healTarget(DCB.G, "hero", healAmount);
    DCB.log(DCB.G, "You rest by the fire.", true);

    const currentNode = DCB.getNodeById(DCB.G.currentMapNodeId);
    if (currentNode) currentNode.completed = true;
    DCB.showMapModal();
    DCB.renderAll();
  });

  document.getElementById("campfireUpgrade").addEventListener("click", () => {
    DCB.showUpgradeCardModal();
  });
};

DCB.showRemoveCardModal = function () {
  DCB.closeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "overlay";
  overlay.className = "overlay";

  const box = document.createElement("div");
  box.className = "panel modal";

  const allCards = DCB.getAllDeckCards();

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
    node.className = `card ${c.type.toLowerCase()}`;
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
      if (DCB.G.gold < 75) return;
      const removed = DCB.removeCardInstance(c.instanceId);
      if (removed) {
        DCB.G.gold -= 75;
        DCB.log(DCB.G, `🗑️ You remove ${removed.name} from your deck for 75 gold.`, true);
      }

      const currentNode = DCB.getNodeById(DCB.G.currentMapNodeId);
      if (currentNode) currentNode.completed = true;
      DCB.showMapModal();
      DCB.renderAll();
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
    DCB.showShopModal();
  });
};

DCB.showShopModal = function () {
  DCB.closeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "overlay";
  overlay.className = "overlay";

  const box = document.createElement("div");
  box.className = "panel modal";

  const shopCards = DCB.rewardChoices(3);

  const header = document.createElement("div");
  header.className = "row";
  header.style.marginBottom = "10px";
  header.innerHTML = `
    <div>
      <div class="big">Shop</div>
      <div class="mini">Spend your gold on new cards or remove weak ones from your deck.</div>
    </div>
    <div class="spacer"></div>
    <div class="badge gold">Gold: ${DCB.G.gold}</div>
  `;

  const controls = document.createElement("div");
  controls.className = "row";
  controls.style.marginBottom = "10px";

  const removeBtn = document.createElement("button");
  removeBtn.className = "btn warn";
  removeBtn.textContent = "Remove a card (75)";
  removeBtn.disabled = DCB.G.gold < 75 || DCB.getAllDeckCards().length === 0;
  removeBtn.addEventListener("click", () => {
    DCB.showRemoveCardModal();
  });

  const leaveBtn = document.createElement("button");
  leaveBtn.className = "btn";
  leaveBtn.textContent = "Leave shop";
  leaveBtn.addEventListener("click", () => {
    DCB.log(DCB.G, "You leave the shop.", true);
    const currentNode = DCB.getNodeById(DCB.G.currentMapNodeId);
    if (currentNode) currentNode.completed = true;
    DCB.showMapModal();
    DCB.renderAll();
  });

  controls.appendChild(removeBtn);
  controls.appendChild(leaveBtn);

  const cardRow = document.createElement("div");
  cardRow.className = "cards";

  shopCards.forEach((c) => {
    const affordable = DCB.G.gold >= 50;
    const node = document.createElement("div");
    node.className = `card ${c.type.toLowerCase()}${affordable ? "" : " disabled"}`;
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
      if (DCB.G.gold < 50) return;
      DCB.G.gold -= 50;
      DCB.G.discard.push(c);
      DCB.log(DCB.G, `🛒 You buy ${c.name} for 50 gold.`, true);

      const currentNode = DCB.getNodeById(DCB.G.currentMapNodeId);
      if (currentNode) currentNode.completed = true;
      DCB.showMapModal();
      DCB.renderAll();
    });
    cardRow.appendChild(node);
  });

  box.appendChild(header);
  box.appendChild(controls);
  box.appendChild(cardRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
};

DCB.showVictoryModal = function () {
  DCB.closeOverlay();

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
      <div class="badge gold">Final Gold: ${DCB.G.gold}</div>
      <div class="badge">Final Strength: ${DCB.G.hero.strength}</div>
      <div class="badge">HP: ${DCB.G.hero.hp}/${DCB.G.hero.maxHp}</div>
    </div>
    <div style="margin-top:16px;">
      <button id="victoryNewRun" class="btn primary">Start New Run</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById("victoryNewRun").addEventListener("click", () => {
    DCB.newRun();
  });
};
