import { useEffect } from "react";

/**
 * Global ergonomics helper: turn vertical mousewheel into horizontal scroll
 * when the cursor is over a horizontally-scrollable container that has no
 * meaningful vertical overflow of its own. Shift+wheel always scrolls
 * horizontally (native behavior is preserved). Trackpad horizontal gestures
 * are left alone — we only intercept pure vertical deltas.
 *
 * This makes wide tables across every module (Clients, Contacts, Staffing,
 * Targets, RGY, MBR, People Ops, etc.) feel seamless to side-scroll without
 * touching each table individually.
 */
export function useGlobalHorizontalScroll() {
  useEffect(() => {
    const isHScrollable = (el: Element) => {
      const s = getComputedStyle(el);
      const ox = s.overflowX;
      if (ox !== "auto" && ox !== "scroll") return false;
      return (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1;
    };

    const findTarget = (start: EventTarget | null): HTMLElement | null => {
      let node = start as HTMLElement | null;
      while (node && node !== document.body) {
        if (node.nodeType === 1 && isHScrollable(node)) return node;
        node = node.parentElement;
      }
      return null;
    };

    const onWheel = (e: WheelEvent) => {
      // Only convert pure vertical wheel deltas.
      if (e.deltaX !== 0) return;
      if (e.deltaY === 0) return;
      // Don't interfere when user is over a normal vertically scrolling area
      // that ALSO scrolls horizontally — only act when vertical scroll is
      // not possible on the nearest h-scrollable ancestor.
      const target = findTarget(e.target);
      if (!target) return;
      const canScrollV = target.scrollHeight > target.clientHeight + 1;
      if (canScrollV && !e.shiftKey) return;
      target.scrollLeft += e.deltaY;
      e.preventDefault();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel as EventListener);
  }, []);
}