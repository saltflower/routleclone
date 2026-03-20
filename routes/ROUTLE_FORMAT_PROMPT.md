# Routle GeoJSON Formatting Prompt

Copy and paste the following to an AI along with your transit system's GeoJSON file:

---

I have a GeoJSON file for a transit system that I want to format for use in a game called Routle. Please convert it to match the required schema exactly.

## Required output format

The output must be a valid GeoJSON FeatureCollection where every feature has this exact structure:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "MultiLineString",
    "coordinates": [
      [[lon, lat], [lon, lat], ...],
      ...
    ]
  },
  "properties": {
    "lineabbr": "22",
    "linename": "STEVENS CREEK - EASTRIDGE",
    "category": "Frequent"
  }
}
```

## Field rules

- **`lineabbr`** — The short route identifier shown on the guess button. Usually a number or short code (e.g. `"22"`, `"101"`, `"BLUE"`, `"R"`). If the source data has a route number or short name, use that. Must be a string.
- **`linename`** — The full human-readable name of the route (e.g. origin to destination). Must be a string. If unavailable, use the route's long name or a descriptive label.
- **`category`** — The service type. Pick the best match from the source data. Common values: `"Local"`, `"Express"`, `"Frequent"`, `"Rapid"`, `"Light Rail"`, `"Subway"`, `"Ferry"`, `"Commuter Rail"`, `"Bus Rapid Transit"`, `"Special"`, `"Shuttle"`. If the source has no category info, use `"Local"` as a default.

## Geometry rules

- All features must use `MultiLineString` geometry (even if the source uses `LineString` — wrap single lines in an extra array).
- Coordinates must be `[longitude, latitude]` order (standard GeoJSON).
- Remove all other properties from features — only keep `lineabbr`, `linename`, and `category`.
- Remove any top-level properties other than `type`, `name` (optional), and `features`.

## Output

Return the complete formatted GeoJSON. After formatting, tell me:
1. How many routes are in the file
2. What categories were used
3. Any routes where you had to guess or infer field values

---

## After you get the formatted file

1. Save it as `YourSystemName.geojson` inside the `routes/` folder.
2. Open `script.js` and add an entry to the `TRANSIT_SYSTEMS` array at the top:

```js
const TRANSIT_SYSTEMS = [
    { id: 'VTA',  name: 'VTA — Santa Clara', file: 'routes/VTA.geojson' },
    { id: 'MUNI', name: 'Muni — San Francisco', file: 'routes/MUNI.geojson' },
    //  ^^^^ add yours here
];
```

- **`id`** — a short unique identifier, no spaces (used internally for seeding)
- **`name`** — display name shown in the sidebar
- **`file`** — path relative to the root of the project
