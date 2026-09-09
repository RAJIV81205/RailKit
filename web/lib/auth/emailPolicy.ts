import { isDisposableEmailDomain } from "disposable-email-domains-js";

const DEFAULT_BLOCKED_EMAIL_DOMAINS = ["qwiklabs.net"];

function getBlockedEmailDomains() {
  const configured = (process.env.BLOCKED_EMAIL_DOMAINS || "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);

  return new Set([...DEFAULT_BLOCKED_EMAIL_DOMAINS, ...configured]);
}

export function isBlockedEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const separator = normalized.lastIndexOf("@");
  if (
    separator <= 0 ||
    separator === normalized.length - 1 ||
    separator !== normalized.indexOf("@")
  ) {
    return true;
  }

  const domain = normalized.slice(separator + 1);
  const blockedDomains = getBlockedEmailDomains();

  for (let candidate = domain; candidate.includes("."); ) {
    if (blockedDomains.has(candidate) || isDisposableEmailDomain(candidate)) {
      return true;
    }

    candidate = candidate.slice(candidate.indexOf(".") + 1);
  }

  return false;
}
