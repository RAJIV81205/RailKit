import type { EndpointDoc } from "./endpointDocs";

function istDate(offsetDays = 0): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const date = new Date(Date.UTC(Number(value("year")), Number(value("month")) - 1, Number(value("day")) + offsetDays));
  return `${String(date.getUTCDate()).padStart(2, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${date.getUTCFullYear()}`;
}

function exampleDate(endpointId: string): string {
  return istDate(endpointId === "train-history" ? -1 : endpointId === "seat-availability" || endpointId === "fare-lookup" ? 7 : 0);
}

export function examplePathForToday(examplePath: string, endpointId = ""): string {
  const date = exampleDate(endpointId);
  return examplePath
    .replace(/\b\d{2}-\d{2}-20\d{2}\b/g, date)
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, date);
}

export function exampleCodeForToday(code: string, endpointId: string): string {
  return code
    .replace(/\b\d{2}-\d{2}-20\d{2}\b/g, exampleDate(endpointId))
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, exampleDate(endpointId));
}

export function buildAiMarkdown(
  endpoints: readonly EndpointDoc[],
  baseUrl: string,
  docsUrl: string,
): string {
  const details = endpoints.map((endpoint) => {
    const sdkParams = endpoint.params.length
      ? endpoint.params.map((param) => {
          const optional = endpoint.signature.includes(`${param.name}?:`);
          return `- \`${param.name}\`${optional ? " (optional)" : ""}: ${param.desc}`;
        }).join("\n")
      : "No parameters.";
    const restParams = endpoint.restParams.length
      ? endpoint.restParams.map((param) =>
          `- \`${param.name}\` (${param.in}${param.required ? "" : ", optional"}): ${param.desc}`,
        ).join("\n")
      : "No parameters.";
    const functionName = endpoint.signature.slice(0, endpoint.signature.indexOf("("));
    return `### ${endpoint.title}

${endpoint.description}

SDK: \`${endpoint.signature}\`

${sdkParams}

REST: \`${endpoint.method} ${endpoint.path}\`

${restParams}

${endpoint.notes}

Example URL: \`${baseUrl}${examplePathForToday(endpoint.examplePath, endpoint.id)}\`

SDK example (server-side):

\`\`\`js
import { configure, ${functionName} } from "railkit";
configure(process.env.RAILKIT_API_KEY);
${exampleCodeForToday(endpoint.example, endpoint.id)}
\`\`\`

Illustrative response (fields and values vary):

\`\`\`json
${endpoint.response}
\`\`\`

[Full docs](${docsUrl}/${endpoint.id})`;
  }).join("\n\n");

  return `# RailKit integration reference

Base URL: \`${baseUrl}\`. All listed routes use GET and require \`x-api-key\`. Direct REST access requires the Advance plan. SDK calls require \`configure(apiKey)\` first; keep keys on the server.

## First SDK request

\`\`\`bash
npm install railkit
\`\`\`

\`\`\`js
import { configure, stationByCode } from "railkit";
configure(process.env.RAILKIT_API_KEY);
const result = await stationByCode("NDLS");
if (result.success) console.log(result.data);
else console.error(result.error);
\`\`\`

## Responses and errors

Most successes use \`{ "success": true, "data": ... }\`; failures use \`{ "success": false, "error": "..." }\`. Always check \`success\`. Cancelled trains also return a top-level \`summary\`. Empty or nullable fields depend on the endpoint and upstream data. HTTP 400 indicates invalid input, 401/403 key or access issues, 404 an absent record, 429 rate or usage limits, and 500 server failure. Also handle network errors. Sample responses below illustrate structure, not guaranteed values.

## Endpoints (${endpoints.length})

${details}
`;
}
