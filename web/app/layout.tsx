import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono, Noto_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SidebarProvider } from "./SidebarProvider";
import { Header } from "../components/Header";
import { Analytics } from "@vercel/analytics/next"
import {
  buildMetadata,
  OG_LOCALE,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE,
  TWITTER_CARD,
  TWITTER_HANDLE,
  TWITTER_SITE,
  getSiteUrl,
} from "../lib/seo";

const notoSans = Noto_Sans({
  variable: "--font-noto",
  subsets: ["latin"],
  display: "swap",
});

const landingSans = Inter({
  variable: "--font-landing-sans",
  subsets: ["latin"],
  display: "swap",
});

const landingSerif = Instrument_Serif({
  variable: "--font-landing-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const codeFont = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  alternates: {
    canonical: "/",
  },
  applicationName: SITE_NAME,
  authors: [{ name: "Rajiv Dubey", url: "https://github.com/RAJIV81205" }],
  creator: "Rajiv Dubey",
  publisher: SITE_NAME,
  category: "developer tools",
  openGraph: {
    type: "website",
    locale: OG_LOCALE,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: getSiteUrl(),
    images: [
      {
        url: buildMetadata({}).openGraph.images[0].url,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: "RailKit",
      },
    ],
  },
  twitter: {
    card: TWITTER_CARD,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: TWITTER_SITE,
    creator: TWITTER_HANDLE,
    images: [buildMetadata({}).twitter.images[0]],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  other: {
    "msvalidate.01": "8115E2DFEDA48CCCCBC754C36648F4DB",
  },
  icons: {
    icon: [
      {
        url: "/icon.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body className={`${notoSans.variable} ${landingSans.variable} ${landingSerif.variable} ${codeFont.variable} antialiased`}>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-WCXRHWZD"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <SidebarProvider>
          <Header />
          {children}
        </SidebarProvider>
        <Analytics />
        <Script id="google-tag-manager" strategy="lazyOnload">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-WCXRHWZD');`}
        </Script>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-1SFQ77RRP2"
          strategy="lazyOnload"
        />
        <Script id="google-analytics" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-1SFQ77RRP2');
          `}
        </Script>
      </body>
    </html>
  );
}
