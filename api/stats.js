const { neon } = require("@neondatabase/serverless");

let sqlClient;

function getSql() {
  const connectionString = (process.env.DATABASE_URL || "").replace(/^"|"$/g, "");
  if (!connectionString) return null;

  if (!sqlClient) {
    sqlClient = neon(connectionString);
  }

  return sqlClient;
}

async function ensureSchema() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS game_runs (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      won BOOLEAN NOT NULL,
      deck_size INTEGER NOT NULL CHECK (deck_size >= 0 AND deck_size <= 200)
    )
  `;
}

async function getStats() {
  const sql = getSql();

  await ensureSchema();

  const [stats] = await sql`
    SELECT
      COUNT(*)::int AS runs,
      COALESCE(ROUND((AVG(CASE WHEN won THEN 1 ELSE 0 END) * 100)::numeric, 1), 0)::float AS win_ratio,
      ROUND(AVG(deck_size) FILTER (WHERE won), 1)::float AS average_winning_deck_size
    FROM game_runs
  `;

  return {
    runs: stats.runs,
    winRatio: stats.win_ratio,
    averageWinningDeckSize: stats.average_winning_deck_size
  };
}

async function recordRun(req) {
  const sql = getSql();

  await ensureSchema();

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const won = body.won;
  const deckSize = Number(body.deckSize);

  if (typeof won !== "boolean" || !Number.isInteger(deckSize) || deckSize < 0 || deckSize > 200) {
    const error = new Error("Invalid run stats.");
    error.statusCode = 400;
    throw error;
  }

  await sql`
    INSERT INTO game_runs (won, deck_size)
    VALUES (${won}, ${deckSize})
  `;

  return getStats();
}

module.exports = async function handler(req, res) {
  try {
    if (!getSql()) {
      res.status(500).json({ error: "DATABASE_URL is not configured." });
      return;
    }

    if (req.method === "GET") {
      res.status(200).json(await getStats());
      return;
    }

    if (req.method === "POST") {
      res.status(200).json(await recordRun(req));
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: statusCode === 500 ? "Stats are unavailable." : error.message });
  }
};
