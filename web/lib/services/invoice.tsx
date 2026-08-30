import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import fs from "fs";
import path from "path";
import { PLAN_CONFIG } from "@/lib/constants";

export interface InvoiceUser {
  name: string;
  email: string;
  plan: string;
  billingDate?: Date | null;
  limit: number;
}

export interface InvoiceOrder {
  orderId: string;
  planType: string;
  billingInterval?: "month" | "year" | null;
  termMonths?: number | null;
  monthlyLimit?: number | null;
  entitlementStartsAt?: Date | null;
  entitlementEndsAt?: Date | null;
  transactionReference?: string | null;
  amount: number;
  currency?: string | null;
  createdAt?: Date | null;
}

type InvoicePlanDetails = {
  displayName: string;
  amount: number;
};

type InvoiceData = {
  user: InvoiceUser;
  billingDate: Date;
  serviceEndsAt: Date;
  billingInterval: "month" | "year";
  monthlyLimit: number;
  termMonths: number;
  orderId: string;
  transactionReference: string | null;
  currency: string;
  invoiceNumber: string;
  planDetails: InvoicePlanDetails;
  amountDue: number;
  logoSrc: string | null;
};

let cachedLogoSrc: string | null | undefined;

export function addOneMonth(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

function addMonths(date: Date, months: number): Date {
  let result = new Date(date);
  for (let index = 0; index < months; index += 1) result = addOneMonth(result);
  return result;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, Number(amount) || 0));
}

async function getInvoicePlanDetails(user: InvoiceUser, order: InvoiceOrder): Promise<InvoicePlanDetails> {
  const normalizedPlan = order.planType.toLowerCase();

  try {
    const plan =
      PLAN_CONFIG.plans.find((item) => (item.userPlan || "").toLowerCase() === normalizedPlan) ||
      PLAN_CONFIG.plans.find((item) => item.planType.toLowerCase() === normalizedPlan) ||
      null;

    if (!plan) {
      return {
        displayName: `${capitalize(user.plan)} Plan`,
        amount: order.amount,
      };
    }

    return {
      displayName: plan.name || `${capitalize(user.plan)} Plan`,
      amount: Math.max(0, Number(order.amount) || 0),
    };
  } catch (error) {
    console.error("Failed to resolve plan config for invoice:", error);
    return {
      displayName: `${capitalize(user.plan)} Plan`,
      amount: Math.max(0, Number(order.amount) || 0),
    };
  }
}

function getLogoSrc() {
  if (cachedLogoSrc !== undefined) {
    return cachedLogoSrc;
  }

  const candidatePaths = [
    path.join(process.cwd(), "public", "icon.png"),
    path.join(process.cwd(), "web", "public", "icon.png"),
  ];
  const logoPath = candidatePaths.find((candidate) => fs.existsSync(candidate));

  if (!logoPath) {
    cachedLogoSrc = null;
    return cachedLogoSrc;
  }

  const logo = fs.readFileSync(logoPath);
  cachedLogoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  return cachedLogoSrc;
}

function buildInvoiceData(user: InvoiceUser, order: InvoiceOrder): Promise<InvoiceData> {
  return getInvoicePlanDetails(user, order).then((planDetails) => {
    const billingInterval = order.billingInterval === "year" ? "year" : "month";
    const termMonths = order.termMonths ?? (billingInterval === "year" ? 12 : 1);
    const billingDate = order.entitlementStartsAt
      ? new Date(order.entitlementStartsAt)
      : order.createdAt
        ? new Date(order.createdAt)
        : user.billingDate
          ? new Date(user.billingDate)
          : new Date();
    const serviceEndsAt = order.entitlementEndsAt
      ? new Date(order.entitlementEndsAt)
      : addMonths(billingDate, termMonths);
    const invoiceNumber = `INV-${order.orderId}`;

    return {
      user,
      billingDate,
      serviceEndsAt,
      billingInterval,
      monthlyLimit: order.monthlyLimit ?? user.limit,
      termMonths,
      orderId: order.orderId,
      transactionReference: order.transactionReference ?? null,
      currency: order.currency || "INR",
      invoiceNumber,
      planDetails,
      amountDue: 0,
      logoSrc: getLogoSrc(),
    };
  });
}

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#3f3f46",
    backgroundColor: "#ffffff",
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 34,
  },
  brandColumn: {
    width: "46%",
  },
  logo: {
    width: 96,
    height: 96,
    objectFit: "contain",
    marginBottom: 10,
  },
  fallbackLogo: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: "#0f4c81",
    color: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  fallbackLogoText: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
  },
  senderName: {
    fontFamily: "Helvetica-Bold",
    color: "#18181b",
    marginBottom: 3,
  },
  textLine: {
    lineHeight: 1,
  },
  billTo: {
    marginTop: 16,
  },
  sectionLabel: {
    fontFamily: "Helvetica-Bold",
    color: "#18181b",
    marginBottom: 7,
  },
  invoiceColumn: {
    width: "42%",
    alignItems: "flex-end",
  },
  invoiceTitle: {
    fontSize: 30,
    fontFamily: "Helvetica-Bold",
    color: "#18181b",
    marginBottom: 5,
  },
  invoiceNumber: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 28,
  },
  metaRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  metaLabel: {
    fontFamily: "Helvetica-Bold",
    color: "#18181b",
  },
  metaValue: {
    color: "#52525b",
  },
  dueBox: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f4f4f5",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 2,
    marginTop: 2,
  },
  dueLabel: {
    fontFamily: "Helvetica-Bold",
    color: "#18181b",
    fontSize: 12,
  },
  dueValue: {
    fontFamily: "Helvetica-Bold",
    color: "#18181b",
    fontSize: 12,
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#3f3f46",
    color: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  itemCell: {
    width: "58%",
  },
  qtyCell: {
    width: "15%",
  },
  rateCell: {
    width: "13%",
    textAlign: "right",
  },
  amountCell: {
    width: "14%",
    textAlign: "right",
  },
  itemName: {
    fontFamily: "Helvetica-Bold",
    color: "#18181b",
    marginBottom: 5,
  },
  itemDescription: {
    color: "#3f3f46",
    lineHeight: 1,
  },
  totals: {
    marginTop: 34,
    marginLeft: "65%",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  totalLabel: {
    fontFamily: "Helvetica-Bold",
    color: "#18181b",
  },
  notes: {
    marginTop: 30,
    width: "88%",
  },
  noteParagraph: {
    lineHeight: 1,
    marginBottom: 16,
  },
});

function InvoiceDocument({ data }: { data: InvoiceData }) {
  const intervalLabel = data.billingInterval === "year" ? "Annual" : "Monthly";
  const itemDescription = `${intervalLabel} prepaid plan · ${data.monthlyLimit.toLocaleString("en-IN")} API calls/month · ${data.termMonths} month${data.termMonths === 1 ? "" : "s"} · Valid through ${formatDate(data.serviceEndsAt)}`;

  return (
    <Document
      title={`${data.invoiceNumber} - RailKit`}
      author="Rajiv Dubey"
      subject="RailKit invoice"
      creator="RailKit"
      producer="RailKit"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.top}>
          <View style={styles.brandColumn}>
            {data.logoSrc ? (
              // React PDF Image does not expose an alt prop.
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={data.logoSrc} style={styles.logo} />
            ) : (
              <View style={styles.fallbackLogo}>
                <Text style={styles.fallbackLogoText}>IC</Text>
              </View>
            )}

            <Text style={styles.senderName}>Rajiv Dubey</Text>
            <Text style={styles.textLine}>RailKit</Text>
            <Text style={styles.textLine}>railkit.in</Text>
            <Text style={styles.textLine}>lucky81205+railkit@gmail.com</Text>

            <View style={styles.billTo}>
              <Text style={styles.sectionLabel}>Bill To:</Text>
              <Text style={styles.senderName}>{data.user.name}</Text>
              <Text style={styles.textLine}>{data.user.email}</Text>
            </View>
          </View>

          <View style={styles.invoiceColumn}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}># {data.invoiceNumber}</Text>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date:</Text>
              <Text style={styles.metaValue}>{formatDate(data.billingDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Payment Terms:</Text>
              <Text style={styles.metaValue}>Paid</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Service Ends:</Text>
              <Text style={styles.metaValue}>{formatDate(data.serviceEndsAt)}</Text>
            </View>
            <View style={styles.dueBox}>
              <Text style={styles.dueLabel}>Amount Due:</Text>
              <Text style={styles.dueValue}>{formatCurrency(data.amountDue, data.currency)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.itemCell}>Item</Text>
            <Text style={styles.qtyCell}>Quantity</Text>
            <Text style={styles.rateCell}>Rate</Text>
            <Text style={styles.amountCell}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.itemCell}>
              <Text style={styles.itemName}>RailKit - {data.planDetails.displayName}</Text>
              <Text style={styles.itemDescription}>{itemDescription}</Text>
            </View>
            <Text style={styles.qtyCell}>1</Text>
            <Text style={styles.rateCell}>{formatCurrency(data.planDetails.amount, data.currency)}</Text>
            <Text style={styles.amountCell}>{formatCurrency(data.planDetails.amount, data.currency)}</Text>
          </View>
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text>{formatCurrency(data.planDetails.amount, data.currency)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Amount Paid:</Text>
            <Text>{formatCurrency(data.planDetails.amount, data.currency)}</Text>
          </View>
        </View>

        <View style={styles.notes}>
          <Text style={styles.sectionLabel}>Notes:</Text>
          <Text style={styles.noteParagraph}>
            Order: {data.orderId}{data.transactionReference ? ` · Payment reference: ${data.transactionReference}` : ""}. Included quota refreshes monthly. Purchased add-ons remain available until this plan ends.
          </Text>

          <Text style={styles.sectionLabel}>Terms:</Text>
          <Text>Payment is non-refundable.</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateInvoicePdf(user: InvoiceUser, order: InvoiceOrder): Promise<Buffer> {
  const data = await buildInvoiceData(user, order);
  return renderToBuffer(<InvoiceDocument data={data} />);
}
