import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2];
const outputPath = process.argv[3] || path.resolve("public/data/india-railways.json");

if (!inputPath) {
  console.error("Usage: node scripts/buildRailwayGeometry.mjs <railways.geojson> [output.json]");
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const precision = 5;
const tolerance = 0.0008;

const round = (value) => Number(Number(value).toFixed(precision));
const key = (point) => `${point[0]},${point[1]}`;

const lines = source.features
  .filter((feature) => feature?.properties?.railway === "rail" && feature?.geometry?.type === "LineString")
  .map((feature) => feature.geometry.coordinates.map(([lng, lat]) => [round(lat), round(lng)]))
  .filter((line) => line.length > 1);

const endpoints = new Map();
for (let index = 0; index < lines.length; index += 1) {
  for (const point of [lines[index][0], lines[index][lines[index].length - 1]]) {
    const endpoint = key(point);
    const connected = endpoints.get(endpoint) || [];
    connected.push(index);
    endpoints.set(endpoint, connected);
  }
}

const visited = new Uint8Array(lines.length);
const merged = [];

function attach(chain, atEnd) {
  while (true) {
    const endpoint = key(atEnd ? chain[chain.length - 1] : chain[0]);
    const candidates = (endpoints.get(endpoint) || []).filter((index) => !visited[index]);
    if (candidates.length !== 1) return;
    const index = candidates[0];
    visited[index] = 1;
    let next = lines[index];
    if (key(next[0]) !== endpoint) next = next.slice().reverse();
    if (atEnd) chain.push(...next.slice(1));
    else chain.unshift(...next.slice(0, -1).reverse());
  }
}

function consume(index) {
  if (visited[index]) return;
  visited[index] = 1;
  const chain = lines[index].slice();
  attach(chain, true);
  attach(chain, false);
  merged.push(chain);
}

for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index];
  if ((endpoints.get(key(line[0]))?.length || 0) !== 2 || (endpoints.get(key(line[line.length - 1]))?.length || 0) !== 2) {
    consume(index);
  }
}
for (let index = 0; index < lines.length; index += 1) consume(index);

function sqSegmentDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = end[0]; y = end[1]; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplify(line) {
  if (line.length <= 2) return line;
  const threshold = tolerance * tolerance;
  const keep = new Uint8Array(line.length);
  keep[0] = 1;
  keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDistance = threshold;
    let split = -1;
    for (let index = first + 1; index < last; index += 1) {
      const distance = sqSegmentDistance(line[index], line[first], line[last]);
      if (distance > maxDistance) { maxDistance = distance; split = index; }
    }
    if (split !== -1) {
      keep[split] = 1;
      stack.push([first, split], [split, last]);
    }
  }
  return line.filter((_, index) => keep[index]);
}

const outputLines = merged.map(simplify).filter((line) => line.length > 1);
const payload = {
  source: "OpenStreetMap via Humanitarian OpenStreetMap Team",
  sourceUrl: "https://data.humdata.org/dataset/hotosm_ind_railways",
  generatedAt: new Date().toISOString(),
  toleranceDegrees: tolerance,
  lineCount: outputLines.length,
  lines: outputLines,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(payload));
console.log(JSON.stringify({ inputLines: lines.length, outputLines: outputLines.length, bytes: fs.statSync(outputPath).size }));
