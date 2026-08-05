import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface Stat {
  label: string;
  value: string;
}

interface CinematicHeroProps {
  stats: Stat[];
}

export function CinematicHero({ stats }: CinematicHeroProps) {
  return (
    <section className="ch-root">
      {/* Background video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster="/hero-poster.jpg"
        className="ch-video"
      >
        <source
          src="/hero-video.mp4"
          type="video/mp4"
          media="(min-width: 769px)"
        />
      </video>

      {/* Gradient overlay */}
      <div className="ch-grad-main" aria-hidden />

      {/* Content */}
      <div className="ch-content">
        <p className="ch-eyebrow"></p>

        <h1 className="ch-h1">
          Railway{" "}
          <em className="ch-em">infrastructure,</em>
          <br />
          without the{" "}
          <em className="ch-em">scraping.</em>
        </h1>

        <p className="ch-desc">
          Powering modern railway applications with live train tracking, PNR
          status, seat availability, and station intelligence through one
          clean developer API.
        </p>

        {/* CTAs */}
        <div className="ch-ctas">
          <Link href="/auth" className="ch-btn-primary">
            Get API Key
            <ArrowRight size={15} />
          </Link>
          <Link href="/docs" className="ch-btn-secondary">
            Read Documentation
          </Link>
        </div>

        {/* Stats bar */}
        <div className="ch-stats">
          {stats.map((s, i) => (
            <div key={s.label} className="ch-stat">
              {i > 0 && <span className="ch-stat-sep" aria-hidden />}
              <span className="ch-stat-val">{s.value}</span>
              <span className="ch-stat-lbl">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Code panel */}
        <div className="ch-panel">
          <div className="ch-panel-bar">
            <div className="ch-dots">
              <span className="ch-dot ch-dot-r" />
              <span className="ch-dot ch-dot-y" />
              <span className="ch-dot ch-dot-g" />
            </div>
            <span className="ch-fname">journey.ts</span>
            <span style={{ width: 40 }} />
          </div>
          <pre className="ch-pre" aria-label="Code example">
            <code>
              <span className="ck">import</span>
              {" { configure, checkPNRStatus, trackTrain }\n"}
              <span className="ck">from</span>{" "}
              <span className="cs">&quot;railkit&quot;</span>
              {"\n\n"}
              <span className="cc">{"// one-time setup"}</span>
              {"\n"}
              <span className="cf">configure</span>
              {"(process.env."}
              <span className="ce">RAILKIT_API_KEY</span>
              {")\n\n"}
              <span className="ck">const</span>
              {" pnr = "}
              <span className="ck">await </span>
       
              <span className="cf">checkPNRStatus</span>
              {"("}
              <span className="cs">&quot;1234567890&quot;</span>
              {")"}
            </code>
          </pre>
        </div>
      </div>

      <style>{`
        /* ── Root ── */
        .ch-root {
          position: relative;
          min-height: 100vh;
          width: 100%;
          overflow: hidden;
          background: #ffffff;
          display: flex;
          flex-direction: column;
        }

        /* ── Video ── */
        .ch-video {
          position: absolute;
          top: 300px;
          left: 0; right: 0; bottom: 0;
          width: 100%;
          height: calc(100% - 300px);
          object-fit: cover;
          opacity: 1;
          pointer-events: none;
          z-index: 0;
        }

        /* ── Overlays ── */
        .ch-grad-main {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            #ffffff 0%,
            #ffffff 15%,
            transparent 42%,
            transparent 68%,
            #ffffff 100%
          );
          z-index: 1;
          pointer-events: none;
        }
        /* ── Content wrapper ── */
        .ch-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: calc(8rem - 60px) 24px 8rem;
        }

        /* ── Eyebrow ── */
        .ch-eyebrow {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #9ca3af;
          margin-bottom: 24px;
          animation: ch-rise 0.8s ease-out both;
        }

        /* ── Headline ── */
        .ch-h1 {
          font-family: var(--font-landing-serif), Georgia, serif;
          font-size: clamp(38px, 7vw, 96px);
          font-weight: 400;
          line-height: 0.97;
          letter-spacing: -0.025em;
          color: #000;
          max-width: 860px;
          margin: 0 0 28px;
          animation: ch-rise 0.8s ease-out 0.1s both;
        }
        .ch-em {
          font-style: italic;
          color: #6F6F6F;
        }

        /* ── Description ── */
        .ch-desc {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: clamp(14px, 1.6vw, 17px);
          font-weight: 300;
          line-height: 1.7;
          color: #6F6F6F;
          max-width: 520px;
          margin: 0 0 40px;
          animation: ch-rise 0.8s ease-out 0.2s both;
        }

        /* ── CTAs ── */
        .ch-ctas {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
          margin-bottom: 40px;
          animation: ch-rise 0.8s ease-out 0.3s both;
        }
        .ch-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 36px;
          background: #000;
          color: #fff;
          border-radius: 100px;
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          transition: transform 0.2s, background 0.2s;
          white-space: nowrap;
        }
        .ch-btn-primary:hover { transform: scale(1.03); background: #111; }
        .ch-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 32px;
          background: rgba(255,255,255,0.65);
          color: #000;
          border: 1px solid rgba(0,0,0,0.1);
          border-radius: 100px;
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: transform 0.2s, background 0.2s;
          white-space: nowrap;
        }
        .ch-btn-secondary:hover { transform: scale(1.03); background: rgba(255,255,255,0.85); }

        /* ── Stats bar ── */
        .ch-stats {
          display: flex;
          align-items: center;
          padding: 14px 28px;
          background: rgba(255,255,255,0.65);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 100px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.06);
          margin-bottom: 48px;
          animation: ch-rise 0.8s ease-out 0.4s both;
          gap: 0;
        }
        .ch-stat {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 16px;
        }
        .ch-stat-sep {
          display: block;
          width: 1px;
          height: 18px;
          background: rgba(0,0,0,0.1);
          margin-right: 16px;
          flex-shrink: 0;
        }
        .ch-stat-val {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: #000;
          white-space: nowrap;
        }
        .ch-stat-lbl {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 12px;
          font-weight: 400;
          color: #9ca3af;
          white-space: nowrap;
        }

        /* ── Code panel ── */
        .ch-panel {
          background: rgba(255,255,255,0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(0,0,0,0.07);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 56px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.8) inset;
          width: 100%;
          max-width: 400px;
          animation: ch-rise 0.8s ease-out 0.5s both, ch-float 6s ease-in-out 1.5s infinite;
        }
        .ch-panel-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 16px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          background: rgba(255,255,255,0.45);
        }
        .ch-dots { display: flex; gap: 6px; }
        .ch-dot { width: 10px; height: 10px; border-radius: 50%; }
        .ch-dot-r { background: #ff5f57; }
        .ch-dot-y { background: #febc2e; }
        .ch-dot-g { background: #28c840; }
        .ch-fname {
          font-family: var(--font-landing-sans), monospace;
          font-size: 12px;
          color: #9ca3af;
          font-weight: 500;
        }
        .ch-pre {
          margin: 0;
          padding: 18px 20px;
          font-family: var(--font-code), 'Fira Code', monospace;
          font-size: 12px;
          line-height: 1.85;
          color: #1a1a1a;
          text-align: left;
          overflow-x: auto;
        }
        .ch-pre .ck { color: #7c3aed; }
        .ch-pre .cf { color: #0369a1; }
        .ch-pre .cs { color: #059669; }
        .ch-pre .cc { color: #9ca3af; }
        .ch-pre .ce { color: #b45309; }

        /* ── Animations ── */
        @keyframes ch-rise {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ch-float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-7px); }
        }

        /* ── Mobile ── */
        @media (max-width: 480px) {

        .ch-eyebrow {
          display:none;
        }


          .ch-content {
            padding-top: calc(5rem + 60px);
            padding-bottom: 5rem;
          }
          .ch-h1 {
            font-size: clamp(34px, 10vw, 52px);
            margin-bottom: 20px;
          }
          .ch-desc {
            font-size: 14px;
            margin-bottom: 32px;
          }
          .ch-ctas {
            flex-direction: column;
            align-items: stretch;
            width: 100%;
            max-width: 280px;
            margin-bottom: 32px;
          }
          .ch-btn-primary,
          .ch-btn-secondary {
            justify-content: center;
            padding: 14px 24px;
          }
          /* Collapse stats to 2×2 grid on very small screens */
          .ch-stats {
            border-radius: 16px;
            padding: 12px 8px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0;
            row-gap: 12px;
          }
          .ch-stat {
            flex-direction: column;
            align-items: center;
            gap: 2px;
            padding: 0 12px;
          }
          .ch-stat-sep { display: none; }
          /* Re-add dividers via border */
          .ch-stat:nth-child(odd) {
            border-right: 1px solid rgba(0,0,0,0.07);
          }
          .ch-stat:nth-child(1),
          .ch-stat:nth-child(2) {
            border-bottom: 1px solid rgba(0,0,0,0.07);
            padding-bottom: 12px;
          }
          .ch-stat:nth-child(3),
          .ch-stat:nth-child(4) {
            padding-top: 0;
          }
          .ch-stat-val { font-size: 15px; }
          .ch-stat-lbl { font-size: 11px; }
          .ch-panel { max-width: 100%; }
          .ch-pre { font-size: 11px; padding: 14px 16px; }
        }

        @media (min-width: 481px) and (max-width: 768px) {
          .ch-content {
            padding-top: calc(6rem + 60px);
            padding-bottom: 6rem;
          }
          .ch-stats {
            padding: 12px 20px;
          }
          .ch-stat { padding: 0 12px; }
          .ch-panel { max-width: 360px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ch-eyebrow, .ch-h1, .ch-desc,
          .ch-ctas, .ch-stats, .ch-panel {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
