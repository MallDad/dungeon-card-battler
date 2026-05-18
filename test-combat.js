const fs = require("fs");
const vm = require("vm");

const context = {
  window: {},
  console,
  Math,
  document: {
    addEventListener: () => {}
  }
};

context.window.DCB = {};
context.DCB = context.window.DCB;
vm.createContext(context);

["js/cards.js", "js/game.js"].forEach((file) => {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
});

const DCB = context.DCB;
const G = {
  artifactTurnState: {},
  currentPlayingCard: { type: "Attack" },
  artifacts: [],
  enemy: { name: "Dummy", hp: 10, maxHp: 10, block: 0 },
  hero: { strength: 0, block: 0 },
  over: false
};

DCB.log = () => {};
DCB.endBattle = () => {};
DCB.hasArtifact = () => false;
DCB.clamp = (value, min, max) => Math.max(min, Math.min(max, value));

DCB.CARD_LIBRARY.flurry.play(G);

if (G.enemy.hp !== 10) {
  throw new Error("Flurry should deal 0 damage when no cards have been played this turn.");
}

G.artifactTurnState.cardsPlayedThisTurn = 3;
DCB.CARD_LIBRARY.flurry.play(G);

if (G.enemy.hp !== 4) {
  throw new Error("Flurry should deal 2 damage per card already played this turn.");
}

console.log("Combat card test passed.");
