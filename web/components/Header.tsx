"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, LogOut, Menu, X } from "lucide-react";
import { useSidebar } from "./SidebarProvider";

type VerifiedUser = {
  id: string;
  name: string;
  email: string;
  active: boolean;
};

export function Header() {
  const pathname = usePathname();
  const isAdminPage = pathname === "/admin";
  const isDashboardPage = pathname === "/dashboard";
  const isDocsPage = pathname === "/docs" || pathname.startsWith("/docs/");
  const router = useRouter();
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const [user, setUser] = useState<VerifiedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const checkAuth = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/user/verify", { method: "GET", signal: controller.signal });
        if (!res.ok) { if (mounted) setUser(null); return; }
        const data = await res.json();
        if (mounted) setUser(data?.success ? data.user : null);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    checkAuth();
    return () => { mounted = false; controller.abort(); };
  }, [pathname]);

  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!isDocsPage) setSidebarOpen(false);
  }, [isDocsPage, setSidebarOpen]);

  if (isAdminPage) return null;

  const handleLogout = async () => {
    try {
      await fetch("/api/user/verify", { method: "DELETE" });
      setUser(null);
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };


  return (
    <>
      <style>{`
        .hdr {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 50;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .hdr-inner {
          max-width: 1200px;
          margin: 0 auto;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
        }
        @media (max-width: 640px) { .hdr-inner { padding: 0 20px; } }

        /* Logo */
        .hdr-logo {
          display: flex;
          align-items: center;
          gap: 9px;
          text-decoration: none;
          flex-shrink: 0;
          transition: opacity 0.15s;
        }
        .hdr-logo:hover { opacity: 0.7; }
        .hdr-logo-mark {
          width: 28px; height: 28px;
          border-radius: 7px;
          border: 1px solid rgba(0,0,0,0.08);
          background: #fafafa;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }
        .hdr-logo-name {
          font-family: var(--font-landing-serif), Georgia, serif;
          font-size: 17px;
          font-weight: 400;
          color: #000;
          letter-spacing: -0.01em;
          line-height: 1;
          white-space: nowrap;
        }
        .hdr-logo-name sup {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 9px;
          font-weight: 400;
          color: #aaa;
          vertical-align: super;
          margin-left: 1px;
        }

        /* Nav */
        .hdr-nav {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        @media (max-width: 768px) { .hdr-nav { display: none; } }
        .hdr-nav-link {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 13.5px;
          font-weight: 400;
          color: #6F6F6F;
          text-decoration: none;
          padding: 5px 12px;
          border-radius: 8px;
          transition: color 0.15s, background 0.15s;
        }
        .hdr-nav-link:hover { color: #000; background: rgba(0,0,0,0.04); }
        .hdr-nav-link-active {
          color: #000;
          background: rgba(0,0,0,0.05);
          font-weight: 500;
        }

        /* Auth */
        .hdr-auth {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .hdr-btn-primary {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          background: #000;
          border: none;
          border-radius: 100px;
          padding: 7px 18px;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.15s, transform 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }
        .hdr-btn-primary:hover { background: #222; transform: scale(1.02); }
        .hdr-btn-ghost {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 13px;
          font-weight: 400;
          color: #000;
          background: transparent;
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 100px;
          padding: 7px 16px;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }
        .hdr-btn-ghost:hover { background: #f5f5f5; }
        .hdr-btn-signout {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 13px;
          font-weight: 400;
          color: #9ca3af;
          background: transparent;
          border: none;
          padding: 7px 10px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 8px;
          transition: color 0.15s, background 0.15s;
        }
        .hdr-btn-signout:hover { color: #000; background: rgba(0,0,0,0.04); }

        /* Mobile button */
        .hdr-mobile-btn {
          display: none;
          align-items: center;
          justify-content: center;
          width: 32px; height: 32px;
          border-radius: 8px;
          border: 1px solid rgba(0,0,0,0.08);
          background: transparent;
          color: #6F6F6F;
          cursor: pointer;
          transition: background 0.15s;
        }
        .hdr-mobile-btn:hover { background: #f5f5f5; color: #000; }
        @media (max-width: 768px) { .hdr-mobile-btn { display: flex; } }

        /* Docs sidebar toggle */
        .hdr-sidebar-btn {
          display: none;
          align-items: center;
          justify-content: center;
          width: 32px; height: 32px;
          border-radius: 8px;
          border: 1px solid rgba(0,0,0,0.08);
          background: transparent;
          color: #6F6F6F;
          cursor: pointer;
          transition: background 0.15s;
        }
        .hdr-sidebar-btn:hover { background: #f5f5f5; color: #000; }
        @media (max-width: 1024px) { .hdr-sidebar-btn { display: flex; } }

        /* Mobile drawer */
        .hdr-backdrop {
          position: fixed;
          inset: 0;
          z-index: 60;
          background: rgba(0,0,0,0.25);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          animation: hdr-fade 0.2s ease both;
        }
        @keyframes hdr-fade { from { opacity: 0; } to { opacity: 1; } }
        .hdr-drawer {
          position: absolute;
          top: 0; right: 0;
          height: 100%;
          width: min(80%, 280px);
          background: #fff;
          border-left: 1px solid rgba(0,0,0,0.06);
          padding: 20px;
          display: flex;
          flex-direction: column;
          animation: hdr-slide 0.22s ease both;
        }
        @keyframes hdr-slide { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .hdr-drawer-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 16px;
          margin-bottom: 16px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .hdr-drawer-title {
          font-family: var(--font-landing-serif), Georgia, serif;
          font-size: 16px;
          color: #000;
        }
        .hdr-drawer-close {
          width: 28px; height: 28px;
          border-radius: 7px;
          border: 1px solid rgba(0,0,0,0.08);
          background: transparent;
          color: #6F6F6F;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .hdr-drawer-close:hover { background: #f5f5f5; color: #000; }
        .hdr-drawer-links {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }
        .hdr-drawer-link {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 14px;
          color: #374151;
          text-decoration: none;
          padding: 11px 14px;
          border-radius: 9px;
          transition: background 0.15s, color 0.15s;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .hdr-drawer-link:hover { background: #f5f5f5; color: #000; }
        .hdr-drawer-link-active {
          background: #f5f5f5;
          color: #000;
          font-weight: 500;
        }
        .hdr-drawer-link-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #000;
          flex-shrink: 0;
        }
        .hdr-drawer-footer {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-top: 16px;
          border-top: 1px solid rgba(0,0,0,0.06);
        }
        .hdr-drawer-cta {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          background: #000;
          border: none;
          border-radius: 10px;
          padding: 11px;
          text-align: center;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.15s;
        }
        .hdr-drawer-cta:hover { background: #222; }
        .hdr-drawer-secondary {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 13px;
          color: #9ca3af;
          background: transparent;
          border: 1px solid rgba(0,0,0,0.07);
          border-radius: 10px;
          padding: 10px;
          text-align: center;
          text-decoration: none;
          cursor: pointer;
          transition: color 0.15s, background 0.15s;
        }
        .hdr-drawer-secondary:hover { color: #000; background: #f9fafb; }

        @media (prefers-reduced-motion: reduce) {
          .hdr-backdrop, .hdr-drawer { animation: none; }
        }
      `}</style>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="hdr-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div className="hdr-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="hdr-drawer-head">
              <span className="hdr-drawer-title">Menu</span>
              <button
                className="hdr-drawer-close"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X size={13} />
              </button>
            </div>

            <div className="hdr-drawer-links">
              {[
                { href: "/docs",    label: "Docs" },
                { href: "/pricing", label: "Pricing" },
                { href: "/contact", label: "Contact" },
              ].map(({ href, label }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`hdr-drawer-link ${active ? "hdr-drawer-link-active" : ""}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {label}
                    {active && <span className="hdr-drawer-link-dot" aria-hidden />}
                  </Link>
                );
              })}
            </div>

            {!loading && (
              <div className="hdr-drawer-footer">
                {user ? (
                  <>
                    <Link href="/dashboard" className="hdr-drawer-cta" onClick={() => setMobileMenuOpen(false)}>
                      Dashboard
                    </Link>
                    <button
                      className="hdr-drawer-secondary"
                      onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <Link href="/auth" className="hdr-drawer-cta" onClick={() => setMobileMenuOpen(false)}>
                    Get API Key
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header bar */}
      <header className="hdr">
        <div className="hdr-inner">

          {/* Left: docs sidebar toggle + logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isDocsPage && (
              <button
                className="hdr-sidebar-btn"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Toggle sidebar"
              >
                <Menu size={15} />
              </button>
            )}
            <Link href="/" className="hdr-logo">
              <div className="hdr-logo-mark">
                <Image src="/icon.png" alt="RailKit" width={20} height={20} style={{ objectFit: "contain" }} />
              </div>
              <span className="hdr-logo-name">
                RailKit<sup>®</sup>
              </span>
            </Link>
          </div>

          {/* Center: nav */}
          <nav className="hdr-nav" aria-label="Main navigation">
            <Link href="/docs"    className={`hdr-nav-link ${isDocsPage ? "hdr-nav-link-active" : ""}`}>Docs</Link>
            <Link href="/pricing" className={`hdr-nav-link ${pathname === "/pricing" ? "hdr-nav-link-active" : ""}`}>Pricing</Link>
            <Link href="/contact" className={`hdr-nav-link ${pathname === "/contact" ? "hdr-nav-link-active" : ""}`}>Contact</Link>
          </nav>

          {/* Right: auth + mobile button */}
          <div className="hdr-auth">

            {!loading && (
              <div className="hidden md:flex items-center gap-2">
                {user ? (
                  <>
                    <Link href="/dashboard" className="hdr-btn-ghost">
                      Dashboard
                      <ChevronRight size={13} />
                    </Link>
                    <button onClick={handleLogout} className="hdr-btn-signout" aria-label="Sign out">
                      <LogOut size={13} />
                    </button>
                  </>
                ) : (
                  <Link href="/auth" className="hdr-btn-primary">
                    Get API Key
                  </Link>
                )}
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="hdr-mobile-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={15} />
            </button>
          </div>

        </div>
      </header>
    </>
  );
}
