// src/lib/search.js
// ─────────────────────────────────────────────────────────────────────────────
// Azure AI Search — client + index bootstrap
// Called once at startup (after Key Vault loads)
// ─────────────────────────────────────────────────────────────────────────────

const SEARCH_INDEX_NAME = process.env.SEARCH_INDEX_NAME || "events";

// ── Index schema (what fields are searchable / filterable) ───────────────────
const INDEX_DEFINITION = {
  name: SEARCH_INDEX_NAME,
  fields: [
    {
      name: "id",
      type: "Edm.String",
      key: true,
      searchable: false,
      filterable: true,
    },
    {
      name: "title",
      type: "Edm.String",
      searchable: true,
      filterable: false,
      sortable: true,
      analyzer: "en.microsoft",    // FIXED
    },
    {
      name: "description",
      type: "Edm.String",
      searchable: true,
      filterable: false,
      analyzer: "en.microsoft",    // FIXED
    },
    {
      name: "venue",
      type: "Edm.String",
      searchable: true,
      filterable: true,
      sortable: true,
    },
    {
      name: "eventDate",
      type: "Edm.DateTimeOffset",
      searchable: false,
      filterable: true,
      sortable: true,
    },
    {
      name: "ticketPrice",
      type: "Edm.Double",
      searchable: false,
      filterable: true,
      sortable: true,
    },
    {
      name: "isFree",
      type: "Edm.Boolean",
      searchable: false,
      filterable: true,
    },
    {
      name: "availableSeats",
      type: "Edm.Int32",
      searchable: false,
      filterable: true,
    },
    {
      name: "status",
      type: "Edm.String",
      searchable: false,
      filterable: true,
    },
    {
      name: "organizerId",
      type: "Edm.Int32",
      searchable: false,
      filterable: true,
    },
    {
      name: "organizerName",
      type: "Edm.String",
      searchable: true,
      filterable: false,
    },
  ],
};

// ── Lazy client (created once after vault loads) ─────────────────────────────
let _endpoint = null;
let _apiKey   = null;

function getSearchConfig() {
  if (!_endpoint) {
    _endpoint = process.env.SEARCH_ENDPOINT;
    _apiKey   = process.env.SEARCH_API_KEY;
  }
  return { endpoint: _endpoint, apiKey: _apiKey };
}

// ── Generic REST helper (no SDK needed — keeps dependencies minimal) ──────────
async function searchRequest(method, path, body = null) {
  const { endpoint, apiKey } = getSearchConfig();

  if (!endpoint || !apiKey) {
    throw new Error("[SEARCH] SEARCH_ENDPOINT or SEARCH_API_KEY not set");
  }

  const url = `${endpoint}${path}`;

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}

  if (!res.ok) {
    throw new Error(`[SEARCH] ${method} ${path} → ${res.status}: ${text}`);
  }

  return json;
}

// ── Create the index if it doesn't exist ─────────────────────────────────────
async function ensureIndexExists() {
  const { endpoint, apiKey } = getSearchConfig();

  if (!endpoint || !apiKey) {
    console.warn("[SEARCH] Credentials not set — skipping index creation");
    return;
  }

  try {
    // Check if index already exists
    const checkRes = await fetch(
      `${endpoint}/indexes/${SEARCH_INDEX_NAME}?api-version=2024-05-01-preview`,
      { headers: { "api-key": apiKey } }
    );

    if (checkRes.status === 200) {
      console.log(`✅ [SEARCH] Index "${SEARCH_INDEX_NAME}" already exists`);
      return;
    }

    // Create it
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