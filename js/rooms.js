window.DCB = window.DCB || {};

DCB.rewardChoices = function (count = 3) {
  const poolIds = [
    "fireball",
    "bigShield",
    "poisonDart",
    "poisonMaster",
    "shieldBash",
    "barricade",
    "flurry",
    "tactician",
    "adrenaline",
    "quickStabPlus",
    "focus",
    "heal",
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

DCB.getUpgradedCardId = function (cardId, source = "general") {
  if (cardId === "strike") return "strikePlus";
  if (cardId === "defend") return "defendPlus";
  if (cardId === "quickStab") return "quickStabPlus";
  if (source === "campfire" && cardId === "poisonDart") return "poisonBlade";
  if (source === "campfire" && cardId === "barricade") return "barricadePlus";
  if (source === "campfire" && cardId === "tactician") return "masterTactician";
  return null;
};

DCB.getAllDeckCards = function () {
  return [...DCB.G.deck, ...DCB.G.discard, ...DCB.G.hand];
};

DCB.showDeckListModal = function () {
  DCB.closeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "overlay";
  overlay.className = "overlay";

  const box = document.createElement("div");
  box.className = "panel modal";
  box.innerHTML = `
    <div class="row" style="margin-bottom:10px;">
      <div>
        <div class="big">Deck</div>
        <div class="mini">Cards in your deck, discard pile, and hand sorted alphabetically.</div>
      </div>
      <div class="spacer"></div>
      <button id="closeDeckList" class="btn">Close</button>
    </div>
  `;

  const cardRow = document.createElement("div");
  cardRow.className = "cards";

  const cards = DCB.getAllDeckCards().sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    return byName !== 0 ? byName : a.instanceId - b.instanceId;
  });

  cards.forEach((card) => {
    const node = document.createElement("div");
    node.className = `card ${card.type.toLowerCase()}${card.unplayable ? " disabled" : ""}`;
    node.innerHTML = `
      <div class="tag ${card.type.toLowerCase()}">${card.type}</div>
      <div class="top">
        <div class="cost">${card.cost}</div>
        <div>
          <div class="cname">${card.name}</div>
          <div class="ctype">Deck</div>
        </div>
      </div>
      <div class="desc">${card.desc}</div>
    `;
    cardRow.appendChild(node);
  });

  if (cards.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mini";
    empty.textContent = "Your deck is empty.";
    box.appendChild(empty);
  } else {
    box.appendChild(cardRow);
  }

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById("closeDeckList").addEventListener("click", () => {
    DCB.closeOverlay();
  });
};

DCB.sortCampfireUpgradeCards = function (cards) {
  const priority = {
    poisonDart: 0,
    barricade: 1,
    tactician: 2,
    quickStab: 3,
    strike: 4,
    defend: 5
  };

  return [...cards].sort((a, b) => {
    const aPriority = priority[a.id] ?? 99;
    const bPriority = priority[b.id] ?? 99;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.name.localeCompare(b.name);
  });
};

DCB.upgradeCardInstance = function (instanceId, source = "general") {
  const zones = [DCB.G.deck, DCB.G.discard, DCB.G.hand];

  for (const zone of zones) {
    const idx = zone.findIndex(card => card.instanceId === instanceId);
    if (idx !== -1) {
      const oldCard = zone[idx];
      const upgradedId = DCB.getUpgradedCardId(oldCard.id, source);
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

DCB.showArtifactRewardModal = function (artifacts) {
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
      <div class="big">Choose an artifact</div>
      <div class="mini">Pick one permanent artifact, then return to the map.</div>
    </div>
  `;

  box.appendChild(header);

  if (artifacts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mini";
    empty.textContent = "You already have every artifact.";

    const continueBtn = document.createElement("button");
    continueBtn.className = "btn primary";
    continueBtn.textContent = "Continue";
    continueBtn.style.marginTop = "12px";
    continueBtn.addEventListener("click", () => {
      DCB.returnToMapAfterRoom();
    });

    box.appendChild(empty);
    box.appendChild(continueBtn);
  } else {
    const artifactRow = document.createElement("div");
    artifactRow.className = "artifactChoices";

    artifacts.forEach((artifact) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "artifactChoice";
      node.innerHTML = `
        <div class="artifactName">${artifact.name}</div>
        <div class="artifactDesc">${artifact.desc}</div>
      `;
      node.addEventListener("click", () => {
        DCB.addArtifact(DCB.G, artifact.id);
        DCB.returnToMapAfterRoom();
      });
      artifactRow.appendChild(node);
    });

    box.appendChild(artifactRow);
  }

  overlay.appendChild(box);
  document.body.appendChild(overlay);
};

DCB.showDiscardOneCardModal = function () {
  DCB.closeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "overlay";
  overlay.className = "overlay";

  const box = document.createElement("div");
  box.className = "panel modal";
  box.innerHTML = `
    <div class="row" style="margin-bottom:10px;">
      <div>
        <div class="big">Discard a card</div>
        <div class="mini">Choose one card from your hand to discard.</div>
      </div>
    </div>
  `;

  const cardRow = document.createElement("div");
  cardRow.className = "cards";

  DCB.G.hand.forEach((card) => {
    const node = document.createElement("div");
    node.className = `card ${card.type.toLowerCase()}`;
    node.innerHTML = `
      <div class="tag ${card.type.toLowerCase()}">${card.type}</div>
      <div class="top">
        <div class="cost">${card.cost}</div>
        <div>
          <div class="cname">${card.name}</div>
          <div class="ctype">Discard</div>
        </div>
      </div>
      <div class="desc">${card.desc}</div>
    `;
    node.addEventListener("click", () => {
      const discarded = DCB.removeCardFromHand(card.instanceId);
      if (discarded) {
        DCB.G.discard.push(discarded);
        DCB.log(DCB.G, `You discard ${discarded.name}.`, true);
      }
      DCB.closeOverlay();
      DCB.renderAll();
    });
    cardRow.appendChild(node);
  });

  box.appendChild(cardRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
};

DCB.showUpgradeCardModal = function () {
  DCB.closeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "overlay";
  overlay.className = "overlay";

  const box = document.createElement("div");
  box.className = "panel modal";

  const upgradableCards = DCB.sortCampfireUpgradeCards(
    DCB.getAllDeckCards().filter(card => DCB.getUpgradedCardId(card.id, "campfire"))
  );

  box.innerHTML = `
    <div class="row" style="margin-bottom:10px;">
      <div>
        <div class="big">Upgrade a card</div>
        <div class="mini">Choose a card to upgrade.</div>
      </div>
      <div class="spacer"></div>
      <button id="backToCampfire" class="btn">Back</button>
    </div>
  `;

  const cardRow = document.createElement("div");
  cardRow.className = "cards";

  upgradableCards.forEach((c) => {
    const upgradedId = DCB.getUpgradedCardId(c.id, "campfire");
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
      const result = DCB.upgradeCardInstance(c.instanceId, "campfire");
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

      DCB.showShopModal();
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

  if (DCB.G.shopOfferNodeId !== DCB.G.currentMapNodeId || DCB.G.shopOffers.length === 0) {
    DCB.G.shopOfferNodeId = DCB.G.currentMapNodeId;
    DCB.G.shopOffers = DCB.rewardChoices(6).map(card => ({
      card,
      purchased: false
    }));
  }

  const shopOffers = DCB.G.shopOffers;

  const header = document.createElement("div");
  header.className = "row";
  header.style.marginBottom = "10px";
  header.innerHTML = `
    <div>
      <div class="big">Shop</div>
      <div class="mini">Spend your gold on new cards or remove weak ones from your deck.</div>
    </div>
    <div class="spacer"></div>
    <div class="badge gold" id="shopGoldText">Gold: ${DCB.G.gold}</div>
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
    DCB.G.shopOfferNodeId = null;
    DCB.G.shopOffers = [];
    DCB.showMapModal();
    DCB.renderAll();
  });

  controls.appendChild(removeBtn);
  controls.appendChild(leaveBtn);

  const cardRow = document.createElement("div");
  cardRow.className = "cards";

  const refreshShopAffordability = () => {
    const goldText = document.getElementById("shopGoldText");
    if (goldText) goldText.textContent = `Gold: ${DCB.G.gold}`;
    removeBtn.disabled = DCB.G.gold < 75 || DCB.getAllDeckCards().length === 0;
    cardRow.querySelectorAll("[data-shop-card]").forEach((cardNode) => {
      if (cardNode.dataset.purchased === "true") return;
      cardNode.classList.toggle("disabled", DCB.G.gold < 50);
    });
  };

  shopOffers.forEach((offer) => {
    const c = offer.card;
    const affordable = DCB.G.gold >= 50;
    const node = document.createElement("div");
    node.className = `card ${c.type.toLowerCase()}${affordable && !offer.purchased ? "" : " disabled"}`;
    node.dataset.shopCard = "true";
    node.dataset.purchased = offer.purchased ? "true" : "false";
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
      <div class="price">${offer.purchased ? "Purchased" : "Cost: 50 gold"}</div>
    `;
    node.addEventListener("click", () => {
      if (node.dataset.purchased === "true" || DCB.G.gold < 50) return;
      DCB.G.gold -= 50;
      DCB.G.discard.push(c);
      offer.purchased = true;
      node.dataset.purchased = "true";
      node.classList.add("disabled");
      node.querySelector(".price").textContent = "Purchased";
      DCB.log(DCB.G, `🛒 You buy ${c.name} for 50 gold.`, true);

      DCB.renderAll();
      refreshShopAffordability();
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
    <div class="big" style="font-size:22px; margin-bottom:8px;">You Win</div>
    <div class="mini" style="margin-bottom:16px;">
      You defeated the Dungeon Boss and cleared the map.
    </div>
    <div class="row">
      <div class="badge gold">Final Gold: ${DCB.G.gold}</div>
      <div class="badge">Final Strength: ${DCB.G.hero.strength}</div>
      <div class="badge">HP: ${DCB.G.hero.hp}/${DCB.G.hero.maxHp}</div>
    </div>
    <div class="finalActions" style="margin-top:16px;">
      <button id="victoryNewRun" class="btn primary">Start New Run</button>
    </div>
  `;

  const actions = box.querySelector(".finalActions");
  box.insertBefore(DCB.createFinalStatsSection(true), actions);

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById("victoryNewRun").addEventListener("click", () => {
    DCB.newRun();
  });
};

DCB.showDefeatModal = function () {
  DCB.closeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "overlay";
  overlay.className = "overlay";

  const box = document.createElement("div");
  box.className = "panel modal";
  box.innerHTML = `
    <div class="big" style="font-size:22px; margin-bottom:8px;">You Died</div>
    <div class="mini" style="margin-bottom:16px;">
      You were defeated on Map Row ${DCB.G.floor}.
    </div>
    <div class="row">
      <div class="badge gold">Final Gold: ${DCB.G.gold}</div>
      <div class="badge">Final Strength: ${DCB.G.hero.strength}</div>
      <div class="badge">HP: ${DCB.G.hero.hp}/${DCB.G.hero.maxHp}</div>
    </div>
    <div class="finalActions" style="margin-top:16px;">
      <button id="defeatNewRun" class="btn primary">Start New Run</button>
    </div>
  `;

  const actions = box.querySelector(".finalActions");
  box.insertBefore(DCB.createFinalStatsSection(false), actions);

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById("defeatNewRun").addEventListener("click", () => {
    DCB.newRun();
  });
};
