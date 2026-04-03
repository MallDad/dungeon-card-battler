window.DCB = window.DCB || {};

DCB.clamp = function (n, a, b) {
  return Math.max(a, Math.min(b, n));
};

DCB.shuffle = function (arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

DCB.rng = function (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

DCB.el = function (tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2), v);
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const c of children) {
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
};