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
        const res = await fetch("/api/user/verify", {
          method: "GET",
          signal: controller.signal,
        });
        if (!res.ok) {
          if (mounted) setUser(null);
          return;
        }
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
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [pathname]);

  useEffect(() => {
    const closeTimer = window.setTimeout(() => setMobileMenuOpen(false), 0);
    return () => window.clearTimeout(closeTimer);
  }, [pathname]);

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
      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[60] animate-header-fade bg-black/25 backdrop-blur-sm motion-reduce:animate-none"
          onClick={() => setMobileMenuOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="absolute top-0 right-0 flex h-full w-[min(80%,280px)] animate-header-slide flex-col border-l border-black/6 bg-white p-5 motion-reduce:animate-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-black/6 pb-4">
              <span className="font-site-serif text-base text-black">Menu</span>
              <button
                className="flex size-7 cursor-pointer items-center justify-center rounded-[7px] border border-black/8 bg-transparent text-[#6F6F6F] transition-colors hover:bg-[#f5f5f5] hover:text-black"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X size={13} />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-0.5">
              {[
                { href: "/docs", label: "Docs" },
                { href: "/pricing", label: "Pricing" },
                { href: "/contact", label: "Contact" },
              ].map(({ href, label }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center justify-between rounded-[9px] px-3.5 py-[11px] text-sm text-[#374151] no-underline transition-colors hover:bg-[#f5f5f5] hover:text-black ${active ? "bg-[#f5f5f5] font-medium text-black" : ""}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {label}
                    {active && (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-black"
                        aria-hidden
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {!loading && (
              <div className="flex flex-col gap-2 border-t border-black/6 pt-4">
                {user ? (
                  <>
                    <Link
                      href="/dashboard"
                      className="rounded-[10px] bg-black p-[11px] text-center text-sm font-medium text-white no-underline transition-colors hover:bg-[#222]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <button
                      className="rounded-[10px] border border-black/7 bg-transparent p-2.5 text-center text-[13px] text-[#9ca3af] transition-colors hover:bg-[#f9fafb] hover:text-black"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/auth"
                    className="rounded-[10px] bg-black p-[11px] text-center text-sm font-medium text-white no-underline transition-colors hover:bg-[#222]"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Get API Key
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header bar */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-black/6 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] max-w-[1200px] items-center justify-between px-5 sm:px-8">
          {/* Left: docs sidebar toggle + logo */}
          <div className="flex shrink-0 items-center gap-2.5">
            {isDocsPage && (
              <button
                className="hidden size-8 cursor-pointer items-center justify-center rounded-lg border border-black/8 bg-transparent text-[#6F6F6F] transition-colors hover:bg-[#f5f5f5] hover:text-black max-lg:flex"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Toggle sidebar"
              >
                <Menu size={15} />
              </button>
            )}
            <Link
              href="/"
              className="flex shrink-0 items-center gap-[9px] text-black no-underline transition-opacity hover:opacity-70"
            >
              <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[7px] border border-black/8 bg-[#fafafa]">
                <Image
                  src="/icon.png"
                  alt="RailKit"
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
              <span className="font-site-serif text-[17px] leading-none tracking-[-0.01em]">
                RailKit
                <sup className="font-site-sans ml-px align-super text-[9px] text-[#aaa]">
                  ®
                </sup>
              </span>
            </Link>
          </div>

          {/* Center: nav */}
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Main navigation"
          >
            <Link
              href="/docs"
              className={`rounded-lg px-3 py-[5px] font-site-sans text-[13.5px] no-underline transition-colors hover:bg-black/4 hover:text-black ${isDocsPage ? "bg-black/5 font-medium text-black" : "text-[#6F6F6F]"}`}
            >
              Docs
            </Link>
            <Link
              href="/pricing"
              className={`rounded-lg px-3 py-[5px] font-site-sans text-[13.5px] no-underline transition-colors hover:bg-black/4 hover:text-black ${pathname === "/pricing" ? "bg-black/5 font-medium text-black" : "text-[#6F6F6F]"}`}
            >
              Pricing
            </Link>
            <Link
              href="/contact"
              className={`rounded-lg px-3 py-[5px] font-site-sans text-[13.5px] no-underline transition-colors hover:bg-black/4 hover:text-black ${pathname === "/contact" ? "bg-black/5 font-medium text-black" : "text-[#6F6F6F]"}`}
            >
              Contact
            </Link>
          </nav>

          {/* Right: auth + mobile button */}
          <div className="flex shrink-0 items-center gap-2">
            <div
              className={`hidden min-h-8 w-[172px] items-center justify-end transition-opacity duration-200 md:flex ${loading ? "invisible opacity-0" : "visible opacity-100"}`}
              aria-hidden={loading}
            >
              {!loading && (
                <div className="flex items-center gap-2">
                  {user ? (
                    <>
                      <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-[5px] rounded-full border border-black/12 bg-transparent px-4 py-[7px] font-site-sans text-[13px] text-black no-underline transition-colors hover:bg-[#f5f5f5]"
                      >
                        Dashboard
                        <ChevronRight size={13} />
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="inline-flex cursor-pointer items-center gap-[5px] rounded-lg border-0 bg-transparent px-2.5 py-[7px] text-[13px] text-[#9ca3af] transition-colors hover:bg-black/4 hover:text-black"
                        aria-label="Sign out"
                      >
                        <LogOut size={13} />
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/auth"
                      className="inline-flex items-center gap-[5px] rounded-full bg-black px-[18px] py-[7px] font-site-sans text-[13px] font-medium text-white no-underline transition-[background,transform] hover:scale-[1.02] hover:bg-[#222]"
                    >
                      Get API Key
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-black/8 bg-transparent text-[#6F6F6F] transition-colors hover:bg-[#f5f5f5] hover:text-black md:hidden"
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
