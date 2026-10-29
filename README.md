# Care

Pick a problem (food, housing, health, ...), enter a location, and get a list of nearby providers from Google Places.

## Run

```
export GOOGLE_PLACES_API_KEY=your-key   # needs "Places API (New)" enabled
node server.js
```

Open http://localhost:3000. The key stays on the server (`/api/providers` proxies Google); never put it in `public/`.

Add or edit problem categories in `PROBLEMS` in `server.js` and the matching labels in `public/index.html`.
