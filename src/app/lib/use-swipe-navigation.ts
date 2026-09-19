import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { PortalNavItem } from '../components/portal-shell';
import { prefetchRouteByPath } from '../route-modules';
import { prefetchRouteData } from './login-prefetch';
import { useAuth } from './auth';

/* ── Physics ──────────────────────────────────────────────────────── */

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const GLIDE_EASE = 'cubic-bezier(0.25, 1, 0.5, 1)';

function rubberBand(offset: number, dimension: number): number {
  const c = 0.35;
  const x = Math.abs(offset);
  return Math.sign(offset) * c * dimension * (1 - Math.exp(-x / (c * dimension)));
}

/* ── Interactive Form / Element Blocking ──────────────────────────── */

const BLOCKED_QUERY =
  'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"], [data-swipe-ignore], input[type="range"], canvas, .embla';

function shouldBlockSwipe(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest(BLOCKED_QUERY));
}

const BLOCK_ROUTES = [
  '/student/privacy-waiver/',
  '/student/medical-form/',
  '/staff/review/',
] as const;

function isBlockedRoute(p: string): boolean {
  return BLOCK_ROUTES.some((r) => p.startsWith(r));
}

/* ── Active-index & Target Resolution ─────────────────────────────── */

function findActiveIndex(pathname: string, items: readonly PortalNavItem[]): number {
  return items.findIndex(({ path }) => {
    if (path === '/student' || path === '/staff/dashboard' || path === '/admin')
      return pathname === path;
    if (path === '/staff/submissions')
      return (
        pathname === '/staff' ||
        pathname.startsWith('/staff/submissions') ||
        pathname.startsWith('/staff/review')
      );
    if (path === '/student/year-selection')
      return (
        pathname === path ||
        pathname.startsWith('/student/privacy-waiver') ||
        pathname.startsWith('/student/medical-form')
      );
    return pathname.startsWith(path);
  });
}

function resolveTarget(items: readonly PortalNavItem[], idx: number, dir: -1 | 1): number {
  let next = idx + dir;
  if (next >= 0 && next < items.length && items[next].mobileEmphasis) {
    next = next + dir;
  }
  return next;
}

/* ── Backdrop & High-Fidelity Tab Previews ───────────────────────── */

function createBackdrop(contentEl: HTMLElement): HTMLDivElement {
  const el = document.createElement('div');
  el.dataset.swipeBackdrop = '';
  Object.assign(el.style, {
    position: 'absolute',
    top: `${contentEl.offsetTop}px`,
    left: '0',
    width: '100%',
    minHeight: `${Math.max(contentEl.offsetHeight, window.innerHeight)}px`,
    pointerEvents: 'none',
    willChange: 'transform',
    zIndex: '3',
    background: 'var(--color-background, #fafafa)',
    overflow: 'hidden',
    boxSizing: 'border-box',
  });
  return el;
}

function createTabPreview(item: PortalNavItem): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'relative px-4 pb-36 sm:pb-40 md:px-8 md:pb-24 print:p-0';

  const container = document.createElement('div');
  container.className = 'w-full space-y-4 pt-1 animate-pulse';

  // Page Header
  const header = document.createElement('div');
  header.className = 'space-y-1.5 pb-2';
  header.innerHTML = `
    <div class="inline-flex items-center gap-2">
      <h1 class="text-xl font-bold tracking-tight text-neutral-800">${item.label}</h1>
    </div>
    <div class="h-3.5 w-48 rounded bg-neutral-200/70"></div>
  `;
  container.appendChild(header);

  // Card 1
  const card1 = document.createElement('div');
  card1.className =
    'rounded-2xl border border-neutral-200/60 bg-white p-5 space-y-3.5 shadow-xs';
  card1.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="h-4 w-32 rounded bg-neutral-200/70"></div>
      <div class="h-5 w-16 rounded-full bg-neutral-100"></div>
    </div>
    <div class="h-7 w-40 rounded-lg bg-neutral-200/50"></div>
    <div class="h-3 w-full rounded bg-neutral-100"></div>
    <div class="h-3 w-3/4 rounded bg-neutral-100"></div>
  `;
  container.appendChild(card1);

  // Card 2
  const card2 = document.createElement('div');
  card2.className =
    'rounded-2xl border border-neutral-200/60 bg-white p-5 space-y-3 shadow-xs';
  card2.innerHTML = `
    <div class="h-4 w-28 rounded bg-neutral-200/70"></div>
    <div class="space-y-2.5 pt-1">
      <div class="h-11 w-full rounded-xl bg-neutral-100"></div>
      <div class="h-11 w-full rounded-xl bg-neutral-100"></div>
    </div>
  `;
  container.appendChild(card2);

  wrap.appendChild(container);
  return wrap;
}

function createEdgeShadow(side: 'left' | 'right'): HTMLDivElement {
  const el = document.createElement('div');
  const grad = side === 'left' ? 'to right' : 'to left';
  Object.assign(el.style, {
    position: 'absolute',
    top: '0',
    left: side === 'left' ? '0' : 'auto',
    right: side === 'right' ? '0' : 'auto',
    width: '24px',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '10',
    background: `linear-gradient(${grad}, rgba(0,0,0,0.12), transparent)`,
  });
  return el;
}

/* ── Touch state ──────────────────────────────────────────────────── */

interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  prevX: number;
  prevT: number;
  velocityX: number;
  decided: boolean;
  swiping: boolean;
  currentTargetIdx: number;
}

/* ── Hook ─────────────────────────────────────────────────────────── */

export function useSwipeNavigation(
  navItems: readonly PortalNavItem[],
  contentRef: React.RefObject<HTMLElement | null>,
) {
  const navigate = useNavigate();
  const location = useLocation();
  const { me } = useAuth();

  const navRef = useRef(navItems);
  const pathRef = useRef(location.pathname);
  const meRef = useRef(me);
  navRef.current = navItems;
  pathRef.current = location.pathname;
  meRef.current = me;

  const state = useRef<SwipeState | null>(null);
  const animating = useRef(false);
  const backdropRef = useRef<HTMLDivElement | null>(null);

  const tx3d = (el: HTMLElement, x: number) => {
    el.style.transform = `translate3d(${x}px, 0, 0)`;
  };

  const clearAll = useCallback((el: HTMLElement) => {
    el.style.transform = '';
    el.style.transition = '';
    el.style.boxShadow = '';
    el.style.willChange = '';
    el.style.zIndex = '';
  }, []);

  const removeBackdrop = useCallback(() => {
    if (backdropRef.current) {
      backdropRef.current.remove();
      backdropRef.current = null;
    }
  }, []);

  /* ── touchstart ─────────────────────────────────────────────── */

  const onStart = useCallback((e: TouchEvent) => {
    if (animating.current) return;
    if (e.touches.length !== 1) return;
    if (window.matchMedia('(min-width: 768px)').matches) return;
    if (shouldBlockSwipe(e.target)) return;
    if (isBlockedRoute(pathRef.current)) return;

    const t = e.touches[0];
    state.current = {
      startX: t.clientX,
      startY: t.clientY,
      currentX: t.clientX,
      prevX: t.clientX,
      prevT: e.timeStamp,
      velocityX: 0,
      decided: false,
      swiping: false,
      currentTargetIdx: -1,
    };
  }, []);

  /* ── touchmove ──────────────────────────────────────────────── */

  const onMove = useCallback((e: TouchEvent) => {
    const s = state.current;
    const el = contentRef.current;
    if (!s || animating.current || !el || e.touches.length !== 1) return;

    const t = e.touches[0];
    const dx = t.clientX - s.startX;
    const dy = t.clientY - s.startY;

    // Angle detection: allow natural thumb arc while filtering vertical scroll
    if (!s.decided) {
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax < 6 && ay < 6) return;
      s.decided = true;

      // If vertical motion dominates, pass control to browser scrolling
      if (ay > ax * 0.75) {
        state.current = null;
        return;
      }

      s.swiping = true;
      el.style.willChange = 'transform';
      el.style.zIndex = '1';
    }

    if (!s.swiping) return;

    // Lock page vertically during active horizontal swipe
    e.preventDefault();

    // Track horizontal velocity
    const dt = e.timeStamp - s.prevT;
    if (dt > 0) {
      const iv = (t.clientX - s.prevX) / dt;
      s.velocityX = 0.7 * iv + 0.3 * s.velocityX;
    }
    s.prevX = t.clientX;
    s.prevT = e.timeStamp;
    s.currentX = t.clientX;

    // Determine target tab
    const activeIdx = findActiveIndex(pathRef.current, navRef.current);
    const dir: -1 | 1 = dx > 0 ? -1 : 1;
    const targetIdx = resolveTarget(navRef.current, activeIdx, dir);
    const canNavigate = activeIdx !== -1 && targetIdx >= 0 && targetIdx < navRef.current.length;
    const vw = window.innerWidth;

    if (canNavigate) {
      const targetItem = navRef.current[targetIdx];

      // Setup or switch target tab preview
      if (s.currentTargetIdx !== targetIdx || !backdropRef.current) {
        s.currentTargetIdx = targetIdx;

        // Warm up chunk and React Query data immediately in the background
        prefetchRouteByPath(targetItem.path);
        prefetchRouteData(targetItem.path, meRef.current);

        const mainEl = el.parentElement;
        if (mainEl) {
          removeBackdrop();
          const backdrop = createBackdrop(el);

          // Render styled preview skeleton
          const preview = createTabPreview(targetItem);
          backdrop.appendChild(preview);

          // Edge shadow facing the current page
          const shadow = createEdgeShadow(dir === -1 ? 'right' : 'left');
          backdrop.appendChild(shadow);

          mainEl.insertBefore(backdrop, mainEl.firstChild);
          backdropRef.current = backdrop;

          const backdropStart = dir === 1 ? vw : -vw;
          tx3d(backdrop, backdropStart);
        }
      }

      // 1:1 hardware-accelerated tracking
      tx3d(el, dx);

      // Move preview in sync
      if (backdropRef.current) {
        const backdropStart = dir === 1 ? vw : -vw;
        tx3d(backdropRef.current, backdropStart + dx);
      }
    } else {
      // Natural edge rubber-band at boundaries
      tx3d(el, rubberBand(dx, vw));
      if (backdropRef.current) {
        removeBackdrop();
        s.currentTargetIdx = -1;
      }
    }
  }, [contentRef, removeBackdrop]);

  /* ── touchend ───────────────────────────────────────────────── */

  const onEnd = useCallback(() => {
    const s = state.current;
    const el = contentRef.current;
    state.current = null;

    if (!s || !s.swiping || animating.current || !el) {
      if (el) clearAll(el);
      removeBackdrop();
      return;
    }

    const dx = s.currentX - s.startX;
    const absDx = Math.abs(dx);
    const v = Math.abs(s.velocityX);
    const vw = window.innerWidth;

    // Committed if dragged > 20% of screen or flicked with speed
    const committed =
      absDx > Math.min(vw * 0.2, 65) ||
      (v > 0.22 && absDx > 18);

    const dir: -1 | 1 = dx > 0 ? -1 : 1;
    const activeIdx = findActiveIndex(pathRef.current, navRef.current);
    const targetIdx = resolveTarget(navRef.current, activeIdx, dir);
    const canNavigate = activeIdx !== -1 && targetIdx >= 0 && targetIdx < navRef.current.length;

    if (!committed || !canNavigate) {
      // ── Snap back ──
      const snapDuration = 220;
      el.style.transition = `transform ${snapDuration}ms ${EASE_OUT}`;
      tx3d(el, 0);

      if (backdropRef.current) {
        backdropRef.current.style.transition = `transform ${snapDuration}ms ${EASE_OUT}`;
        tx3d(backdropRef.current, dir === 1 ? vw : -vw);
      }

      setTimeout(() => {
        clearAll(el);
        removeBackdrop();
      }, snapDuration + 20);
      return;
    }

    // ── Commit: animate target tab into place ──
    animating.current = true;

    const exitDuration = Math.round(
      Math.max(160, Math.min(260, (vw - absDx) / Math.max(v, 0.8)))
    );
    const glideTrans = `transform ${exitDuration}ms ${GLIDE_EASE}`;
    const contentOutX = dx > 0 ? vw : -vw;

    // Active page glides out
    el.style.transition = glideTrans;
    tx3d(el, contentOutX);

    // Target preview glides to center
    if (backdropRef.current) {
      backdropRef.current.style.transition = glideTrans;
      tx3d(backdropRef.current, 0);
    }

    setTimeout(() => {
      // Navigate to destination tab
      navigate(navRef.current[targetIdx].path);

      // Reset content element position underneath backdrop
      el.style.transition = 'none';
      tx3d(el, 0);

      // Let React mount the live cached query view, then remove preview smoothly
      requestAnimationFrame(() => {
        setTimeout(() => {
          removeBackdrop();
          clearAll(el);
          animating.current = false;
        }, 40);
      });
    }, exitDuration);
  }, [contentRef, navigate, clearAll, removeBackdrop]);

  /* ── touchcancel ────────────────────────────────────────────── */

  const onCancel = useCallback(() => {
    state.current = null;
    const el = contentRef.current;
    if (el) {
      el.style.transition = `transform 200ms ${EASE_OUT}`;
      tx3d(el, 0);
      setTimeout(() => clearAll(el), 220);
    }
    removeBackdrop();
  }, [contentRef, clearAll, removeBackdrop]);

  /* ── Listeners ──────────────────────────────────────────────── */

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    el.style.touchAction = 'pan-y';

    const handleTouchStart = (e: TouchEvent) => onStart(e);
    const handleTouchMove = (e: TouchEvent) => onMove(e);
    const handleTouchEnd = () => onEnd();
    const handleTouchCancel = () => onCancel();

    // Start gesture on content container
    el.addEventListener('touchstart', handleTouchStart, { passive: true });

    // Track on window to prevent lost touches during fast swipes
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      el.style.touchAction = '';
      el.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
      removeBackdrop();
    };
  }, [contentRef, onStart, onMove, onEnd, onCancel, removeBackdrop]);
}
