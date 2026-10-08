import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ScanSearch } from "lucide-react";

export const metadata: Metadata = {
  title: "Access restricted",
  robots: { index: false, follow: false },
};

export default function DevtoolsBlockedPage() {
  return (
    <main className="flex min-h-svh items-center justify-center overflow-hidden bg-[#fffaf5] px-5 py-10 text-slate-950 sm:px-8">
      <section aria-labelledby="blocked-title" className="grid w-full max-w-5xl items-center gap-8 sm:gap-12 md:grid-cols-[1fr_360px]">
        <div className="order-2 md:order-1">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-3 py-1.5 text-xs font-semibold tracking-wide text-orange-800">
            <ScanSearch aria-hidden="true" size={15} />
            RAILKIT · A QUICK DETOUR
          </div>
          <h1 id="blocked-title" className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            What are you looking for in there?
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
            The trains are out front, not backstage. Close DevTools and you can hop right back in. No hard feelings.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-orange-600"
          >
            <ArrowLeft aria-hidden="true" size={17} />
            Back to homepage
          </Link>
        </div>

        <figure className="order-1 mx-auto w-full max-w-[280px] overflow-hidden rounded-3xl border border-orange-100 bg-white p-2 shadow-[0_24px_70px_-38px_rgba(124,45,18,0.35)] sm:max-w-[360px] md:order-2">
          <Image
            src="/devtools-meme.png"
            alt="Fry giving a knowing side-eye"
            width={360}
            height={360}
            priority
            sizes="(max-width: 768px) 280px, 360px"
            className="h-auto w-full rounded-2xl"
          />
          <figcaption className="px-3 py-3 text-center text-sm font-medium text-slate-600">
            “Nothing to see here… right?”
          </figcaption>
        </figure>
      </section>
    </main>
  );
}
