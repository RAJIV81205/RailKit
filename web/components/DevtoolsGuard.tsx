"use client";

import disableDevtool from "disable-devtool";
import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

const BLOCKED_PATH = "/devtools-blocked";

function isAdminRoute(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isExemptRoute(pathname: string) {
  return isAdminRoute(pathname) || pathname === BLOCKED_PATH;
}

function redirectToNotice() {
  if (window.location.pathname !== BLOCKED_PATH) {
    window.location.replace(BLOCKED_PATH);
  }
}

export function DevtoolsGuard() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    disableDevtool({
      // Keep regular context menus, selection, and clipboard behavior intact.
      disableMenu: false,
      interval: 100,
      ignore: () => isExemptRoute(window.location.pathname),
      url: new URL(BLOCKED_PATH, window.location.origin).toString(),
      timeOutUrl: new URL(BLOCKED_PATH, window.location.origin).toString(),
      ondevtoolopen: () => redirectToNotice(),
    });
    disableDevtool.isSuspend = isExemptRoute(window.location.pathname);

    return () => {
      disableDevtool.isSuspend = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (isExemptRoute(pathname)) {
      disableDevtool.isSuspend = true;
      return;
    }
    disableDevtool.isSuspend = false;
  }, [pathname]);

  return null;
}
