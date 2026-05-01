// src/lib/search.js
// ─────────────────────────────────────────────────────────────────────────────
// Azure AI Search — REST client + index bootstrap
// ─────────────────────────────────────────────────────────────────────────────

// BUG FIX: fetch is only built-in from Node 18+.
// This polyfill makes it work on any Node version.
const _fetch = (() => {
  if (typeof globalThis.fetch === "function") return globalThis.fetch.bind(globalThis);
  try { return require("node-fetch"); } catch (_) { return null; }
})();

if (!_fetch) {
  console.error(
    "[SEARCH] No fetch available. Run: npm install node-fetch@2\n" +
    "Or upgrade to Node.js 18+"
  );
}

// ── Index name ────────────────────────────────────────────────────────────────
// Read at module load — comes from .env (not Key Vault), dotenv already ran
const SEARCH_INDEX_NAME = process.env.SEARCH_INDEX_NAME || "events";

// ── Index schema ──────────────────────────────────────────────────────────────
// IMPORTANT: If you change this schema after the index already exists in Azure,
// you must delete the index in the Azure Portal and restart the server so it
// gets recreated. Go to: Portal → event-search-iba → Indexes → delete "events"
const INDEX_DEFINITION = {
  name: SEARCH_INDEX_NAME,
  fields: [
    {
      name:        "id",
      type:        "Edm.String",
      key:         true,
      searchable:  false,
      filterable:  true,
    },
    {
      name:        "title",
      type:        "Edm.String",
      searchable:  true,
      filterable:  false,
      sortable:    true,
      analyzer:    "en.microsoft",
    },
    {
      name:        "description",
      type:        "Edm.String",
      searchable:  true,
      filterable:  false,
      sortable:    false,
      analyzer:    "en.microsoft",
    },
    {
      name:        "venue",
      type:        "Edm.String",
      searchable:  true,    // ← searchable so Lucene field syntax works
      filterable:  false,   // ← NOT filterable (search.ismatch not on Free tier)
      sortable:    true,
    },
    {
      name:        "eventDate",
      type:        "Edm.DateTimeOffset",
      searchable:  false,
      filterable:  true,
      sortable:    true,
    },
    {
      name:        "ticketPrice",
      type:        "Edm.Double",
      searchable:  false,
      filterable:  true,
      sortable:    true,
    },
    {
      name:        "isFree",
      type:        "Edm.Boolean",
      searchable:  false,
      filterable:  true,
    },
    {
      name:        "availableSeats",
      type:        "Edm.Int32",
      searchable:  false,
      filterable:  true,
    },
    {
      name:        "status",
      type:        "Edm.String",
      searchable:  false,
      filterable:  true,
    },
    {
      name:        "organizerId",
      type:        "Edm.Int32",
      searchable:  false,
      filterable:  true,
    },
    {
      name:        "organizerName",
      type:        "Edm.String",
      searchable:  true,
      filterable:  false,
    },
    {
      name:        "bannerUrl",
      type:        "Edm.String",
      searchable:  false,
      filterable:  false,
      sortable:    false,
      retrievable: true,
    },
  ],
};

// ── Lazy config (re-read from process.env on every call until set) ────────────
let _endpoint = null;
let _apiKey   = null;

function getSearchConfig() {
  // Always re-read if not yet set (Key Vault may not have loaded at first require)
  if (!_endpoint && process.env.SEARCH_ENDPOINT) {
    _endpoint = process.env.SEARCH_ENDPOINT;
    _apiKey   = process.env.SEARCH_API_KEY;
  }
  return { endpoint: _endpoint, apiKey: _apiKey };
}

// ── Generic REST helper ───────────────────────────────────────────────────────
async function searchRequest(method, path, body = null) {
  const { endpoint, apiKey } = getSearchConfig();

  if (!endpoint || !apiKey) {
    throw new Error("[SEARCH] SEARCH_ENDPOINT or SEARCH_API_KEY not loaded from Key Vault");
  }

  const url = `${endpoint}${path}`;

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
  };

  if (body) options.body = JSON.stringify(body);

  const res = await _fetch(url, options);
  const text = await res.text();

  let json = null;
  try { json = JSON.parse(text); } catch (_) {}

  if (!res.ok) {
    throw new Error(`[SEARCH] ${method} ${path} → HTTP ${res.status}: ${text}`);
  }

  return json;
}

// ── Create the index if it doesn't exist ─────────────────────────────────────
async function ensureIndexExists() {
  const { endpoint, apiKey } = getSearchConfig();

  if (!endpoint || !apiKey) {
    console.warn("[SEARCH] Credentials not yet available — skipping index check");
    return;
  }

  try {
    // Check existence
    const checkRes = await _fetch(
      `${endpoint}/indexes/${SEARCH_INDEX_NAME}?api-version=2024-05-01-preview`,
      { headers: { "api-key": apiKey } }
    );

    if (checkRes.status === 200) {
      console.log(`✅ [SEARCH] Index "${SEARCH_INDEX_NAME}" exists`);
      return;
    }

    // Create
    await searchRequest(
      "PUT",
      `/indexes/${SEARCH_INDEX_NAME}?api-version=2024-05-01-preview`,
      INDEX_DEFINITION
    );

    console.log(`✅ [SEARCH] Index "${SEARCH_INDEX_NAME}" created`);
  } catch (err) {
    console.error("[SEARCH] Failed to ensure index:", err.message);
  }
}

module.exports = {
  searchRequest,
  ensureIndexExists,
  SEARCH_INDEX_NAME,
};