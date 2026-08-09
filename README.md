# RailKit

[![npm version](https://badge.fury.io/js/railkit.svg)](https://www.npmjs.com/package/railkit)
[![Downloads](https://img.shields.io/npm/dm/railkit.svg)](https://www.npmjs.com/package/railkit)
[![License](https://img.shields.io/npm/l/railkit.svg)](https://github.com/RAJIV81205/railkit/blob/main/LICENSE)

<img width="1536" height="657" alt="RailKit Banner" src="https://github.com/user-attachments/assets/6bdcc05f-186d-4f6f-918d-a99a65026c97" />


A comprehensive Node.js SDK for Indian Railways. Get real-time PNR status, train information, live tracking, station updates, train search, and seat availability — all through a single, clean API.

---

## ✨ Features

- 🎫 **PNR Status** — Real-time PNR status with full passenger details
- 🚂 **Train Information** — Complete train details with station-by-station route
- 📍 **Live Train Tracking** — Real-time position and delay info for any train
- 🚉 **Live Station Board** — Upcoming trains at any station right now
- 🔍 **Train Search** — Find all direct trains between two stations
- 💺 **Seat Availability** — Check availability and fare for any class and quota
- 💰 **Fare Lookup** — Full fare breakdown for any train, class, and quota
- ⚡ **Fast & Reliable** — Built-in timeout handling, input validation, and caching

---

## 📦 Installation

```bash
npm install railkit
```

---

## 🔑 Getting an API Key

1. Visit **[railkit.rajivdubey.dev](https://railkit.rajivdubey.dev)**
2. Sign up and navigate to your Dashboard
3. Generate an API key from the **API Keys** section
4. Copy the key — you'll use it in the next step

---

## 🚀 Quick Start

### Step 1 — Add your API key to `.env`

```bash
# .env
RAILKIT_API_KEY=your_api_key_here
```

### Step 2 — Configure the SDK once at startup

```javascript
import { configure } from 'railkit';

configure(process.env.RAILKIT_API_KEY);
```

Call `configure()` **once** at the top of your app before using any other function. It stores your key globally for all subsequent calls.

### Step 3 — Use any function

```javascript
import {
  configure,
  checkPNRStatus,
  getTrainInfo,
  trackTrain,
  liveAtStation,
  searchTrainBetweenStations,
  getAvailability,
  fareLookup,
} from 'railkit';

// Configure once
configure(process.env.RAILKIT_API_KEY);

// Check PNR status
const pnrResult = await checkPNRStatus('1234567890');

// Get train information
const trainResult = await getTrainInfo('12301');

// Track live train status (date optional, defaults to today)
const trackResult = await trackTrain('12301', '31-03-2026');

// Get live trains at a station
const stationResult = await liveAtStation('NDLS');

// Search trains between stations
const searchResult = await searchTrainBetweenStations('NDLS', 'BCT');

// Get seat availability with fare breakdown
const availResult = await getAvailability('12496', 'ASN', 'DDU', '27-12-2025', '2A', 'GN');

// Get fare for a journey
const fareResult = await fareLookup('12313', 'ASN', 'NDLS', '06-06-2026', '3A', 'GN');
```

---

## 📖 API Reference

### `configure(apiKey)`

Configure the SDK with your API key. **Must be called once before any other function.**

| Parameter | Type | Description |
|-----------|------|-------------|
| `apiKey` | string | Your API key from the dashboard |

```javascript
import { configure } from 'railkit';

configure(process.env.RAILKIT_API_KEY);
```

---

### 1. `checkPNRStatus(pnr)`

Get comprehensive PNR status with passenger details, journey information, chart status, and booking fare.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `pnr` | string | 10-digit PNR number |

**Example:**
```javascript
const result = await checkPNRStatus('5827194603');

if (result.success) {
  console.log('PNR:', result.data.pnr);
  console.log('Train:', result.data.train.name, `(${result.data.train.number})`);
  console.log('Journey:', `${result.data.journey.source.name} → ${result.data.journey.destination.name}`);
  console.log('Class:', result.data.journey.class, '| Quota:', result.data.journey.quota);
  console.log('Fare:', `₹${result.data.booking.fare}`);

  result.data.passengers.forEach(p => {
    console.log(`${p.serialNumber}: booking ${p.booking.details} → current ${p.current.details}`);
  });
}
```

**Response:**
```javascript
{
  success: true,
  data: {
    pnr: "5827194603",
    train: {
      number: "12987",
      name: "SAMPURN K RAJDHANI"
    },
    journey: {
      dateOfJourney: "22 Aug 2026, 04:35:00 pm",
      class: "3A",
      quota: "GN",
      source: { code: "JP", name: "JAIPUR JN" },
      destination: { code: "NDLS", name: "NEW DELHI" },
      boardingPoint: { code: "JP", name: "JAIPUR JN" },
      distance: 471,
      arrivalDate: "22 Aug 2026, 10:20:00 pm"
    },
    chart: { status: "Chart Prepared" },
    booking: {
      fare: 1845,
      ticketFare: 1795,
      bookingDate: "20 Aug 2026, 11:14:32 am"
    },
    passengers: [
      {
        serialNumber: "Passenger 1",
        coachPosition: 0,
        booking: {
          status: "CNF",
          coach: "B5",
          berthNo: 22,
          berthCode: "LB",
          details: "CNF/B5/22/LB"
        },
        current: {
          status: "CNF",
          coach: "B5",
          berthNo: 22,
          berthCode: "LB",
          details: "CNF , B5 - 22 [LB]"
        }
      },
      {
        serialNumber: "Passenger 2",
        coachPosition: 0,
        booking: {
          status: "RAC",
          coach: null,
          berthNo: 7,
          berthCode: null,
          details: "RAC/7"
        },
        current: {
          status: "CNF",
          coach: "B5",
          berthNo: 31,
          berthCode: "UB",
          details: "CNF , B5 - 31 [UB]"
        }
      }
    ]
  }
}
```

---

### 2. `getTrainInfo(trainNumber)`

Get detailed train information including complete route with station coordinates.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `trainNumber` | string | 5-digit train number |

**Example:**
```javascript
const result = await getTrainInfo('12301');

if (result.success) {
  const { trainInfo, route } = result.data;

  console.log(`🚂 ${trainInfo.train_name} (${trainInfo.train_no})`);
  console.log(`📍 ${trainInfo.from_stn_name} → ${trainInfo.to_stn_name}`);
  console.log(`⏱️ ${trainInfo.from_time} → ${trainInfo.to_time} (${trainInfo.travel_time})`);
  console.log(`📅 Running days: ${trainInfo.running_days}`);

  route.slice(0, 5).forEach(stn => {
    console.log(`  ${stn.stnName} (${stn.stnCode}) — dep: ${stn.departure}`);
  });
}
```

**Response:**
```javascript
{
  success: true,
  data: {
    trainInfo: {
      train_no: "12301",
      train_name: "HOWRAH RAJDHANI",
      from_stn_name: "NEW DELHI",
      from_stn_code: "NDLS",
      to_stn_name: "HOWRAH JN",
      to_stn_code: "HWH",
      from_time: "17:00",
      to_time: "09:55",
      travel_time: "16:55 hrs",
      running_days: "1111111",
      type: "RAJDHANI"
    },
    route: [
      {
        stnCode: "NDLS", stnName: "NEW DELHI",
        arrival: "--", departure: "17:00",
        halt: "0 min", distance: "0", day: "1",
        coordinates: { latitude: 28.6431, longitude: 77.2201 }
      }
      // ... more stations
    ]
  }
}
```

---

### 3. `trackTrain(trainNumber, date?)`

Get real-time live status of a train with a unified station timeline (stoppages + intermediate stations in route order).

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `trainNumber` | string | 5-digit train number |
| `date` | string *(optional)* | Date in `DD-MM-YYYY` format. Defaults to today if omitted. |

**Example:**
```javascript
const result = await trackTrain('12301', '31-03-2026');

if (result.success) {
  const { trainNo, trainName, statusNote, currentStationCode, timeline } = result.data;

  console.log(`🚂 ${trainName} (${trainNo})`);
  console.log(`📍 Status: ${statusNote}`);
  console.log(`🎯 Current station code: ${currentStationCode}`);

  timeline.forEach(point => {
    console.log(`\n🚉 ${point.stationName} (${point.stationCode})`);
    console.log(`   Type: ${point.type} | Status: ${point.status}`);

    if (point.type === 'stoppage') {
      console.log(`   PF: ${point.platform || '-'}`);
      console.log(`   Arr: ${point.arrival.scheduled} → ${point.arrival.actual} ${point.arrival.delay}`);
      console.log(`   Dep: ${point.departure.scheduled} → ${point.departure.actual} ${point.departure.delay}`);
    }
  });
}
```

**Response:**
```javascript
{
  success: true,
  data: {
    trainNo: "12301",
    trainName: "HOWRAH RAJDHANI",
    date: "31-Mar-2026",
    statusNote: "Arrived at HOWRAH JN(HWH) — On Time",
    lastUpdate: "31-Mar-2026 10:01",
    totalStations: 8, // stoppage count from source
    currentStationCode: "HWH",
    timeline: [
      {
        type: "stoppage", // stoppage | intermediate
        status: "passed", // passed | current | upcoming
        stationCode: "NDLS", stationName: "NEW DELHI",
        platform: "16", distanceKm: "0",
        arrival:   { scheduled: "SRC", actual: "SRC",        delay: ""        },
        departure: { scheduled: "17:00", actual: "17:00",    delay: "On Time" },
        coachPosition: [
          { type: "ENG", number: "ENG", position: "0" },
          { type: "3A",  number: "B1",  position: "5" }
          // ...
        ]
      },
      {
        type: "intermediate",
        status: "current",
        stationCode: "SZM",
        stationName: "SUBZI MANDI"
      }
      // ... more timeline points
    ]
  }
}
```

---

### 4. `getTrainHistory(trainNumber, journeyDate)`

Get the completed journey history of a train for a specific journey date. The backend persists a `TrainHistory` record once a train has reached its destination, including the full station-by-station timeline, per-stop delays, and the final coach position.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `trainNumber` | string | 5-digit train number |
| `journeyDate` | string | Journey date in `DD-MM-YYYY` format |

**Example:**
```javascript
const result = await getTrainHistory('12301', '15-04-2025');

if (result.success) {
  const { trainNo, trainName, journeyDate, stations, coachPosition } = result.data;

  console.log(`🚂 ${trainName} (${trainNo}) — ${journeyDate}`);

  stations.forEach((stop) => {
    console.log(`\n🚉 ${stop.stationName} (${stop.stationCode})`);
    console.log(`   PF: ${stop.platform || '-'}`);
    console.log(`   Arr: ${stop.arrival.scheduled} → ${stop.arrival.actual} (${stop.arrival.delay} min)`);
    console.log(`   Dep: ${stop.departure.scheduled} → ${stop.departure.actual} (${stop.departure.delay} min)`);
  });
}
```

**Response:**
```javascript
{
  success: true,
  data: {
    historyKey: "12301:15-04-2025",
    trainNo: "12301",
    trainName: "HOWRAH RAJDHANI",
    journeyDate: "15-04-2025",
    sourceStationCode: "NDLS",
    sourceStationName: "NEW DELHI",
    destinationStationCode: "HWH",
    destinationStationName: "HOWRAH JN",
    stations: [
      {
        stationCode: "NDLS",
        stationName: "NEW DELHI",
        platform: "16",
        distanceKm: 0,
        arrival:   { scheduled: "SRC", actual: "SRC",   delay: 0  },
        departure: { scheduled: "17:00", actual: "17:00", delay: 0 }
      },
      {
        stationCode: "HWH",
        stationName: "HOWRAH JN",
        platform: "9",
        distanceKm: 1447,
        arrival:   { scheduled: "09:55", actual: "09:55", delay: 0 },
        departure: { scheduled: "10:00", actual: "10:00", delay: 0 }
      }
    ],
    coachPosition: [
      { type: "ENG", number: "ENG", position: "0" },
      { type: "3A",  number: "B1",  position: "5" }
    ],
    lastUpdate: "2025-04-16T10:05:00.000Z"
  }
}
```

> The endpoint returns `404` with `{ success: false, error: "Train history record not found" }` for dates where the train has not yet reached its destination.

---

### 5. `liveAtStation(stnCode, hours?)`

Get the list of upcoming and passing trains at a station in real time, with arrival/departure times, delays, and platform info.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `stnCode` | string | Station code (e.g., `'NDLS'`, `'BCT'`, `'HWH'`) |
| `hours` | number | Time window — `2`, `4`, or `8` (default `2`) |

**Example:**
```javascript
const result = await liveAtStation('NDLS', 2);

if (result.success) {
  console.log(result.data.summary);
  console.log(`Total trains: ${result.data.totalTrains}`);

  result.data.trains.forEach(train => {
    console.log(`🚂 ${train.trainNo} — ${train.trainName}`);
    console.log(`   📍 ${train.sourceName} → ${train.destName} | PF ${train.platform}`);
    console.log(`   ⏰ Arr ${train.arrival.actual} (scheduled ${train.arrival.scheduled}, delay ${train.arrival.delay}m)`);
  });
}
```

**Response:**
```javascript
{
  success: true,
  data: {
    summary: "20 Trains departing from/arriving at NDLS - NEW DELHI. in next 2 Hrs.",
    totalTrains: 2,
    trains: [
      {
        trainNo: "12987",
        trainName: "SAMPURN K RAJDHANI",
        source: "JP",
        sourceName: "JAIPUR JN",
        dest: "NDLS",
        destName: "NEW DELHI",
        trainType: "Rajdhani",
        classes: "1A, 2A, 3A",
        runDate: "22-Aug-2026",
        platform: "9",
        cancelled: false,
        arrival:   { actual: "10:18", scheduled: "10:20", delay: 0,  delayed: false },
        departure: { actual: "10:25", scheduled: "10:25", delay: 5,  delayed: true  }
      },
      {
        trainNo: "12309",
        trainName: "RAJDHANI EXPRESS",
        source: "HWH",
        sourceName: "HOWRAH JN",
        dest: "NDLS",
        destName: "NEW DELHI",
        trainType: "Rajdhani",
        classes: "1A, 2A, 3A",
        runDate: "22-Aug-2026",
        platform: "3",
        cancelled: false,
        arrival:   { actual: "11:05", scheduled: "11:00", delay: 5,  delayed: true  },
        departure: { actual: "11:12", scheduled: "11:10", delay: 2,  delayed: true  }
      }
    ]
  }
}
```

---

### 6. `searchTrainBetweenStations(fromStnCode, toStnCode)`

Find all direct trains running between two stations.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `fromStnCode` | string | Origin station code |
| `toStnCode` | string | Destination station code |

**Example:**
```javascript
const result = await searchTrainBetweenStations('NDLS', 'BCT');

if (result.success) {
  console.log(`Found ${result.data.length} trains\n`);

  result.data.forEach(train => {
    console.log(`🚂 ${train.train_name} (${train.train_no})`);
    console.log(`   📍 ${train.from_stn_name} → ${train.to_stn_name}`);
    console.log(`   ⏰ ${train.from_time} → ${train.to_time} (${train.travel_time})`);
    console.log(`   📏 Distance: ${train.distance} km`);
    console.log(`   📅 Days: ${train.running_days}`);
  });
}
```

**Response:**
```javascript
{
  success: true,
  data: [
    {
      train_no: "12951",
      train_name: "MUMBAI RAJDHANI",
      source_stn_name: "NEW DELHI",
      source_stn_code: "NDLS",
      dstn_stn_name: "MUMBAI CENTRAL",
      dstn_stn_code: "BCT",
      from_stn_name: "NEW DELHI",
      from_stn_code: "NDLS",
      to_stn_name: "MUMBAI CENTRAL",
      to_stn_code: "BCT",
      from_time: "16:55",
      to_time: "08:35",
      travel_time: "15:40 hrs",
      running_days: "1111111",
      distance: "1384",
      halts: 8
    }
    // ... more trains (sorted by departure time)
  ]
}
```

---

### 7. `getAvailability(trainNo, fromStnCode, toStnCode, date, coach, quota)`

Check seat availability and fare breakdown for a specific train, class, and date.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `trainNo` | string | 5-digit train number |
| `fromStnCode` | string | Origin station code (e.g., `'NDLS'`) |
| `toStnCode` | string | Destination station code (e.g., `'BCT'`) |
| `date` | string | Journey date in `DD-MM-YYYY` format |
| `coach` | string | Coach/class code — see [Class & Quota Reference](#-class--quota-reference) |
| `quota` | string | Quota code — see [Class & Quota Reference](#-class--quota-reference) |

**Example:**
```javascript
const result = await getAvailability('12301', 'NDLS', 'HWH', '27-12-2025', '3A', 'GN');

if (result.success) {
  const { train, fare, availability } = result.data;

  console.log(`🚂 ${train.trainName} (${train.trainNo})`);
  console.log(`📍 ${train.fromStationName} → ${train.toStationName}`);

  console.log('\n💰 Fare Breakdown:');
  console.log(`   Base Fare:    ₹${fare.baseFare}`);
  console.log(`   Reservation:  ₹${fare.reservationCharge}`);
  console.log(`   Superfast:    ₹${fare.superfastCharge}`);
  console.log(`   Total:        ₹${fare.totalFare}`);

  console.log('\n📅 Availability:');
  availability.forEach(day => {
    console.log(`   ${day.date}: ${day.availabilityText} — ${day.prediction}`);
  });
}
```

---

### 8. `fareLookup(trainNo, fromStnCode, toStnCode, date, travelClass, quota)`

Get the full fare breakdown for a journey — base fare, reservation, superfast, catering, GST, dynamic fare, and total.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `trainNo` | string | 5-digit train number |
| `fromStnCode` | string | Origin station code (e.g., `'ASN'`) |
| `toStnCode` | string | Destination station code (e.g., `'NDLS'`) |
| `date` | string | Journey date in `DD-MM-YYYY` format |
| `travelClass` | string | See class codes below |
| `quota` | string | See quota codes below |

**Class Codes:** see [Class & Quota Reference](#-class--quota-reference)

**Quota Codes:** see [Class & Quota Reference](#-class--quota-reference)

**Example:**
```javascript
const result = await fareLookup('12313', 'ASN', 'NDLS', '06-06-2026', '3A', 'GN');

if (result.success) {
  const d = result.data;
  console.log(`🚂 ${d.trainName} (${d.trainNo})`);
  console.log(`📍 ${d.from} → ${d.to}  |  ${d.distance} km`);
  console.log(`\n💰 Fare Breakdown:`);
  console.log(`   Base Fare:    ₹${d.baseFare}`);
  console.log(`   Reservation:  ₹${d.reservation}`);
  console.log(`   Superfast:    ₹${d.superfast}`);
  console.log(`   Catering:     ₹${d.catering}`);
  console.log(`   Dynamic Fare: ₹${d.dynamicFare}`);
  console.log(`   GST:          ₹${d.gst}`);
  console.log(`   ─────────────────`);
  console.log(`   Total:        ₹${d.totalFare}`);
}
```

**Response:**
```javascript
{
  success: true,
  data: {
    trainNo:     "12313",
    trainName:   "RAJDHANI EXPRES",
    from:        "ASN",
    to:          "NDLS",
    class:       "3A",
    distance:    1249,
    baseFare:    1617,
    reservation: 40,
    superfast:   45,
    catering:    310,
    dynamicFare: 647,
    gst:         118,
    totalFare:   2780,
    tatkalFare:  0,
    concession:  0
  }
}
```

---

## ⚠️ Error Handling

All functions return a consistent response structure. Always check `success` before accessing `data`.

```javascript
// ✅ Success
{ success: true, data: { /* ... */ } }

// ❌ Failure
{ success: false, error: "Description of what went wrong" }
```

**Common error scenarios:**

| Error | Cause |
|-------|-------|
| `railkit is not configured` | `configure()` was not called |
| `Invalid API key` (401) | Key doesn't exist in the system |
| `API key is inactive` (403) | Key has been deactivated |
| `Usage limit exceeded` (429) | Monthly request quota reached |
| `PNR number must be exactly 10 digits` | Bad input |
| `Invalid train number` | Train number not 5 digits |
| `Invalid date format. Use DD-MM-YYYY.` | Wrong date format |
| `Request timed out` | Upstream service too slow |

---

## 🛡️ Input Validation

The SDK validates inputs locally before making any network call:

- **PNR** — must be exactly 10 digits (non-numerics auto-stripped)
- **Train number** — must be exactly 5 characters
- **Station codes** — must be uppercase alphabetic, 1–5 chars
- **Date** — must be `DD-MM-YYYY`, validated for real calendar dates
- **Coach / Class** — see [Class & Quota Reference](#-class--quota-reference)
- **Quota** — see [Class & Quota Reference](#-class--quota-reference)

---

## 📊 PNR Status Codes

| Code | Meaning |
|------|---------|
| `CNF` | Confirmed |
| `WL` | Waiting List |
| `RAC` | Reservation Against Cancellation |
| `CAN` | Cancelled |
| `PQWL` | Pooled Quota Waiting List |
| `TQWL` | Tatkal Quota Waiting List |
| `GNWL` | General Waiting List |

---

## 🚃 Class & Quota Reference

Used by both `getAvailability` and `fareLookup`.

### Coach / Travel Class

| Code | Class | Functions |
|------|-------|-----------|
| `SL` | Sleeper Class | both |
| `2S` | Second Seating | both |
| `3A` | Third AC | both |
| `3E` | Third AC Economy | both |
| `2A` | Second AC | both |
| `1A` | First AC | both |
| `CC` | AC Chair Car | both |
| `EC` | Executive Class | both |
| `EA` | Executive Anubhuti | `fareLookup` |
| `FC` | First Class | `fareLookup` |
| `VS` | Vistadome Non AC | `fareLookup` |
| `CH` | Chair Car High Capacity | `fareLookup` |
| `HS` | Sleeper High Capacity | `fareLookup` |
| `VC` | Vistadome CC | `fareLookup` |
| `VA` | Vistadome AC | `fareLookup` |

### Quota

| Code | Quota | Functions |
|------|-------|-----------|
| `GN` | General | both |
| `TQ` | Tatkal | both |
| `LD` | Ladies | both |
| `SS` | Senior Citizen | both |
| `PT` | Premium Tatkal | `fareLookup` |
| `DF` | Defence | `fareLookup` |
| `FT` | Foreign Tourist | `fareLookup` |
| `LB` | Lower Berth | `fareLookup` |
| `YU` | Yuva | `fareLookup` |
| `DP` | Duty Pass | `fareLookup` |
| `HP` | Handicapped | `fareLookup` |
| `PH` | Parliament House | `fareLookup` |

---

## 🔧 Requirements

- Node.js 18+ (native `fetch` required)
- Internet connection for API calls
- A valid RailKit API key

---

## 🙋 Support

- **Issues:** [GitHub Issues](https://github.com/RAJIV81205/railkit/issues)
- **Docs:** [railkit.rajivdubey.dev/docs](https://railkit.rajivdubey.dev/docs)
- **Discussions:** [GitHub Discussions](https://github.com/RAJIV81205/railkit/discussions)


---

*Built with ❤️ for Indian Railways enthusiasts. Happy journey! 🚂*
