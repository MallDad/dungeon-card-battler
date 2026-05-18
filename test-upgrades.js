const fs = require("fs");
const vm = require("vm");

const context = {
  window: {},
  console,
  Math,
  document: {}
};

context.window.DCB = {};
context.DCB = context.window.DCB;
vm.createContext(context);

["js/cards.js", "js/rooms.js"].forEach((file) => {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
});

const DCB = context.DCB;
DCB.nextCardInstanceId = 1;
DCB.makeCard = (id) => ({
  ...DCB.CARD_LIBRARY[id],
  instanceId: DCB.nextCardInstanceId++
});

DCB.G = {
  deck: [
    "strike", "strike", "strike", "strike", "strike",
    "defend", "defend", "defend", "defend", "defend",
    "quickStab",
    "poisonDart",
    "barricade",
    "tactician",
    "heal"
  ].map((id) => DCB.makeCard(id)),
  discard: [],
  hand: []
};

const campfireUpgrades = DCB.sortCampfireUpgradeCards(
  DCB.getAllDeckCards().filter((card) => DCB.getUpgradedCardId(card.id, "campfire"))
).map((card) => ({
  from: card.id,
  to: DCB.getUpgradedCardId(card.id, "campfire")
}));

const poisonBladeUpgrade = campfireUpgrades.find((upgrade) => upgrade.from === "poisonDart");

if (!poisonBladeUpgrade || poisonBladeUpgrade.to !== "poisonBlade") {
  throw new Error("Campfire upgrades must include Poison Dart -> Poison Blade.");
}

if (campfireUpgrades[0].from !== "poisonDart") {
  throw new Error("Poison Dart should be the first campfire upgrade option.");
}

const barricadeUpgrade = campfireUpgrades.find((upgrade) => upgrade.from === "barricade");

if (!barricadeUpgrade || barricadeUpgrade.to !== "barricadePlus") {
  throw new Error("Campfire upgrades must include Barricade -> Barricade+.");
}

const tacticianUpgrade = campfireUpgrades.find((upgrade) => upgrade.from === "tactician");

if (!tacticianUpgrade || tacticianUpgrade.to !== "masterTactician") {
  throw new Error("Campfire upgrades must include Tactician -> Master Tactician.");
}

console.log("Campfire upgrade test passed.");
