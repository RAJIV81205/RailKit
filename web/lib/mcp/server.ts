import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  cancelList,
  checkPNRStatus,
  configure,
  fareLookup,
  getAvailability,
  getTrainHistory,
  getTrainInfo,
  liveAtStation,
  searchTrainBetweenStations,
  stationByCode,
  stationsByName,
  trackTrain,
  trainByNumber,
  trainTimetableAtStation,
  trainsByName,
} from "railkit";

const trainNumber = z
  .string()
  .regex(/^\d{5}$/, "Train number must be exactly 5 digits");
const pnr = z.string().regex(/^\d{10}$/, "PNR must be exactly 10 digits");
const stationCode = z
  .string()
  .regex(/^[A-Za-z0-9]{1,5}$/, "Station code must be 1-5 letters or digits")
  .transform((value) => value.toUpperCase());
const date = z
  .string()
  .regex(/^\d{2}-\d{2}-\d{4}$/, "Date must use DD-MM-YYYY");
const trackDate = z
  .string()
  .regex(/^(today|\d{2}-\d{2}-\d{4})$/i, "Date must use DD-MM-YYYY or today");
const searchName = z.string().trim().min(2).max(80);
const coach = z.enum(["2S", "SL", "3A", "3E", "2A", "1A", "CC", "EC"]);
const travelClass = z.enum([
  "1A",
  "2A",
  "3A",
  "3E",
  "CC",
  "EC",
  "EA",
  "FC",
  "SL",
  "2S",
  "VS",
  "CH",
  "HS",
  "VC",
  "VA",
]);
const availabilityQuota = z.enum(["GN", "LD", "SS", "TQ"]);
const fareQuota = z.enum([
  "GN",
  "TQ",
  "LD",
  "DF",
  "FT",
  "LB",
  "PT",
  "YU",
  "DP",
  "HP",
  "PH",
  "SS",
]);

type RailkitResult = { success?: boolean; [key: string]: unknown };

function toolResult(result: RailkitResult) {
  const serialized = JSON.stringify(result);
  if (serialized.length > 250_000) {
    return {
      isError: true,
      content: [
        { type: "text" as const, text: "RailKit response too large to return" },
      ],
    };
  }
  return {
    content: [{ type: "text" as const, text: serialized }],
    structuredContent: result,
    ...(result.success === false ? { isError: true } : {}),
  };
}

async function callRailkit(fn: () => Promise<RailkitResult>) {
  try {
    return toolResult(await fn());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "RailKit request failed";
    return {
      isError: true,
      content: [{ type: "text" as const, text: message.slice(0, 300) }],
    };
  }
}

export function createRailkitMcpServer(apiKey: string) {
  configure(apiKey);

  const server = new McpServer({ name: "railkit-mcp", version: "1.0.0" });
  const readOnly = {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  };

  server.registerTool(
    "check_pnr_status",
    {
      title: "Check PNR status",
      description:
        "Get current booking, passenger, journey, chart, and fare details for a 10-digit PNR.",
      inputSchema: { pnr },
      annotations: readOnly,
    },
    ({ pnr }) => callRailkit(() => checkPNRStatus(pnr)),
  );
  server.registerTool(
    "get_train_info",
    {
      title: "Get train information",
      description:
        "Get detailed information and complete route for an exact 5-digit train number.",
      inputSchema: { trainNumber },
      annotations: readOnly,
    },
    ({ trainNumber }) => callRailkit(() => getTrainInfo(trainNumber)),
  );
  server.registerTool(
    "track_train",
    {
      title: "Track train",
      description:
        "Get live running status, current station, delays, and station timeline. Date is DD-MM-YYYY or today.",
      inputSchema: { trainNumber, date: trackDate.optional() },
      annotations: readOnly,
    },
    ({ trainNumber, date }) => callRailkit(() => trackTrain(trainNumber, date)),
  );
  server.registerTool(
    "get_train_history",
    {
      title: "Get train history",
      description:
        "Get completed journey history and station-by-station delays for a train and DD-MM-YYYY journey date.",
      inputSchema: { trainNumber, journeyDate: date },
      annotations: readOnly,
    },
    ({ trainNumber, journeyDate }) =>
      callRailkit(() => getTrainHistory(trainNumber, journeyDate)),
  );
  server.registerTool(
    "live_at_station",
    {
      title: "Live trains at station",
      description:
        "Get upcoming and passing trains, delays, and platforms at a station for 2, 4, or 8 hours.",
      inputSchema: {
        stationCode,
        hours: z.union([z.literal(2), z.literal(4), z.literal(8)]).optional(),
      },
      annotations: readOnly,
    },
    ({ stationCode, hours }) =>
      callRailkit(() => liveAtStation(stationCode, hours)),
  );
  server.registerTool(
    "search_trains",
    {
      title: "Search trains",
      description:
        "Find direct trains between origin and destination station codes, optionally for a DD-MM-YYYY journey date.",
      inputSchema: {
        fromStnCode: stationCode,
        toStnCode: stationCode,
        date: date.optional(),
      },
      annotations: readOnly,
    },
    ({ fromStnCode, toStnCode, date }) =>
      callRailkit(() =>
        searchTrainBetweenStations(fromStnCode, toStnCode, date),
      ),
  );
  server.registerTool(
    "get_availability",
    {
      title: "Get seat availability",
      description:
        "Check seat availability and fare for train, station pair, DD-MM-YYYY date, coach, and quota.",
      inputSchema: {
        trainNo: trainNumber,
        fromStnCode: stationCode,
        toStnCode: stationCode,
        date,
        coach,
        quota: availabilityQuota,
      },
      annotations: readOnly,
    },
    ({ trainNo, fromStnCode, toStnCode, date, coach, quota }) =>
      callRailkit(() =>
        getAvailability(trainNo, fromStnCode, toStnCode, date, coach, quota),
      ),
  );
  server.registerTool(
    "get_fare",
    {
      title: "Get fare",
      description:
        "Get full fare breakdown for train, station pair, DD-MM-YYYY date, travel class, and quota.",
      inputSchema: {
        trainNo: trainNumber,
        fromStnCode: stationCode,
        toStnCode: stationCode,
        date,
        travelClass,
        quota: fareQuota,
      },
      annotations: readOnly,
    },
    ({ trainNo, fromStnCode, toStnCode, date, travelClass, quota }) =>
      callRailkit(() =>
        fareLookup(trainNo, fromStnCode, toStnCode, date, travelClass, quota),
      ),
  );
  server.registerTool(
    "get_cancel_list",
    {
      title: "Get cancelled trains",
      description:
        "Get fully and partially cancelled trains with affected routes and journey dates.",
      inputSchema: {},
      annotations: readOnly,
    },
    () => callRailkit(() => cancelList()),
  );
  server.registerTool(
    "get_station_timetable",
    {
      title: "Get station timetable",
      description:
        "Get scheduled trains crossing a station; optional DD-MM-YYYY date is limited by RailKit to today, yesterday, or tomorrow.",
      inputSchema: { stationCode, date: date.optional() },
      annotations: readOnly,
    },
    ({ stationCode, date }) =>
      callRailkit(() => trainTimetableAtStation(stationCode, date)),
  );
  server.registerTool(
    "get_station",
    {
      title: "Get station",
      description: "Resolve a station code to station name and coordinates.",
      inputSchema: { stationCode },
      annotations: readOnly,
    },
    ({ stationCode }) => callRailkit(() => stationByCode(stationCode)),
  );
  server.registerTool(
    "search_stations",
    {
      title: "Search stations",
      description:
        "Find up to 10 stations matching a partial name of at least 2 characters.",
      inputSchema: { name: searchName },
      annotations: readOnly,
    },
    ({ name }) => callRailkit(() => stationsByName(name)),
  );
  server.registerTool(
    "get_train",
    {
      title: "Get train by number",
      description:
        "Resolve an exact 5-digit train number to its stored train name.",
      inputSchema: { trainNumber },
      annotations: readOnly,
    },
    ({ trainNumber }) => callRailkit(() => trainByNumber(trainNumber)),
  );
  server.registerTool(
    "search_trains_by_name",
    {
      title: "Search trains by name",
      description:
        "Find up to 10 trains matching a partial train name of at least 2 characters.",
      inputSchema: { name: searchName },
      annotations: readOnly,
    },
    ({ name }) => callRailkit(() => trainsByName(name)),
  );

  return server;
}
