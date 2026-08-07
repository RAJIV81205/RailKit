// Single REST endpoint registry used by public docs and dashboard.
export type ApiEndpointDoc = {
  id: string;
  name: string;
  method: "GET";
  path: string;
  examplePath: string;
  notes: string;
};

export const apiEndpointDocs: readonly ApiEndpointDoc[] = [
  { id: "pnr-status", name: "Check PNR Status", method: "GET", path: "/api/checkPNRStatus/:pnr", examplePath: "/api/checkPNRStatus/1234567890", notes: "PNR must be 10 digits." },
  { id: "train-info", name: "Get Train Info", method: "GET", path: "/api/getTrainInfo/:trainNumber", examplePath: "/api/getTrainInfo/12345", notes: "Train number must be 5 digits." },
  { id: "live-tracking", name: "Track Train", method: "GET", path: "/api/trackTrain/:trainNumber/:date", examplePath: "/api/trackTrain/12345/28-03-2026", notes: "Date format: DD-MM-YYYY. You can also pass `today` as date." },
  { id: "station-live", name: "Live At Station", method: "GET", path: "/api/liveAtStation/:stnCode?hrs=2|4|8", examplePath: "/api/liveAtStation/NDLS?hrs=4", notes: "Use an uppercase station code. Optional `hrs` accepts 2, 4, or 8; default is 2." },
  { id: "train-history", name: "Get Train History", method: "GET", path: "/api/trainHistory/:trainNo/:journeyDate", examplePath: "/api/trainHistory/12345/15-04-2025", notes: "Date format: DD-MM-YYYY. Returns 404 when the train has not completed that journey." },
  { id: "train-search", name: "Search Trains Between Stations", method: "GET", path: "/api/searchTrainBetweenStations/:fromStnCode/:toStnCode?date=DD-MM-YYYY", examplePath: "/api/searchTrainBetweenStations/NDLS/BCT?date=28-03-2026", notes: "The `date` query parameter is optional." },
  { id: "seat-availability", name: "Get Seat Availability", method: "GET", path: "/api/getAvailability/:trainNo/:fromStnCode/:toStnCode/:date/:coach/:quota", examplePath: "/api/getAvailability/12496/ASN/DDU/27-12-2025/2A/GN", notes: "Date format: DD-MM-YYYY." },
  { id: "fare-lookup", name: "Fare Lookup", method: "GET", path: "/api/fareLookup/:trainNo/:date/:fromStation/:toStation/:class/:quota", examplePath: "/api/fareLookup/12313/06-06-2026/ASN/NDLS/3A/GN", notes: "Returns full fare breakdown. Date format: DD-MM-YYYY." },
  { id: "cancelled-trains", name: "Cancelled Trains", method: "GET", path: "/api/cancelled", examplePath: "/api/cancelled", notes: "Returns fully and partially cancelled trains. No parameters required." },
] as const;
