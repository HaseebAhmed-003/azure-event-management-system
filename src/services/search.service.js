// src/services/search.service.js
// ─────────────────────────────────────────────────────────────────────────────
// High-level Azure AI Search operations
//   indexEvent(event)         — upsert one event into the index
//   removeEventFromIndex(id)  — delete one event from index
//   searchEvents(params)      — query the index (typo-tolerant, filterable)
// ─────────────────────────────────────────────────────────────────────────────

const { searchRequest, SEARCH_INDEX_NAME } = require("../lib/search");

const API_VERSION = "2024-05-01-preview";

// ── Convert Prisma Event object → Search document ────────────────────────────
function toDocument(event) {
  return {
    "@search.action": "mergeOrUpload",
    id:             String(event.id),
    title:          event.title         || "",
    description:    event.description   || "",
    venue:          event.venue         || "",
    eventDate:      event.eventDate ? new Date(event.eventDate).toISOString() : null,
    ticketPrice:    Number(event.ticketPrice || 0),
    isFree:         Boolean(event.isFree),
    availableSeats: Number(event.availableSeats || 0),
    status:         event.status        || "DRAFT",
    organizerId:    Number(event.organizerId || 0),
    organizerName:  event.organizer?.name || "",
  };
}

// ── Push / update one event in the index ─────────────────────────────────────
async function indexEvent(event) {
  try {
    await searchRequest(
      "POST",
      `/indexes/${SEARCH_INDEX_NAME}/docs/index?api-version=${API_VERSION}`,
      { value: [toDocument(event)] }
    );
    console.log(`[SEARCH] Indexed event ${event.id}`);
  } catch (err) {
    // Non-fatal — search is a feature, not core functionality
    console.error(`[SEARCH] Failed to index event ${event.id}:`, err.message);
  }
}

// ── Remove one event from the index ──────────────────────────────────────────
async function removeEventFromIndex(eventId) {
  try {
    await searchRequest(
      "POST",
      `/indexes/${SEARCH_INDEX_NAME}/docs/index?api-version=${API_VERSION}`,
      {
        value: [
          {
            "@search.action": "delete",
            id: String(eventId),
          },
        ],
      }
    );
    console.log(`[SEARCH] Removed event ${eventId} from index`);
  } catch (err) {
    console.error(`[SEARCH] Failed to remove event ${eventId}:`, err.message);
  }
}

// ── Search the index ──────────────────────────────────────────────────────────
// Params: search, from, to, venue, isFree, minPrice, maxPrice, skip, take
async function searchEvents({
  search = "*",
  from,
  to,
  venue,
  isFree,
  minPrice,
  maxPrice,
  skip = 0,
  take = 50,
} = {}) {
  // Build OData $filter string
  const filters = ["status eq 'PUBLISHED'"];

  if (venue) {
    // Partial venue match via search.ismatch
    filters.push(`search.ismatch('${venue.replace(/'/g, "''")}', 'venue')`);
  }

  if (from) {
    filters.push(`eventDate ge ${new Date(from).toISOString()}`);
  }

  if (to) {
    filters.push(`eventDate le ${new Date(to).toISOString()}`);
  }

  if (isFree === "true" || isFree === true) {
    filters.push("isFree eq true");
  }

  if (minPrice !== undefined && minPrice !== "") {
    filters.push(`ticketPrice ge ${Number(minPrice)}`);
  }

  if (maxPrice !== undefined && maxPrice !== "") {
    filters.push(`ticketPrice le ${Number(maxPrice)}`);
  }

  const filterString = filters.join(" and ");

  // Build the search body
  const body = {
    search:       search || "*",
    queryType:    "full",          // enables Lucene syntax + fuzzy
    searchMode:   "all",
    $filter:      filterString,
    $orderby:     "eventDate asc",
    $skip:        skip,
    $top:         take,
    $count:       true,
    searchFields: "title,description,venue,organizerName",
    // Fuzzy matching: append ~ to each term automatically
    // When queryType=full, user can type "music~" — we handle it transparently
  };

  // If the user typed a plain word (no special chars), add fuzzy automatically
  if (search && search !== "*" && !/[+\-&|!(){}[\]^"~*?:\\]/.test(search)) {
    // Turn "conference" into "conference~1" (allows 1 edit distance = typo tolerance)
    body.search = search
      .trim()
      .split(/\s+/)
      .map((term) => `${term}~1`)
      .join(" ");
  }

  try {
    const result = await searchRequest(
      "POST",
      `/indexes/${SEARCH_INDEX_NAME}/docs/search?api-version=${API_VERSION}`,
      body
    );

    return {
      total: result["@odata.count"] || 0,
      results: (result.value || []).map((doc) => ({
        id:             Number(doc.id),
        title:          doc.title,
        description:    doc.description,
        venue:          doc.venue,
        eventDate:      doc.eventDate,
        ticketPrice:    doc.ticketPrice,
        isFree:         doc.isFree,
        availableSeats: doc.availableSeats,
        status:         doc.status,
        organizerId:    doc.organizerId,
        organizerName:  doc.organizerName,
        score:          doc["@search.score"],
      })),
    };
  } catch (err) {
    console.error("[SEARCH] Query failed:", err.message);
    // Fallback to empty results instead of crashing
    return { total: 0, results: [] };
  }
}

module.exports = {
  indexEvent,
  removeEventFromIndex,
  searchEvents,
};