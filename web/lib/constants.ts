export type PaidPlanType = "pro" | "advance";

export type PlanTheme = "blue" | "slate" | "emerald";
export type PlanType = PaidPlanType | "free";

export type PricingFeature = {
  text: string;
  highlight?: boolean;
};

export type PricingPlan = {
  id: string;
  name: string;
  originalPrice?: string;
  price: string;
  period: string;
  description: string;
  features: PricingFeature[];
  planType: PlanType;
  buttonText: string;
  popular?: boolean;
  colorTheme: PlanTheme;
  annualPrice?: string;
  annualOriginalPrice?: string;
};

export type ManagedPlan = {
  id: string;
  name: string;
  originalPrice?: number | null;
  price: number;
  period: string;
  description: string;
  features: PricingFeature[];
  planType: PlanType;
  buttonText: string;
  popular?: boolean;
  colorTheme: PlanTheme;
  limit: number;
  annualPrice?: number;
  annualOriginalPrice?: number;
  userPlan?: "pro" | "enterprise" | null;
};

export type PlanConfigShape = {
  key: string;
  offerEndsAt: string | null;
  contactEmail: string;
  plans: ManagedPlan[];
};

export const PLAN_CONFIG: PlanConfigShape = {
  key: "default",
  offerEndsAt: null,
  contactEmail: "lucky81205+railkit@gmail.com",
  plans: [
    {
      id: "free",
      name: "Free Tier",
      price: 0,
      period: "/month",
      description:
        "For developers exploring the platform and testing basic functionality.",
      features: [
        { text: "50 API requests per month", highlight: true },
        { text: "100 requests / 10 min" },
        { text: "SDK Access only" },
        { text: "Email support" },
      ],
      planType: "free",
      buttonText: "Start for Free",
      colorTheme: "blue",
      limit: 50,
      userPlan: null,
    },
    {
      id: "pro",
      name: "Pro Tier",
      originalPrice: 89,
      price: 59,
      period: "/month",
      description:
        "For active developers building projects and scaling applications.",
      features: [
        { text: "5000 API requests per month", highlight: true },
        { text: "200 requests / 10 min" },
        { text: "SDK Access only" },
        { text: "Advanced rate limits" },
      ],
      planType: "pro",
      buttonText: "Upgrade Now",
      popular: false,
      colorTheme: "slate",
      limit: 5000,
      annualPrice: 708,
      annualOriginalPrice: 1068,
      userPlan: "pro",
    },
    {
      id: "advance",
      name: "Advance Plan",
      originalPrice: 99,
      price: 89,
      period: "/month",
      description:
        "For heavy users needing massive request limits and reliability.",
      features: [
        { text: "10k API requests per month", highlight: true },
        { text: "600 requests / 10 min" },
        { text: "API endpoint access" },
        { text: "Sponsor badge" },
      ],
      planType: "advance",
      buttonText: "Upgrade Now",
      popular: true,
      colorTheme: "emerald",
      limit: 10000,
      annualPrice: 1068,
      annualOriginalPrice: 1188,
      userPlan: "enterprise",
    },
  ],
};

export function formatINR(value: number) {
  return `₹${Math.max(0, Number(value) || 0)}`;
}

export function isPaidPlanType(value: unknown): value is PaidPlanType {
  return value === "pro" || value === "advance";
}

export function getPublicPlanConfig() {
  return {
    billingV2Enabled: process.env.BILLING_V2_ENABLED === "true",
    offerEndsAt: PLAN_CONFIG.offerEndsAt,
    contactEmail: PLAN_CONFIG.contactEmail,
    plans: PRICING_PLANS.map((plan) => ({
      ...plan,
      features: plan.features.map((feature) => ({ ...feature })),
    })),
  };
}

export function getPaidPlanRuntime(planType: PaidPlanType, billingInterval: "month" | "year" = "month") {
  const plan = PLAN_CONFIG.plans.find((item) => item.planType === planType);
  if (!plan) return null;

  return {
    amount: Math.max(0, Number(billingInterval === "year" ? plan.annualPrice : plan.price) || 0),
    limit: Math.max(0, Number(plan.limit) || 0),
    termMonths: billingInterval === "year" ? 12 : 1,
    billingInterval,
    userPlan: (plan.userPlan ||
      (planType === "advance" ? "enterprise" : "pro")) as "pro" | "enterprise",
  };
}

export const PRICING_PLANS: PricingPlan[] = PLAN_CONFIG.plans.map((plan) => ({
  id: plan.id,
  name: plan.name,
  originalPrice:
    typeof plan.originalPrice === "number"
      ? formatINR(plan.originalPrice)
      : undefined,
  price: formatINR(plan.price),
  period: plan.period,
  annualPrice:
    typeof plan.annualPrice === "number" ? formatINR(plan.annualPrice) : undefined,
  annualOriginalPrice:
    typeof plan.annualOriginalPrice === "number"
      ? formatINR(plan.annualOriginalPrice)
      : undefined,
  description: plan.description,
  features: plan.features,
  planType: plan.planType,
  buttonText: plan.buttonText,
  popular: plan.popular,
  colorTheme: plan.colorTheme,
}));

export const TOPUP_OPTIONS = [
  { requests: 20000, price: 159, perReq: 0.008 },
  { requests: 30000, price: 229, perReq: 0.008 },
  { requests: 50000, price: 379, perReq: 0.008 },
  { requests: 100000, price: 749, perReq: 0.008 },
] as const;




export type LegalSection = {
  heading: string;
  content?: string;
  items?: string[];
};

export type LegalDocument = {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
};

export const TERMS_AND_CONDITIONS: LegalDocument = {
  title: "Terms and Conditions",
  lastUpdated: "2026-08-03",
  sections: [
    {
      heading: "Acceptance of Terms",
      items: [
        "By accessing, purchasing, or using RailKit, you agree to be bound by these Terms and Conditions.",
        "If you do not agree with any part of these Terms, you must immediately discontinue use of the Service.",
        "Continued use of RailKit following any modification of these Terms constitutes acceptance of the revised Terms."
      ]
    },

    {
      heading: "Independent Service Disclaimer",
      items: [
        "RailKit is an independent developer platform.",
        "RailKit is not affiliated with, endorsed by, authorized by, sponsored by, or officially connected with Indian Railways, IRCTC, CRIS, the Government of India, or any railway authority.",
        "RailKit is not an official source of railway information.",
        "Users must independently verify information before relying upon it for operational, financial, legal, regulatory, commercial, or customer-facing purposes.",
        "Use of RailKit does not imply any relationship with or approval from any government organization."
      ]
    },

    {
      heading: "Service Description",
      items: [
        "RailKit provides APIs, developer tools, and related services that aggregate, process, and present railway-related information in a developer-friendly format.",
        "The Service is intended primarily for developers, experimentation, learning, prototyping, and lightweight integrations.",
        "Access to RailKit does not transfer ownership of any software, infrastructure, documentation, intellectual property, or service components."
      ]
    },

    {
      heading: "API License",
      items: [
        "RailKit grants a limited, non-exclusive, non-transferable, non-sublicensable, revocable license to access and use the Service.",
        "The license remains valid only while the user's account is active and compliant with these Terms.",
        "All rights not expressly granted are reserved by RailKit."
      ]
    },

    {
      heading: "API Key Security",
      items: [
        "API keys are issued to individual accounts and must remain confidential.",
        "Users may not share, transfer, lease, sell, sublicense, publish, or distribute API keys.",
        "Users are solely responsible for all activity performed using their API keys.",
        "Users must immediately notify RailKit of any suspected unauthorized access or compromise."
      ]
    },

    {
      heading: "Commercial Usage",
      items: [
        "Commercial usage is permitted only through an active paid subscription.",
        "RailKit is an independent developer project and is not marketed as enterprise-grade infrastructure.",
        "Businesses integrating RailKit do so entirely at their own risk.",
        "RailKit makes no guarantees regarding suitability for commercial operations, business continuity, compliance requirements, customer obligations, production workloads, or operational decision-making.",
        "Users are solely responsible for determining whether RailKit is appropriate for their intended use."
      ]
    },

    {
      heading: "Prohibited Uses",
      items: [
        "Reselling API access, API responses, or any RailKit-derived service.",
        "Redistributing RailKit data to third parties.",
        "Providing RailKit responses through another API, platform, product, or service.",
        "Creating a competing railway information service or API.",
        "Building derivative products whose primary value is RailKit data.",
        "Sharing API keys with customers, clients, partners, contractors, or other organizations.",
        "Creating multiple accounts to bypass quotas, restrictions, pricing, or enforcement actions.",
        "Attempting to circumvent authentication systems, security controls, quotas, or rate limits.",
        "Reverse engineering, probing, testing, or attempting to discover internal implementation details.",
        "Using RailKit for unlawful, fraudulent, deceptive, abusive, or unauthorized purposes."
      ]
    },

    {
      heading: "Data Usage and Storage Restrictions",
      items: [
        "Users may not create, maintain, replicate, enrich, archive, export, mirror, scrape, or distribute databases derived substantially from RailKit data.",
        "Users may not use RailKit as a source for building permanent railway information repositories.",
        "Users may not create historical datasets, commercial archives, analytics warehouses, or large-scale repositories derived primarily from RailKit data.",
        "Long-term retention of RailKit data is prohibited except for temporary application functionality.",
        "Temporary caching is permitted only to improve application performance and must not be used to avoid API usage.",
        "Stored data may not be redistributed, resold, licensed, exposed through another service, or made publicly available.",
        "RailKit reserves sole discretion in determining whether a user's storage or caching practices violate these Terms."
      ]
    },

    {
      heading: "Acceptable Use of Data",
      items: [
        "RailKit data may only be used within applications owned or operated by the subscribing user.",
        "Users may not expose bulk data feeds, downloadable datasets, public APIs, exports, or derivative services primarily based on RailKit data.",
        "Users may not use RailKit data to create competing platforms, marketplaces, aggregators, analytics products, or commercial data repositories."
      ]
    },

    {
      heading: "Rate Limits and Fair Usage",
      items: [
        "All plans are subject to request limits, quotas, fair usage requirements, and technical restrictions.",
        "Rate limits may be enforced per API key, account, IP address, application, organization, or other identifiers.",
        "RailKit may throttle, restrict, suspend, or terminate access where usage adversely affects service stability or violates fair usage policies.",
        "Unused request quotas do not carry over unless explicitly stated."
      ]
    },

    {
      heading: "Subscription Plans & Request Packs",
      items: [
        "Legacy paid subscriptions remain valid under their original terms. New plans are available monthly or annually as shown at checkout.",
        "New annual plans are paid upfront for twelve (12) months; included request quota renews monthly during that term.",
        "Request Packs are add-ons available only for an active paid subscription and are not standalone products.",
        "Purchasing a Request Pack increases the API request quota available under the associated active paid subscription.",
        "A Request Pack purchase does not renew, extend, or otherwise modify the subscription's validity period.",
        "All unused requests from a Request Pack automatically expire when the associated paid subscription expires.",
        "When a paid subscription expires, the account reverts to the Free plan and all remaining Request Pack requests are permanently forfeited.",
        "Purchasing a new subscription does not restore or carry forward Request Pack requests that expired with a previous subscription.",
        "Users are responsible for ensuring that sufficient subscription validity remains before purchasing a Request Pack.",
        "Request Pack purchases are non-refundable after successful payment, except where required by applicable law."
      ]
    },

    {
      heading: "Security and Suspicious Activity",
      items: [
        "RailKit may monitor service activity for security, fraud prevention, abuse detection, compliance, and operational purposes.",
        "Any suspicious, abusive, fraudulent, unauthorized, or potentially harmful activity may result in immediate restriction, suspension, or termination.",
        "Examples include credential sharing, unusual request patterns, scraping, quota abuse, automated account creation, resale attempts, data harvesting, or security violations.",
        "Users may be required to provide additional verification during investigations.",
        "RailKit reserves sole discretion in determining whether activity is suspicious or abusive."
      ]
    },

    {
      heading: "Account Suspension and Termination",
      items: [
        "RailKit may suspend, restrict, disable, or terminate accounts without prior notice.",
        "Violations involving resale, redistribution, key sharing, abuse, data extraction, suspicious activity, or breaches of these Terms may result in immediate termination.",
        "All licenses and access rights immediately cease upon termination.",
        "Associated API keys, accounts, IP addresses, domains, applications, organizations, and related resources may also be blocked."
      ]
    },

    {
      heading: "Payments and Refunds",
      items: [
        "All payments are final.",
        "Subscriptions, credits, and usage fees are non-refundable unless required by applicable law.",
        "Unused requests, quotas, or subscription periods are non-refundable.",
        "No refunds will be provided for suspensions or terminations resulting from violations of these Terms.",
        "Users are responsible for evaluating the Service before purchasing a subscription.",
        "Chargebacks, payment fraud, or abusive dispute activity may result in immediate account termination."
      ]
    },

    {
      heading: "Third-Party Data Sources",
      items: [
        "RailKit may rely on third-party systems, publicly available information, external services, and infrastructure providers.",
        "RailKit does not control such third-party sources and cannot guarantee their availability, continuity, legality, accuracy, completeness, or future accessibility.",
        "Changes made by third-party providers may affect RailKit without notice.",
        "RailKit is not responsible for inaccuracies, interruptions, delays, or failures resulting from third-party systems."
      ]
    },

    {
      heading: "Service Availability",
      items: [
        "RailKit is provided on a best-effort basis.",
        "No service level agreement (SLA), uptime commitment, availability guarantee, reliability guarantee, or response-time guarantee is provided unless explicitly agreed in writing.",
        "Maintenance, outages, upgrades, infrastructure failures, data source changes, technical issues, force majeure events, or third-party failures may affect service availability.",
        "The Service may become unavailable at any time without prior notice."
      ]
    },

    {
      heading: "Business Dependency Disclaimer",
      items: [
        "Users must not treat RailKit as their sole source of operationally critical railway information.",
        "Users are responsible for maintaining backup systems, fallback providers, alternative solutions, and contingency plans where business continuity is important.",
        "RailKit shall not be responsible for losses arising from outages, service interruptions, reduced availability, data changes, or service discontinuation.",
        "Users acknowledge that RailKit may be modified, restricted, suspended, or discontinued at any time."
      ]
    },

    {
      heading: "Service Modifications and Discontinuation",
      items: [
        "RailKit reserves the right to modify, suspend, restrict, replace, remove, or discontinue any feature, endpoint, API version, pricing plan, subscription tier, or service component at any time.",
        "RailKit has no obligation to continue operating any part of the Service indefinitely.",
        "No compensation, migration assistance, replacement services, consulting services, source code access, technical support, or continued operation shall be owed following service modifications or discontinuation except where required by law."
      ]
    },

    {
      heading: "Intellectual Property",
      items: [
        "All RailKit software, APIs, branding, documentation, infrastructure, website content, designs, logos, and platform components are protected by applicable intellectual property laws.",
        "No ownership rights are transferred through use of the Service.",
        "Users may not copy, reproduce, distribute, modify, or create derivative works from RailKit except as expressly permitted."
      ]
    },

    {
      heading: "Disclaimer of Warranties",
      items: [
        "The Service is provided on an 'AS IS' and 'AS AVAILABLE' basis.",
        "RailKit expressly disclaims all warranties, whether express, implied, statutory, or otherwise.",
        "RailKit does not guarantee accuracy, completeness, reliability, availability, suitability, performance, or fitness for any particular purpose.",
        "Users assume all risks associated with use of the Service."
      ]
    },

    {
      heading: "Limitation of Liability",
      items: [
        "To the maximum extent permitted by law, RailKit and its owner shall not be liable for any direct, indirect, incidental, consequential, special, exemplary, punitive, or economic damages.",
        "This includes loss of revenue, profits, business opportunities, customers, goodwill, data, contracts, operational capability, or business continuity.",
        "RailKit shall not be liable for decisions made based on information obtained through the Service.",
        "In all circumstances, RailKit's total aggregate liability shall not exceed the amount paid by the user to RailKit during the thirty (30) days preceding the event giving rise to the claim."
      ]
    },

    {
      heading: "Indemnification",
      items: [
        "Users agree to defend, indemnify, and hold harmless RailKit and its owner from any claims, liabilities, damages, losses, expenses, legal costs, or demands arising from their use of the Service, violation of these Terms, misuse of API data, or infringement of third-party rights."
      ]
    },

    {
      heading: "No Agency Relationship",
      items: [
        "Nothing in these Terms creates any partnership, joint venture, employment relationship, agency relationship, franchise relationship, or official representation between RailKit and any user.",
        "Users may not represent themselves as official partners, distributors, agents, or representatives of RailKit."
      ]
    },

    {
      heading: "Changes to Terms",
      items: [
        "RailKit may update these Terms at any time.",
        "Changes become effective upon publication.",
        "Continued use of the Service after publication constitutes acceptance of the revised Terms."
      ]
    },

    {
      heading: "Governing Law",
      items: [
        "These Terms shall be governed by and construed in accordance with the laws of India.",
        "Any disputes arising from or relating to the Service shall be subject to the exclusive jurisdiction of the courts located in West Bengal, India.",
        "Mandatory consumer protection rights under applicable law shall remain unaffected where legally required."
      ]
    }
  ]
};


export const PRIVACY_POLICY: LegalDocument = {
  "title": "Privacy Policy",
  "lastUpdated": "2026-06-02",
  "sections": [
    {
        "heading": "Introduction",
        "items": [
        "This Privacy Policy describes how RailKit handles your information.",
        "It applies to our website, APIs, dashboard, and Node.js SDK.",
        "By using the Service, you agree to the practices described here.",
      ]
      },
    {
      "heading": "Information We Collect",
      "items": [
        "Name and email address.",
        "Account information.",
        "API usage statistics.",
        "IP addresses and device information.",
        "Browser and operating system details.",
        "Payment transaction metadata."
      ]
    },
    {
        "heading": "Usage Logs",
        "items": [
        "RailKit records API requests, response metrics, and timestamps.",
        "We log IP addresses and other operational metadata for security and reliability.",
        "Logs are used to detect abuse, debug issues, and improve the Service.",
      ]
      },
    {
      "heading": "How We Use Information",
      "items": [
        "Provide and maintain services.",
        "Authenticate users.",
        "Monitor API usage.",
        "Enforce rate limits.",
        "Prevent abuse and fraud.",
        "Process payments.",
        "Communicate service updates."
      ]
    },
    {
        "heading": "Security Monitoring",
        "items": [
        "We analyze account activity, request patterns, and IP addresses.",
        "Usage behavior is reviewed to detect suspicious activity and enforce platform security.",
        "Monitoring helps protect both users and the platform from abuse.",
      ]
      },
    {
        "heading": "Data Sharing",
        "items": [
        "We do not sell personal information.",
        "Data may be shared with payment processors.",
        "We may also share data with legal authorities when required by law.",
      ]
      },
    {
        "heading": "Data Retention",
        "items": [
        "Information may be retained as long as necessary for operational purposes.",
        "We retain data for security, legal, and business needs.",
        "You may request deletion of your account data, subject to legal obligations.",
      ]
      },
    {
        "heading": "Cookies",
        "items": [
        "Cookies and similar technologies may be used to improve user experience.",
        "They help the website function correctly and remember preferences.",
        "You can control cookies through your browser settings.",
      ]
      },
    {
        "heading": "Data Security",
        "items": [
        "Reasonable security measures are implemented to protect stored information.",
        "Encryption, access controls, and monitoring are part of our security stack.",
        "No system can guarantee absolute security.",
      ]
      },
    {
        "heading": "Third-Party Services",
        "items": [
        "RailKit may integrate with third-party services.",
        "Each provider follows its own privacy practices.",
        "We are not responsible for the privacy practices of external providers.",
      ]
      },
    {
        "heading": "Policy Updates",
        "items": [
        "This Privacy Policy may be updated periodically.",
        "Updates will be reflected by revising the 'lastUpdated' value.",
        "Continued use of the service constitutes acceptance of any updates.",
      ]
      }
  ]
}
