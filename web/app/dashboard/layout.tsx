import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";

const dashboardDisplay = Bricolage_Grotesque({
  variable: "--font-dashboard-display",
  subsets: ["latin"],
  display: "swap",
});

const dashboardBody = DM_Sans({
  variable: "--font-dashboard-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${dashboardDisplay.variable} ${dashboardBody.variable}`}>
      {children}
    </div>
  );
}
