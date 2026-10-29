// Minimal dependency-free server: serves /public and proxies Google Places
// so the API key never reaches the browser.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const KEY = process.env.GOOGLE_PLACES_API_KEY;
const PUBLIC = path.join(__dirname, "public");

// Problem id -> Google text search query.
const PROBLEMS = {
  food: "food bank OR free meals OR food pantry",
  housing: "homeless shelter OR housing assistance",
  health: "free clinic OR community health center",
  mental: "mental health counseling",
  clothing: "free clothing donation center",
  legal: "free legal aid",
  jobs: "job training OR employment services",
};

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

async function providers(url, res) {
  const problem = url.searchParams.get("problem");
  const lat = parseFloat(url.searchParams.get("lat"));
  const lng = parseFloat(url.searchParams.get("lng"));
  const place = (url.searchParams.get("place") || "").slice(0, 100);

  if (!PROBLEMS[problem]) return send(res, 400, { error: "Unknown problem" });
  if (!KEY) return send(res, 500, { error: "GOOGLE_PLACES_API_KEY is not set on the server" });

  const body = { textQuery: PROBLEMS[problem] + (place ? " near " + place : ""), maxResultCount: 15 };
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 20000 } };
  } else if (!place) {
    return send(res, 400, { error: "Provide a location" });
  }

  try {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": KEY,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.currentOpeningHours.openNow",
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) return send(res, 502, { error: data.error?.message || "Google request failed" });
    const results = (data.places || []).map((p) => ({
      name: p.displayName?.text,
      address: p.formattedAddress,
      phone: p.nationalPhoneNumber,
      website: p.websiteUri,
      mapsUrl: p.googleMapsUri,
      rating: p.rating,
      openNow: p.currentOpeningHours?.openNow,
    }));
    send(res, 200, { results });
  } catch (e) {
    send(res, 502, { error: "Could not reach Google" });
  }
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/providers") return providers(url, res);
    const file = path.join(PUBLIC, url.pathname === "/" ? "index.html" : url.pathname);
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, "Forbidden", "text/plain");
    fs.readFile(file, (err, buf) =>
      err ? send(res, 404, "Not found", "text/plain") : send(res, 200, buf, TYPES[path.extname(file)] || "application/octet-stream")
    );
  })
  .listen(PORT, () => console.log(`Care running on http://localhost:${PORT}`));
