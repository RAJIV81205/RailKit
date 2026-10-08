import fs from "node:fs/promises";
import path from "node:path";

const outputPath = path.join(process.cwd(), "public", "data", "india-stations.json");
const sourceUrl = `https://enquiry.indianrail.gov.in/mntes/javascripts/station_map_data.js?v=${Math.floor(Date.now() / 1000)}`;

function parseCoordinate(value) {
  const coordinate = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(coordinate) ? coordinate : null;
}

function parseStations(source) {
  const match = source.match(/_ALL_STNS_ARR_STR\s*=\s*"([\s\S]*?)";/);
  if (!match?.[1]) throw new Error("The station list was not found in the source response.");

  const values = match[1].replace(/\\"/g, '"').replace(/\\[nr]/g, "").trim().split(",");
  const stations = [];

  for (let index = 0; index < values.length; index += 5) {
    const code = String(values[index] || "").trim().toUpperCase();
    const name = String(values[index + 1] || "").trim();
    if (!code || !name) continue;

    stations.push({
      code,
      name,
      lat: parseCoordinate(values[index + 3]),
      lon: parseCoordinate(values[index + 4]),
    });
  }

  if (!stations.length) throw new Error("The source returned no stations.");
  return stations;
}

function getISTTimestamp() {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

async function updateStationData() {
  const response = await fetch(sourceUrl, {
    headers: {
      Accept: "*/*",
      Referer: "https://enquiry.indianrail.gov.in/mntes/q?opt=MainMenu&subOpt=liveStation&excpType=",
    },
  });

  if (!response.ok) throw new Error(`Station source returned HTTP ${response.status}.`);

  const stations = parseStations(await response.text());
  const payload = {
    updatedAtIST: getISTTimestamp(),
    totalStations: stations.length,
    stations,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Updated ${stations.length.toLocaleString("en-IN")} stations in ${outputPath}`);
}

updateStationData().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
