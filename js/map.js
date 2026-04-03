window.DCB = window.DCB || {};

DCB.MAP_TEMPLATE = [
  ["fight", "fight", "fight"],
  ["shop", "fight", "campfire"],
  ["fight", "elite", "fight"],
  ["campfire", "fight", "shop"],
  ["fight", "elite"],
  ["boss"]
];

DCB.generateMapFromTemplate = function () {
  const map = [];
  for (let row = 0; row < DCB.MAP_TEMPLATE.length; row++) {
    const rowTypes = DCB.MAP_TEMPLATE[row];
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
};

DCB.getNodeById = function (id) {
  for (const row of DCB.G.map) {
    for (const node of row) {
      if (node.id === id) return node;
    }
  }
  return null;
};

DCB.getSelectableNodeIds = function () {
  if (DCB.G.runComplete) return [];

  if (DCB.G.currentMapNodeId === null) {
    return DCB.G.map[0].map(node => node.id);
  }

  const current = DCB.getNodeById(DCB.G.currentMapNodeId);
  if (!current) return [];
  return current.connectsTo || [];
};

DCB.nodeLabel = function (type) {
  if (type === "fight") return "Fight";
  if (type === "campfire") return "Campfire";
  if (type === "shop") return "Shop";
  if (type === "elite") return "Elite";
  if (type === "boss") return "Boss";
  if (type === "start") return "Start";
  return "Unknown";
};

DCB.nodeBadgeClass = function (type) {
  if (type === "fight") return "node-fight";
  if (type === "campfire") return "node-campfire";
  if (type === "shop") return "node-shop";
  if (type === "elite") return "node-elite";
  if (type === "boss") return "node-boss";
  return "";
};

DCB.enterNode = function (nodeId) {
  DCB.closeOverlay();

  const node = DCB.getNodeById(nodeId);
  if (!node) return;

  const selectable = DCB.getSelectableNodeIds();
  if (!selectable.includes(nodeId)) return;

  DCB.G.currentMapNodeId = node.id;
  DCB.G.currentMapRow = node.row;
  DCB.G.floor = node.row + 1;
  DCB.G.nodeType = node.type;

  DCB.log(DCB.G, "", true);
  DCB.log(DCB.G, `=== Map Row ${DCB.G.floor}: ${DCB.nodeLabel(node.type)} ===`, true);

  if (node.type === "fight" || node.type === "elite" || node.type === "boss") {
    DCB.startEncounter(node.type, node.row);
  } else if (node.type === "campfire") {
    DCB.showCampfireModal();
  } else if (node.type === "shop") {
    DCB.showShopModal();
  }

  DCB.renderAll();
};

DCB.startEncounter = function (nodeType, mapRow) {
  DCB.G.enemy = DCB.makeEnemyForNode(nodeType, mapRow);
  DCB.G.over = false;

  const intro =
    nodeType === "boss"
      ? "The Dungeon Boss blocks your path!"
      : nodeType === "elite"
        ? `A ${DCB.G.enemy.name} appears! It looks dangerous.`
        : `A ${DCB.G.enemy.name} appears!`;

  DCB.log(DCB.G, intro, false);
  DCB.startHeroTurn(DCB.G);
};

DCB.buildMapNodePositions = function (boardWidth, boardHeight) {
  const positions = {};
  const totalRows = DCB.G.map.length;

  for (let row = 0; row < totalRows; row++) {
    const nodes = DCB.G.map[row];
    const count = nodes.length;
    const y = boardHeight - 80 - (row * ((boardHeight - 160) / Math.max(1, totalRows - 1)));

    for (let col = 0; col < count; col++) {
      const x = ((col + 1) / (count + 1)) * boardWidth;
      positions[nodes[col].id] = { x, y };
    }
  }

  return positions;
};

DCB.renderMapIntoBoard = function (board) {
  if (!board) return;

  board.innerHTML = "";

  const selectableIds = DCB.getSelectableNodeIds();
  const currentNode = DCB.G.currentMapNodeId ? DCB.getNodeById(DCB.G.currentMapNodeId) : null;

  const boardWidth = board.clientWidth;
  const boardHeight = board.clientHeight;
  const positions = DCB.buildMapNodePositions(boardWidth, boardHeight);

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "mapSvg");
  svg.setAttribute("viewBox", `0 0 ${boardWidth} ${boardHeight}`);
  svg.setAttribute("width", boardWidth);
  svg.setAttribute("height", boardHeight);

  for (const row of DCB.G.map) {
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

  for (const row of DCB.G.map) {
    for (const node of row) {
      const pos = positions[node.id];
      const nodeEl = document.createElement("button");
      nodeEl.type = "button";
      nodeEl.className = `mapNode ${node.type}`;
      nodeEl.textContent = DCB.nodeLabel(node.type);
      nodeEl.style.left = `${pos.x}px`;
      nodeEl.style.top = `${pos.y}px`;

      if (node.completed) nodeEl.classList.add("completed");
      if (DCB.G.currentMapNodeId === node.id) nodeEl.classList.add("current");
      if (selectableIds.includes(node.id)) nodeEl.classList.add("selectable");

      const canSelect = selectableIds.includes(node.id);
      nodeEl.disabled = !canSelect;

      if (!canSelect) {
        nodeEl.style.cursor = "default";
      } else {
        nodeEl.addEventListener("click", () => {
          DCB.enterNode(node.id);
        });
      }

      board.appendChild(nodeEl);
    }
  }
};

DCB.mapResizeTimer = null;

DCB.rerenderOpenMapOnResize = function () {
  if (DCB.mapResizeTimer) clearTimeout(DCB.mapResizeTimer);

  DCB.mapResizeTimer = setTimeout(() => {
    const board = document.getElementById("mapBoard");
    if (board) {
      DCB.renderMapIntoBoard(board);
    }
  }, 50);
};

DCB.showMapModal = function () {
  DCB.closeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "overlay";
  overlay.className = "overlay";

  const box = document.createElement("div");
  box.className = "panel modal";

  const currentNode = DCB.G.currentMapNodeId ? DCB.getNodeById(DCB.G.currentMapNodeId) : null;

  box.innerHTML = `
    <div class="row" style="margin-bottom:10px;">
      <div>
        <div class="big">Dungeon Map</div>
        <div class="mini">${currentNode ? `Current position: ${DCB.nodeLabel(currentNode.type)} on row ${currentNode.row + 1}.` : "Choose your first node on row 1."}</div>
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
  DCB.renderMapIntoBoard(board);

  document.getElementById("closeMapBtn").addEventListener("click", () => {
    DCB.closeOverlay();
  });
};