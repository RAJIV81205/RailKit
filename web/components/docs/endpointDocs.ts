import {
  Armchair,
  Building2,
  CircleX,
  History,
  IndianRupee,
  MapPin,
  Search,
  Ticket,
  Train,
  type LucideIcon,
} from "lucide-react";

export type EndpointDoc = {
  id: string;
  name: string;
  title: string;
  icon: LucideIcon;
  description: string;
  signature: string;
  params: Array<{ name: string; type: string; desc: string }>;
  example: string;
  response: string;
  method: "GET";
  path: string;
  examplePath: string;
  notes: string;
};

type SdkEndpointDoc = Omit<EndpointDoc, "name" | "method" | "path" | "examplePath" | "notes">;

const sdkEndpointDocs: SdkEndpointDoc[] = [
  {
    id: "pnr-status",
    title: "PNR Status",
    icon: Ticket,
    description:
      "Get complete PNR status with passenger details, journey route, and confirmation updates.",
    signature: "checkPNRStatus(pnr: string)",
    params: [{ name: "pnr", type: "string", desc: "10-digit PNR number" }],
    example: `const result = await checkPNRStatus("6948325823");

if (result.success) {
  console.log(result.data.train.name);
  console.log(result.data.journey.source.name);
  console.log(result.data.passengers[0].current.details);
}`,
    response: `{
  "success": true,
  "data": {
    "pnr": "6948325823",
    "train": { "number": "18021", "name": "KGP KUR EXP" },
    "journey": {
      "dateOfJourney": "Sep 4, 2026 4:40:00 AM",
      "class": "CC", "quota": "GN",
      "source": { "code": "KGP", "name": "KHARAGPUR JN" },
      "destination": { "code": "KUR", "name": "KHURDA ROAD JN" },
      "boardingPoint": { "code": "KGP", "name": "KHARAGPUR JN" },
      "distance": 366,
      "arrivalDate": "Sep 4, 2026 1:50:00 PM"
    },
    "chart": { "status": "Chart Not Prepared" },
    "booking": { "fare": 1050, "ticketFare": 1050, "bookingDate": "Aug 18, 2026 8:04:06 PM" },
    "passengers": [
      {
        "serialNumber": "Passenger 1", "coachPosition": 0,
        "booking": { "status": "CNF", "coach": "C1", "berthNo": 30, "berthCode": "WS", "details": "CNF/C1/30/WS" },
        "current": { "status": "CNF", "coach": "C1", "berthNo": 30, "berthCode": "WS", "details": "CNF/C1/30/WS" }
      },
      {
        "serialNumber": "Passenger 2", "coachPosition": 0,
        "booking": { "status": "CNF", "coach": "C1", "berthNo": 31, "berthCode": null, "details": "CNF/C1/31" },
        "current": { "status": "CNF", "coach": "C1", "berthNo": 31, "berthCode": null, "details": "CNF/C1/31" }
      }
    ]
  }
}`,
  },
  {
    id: "train-info",
    title: "Train Information",
    icon: Train,
    description:
      "Retrieve route details, running schedule, stoppages, and station-level metadata.",
    signature: "getTrainInfo(trainNumber: string)",
    params: [
      { name: "trainNumber", type: "string", desc: "5-digit train number" },
    ],
    example: `const result = await getTrainInfo("12345");

if (result.success) {
  console.log(result.data.trainInfo.train_name);
  console.log(result.data.route.length);
}`,
    response: `{
  "success": true,
  "data": {
    "trainInfo": { "train_no": "12345", "train_name": "SARAIGHAT EXP", "from_stn_name": "Howrah Jn", "from_stn_code": "HWH", "to_stn_name": "Guwahati", "to_stn_code": "GHY", "from_time": "16:05", "to_time": "09:40", "travel_time": "17:35 hrs", "running_days": "1111111", "type": "SUPERFAST", "train_id": "1891" },
    "route": [{ "stnCode": "HWH", "stnName": "Howrah Jn", "arrival": "--", "departure": "16:05", "halt": "0 min", "haltMinutes": 0, "distance": "0", "day": "1", "platform": 15, "coordinates": { "latitude": 22.5835032884945, "longitude": 88.3422660827637 } }]
  }
}`,
  },
  {
    id: "live-tracking",
    title: "Live Tracking",
    icon: MapPin,
    description:
      "Track live train movement with station-by-station arrival and delay context.",
    signature: "trackTrain(trainNumber: string, date?: string)",
    params: [
      { name: "trainNumber", type: "string", desc: "5-digit train number" },
      {
        name: "date",
        type: "string",
        desc: "Optional SDK journey date in DD-MM-YYYY; defaults to today. REST requires DD-MM-YYYY or today.",
      },
    ],
    example: `const result = await trackTrain("12345", "28-08-2026");

if (result.success) {
  console.log(result.data.statusNote);
  console.log(result.data.timeline);
}`,
    response: `{
  "success": true,
  "data": {
    "trainNo": "12345", "trainName": "SARAIGHAT EXP", "date": "28-Aug-2026",
    "statusNote": "Yet to start from its source", "lastUpdate": "", "totalStations": 161,
    "coachPosition": [],
    "timeline": [{ "type": "stoppage", "status": "current", "stationCode": "HWH", "stationName": "HOWRAH JN", "platform": "15", "distanceKm": "", "arrival": { "scheduled": "SRC", "actual": "SRC", "delay": "" }, "departure": { "scheduled": "16:05 28-Aug", "actual": "16:05 28-Aug*", "delay": "On Time" } }],
    "currentStationCode": "HWH"
  }
}`,
  },
  {
    id: "train-history",
    title: "Train History",
    icon: History,
    description:
      "Get the completed journey history of a train for a specific date — full station-by-station timeline, per-stop delays, and final coach position once the train has reached its destination.",
    signature: "getTrainHistory(trainNumber: string, journeyDate: string)",
    params: [
      { name: "trainNumber", type: "string", desc: "5-digit train number" },
      {
        name: "journeyDate",
        type: "string",
        desc: "Journey date in DD-MM-YYYY",
      },
    ],
    example: `const result = await getTrainHistory("12301", "11-06-2026");

if (result.success) {
  console.log(\`🚂 \${result.data.trainName} — \${result.data.journeyDate}\`);

  result.data.stations.forEach((stop) => {
    console.log(\`🚉 \${stop.stationName} (\${stop.stationCode}) | PF \${stop.platform}\`);
    console.log(\`   Arr: \${stop.arrival.scheduled} → \${stop.arrival.actual} (delay \${stop.arrival.delay}m)\`);
  });
}`,
    response: `{
  "success": true,
  "data": {
    "trainNo": "12301", "trainName": "RAJDHANI EXPRES", "journeyDate": "11-06-2026",
    "sourceStationCode": "HWH", "sourceStationName": "Howrah Jn",
    "destinationStationCode": "NDLS", "destinationStationName": "New Delhi",
    "coachPosition": [
      { "type": "ENG", "number": "ENG", "position": "0" },
      { "type": "LPR", "number": "LPR", "position": "1" },
      { "type": "3A", "number": "B1", "position": "2" },
      { "type": "3A", "number": "B2", "position": "3" },
      { "type": "2A", "number": "A1", "position": "16" },
      { "type": "VP", "number": "VP", "position": "23" }
    ],
    "stations": [
      { "stationCode": "HWH", "stationName": "HOWRAH JN", "platform": "9", "arrival": { "scheduled": "SRC", "actual": "SRC" }, "departure": { "scheduled": "16:50 11-Jun", "actual": "16:50 11-Jun", "delay": "On Time" } },
      { "stationCode": "ASN", "stationName": "ASANSOL JN.", "platform": "4", "distanceKm": "200", "arrival": { "scheduled": "18:47 11-Jun", "actual": "19:03 11-Jun", "delay": "16 Min" }, "departure": { "scheduled": "18:49 11-Jun", "actual": "19:05 11-Jun", "delay": "16 Min" } },
      { "stationCode": "NDLS", "stationName": "NEW DELHI", "platform": "14", "distanceKm": "1449", "arrival": { "scheduled": "10:05 12-Jun", "actual": "10:13 12-Jun", "delay": "8 Min" }, "departure": { "scheduled": "DSTN", "actual": "DSTN" } }
    ],
    "lastUpdate": "12-06-2026 11:12:53 IST"
  }
}`,
  },
  {
    id: "station-live",
    title: "Live At Station",
    icon: Building2,
    description:
      "Get upcoming and passing trains at a station with near real-time status, delays, and platform info.",
    signature: "liveAtStation(stationCode: string, hours?: number)",
    params: [
      {
        name: "stationCode",
        type: "string",
        desc: "Station code such as NDLS, BCT, HWH",
      },
      {
        name: "hours",
        type: "number",
        desc: "Time window in hours — 2, 4, or 8 (default 2)",
      },
    ],
    example: `const result = await liveAtStation("NDLS", 2);

if (result.success) {
  console.log(result.data.summary);
  console.log("Total trains:", result.data.totalTrains);

    result.data.trains.forEach((t) => {
    console.log(\`🚂 \${t.trainNo} — \${t.trainName}\`);
    console.log(\`   \${t.sourceName} → \${t.destName} | PF \${t.platform}\`);
    console.log(\`   Arr: \${t.arrival.actual} (scheduled \${t.arrival.scheduled}, delay \${t.arrival.delay})\`);
  });
}`,
    response: `{
  "success": true,
  "data": {
    "summary": "39 Trains departing from/arriving at NDLS- NEW DELHI in next 2 Hrs.",
    "totalTrains": 39,
    "trains": [{ "trainNo": "12138", "trainName": "PUNJAB MAIL", "source": "FZR", "sourceName": "FIROZPUR CANT", "dest": "CSMT", "destName": "C SHIVAJI MAH T", "trainType": "SUPERFAST", "classes": "1A,2A,3A,SL,GEN,PWD", "runDate": "27-Aug-2026", "platform": "3", "cancelled": null, "arrival": { "actual": "05:16", "scheduled": "04:55", "delay": "21 Mins.", "delayed": true }, "departure": { "actual": "05:21", "scheduled": "05:10", "delay": "11 Mins.", "delayed": true } }]
  }
}`,
  },
  {
    id: "train-search",
    title: "Train Search",
    icon: Search,
    description:
      "Find available trains between stations with timetable and running-day data.",
    signature:
      "searchTrainBetweenStations(from: string, to: string, date?: string)",
    params: [
      { name: "from", type: "string", desc: "Origin station code" },
      { name: "to", type: "string", desc: "Destination station code" },
      {
        name: "date",
        type: "string",
        desc: "Journey date in DD-MM-YYYY (optional)",
      },
    ],
    example: `const result = await searchTrainBetweenStations("NDLS", "BCT", "28-08-2026");

if (result.success) {
    console.log(result.data.map((t) => t.train_name));
}`,
    response: `{
  "success": true,
  "data": [{ "train_no": "12904", "train_name": "GOLDEN TEMPLE M", "source_stn_name": "Amritsar Jn", "source_stn_code": "ASR", "dstn_stn_name": "Bandra Terminus", "dstn_stn_code": "BDTS", "from_stn_name": "Hazrat Nizamuddin", "from_stn_code": "NZM", "to_stn_name": "Bandra Terminus", "to_stn_code": "BDTS", "from_time": "04:00", "to_time": "23:55", "travel_time": "19:55 hrs", "running_days": "1111111", "distance": "1365", "halts": 20 }]
}`,
  },
  {
    id: "seat-availability",
    title: "Seat Availability",
    icon: Armchair,
    description:
      "Check availability forecasts and detailed fare breakup by quota and class.",
    signature:
      "getAvailability(trainNo, fromStnCode, toStnCode, date, coach, quota)",
    params: [
      { name: "trainNo", type: "string", desc: "5-digit train number" },
      { name: "fromStnCode", type: "string", desc: "Origin station code" },
      { name: "toStnCode", type: "string", desc: "Destination station code" },
      { name: "date", type: "string", desc: "Journey date in DD-MM-YYYY" },
      { name: "coach", type: "string", desc: "SL, 3A, 2A, 1A, CC, EC, 2S" },
      { name: "quota", type: "string", desc: "GN, TQ, LD, SS" },
    ],
    example: `const result = await getAvailability(
  "12904", "NZM", "BDTS",
  "01-09-2026", "3A", "GN"
);`,
    response: `{
  "success": true,
  "data": {
    "train": { "trainNo": "12904", "trainName": "GOLDEN TEMPLE M", "from": "NZM", "to": "BDTS", "fromStationName": "Delhi Hazrat Nizamuddin", "toStationName": "Mumbai Bandra Terminus", "distance": 1366, "travelClass": "3A", "quota": "GN" },
    "fare": { "baseFare": 1505, "reservationCharge": 40, "superfastCharge": 45, "serviceTax": 80, "totalFare": 1670 },
    "availability": [{ "date": "1-9-2026", "status": "WAITLIST", "availabilityText": "WL 23", "rawStatus": "RLWL31/WL23", "prediction": "73% Chance", "predictionPercentage": 73, "canBook": true }]
  }
}`,
  },
  {
    id: "fare-lookup",
    title: "Fare Lookup",
    icon: IndianRupee,
    description:
      "Get the full fare breakdown for a journey — base fare, reservation, superfast, catering, GST, dynamic fare, and total collectible amount.",
    signature:
      "fareLookup(trainNo, fromStnCode, toStnCode, date, travelClass, quota)",
    params: [
      { name: "trainNo", type: "string", desc: "5-digit train number" },
      { name: "fromStnCode", type: "string", desc: "Origin station code" },
      { name: "toStnCode", type: "string", desc: "Destination station code" },
      { name: "date", type: "string", desc: "Journey date in DD-MM-YYYY" },
      {
        name: "travelClass",
        type: "string",
        desc: "1A · 2A · 3A · 3E · CC · EC · EA · FC · SL · 2S · VS · CH · HS · VC · VA",
      },
      {
        name: "quota",
        type: "string",
        desc: "GN · TQ · PT · LD · DF · FT · LB · YU · DP · HP · PH · SS",
      },
    ],
    example: `const result = await fareLookup(
  "12904", "NZM", "BDTS",
  "01-09-2026", "3A", "GN"
);

if (result.success) {
  const d = result.data;
  console.log(\`\${d.trainName} (\${d.trainNo})\`);
  console.log(\`\${d.from} → \${d.to} | \${d.distance} km\`);
  console.log(\`Base: ₹\${d.baseFare}  GST: ₹\${d.gst}  Total: ₹\${d.totalFare}\`);
}`,
    response: `{
  "success": true,
  "data": { "trainNo": "12904", "trainName": "GOLDEN TEMPLE M", "from": "NZM", "to": "BDTS", "class": "3A", "distance": 1366, "baseFare": 1505, "reservation": 40, "superfast": 45, "fuelAmount": 0, "concession": 0, "tatkalFare": 0, "gst": 80, "otherCharge": 0, "catering": 0, "dynamicFare": 0, "totalFare": 1670 }
}`,
  },
  {
    id: "cancelled-trains",
    title: "Cancelled Trains",
    icon: CircleX,
    description:
      "Get the complete list of fully and partially cancelled trains, with route details and the affected segment for partial cancellations.",
    signature: "cancelList(): Promise<Result>",
    params: [],
    example: `const result = await cancelList();

if (result.success) {
  console.log("Total:", result.summary.total);
  console.log("Fully cancelled:", result.summary.fullyCancelled);
  console.log("Partially cancelled:", result.summary.partiallyCancelled);

  result.data.fullyCancelledTrains.forEach((train) => {
    console.log(train.trainNo + " — " + train.trainName);
  });

  result.data.partiallyCancelledTrains.forEach((train) => {
    console.log(
      train.trainNo + ": " +
      train.cancelledSegment.from.name + " → " +
      train.cancelledSegment.to.name
    );
  });
}`,
    response: `{
  "success": true,
  "summary": { "total": 60, "fullyCancelled": 16, "partiallyCancelled": 44, "journeyDates": ["26-08-2026"] },
  "data": {
    "fullyCancelledTrains": [{ "trainNo": "12614", "trainName": "WODEYAR SF EXP", "journeyDate": "26-08-2026", "status": "fully_cancelled", "route": { "source": { "code": "SBC", "name": "KRANTIVIRA SANGOLLI RAYANNA (BENGALURU)" }, "destination": { "code": "MYS", "name": "MYSORE JN" } }, "cancelledSegment": null, "trainType": null, "reportedAt": "16-08-2026 12:03:14 IST" }],
    "partiallyCancelledTrains": [{ "trainNo": "12112", "trainName": "AMI CSMT SF EXP", "journeyDate": "26-08-2026", "status": "partially_cancelled", "cancelledSegment": { "from": { "code": "DR", "name": "DADAR" }, "to": { "code": "CSMT", "name": "CHHATRAPATI SHIVAJI MAHARAJ TERMINUS" } } }]
  }
}`,
  },
  {
    id: "station-timetable",
    title: "Station Train Timetable",
    icon: Building2,
    description: "Get the complete scheduled train timetable for a station on a nearby running date.",
    signature: "trainTimetableAtStation(stationCode: string, date?: string)",
    params: [
      { name: "stationCode", type: "string", desc: "Station code such as ASN or NDLS" },
      { name: "date", type: "string", desc: "Optional DD-MM-YYYY date; only today, yesterday, or tomorrow is accepted" },
    ],
    example: `const result = await fetch(
  "/api/station/ASN/timetable?date=28-08-2026"
).then((res) => res.json());

if (result.success) {
  console.log(result.data.totalTrains);
  console.log(result.data.trains[0].trainName);
}`,
    response: `{
  "success": true,
  "data": {
    "summary": "168 Trains scheduled at ASN - ASANSOL JN. on 28-Aug-2026",
    "station": "ASN",
    "date": "28-Aug-2026",
    "totalTrains": 168,
    "trains": [{
      "trainNo": "15052", "trainName": "GKP KOAA EXP",
      "source": "GKP", "sourceName": "Gorakhpur Jn",
      "destination": "KOAA", "destinationName": "Kolkatta Terminal",
      "trainType": "Mail Express", "classes": "1A,2A,3A,SL,GEN,PWD",
      "runningDays": "",
      "arrival": "00:01", "departure": "00:11"
    }]
  }
}`,
  },
  {
    id: "station-by-code",
    title: "Station Lookup by Code",
    icon: MapPin,
    description: "Resolve a station code to its name and coordinates.",
    signature: "stationByCode(stationCode: string)",
    params: [{ name: "stationCode", type: "string", desc: "Station code such as NDLS or HWH" }],
    example: `const result = await fetch("/api/station/NDLS").then((res) => res.json());

if (result.success) {
  console.log(result.data.code, result.data.name);
}`,
    response: `{
  "success": true,
  "data": { "code": "NDLS", "name": "NEW DELHI", "lat": 28.642464, "lon": 77.220154 }
}`,
  },
  {
    id: "station-search",
    title: "Station Search by Name",
    icon: Search,
    description: "Find up to 10 matching stations by partial name.",
    signature: "stationsByName(name: string)",
    params: [{ name: "name", type: "string", desc: "At least 2 characters; partial matching supported" }],
    example: `const result = await fetch(
  "/api/stations/search?name=delhi"
).then((res) => res.json());

result.data.stations.forEach((station) => {
  console.log(station.name, station.code);
});`,
    response: `{
  "success": true,
  "data": {
    "query": "delhi",
    "count": 10,
    "stations": [
      { "code": "ANDI", "name": "ADARSH NAGAR DELHI", "lat": 28.714265, "lon": 77.166767 },
      { "code": "DAZ", "name": "DELHI AZADPUR", "lat": 28.703086, "lon": 77.177153 }
    ]
  }
}`,
  },
  {
    id: "train-by-number",
    title: "Train Lookup by Number",
    icon: Train,
    description: "Resolve a train number to its stored train name.",
    signature: "trainByNumber(trainNumber: string)",
    params: [{ name: "trainNumber", type: "string", desc: "Exactly 5 numeric digits" }],
    example: `const result = await fetch("/api/train/12345").then((res) => res.json());

if (result.success) {
  console.log(result.data.trainNo, result.data.trainName);
}`,
    response: `{
  "success": true,
  "data": { "trainNo": "12345", "trainName": "HWH GHY SARAIGHAT EXPRESS" }
}`,
  },
  {
    id: "train-name-search",
    title: "Train Search by Name",
    icon: Search,
    description: "Find up to 10 trains matching a partial train name.",
    signature: "trainsByName(name: string)",
    params: [{ name: "name", type: "string", desc: "At least 2 characters; partial matching supported" }],
    example: `const result = await fetch(
  "/api/trains/search?name=rajdhani"
).then((res) => res.json());

result.data.trains.forEach((train) => {
  console.log(train.trainName, train.trainNo);
});`,
    response: `{
  "success": true,
  "data": {
    "query": "rajdhani",
    "count": 10,
    "trains": [
      { "trainNo": "12301", "trainName": "RAJDHANI EXPRES" },
      { "trainNo": "12302", "trainName": "HWH RAJDHANI" }
    ]
  }
}`,
  },
];


// Single REST endpoint registry used by public docs and dashboard.
type RestEndpointDoc = {
  id: string;
  name: string;
  method: "GET";
  path: string;
  examplePath: string;
  notes: string;
};

const restEndpointDocs: readonly RestEndpointDoc[] = [
  {
    id: "pnr-status",
    name: "Check PNR Status",
    method: "GET",
    path: "/api/checkPNRStatus/:pnr",
    examplePath: "/api/checkPNRStatus/6948325823",
    notes: "PNR must be 10 digits.",
  },
  {
    id: "train-info",
    name: "Get Train Info",
    method: "GET",
    path: "/api/getTrainInfo/:trainNumber",
    examplePath: "/api/getTrainInfo/12345",
    notes: "Train number must be 5 digits.",
  },
  {
    id: "live-tracking",
    name: "Track Train",
    method: "GET",
    path: "/api/trackTrain/:trainNumber/:date",
    examplePath: "/api/trackTrain/12345/28-08-2026",
    notes: "Date format: DD-MM-YYYY. You can also pass `today` as date.",
  },
  {
    id: "station-live",
    name: "Live At Station",
    method: "GET",
    path: "/api/liveAtStation/:stnCode?hrs=2|4|8",
    examplePath: "/api/liveAtStation/NDLS?hrs=4",
    notes:
      "Use an uppercase station code. Optional `hrs` accepts 2, 4, or 8; default is 2.",
  },
  {
    id: "train-history",
    name: "Get Train History",
    method: "GET",
    path: "/api/trainHistory/:trainNo/:journeyDate",
    examplePath: "/api/trainHistory/12301/11-06-2026",
    notes:
      "Date format: DD-MM-YYYY. Returns 404 when the train has not completed that journey.",
  },
  {
    id: "train-search",
    name: "Search Trains Between Stations",
    method: "GET",
    path: "/api/searchTrainBetweenStations/:fromStnCode/:toStnCode?date=DD-MM-YYYY",
    examplePath: "/api/searchTrainBetweenStations/NDLS/BCT?date=28-08-2026",
    notes: "The `date` query parameter is optional.",
  },
  {
    id: "seat-availability",
    name: "Get Seat Availability",
    method: "GET",
    path: "/api/getAvailability/:trainNo/:fromStnCode/:toStnCode/:date/:coach/:quota",
    examplePath: "/api/getAvailability/12904/NZM/BDTS/01-09-2026/3A/GN",
    notes: "Date format: DD-MM-YYYY.",
  },
  {
    id: "fare-lookup",
    name: "Fare Lookup",
    method: "GET",
    path: "/api/fareLookup/:trainNo/:date/:fromStation/:toStation/:class/:quota",
    examplePath: "/api/fareLookup/12904/01-09-2026/NZM/BDTS/3A/GN",
    notes: "Returns full fare breakdown. Date format: DD-MM-YYYY.",
  },
  {
    id: "cancelled-trains",
    name: "Cancelled Trains",
    method: "GET",
    path: "/api/cancelled",
    examplePath: "/api/cancelled",
    notes:
      "Returns fully and partially cancelled trains. No parameters required.",
  },
  {
    id: "station-timetable",
    name: "Get Station Train Timetable",
    method: "GET",
    path: "/api/station/:stationCode/timetable?date=DD-MM-YYYY",
    examplePath: "/api/station/ASN/timetable?date=28-08-2026",
    notes: "Date is optional, must use DD-MM-YYYY format, and can only be today, yesterday, or tomorrow. Defaults to today.",
  },
  {
    id: "station-by-code",
    name: "Get Station by Code",
    method: "GET",
    path: "/api/station/:stationCode",
    examplePath: "/api/station/NDLS",
    notes: "Station code must be 1-5 letters or digits.",
  },
  {
    id: "station-search",
    name: "Search Stations by Name",
    method: "GET",
    path: "/api/stations/search?name=...",
    examplePath: "/api/stations/search?name=delhi",
    notes: "Name must contain at least 2 characters. Returns at most 10 matches.",
  },
  {
    id: "train-by-number",
    name: "Get Train by Number",
    method: "GET",
    path: "/api/train/:trainNumber",
    examplePath: "/api/train/12345",
    notes: "Train number must be exactly 5 numeric digits.",
  },
  {
    id: "train-name-search",
    name: "Search Trains by Name",
    method: "GET",
    path: "/api/trains/search?name=...",
    examplePath: "/api/trains/search?name=rajdhani",
    notes: "Name must contain at least 2 characters. Returns at most 10 matches.",
  },
] as const;


export const endpointDocs: readonly EndpointDoc[] = sdkEndpointDocs.map((endpoint) => ({
  ...endpoint,
  ...restEndpointDocs.find((rest) => rest.id === endpoint.id),
} as EndpointDoc));
