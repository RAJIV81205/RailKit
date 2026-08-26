"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSidebar } from "../SidebarProvider";
import { apiEndpointDocs } from "./apiEndpointDocs";
import { sidebarGroups } from "./docsData";

const apiEndpointIds = new Set(apiEndpointDocs.map((endpoint) => endpoint.id));

export default function DocsLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const [isDesktop, setIsDesktop] = useState(false);
  const activeSlug = pathname === "/docs" ? "introduction" : pathname.split("/").filter(Boolean).at(-1) || "introduction";

  useEffect(() => {
    const update = () => setIsDesktop(window.innerWidth >= 1024);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className="docs-root" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        .docs-root { min-height: 100vh; background: #ffffff; color: #000; padding-top: 60px; }
        .docs-sidebar { background: #ffffff; border-right: 1px solid rgba(0,0,0,0.06); overflow-y: auto; padding: 20px 12px; }
        .docs-sidebar::-webkit-scrollbar { width: 4px; }
        .docs-sidebar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
        .docs-sidebar-group-label { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #9ca3af; padding: 0 10px; margin-bottom: 4px; margin-top: 4px; }
        .docs-sidebar-btn { display: flex; width: 100%; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; border: none; background: transparent; font-family: 'Inter', system-ui, sans-serif; font-size: 13px; font-weight: 400; color: #6F6F6F; cursor: pointer; text-align: left; transition: background 0.15s, color 0.15s; text-decoration: none; }
        .docs-sidebar-btn:hover { background: rgba(0,0,0,0.04); color: #000; }
        .docs-sidebar-btn-active { background: #000; color: #fff; font-weight: 500; }
        .docs-sidebar-btn-active:hover { background: #111; color: #fff; }
        .docs-method-badge { margin-left: auto; border: 1px solid #bbf7d0; border-radius: 5px; background: #f0fdf4; color: #15803d; padding: 1px 5px; font-family: 'JetBrains Mono', monospace; font-size: 8px; font-weight: 600; letter-spacing: 0.04em; line-height: 1.5; }
        .docs-sidebar-btn-active .docs-method-badge { border-color: rgba(255,255,255,0.28); background: rgba(255,255,255,0.12); color: #bbf7d0; }
        .docs-main { min-width: 0; max-width: 100%; overflow-x: hidden; }
      `}</style>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "240px minmax(0,1fr)" : "1fr", gap: 0, minHeight: "calc(100vh - 60px)" }}>
          <aside
            className="docs-sidebar"
            style={{
              position: isDesktop ? "sticky" : "fixed",
              top: 60,
              left: isDesktop ? "auto" : 0,
              width: isDesktop ? "auto" : 260,
              height: "calc(100vh - 60px)",
              zIndex: 30,
              transform: sidebarOpen || isDesktop ? "translateX(0)" : "translateX(-110%)",
              transition: "transform 0.22s ease",
              alignSelf: "start",
            }}
          >
            {sidebarGroups.map((group, groupIndex) => (
              <div key={group.title} style={{ marginBottom: groupIndex < sidebarGroups.length - 1 ? 20 : 0 }}>
                <p className="docs-sidebar-group-label">{group.title}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                  {group.items.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSlug === section.id;
                    return (
                      <Link
                        key={section.id}
                        href={`/docs/${section.id}`}
                        onClick={() => setSidebarOpen(false)}
                        className={`docs-sidebar-btn ${isActive ? "docs-sidebar-btn-active" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon size={14} style={{ flexShrink: 0 }} />
                        <span>{section.label}</span>
                        {apiEndpointIds.has(section.id) && <span className="docs-method-badge">GET</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </aside>

          <main className="docs-main" style={{ padding: isDesktop ? "32px 0 64px 40px" : "24px 0 64px" }}>
            {children}
          </main>
        </div>
      </div>

      {sidebarOpen && !isDesktop && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)", border: "none", cursor: "pointer" }}
          aria-label="Close sidebar"
        />
      )}
    </div>
  );
}
