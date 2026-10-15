'use client';

/**
 * In-app navigation that never touches the network. Every app screen is the
 * same static page reading the on-device database, so moving between them is
 * just a history entry (pushState) plus a re-render; nothing to fetch offline.
 */
import { type AnchorHTMLAttributes, type MouseEvent, useSyncExternalStore } from 'react';

const NAVIGATE = 'gym:navigate';

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback);
  window.addEventListener(NAVIGATE, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(NAVIGATE, callback);
  };
}

/** The current path and query, or null while prerendering/hydrating. */
export function useLocation(): { pathname: string; params: URLSearchParams } | null {
  const href = useSyncExternalStore(
    subscribe,
    () => window.location.pathname + window.location.search,
    () => null,
  );
  if (href === null) return null;
  const url = new URL(href, 'http://local');
  return { pathname: url.pathname, params: url.searchParams };
}

export function navigate(href: string, { replace = false } = {}): void {
  if (replace) window.history.replaceState(null, '', href);
  else window.history.pushState(null, '', href);
  window.dispatchEvent(new Event(NAVIGATE));
  if (!replace) window.scrollTo(0, 0);
}

/** A link between app screens. Modified clicks (new tab) behave as normal links. */
export function AppLink({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  function click(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    navigate(href);
  }
  return <a href={href} onClick={click} {...props} />;
}
