import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { absoluteUrl, buildMetadata } from "../../../lib/seo";

type Guide = {
  title: string;
  description: string;
  intro: string;
  endpoint: string;
  docsPath: string;
  relatedPath: string;
  relatedLabel: string;
  steps: string[];
  request: string;
  response: string;
  responseNotes: string[];
  freshness: string;
  errors: string[];
};

const guides: Record<string, Guide> = {
  "pnr-status-api": {
    title: "PNR Status API Guide",
    description: "Check Indian Railways PNR status with RailKit REST API or Node.js SDK. See authentication, request and response examples, errors, and data freshness.",
    intro: "Use a 10-digit PNR to retrieve booking and current passenger status, journey details, train information, and chart status. Send requests from your backend so your API key stays private.",
    endpoint: "GET /api/v1/pnr/:pnr",
    docsPath: "/docs/pnr-status",
    relatedPath: "/guides/live-train-tracking-api",
    relatedLabel: "Live train tracking API guide",
    steps: [
      "Create a RailKit account and generate an API key in your dashboard.",
      "Set RAILKIT_API_KEY and PNR in your server environment. PNR must contain exactly 10 digits.",
      "Call the endpoint with the x-api-key header. Replace PNR with a valid booking number you are authorized to use.",
    ],
    request: `export RAILKIT_API_KEY="your_api_key"
export PNR="your_10_digit_pnr"

curl "https://api.railkit.in/api/v1/pnr/$PNR" \\
  -H "x-api-key: $RAILKIT_API_KEY" \\
  -H "accept: application/json"`,
    response: `{
  "success": true,
  "data": {
    "pnr": "1234567890",
    "train": { "number": "18021", "name": "Example Express" },
    "journey": {
      "source": { "code": "KGP", "name": "KHARAGPUR JN" },
      "destination": { "code": "KUR", "name": "KHURDA ROAD JN" }
    },
    "chart": { "status": "Chart Not Prepared" },
    "passengers": [{
      "booking": { "status": "WL", "details": "WL/12" },
      "current": { "status": "CNF", "details": "CNF/C1/30" }
    }]
  }
}`,
    responseNotes: [
      "booking records original reservation status; current records latest reported allocation.",
      "Check success before reading data. Passenger fields may be absent or null until charting or allocation completes.",
      "Example response is illustrative; field availability depends on upstream railway data.",
    ],
    freshness: "PNR status can change as the railway processes bookings and prepares charts. Recheck when users need an update; do not promise instant changes. The endpoint does not provide a guaranteed update interval.",
    errors: [
      "400: PNR is malformed. Validate exactly 10 digits before sending.",
      "401 or 403: API key is missing, invalid, or inactive. Check server configuration.",
      "404: PNR has no available record. Confirm number before retrying.",
      "429: Request limit reached. Back off and check plan usage; avoid rapid polling.",
      "5xx or upstream failure: Retry later with bounded backoff and show last known result if available.",
    ],
  },
  "live-train-tracking-api": {
    title: "Live Train Tracking API Guide",
    description: "Track an Indian train with RailKit REST API. Learn journey-date handling, live status fields, sample requests and responses, errors, and freshness limits.",
    intro: "Look up a train's latest reported movement by five-digit train number and journey start date. V1 returns the full NTES route, stoppage and intermediate station times, journey metrics, Hindi names when available, and detailed coach composition.",
    endpoint: "GET /api/v1/trains/:trainNumber/live/:date",
    docsPath: "/docs/live-tracking",
    relatedPath: "/guides/pnr-status-api",
    relatedLabel: "PNR status API guide",
    steps: [
      "Get a RailKit API key and keep it on your server.",
      "Use a five-digit train number and its journey start date in DD-MM-YYYY format. Date must be today or within the previous five days in India time.",
      "Read statusNote, lastUpdate, currentStationCode, progress, and timeline. Stoppages include actual and scheduled times; intermediate points include scheduled times only. Treat last reported position as an estimate, not GPS location.",
    ],
    request: `export RAILKIT_API_KEY="your_api_key"
export TRAIN_NUMBER="12345"
export JOURNEY_DATE="$(TZ=Asia/Kolkata date +%d-%m-%Y)"

curl "https://api.railkit.in/api/v1/trains/$TRAIN_NUMBER/live/$JOURNEY_DATE" \\
  -H "x-api-key: $RAILKIT_API_KEY" \\
  -H "accept: application/json"`,
    response: `{
  "success": true,
  "data": {
    "trainNo": "12345",
    "trainName": "Example Express",
    "trainNameHindi": "उदाहरण एक्सप्रेस",
    "date": "17-Oct-2026",
    "statusNote": "Arrived at RAMPUR HAT (RPH)",
    "lastUpdate": "17-Oct-2026 19:19 IST",
    "currentStationCode": "RPH",
    "totalStations": 161,
    "totalStoppageStations": 18,
    "totalDistanceKm": 998,
    "averageSpeedKmph": 61.29,
    "progress": {
      "journeyStatus": "running",
      "currentStationIndex": 50,
      "totalStations": 161,
      "passedStations": 49,
      "remainingStations": 111,
      "currentDistanceKm": 207,
      "distanceRemainingKm": 791,
      "percent": 20.74
    },
    "timeline": [
      {
        "type": "stoppage",
        "status": "passed",
        "stationCode": "HWH",
        "stationName": "HOWRAH JN",
        "stationNameHindi": "हावड़ा जं",
        "platform": "15",
        "distanceKm": "0",
        "arrival": { "scheduled": "SRC", "actual": "SRC", "delay": "" },
        "departure": { "scheduled": "16:05 17-Oct", "actual": "16:06 17-Oct", "delay": "00:01" }
      },
      {
        "type": "intermediate",
        "status": "passed",
        "stationCode": "SYAE",
        "stationName": "Example intermediate station",
        "distanceKm": "3",
        "arrival": { "scheduled": "16:10" },
        "departure": { "scheduled": "16:10" }
      }
    ],
    "coachPosition": [{
      "type": "HA1",
      "number": "HA1",
      "position": "4",
      "id": "710580",
      "operatedBy": "ER",
      "coachType": "LWFCWAC",
      "coachNo": "194544",
      "manufacturedIn": 2019,
      "coachClass": "1A+2A",
      "variant": "1A-10-2A-28-V1"
    }],
    "coachPositionTimeline": [{
      "fromStationCode": "HWH",
      "fromStationName": "HOWRAH JN",
      "coachPosition": [{
        "type": "HA1", "number": "HA1", "position": "4", "id": "710580",
        "operatedBy": "ER", "coachType": "LWFCWAC", "coachNo": "194544",
        "manufacturedIn": 2019, "coachClass": "1A+2A", "variant": "1A-10-2A-28-V1"
      }]
    }]
  }
}`,
    responseNotes: [
      "statusNote summarizes reported movement. Stoppage points carry scheduled and actual arrival/departure; intermediate points carry scheduled arrival/departure only.",
      "totalStations counts stoppage and intermediate points; totalStoppageStations counts only stoppages. Hindi names appear when NTES provides them. Missing intermediate English names can be filled from the local station catalog.",
      "averageSpeedKmph is route distance divided by scheduled running time after interior station dwell is subtracted.",
      "Coach metadata includes position label, upstream record ID, owning railway, transportation type, stock number, derived manufacture year, class, and variant. coachPositionTimeline is present when composition changes along the route.",
      "lastUpdate may be empty before movement begins. Check it before showing a 'live' badge.",
      "Example response is illustrative; actual fields and times vary by journey and provider.",
    ],
    freshness: "Train movement comes from upstream reports and may lag real-world location. Show the returned lastUpdate beside the status. A journey that has not started can have no fresh update; this API does not guarantee a fixed refresh interval.",
    errors: [
      "400: Train number or date is invalid. Use five digits and a supported journey date.",
      "401 or 403: API key is missing, invalid, or inactive.",
      "404: No live record for that train and journey date. Check whether the train runs that day.",
      "429: Request limit reached. Reduce polling frequency and retry with backoff.",
      "5xx or upstream failure: Keep the last known status with its timestamp, then retry later.",
    ],
  },
};

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return Object.keys(guides).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = guides[slug];
  if (!guide) return {};
  return buildMetadata({ title: guide.title, description: guide.description, path: `/guides/${slug}` });
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = guides[slug];
  if (!guide) notFound();

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: guide.title, item: absoluteUrl(`/guides/${slug}`) },
    ],
  };

  return (
    <main className="min-h-screen bg-white px-6 pb-24 pt-28 text-neutral-900 sm:px-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <article className="mx-auto max-w-3xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Developer guide</p>
        <h1 className="font-site-serif text-5xl leading-tight sm:text-6xl">{guide.title}</h1>
        <p className="mt-6 text-lg leading-8 text-neutral-600">{guide.intro}</p>
        <p className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 font-site-code text-sm">{guide.endpoint}</p>

        <section className="mt-12" aria-labelledby="get-started">
          <h2 id="get-started" className="text-2xl font-semibold">Get started</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-6 leading-7 text-neutral-700">
            {guide.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
          <Link href="/auth" className="mt-5 inline-block font-medium underline underline-offset-4">Get an API key</Link>
        </section>

        <section className="mt-12" aria-labelledby="request-example">
          <h2 id="request-example" className="text-2xl font-semibold">Request example</h2>
          <p className="mt-3 leading-7 text-neutral-700">Run from a server terminal. Replace example credentials and input values with your own.</p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-neutral-950 p-5 text-sm leading-6 text-neutral-100"><code>{guide.request}</code></pre>
        </section>

        <section className="mt-12" aria-labelledby="response-example">
          <h2 id="response-example" className="text-2xl font-semibold">Response example</h2>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-neutral-950 p-5 text-sm leading-6 text-neutral-100"><code>{guide.response}</code></pre>
          <ul className="mt-5 list-disc space-y-2 pl-6 leading-7 text-neutral-700">
            {guide.responseNotes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="freshness">
          <h2 id="freshness" className="text-2xl font-semibold">Data freshness</h2>
          <p className="mt-4 leading-7 text-neutral-700">{guide.freshness}</p>
        </section>

        <section className="mt-12" aria-labelledby="errors">
          <h2 id="errors" className="text-2xl font-semibold">Errors and recovery</h2>
          <ul className="mt-4 list-disc space-y-2 pl-6 leading-7 text-neutral-700">
            {guide.errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </section>

        <nav aria-label="Related documentation" className="mt-14 flex flex-wrap gap-x-7 gap-y-3 border-t border-neutral-200 pt-7 font-medium">
          <Link href={guide.docsPath} className="underline underline-offset-4">Full endpoint reference</Link>
          <Link href={guide.relatedPath} className="underline underline-offset-4">{guide.relatedLabel}</Link>
          <Link href="/docs" className="underline underline-offset-4">All API documentation</Link>
        </nav>
      </article>
    </main>
  );
}
