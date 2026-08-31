import Link from "next/link";
import { ArrowRight, BookOpen, House } from "lucide-react";

export default function NotFound() {
  return (
    <main className="font-site-sans relative grid min-h-svh place-items-center overflow-hidden bg-white bg-[radial-gradient(circle_at_50%_34%,rgba(0,0,0,0.035),transparent_27rem)] px-5 pt-[86px] pb-8 text-[#0a0a0a] sm:px-6 sm:pt-24 sm:pb-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[60px] bottom-0 opacity-[0.38] [background-image:linear-gradient(to_right,rgba(0,0,0,0.055)_1px,transparent_1px)] [background-size:25vw_100%] [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_76%,transparent)] sm:[background-size:min(12vw,144px)_100%]"
      />

      <section
        className="relative z-10 w-full max-w-[920px] animate-route-arrive text-center motion-reduce:animate-none"
        aria-labelledby="not-found-title"
      >
        <div
          className="mx-auto mb-[18px] flex w-fit items-center gap-2 rounded-full border border-[#e8e8e8] bg-white/80 py-[7px] pr-3 pl-[9px] text-xs font-medium tracking-[0.04em] text-[#4c4c4c] uppercase shadow-[0_8px_30px_rgba(0,0,0,0.035)] backdrop-blur-[10px] sm:mb-7"
          role="status"
        >
          <span
            className="size-2 animate-route-signal rounded-full bg-[#e5484d] shadow-[0_0_0_4px_rgba(229,72,77,0.1)] motion-reduce:animate-none"
            aria-hidden="true"
          />
          Route unavailable
        </div>

        <div className="relative grid h-[165px] place-items-center sm:h-[clamp(190px,30vw,300px)]" aria-hidden="true">
          <p className="font-site-serif m-0 select-none text-[clamp(136px,52vw,190px)] leading-[0.74] font-normal tracking-[-0.085em] text-[#0a0a0a] sm:text-[clamp(150px,28vw,300px)]">
            404
          </p>
          <svg
            className="absolute bottom-[13%] left-1/2 h-[90px] w-[88%] -translate-x-1/2 overflow-visible sm:bottom-[19%] sm:w-[min(78%,670px)]"
            viewBox="0 0 700 90"
            preserveAspectRatio="none"
          >
            <path
              id="not-found-rail-route"
              className="fill-none stroke-transparent"
              d="M8 58 C118 58 122 22 226 22 S354 72 466 62 S548 36 692 36"
            />
            <path
              className="fill-none stroke-white/95 stroke-[13] [stroke-linecap:round]"
              d="M8 58 C118 58 122 22 226 22 S354 72 466 62 S548 36 692 36"
            />
            <path
              className="animate-route-rail fill-none stroke-[#1b1b1b] stroke-2 [stroke-dasharray:2_9] [stroke-linecap:round] motion-reduce:animate-none"
              d="M8 58 C118 58 122 22 226 22 S354 72 466 62 S548 36 692 36"
            />
            <g>
              <animateMotion dur="5.5s" repeatCount="indefinite" rotate="auto">
                <mpath href="#not-found-rail-route" />
              </animateMotion>
              <g transform="translate(-27 -27)">
                <rect
                  x="0"
                  y="0"
                  width="54"
                  height="30"
                  rx="9"
                  className="fill-white stroke-black/20 [stroke-width:1]"
                />
                <path
                  d="M8 7 H23 V18 H8 Z M31 7 H46 V18 H31 Z"
                  className="fill-[#dce8ed]"
                />
                <rect x="8" y="22" width="38" height="2" rx="1" className="fill-[#e5484d]" />
                <circle cx="10" cy="31" r="4" className="fill-[#111]" />
                <circle cx="44" cy="31" r="4" className="fill-[#111]" />
              </g>
            </g>
          </svg>
        </div>

        <p className="font-site-code mt-[18px] mb-2.5 text-[11px] tracking-[0.12em] text-[#6f6f6f] uppercase sm:mt-6">
          Error 404 · Unscheduled stop
        </p>
        <h1
          className="font-site-serif m-0 text-[clamp(34px,5vw,54px)] leading-[1.02] font-normal tracking-[-0.035em]"
          id="not-found-title"
        >
          This route isn&apos;t on <em className="font-inherit text-[#6f6f6f]">our timetable.</em>
        </h1>
        <p className="mx-auto mt-[17px] max-w-[510px] text-sm leading-[1.65] text-[#6f6f6f] sm:text-[15px]">
          The page may have moved, or the address may be off track. Head back to
          RailKit or continue exploring the API docs.
        </p>

        <nav
          className="mx-auto mt-7 flex max-w-[300px] flex-col items-stretch justify-center gap-2.5 sm:max-w-none sm:flex-row"
          aria-label="404 recovery links"
        >
          <Link
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#0a0a0a] bg-[#0a0a0a] px-[19px] text-[13px] font-medium text-white no-underline transition-[transform,background] duration-200 hover:-translate-y-0.5 hover:bg-[#292929] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-black/20 motion-reduce:transition-none sm:w-auto"
            href="/"
          >
            <House size={15} aria-hidden="true" />
            Return home
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#dedede] bg-white/80 px-[19px] text-[13px] font-medium text-[#0a0a0a] no-underline transition-[transform,background,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#b9b9b9] hover:bg-[#f7f7f5] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-black/20 motion-reduce:transition-none sm:w-auto"
            href="/docs"
          >
            <BookOpen size={15} aria-hidden="true" />
            Browse docs
          </Link>
        </nav>

        <p className="font-site-code mt-[23px] text-[11px] text-[#737373]">
          railkit / route_not_found
        </p>
      </section>
    </main>
  );
}
