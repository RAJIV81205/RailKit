// Content model shared by the public documentation UI.
import {
  BookOpen,
  Package,
  Rocket,
  Ticket,
  Train,
  MapPin,
  Building2,
  Search,
  CheckCircle,
  CircleX,
  BarChart3,
  AlertTriangle,
  Gamepad2,
  History,
  type LucideIcon,
  Armchair,
  IndianRupee,
} from "lucide-react";

export const packageInfo = {
  name: 'RailKit',
  tagline: 'Node.js SDK for Indian Railways',
  description: 'Comprehensive Node.js SDK for Indian Railways with real-time PNR status, live train tracking, cancellations, station updates, and complete route information.',
  stats: {
    downloads: '251',
    license: 'MIT',
    nodeVersion: '14+'
  },
  links: {
    github: 'https://github.com/RAJIV81205/railkit',
    npm: 'https://www.npmjs.com/package/railkit',
    issues: 'https://github.com/RAJIV81205/railkit/issues'
  }
};

export type SidebarItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export type SidebarGroup = {
  title: string;
  items: SidebarItem[];
};

export const sidebarGroups: SidebarGroup[] = [
  {
    title: "Getting Started",
    items: [
      { id: "introduction", label: "Introduction", icon: BookOpen },
      { id: "installation", label: "Installation", icon: Package },
      { id: "quickstart", label: "Quick Start", icon: Rocket },
    ],
  },
  {
    title: "Core Features",
    items: [
      { id: "pnr-status", label: "PNR Status", icon: Ticket },
      { id: "train-info", label: "Train Information", icon: Train },
      { id: "live-tracking", label: "Live Tracking", icon: MapPin },
      { id: "train-history", label: "Train History", icon: History },
      { id: "station-live", label: "Live at Station", icon: Building2 },
      { id: "train-search", label: "Train Search", icon: Search },
      { id: "seat-availability", label: "Seat Availability", icon: Armchair },
      { id: "fare-lookup", label: "Fare Lookup", icon: IndianRupee },
      { id: "cancelled-trains", label: "Cancelled Trains", icon: CircleX },
    ],
  },
  {
    title: "Tools",
    items: [
      { id: "playground", label: "Playground", icon: Gamepad2 },
    ],
  },
  {
    title: "Reference",
    items: [
      { id: "validation", label: "Input Validation", icon: CheckCircle },
      { id: "status-codes", label: "Status Codes", icon: BarChart3 },
      { id: "errors", label: "Error Handling", icon: AlertTriangle },
    ],
  },

];


export const sections: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "introduction", label: "Introduction", icon: BookOpen },
  { id: "installation", label: "Installation", icon: Package },
  { id: "quickstart", label: "Quick Start", icon: Rocket },
  { id: "pnr-status", label: "PNR Status", icon: Ticket },
  { id: "train-info", label: "Train Information", icon: Train },
  { id: "live-tracking", label: "Live Tracking", icon: MapPin },
  { id: "train-history", label: "Train History", icon: History },
  { id: "station-live", label: "Live at Station", icon: Building2 },
  { id: "train-search", label: "Train Search", icon: Search },
  { id: "seat-availability", label: "Seat Availability", icon: Armchair },
  { id: "fare-lookup", label: "Fare Lookup", icon: IndianRupee },
  { id: "cancelled-trains", label: "Cancelled Trains", icon: CircleX },
  { id: "playground", label: "Playground", icon: Gamepad2 },
  { id: "validation", label: "Input Validation", icon: CheckCircle },
  { id: "status-codes", label: "Status Codes", icon: BarChart3 },
  { id: "errors", label: "Error Handling", icon: AlertTriangle },
];

export const features = [
  {
    icon: '🎫',
    title: 'PNR Status',
    desc: 'Real-time PNR status with passenger details and confirmation status'
  },
  {
    icon: '🚂',
    title: 'Train Information',
    desc: 'Complete train details with route, schedule, and station coordinates'
  },
  {
    icon: '📍',
    title: 'Live Tracking',
    desc: 'Real-time train location, delays, and station-wise status updates'
  },
  {
    icon: '🚉',
    title: 'Station Live',
    desc: 'Upcoming trains at any station with expected arrival times'
  },
  {
    icon: '🔍',
    title: 'Train Search',
    desc: 'Find trains between stations with classes and availability info'
  },
  {
    icon: '⛔',
    title: 'Cancelled Trains',
    desc: 'Fully and partially cancelled trains with affected route segments'
  },
  {
    icon: '⚡',
    title: 'Fast & Reliable',
    desc: 'Built-in validation, timeout handling, and error management'
  }
];

export const installation = {
  requirements: [
    'Node.js 14 or higher',
    'Active internet connection',
    'Valid PNR numbers or train numbers for testing'
  ],
  platforms: [
    'Node.js applications',
    'Express.js servers',
    'Next.js (App Router & Pages Router)',
    'React Native'
  ]
};

export const quickStartCode = {
  basic: `// .env
// RAILKIT_API_KEY=your_api_key_here

if (!process.env.RAILKIT_API_KEY) {
  throw new Error('RAILKIT_API_KEY is required in environment variables');
}

// Import the functions you need
import { checkPNRStatus, getTrainInfo } from 'railkit';

// Check PNR status
const pnrResult = await checkPNRStatus('1234567890');

// Always check success first
if (pnrResult.success) {
  console.log(pnrResult.data);
} else {
  console.error(pnrResult.error);
}`
};

export const apiDocs = {
  pnr: {
    title: 'PNR Status',
    description: 'Check real-time PNR status with passenger details, journey details, chart status, and booking fare.',
    signature: 'checkPNRStatus(pnr: string): Promise<Result>',
    example: `import { checkPNRStatus } from 'railkit';

const result = await checkPNRStatus('5827194603');

if (result.success) {
  console.log('PNR:', result.data.pnr);
  console.log('Train:', result.data.train.name);
  console.log('From:', result.data.journey.source.name);
  console.log('Passenger 1 current:', result.data.passengers[0].current.details);
}`,
    responseFields: [
      { field: 'pnr', description: '10-digit PNR number' },
      { field: 'train.number', description: 'Train number' },
      { field: 'train.name', description: 'Train name' },
      { field: 'journey.dateOfJourney', description: 'Scheduled journey date and time' },
      { field: 'journey.class', description: 'Travel class (1A, 2A, 3A, SL, CC, 2S, etc.)' },
      { field: 'journey.quota', description: 'Booking quota (GN, TQ, LD, SS, etc.)' },
      { field: 'journey.source', description: 'Origin station with code and name' },
      { field: 'journey.destination', description: 'Destination station with code and name' },
      { field: 'journey.boardingPoint', description: 'Boarding station with code and name' },
      { field: 'journey.distance', description: 'Total journey distance in km' },
      { field: 'journey.arrivalDate', description: 'Scheduled arrival date and time' },
      { field: 'chart.status', description: 'Chart preparation status' },
      { field: 'booking.fare', description: 'Total fare collected' },
      { field: 'booking.ticketFare', description: 'Base ticket fare' },
      { field: 'booking.bookingDate', description: 'Date and time of booking' },
      { field: 'passengers[].serialNumber', description: 'Passenger label (Passenger 1, 2, ...)' },
      { field: 'passengers[].coachPosition', description: 'Coach position index' },
      { field: 'passengers[].booking.status', description: 'Original booking status (CNF, WL, RAC, ...)' },
      { field: 'passengers[].booking.coach', description: 'Booked coach (may be null for WL/RAC)' },
      { field: 'passengers[].booking.berthNo', description: 'Booked berth number' },
      { field: 'passengers[].booking.berthCode', description: 'Booked berth code (LB, UB, SL, SU, ...)' },
      { field: 'passengers[].booking.details', description: 'Formatted booking summary' },
      { field: 'passengers[].current.status', description: 'Current status after chart preparation' },
      { field: 'passengers[].current.coach', description: 'Allotted coach' },
      { field: 'passengers[].current.berthNo', description: 'Allotted berth number' },
      { field: 'passengers[].current.berthCode', description: 'Allotted berth code (LB, UB, SL, SU, ...)' },
      { field: 'passengers[].current.details', description: 'Formatted current allocation summary' }
    ]
  },
  train: {
    title: 'Train Information',
    description: 'Get complete train details including route, schedule, and station coordinates.',
    signature: 'getTrainInfo(trainNo: string): Promise<Result>',
    example: `import { getTrainInfo } from 'railkit';

const result = await getTrainInfo('12345');

if (result.success) {
  console.log('Train:', result.data.trainName);
  console.log('Route:', result.data.route);
  console.log('Classes:', result.data.classes);
}`
  },
  tracking: {
    title: 'Live Train Tracking',
    description: 'Track trains in real-time with current location, delays, and station updates.',
    signature: 'trackTrain(trainNo: string, date: string): Promise<Result>',
    example: `import { trackTrain } from 'railkit';

// Date format: DD-MM-YYYY
const result = await trackTrain('12345', '06-12-2025');

if (result.success) {
  console.log('Status:', result.data.statusNote);
  console.log('Current Station:', result.data.currentStation);
  console.log('Delay:', result.data.delay);
}`,
    note: 'The date parameter must be in DD-MM-YYYY format.'
  },
  trainHistory: {
    title: 'Train History',
    description: 'Get the completed journey history of a train for a specific journey date. The backend persists a record once the train has reached its destination, including the full station-by-station timeline, per-stop delays, and the final coach position.',
    signature: 'getTrainHistory(trainNumber: string, journeyDate: string): Promise<Result>',
    example: `import { getTrainHistory } from 'railkit';

const result = await getTrainHistory('12301', '15-04-2025');

if (result.success) {
  console.log('Train:', result.data.trainName);
  console.log('Journey date:', result.data.journeyDate);
  console.log('Stations:', result.data.stations.length);
  console.log('Last update:', result.data.lastUpdate);
}`,
    responseFields: [
      { field: 'historyKey', description: 'Composite key (trainNo:journeyDate) used by the backend to look up the record' },
      { field: 'trainNo', description: '5-digit train number' },
      { field: 'trainName', description: 'Train name' },
      { field: 'journeyDate', description: 'Journey date in DD-MM-YYYY format' },
      { field: 'sourceStationCode', description: 'Source station code' },
      { field: 'sourceStationName', description: 'Source station name' },
      { field: 'destinationStationCode', description: 'Destination station code' },
      { field: 'destinationStationName', description: 'Destination station name' },
      { field: 'stations[].stationCode', description: 'Stop station code' },
      { field: 'stations[].stationName', description: 'Stop station name' },
      { field: 'stations[].platform', description: 'Platform number at the stop' },
      { field: 'stations[].distanceKm', description: 'Cumulative distance from source in km' },
      { field: 'stations[].arrival.scheduled', description: 'Scheduled arrival time' },
      { field: 'stations[].arrival.actual', description: 'Actual arrival time' },
      { field: 'stations[].arrival.delay', description: 'Arrival delay in minutes' },
      { field: 'stations[].departure.scheduled', description: 'Scheduled departure time' },
      { field: 'stations[].departure.actual', description: 'Actual departure time' },
      { field: 'stations[].departure.delay', description: 'Departure delay in minutes' },
      { field: 'coachPosition[].type', description: 'Coach type (ENG, 1A, 2A, 3A, SL, etc.)' },
      { field: 'coachPosition[].number', description: 'Coach number' },
      { field: 'coachPosition[].position', description: 'Coach position from the engine' },
      { field: 'lastUpdate', description: 'ISO timestamp of the last update to the record' }
    ],
    note: 'Returns 404 with { success: false, error: "Train history record not found" } when the train has not yet reached its destination for the given date.'
  },
  station: {
    title: 'Station Live',
    description: 'Get upcoming and passing trains at a station with arrival/departure times, delays, and platform info.',
    signature: 'liveAtStation(stationCode: string, hours?: 2 | 4 | 8): Promise<Result>',
    example: `import { liveAtStation } from 'railkit';

// hours: 2, 4, or 8 (default 2)
const result = await liveAtStation('NDLS', 2);

if (result.success) {
  console.log(result.data.summary);
  result.data.trains.forEach((t) => {
    console.log(\`\${t.trainNo} \${t.trainName} | Arr \${t.arrival.actual} (delay \${t.arrival.delay}m)\`);
  });
}`,
    responseFields: [
      { field: 'summary', description: 'Human-readable summary line, e.g. "20 Trains departing from/arriving at NDLS in next 2 Hrs."' },
      { field: 'totalTrains', description: 'Number of trains in the response' },
      { field: 'trains[].trainNo', description: '5-digit train number' },
      { field: 'trains[].trainName', description: 'Train name' },
      { field: 'trains[].source', description: 'Origin station code' },
      { field: 'trains[].sourceName', description: 'Origin station name' },
      { field: 'trains[].dest', description: 'Destination station code' },
      { field: 'trains[].destName', description: 'Destination station name' },
      { field: 'trains[].trainType', description: 'Train type (e.g. Rajdhani, MEMU, Express)' },
      { field: 'trains[].classes', description: 'Comma-separated classes available (1A, 2A, 3A, SL, GEN, ...)' },
      { field: 'trains[].runDate', description: 'Train run date in DD-Mon-YYYY format' },
      { field: 'trains[].platform', description: 'Platform number' },
      { field: 'trains[].cancelled', description: 'Whether the train is cancelled at this stop' },
      { field: 'trains[].arrival.actual', description: 'Actual arrival time' },
      { field: 'trains[].arrival.scheduled', description: 'Scheduled arrival time' },
      { field: 'trains[].arrival.delay', description: 'Arrival delay in minutes' },
      { field: 'trains[].arrival.delayed', description: 'Boolean — whether the train is delayed on arrival' },
      { field: 'trains[].departure.actual', description: 'Actual departure time' },
      { field: 'trains[].departure.scheduled', description: 'Scheduled departure time' },
      { field: 'trains[].departure.delay', description: 'Departure delay in minutes' },
      { field: 'trains[].departure.delayed', description: 'Boolean — whether the train is delayed on departure' }
    ]
  }
};

export const statusCodes = [
  { code: 'CNF', desc: 'Confirmed - Seat/Berth allocated' },
  { code: 'WL', desc: 'Waiting List - Not confirmed' },
  { code: 'RAC', desc: 'Reservation Against Cancellation' },
  { code: 'CAN', desc: 'Cancelled' },
  { code: 'PQWL', desc: 'Pooled Quota Waiting List' },
  { code: 'TQWL', desc: 'Tatkal Quota Waiting List' },
  { code: 'RLWL', desc: 'Remote Location Waiting List' },
  { code: 'GNWL', desc: 'General Waiting List' }
];

export const responseFormats = {
  success: `{
  success: true,
  data: {
    // Response data
  }
}`,
  error: `{
  success: false,
  error: "Error message"
}`
};
