import { useEffect, useState, type RefObject } from "react";
import { ChevronsLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollToStartButtonProps {
  scrollRef: RefObject<HTMLDivElement>;
  /** Pixels of horizontal scroll before the button appears. Default 120. */
  threshold?: number;
  className?: string;
}

/**
 * Floating "Jump to start" button for horizontally scrollable containers.
 * Appears once the container is scrolled past `threshold` pixels and smoothly
 * scrolls back to column 1 on click.
 */
export function ScrollToStartButton({
  scrollRef,
  threshold = 120,
  className,
}: ScrollToStartButtonProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setVisible(el.scrollLeft > threshold);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef, threshold]);

  const handleClick = () => {
    scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Jump to first column"
      className={cn(
        "hidden sm:inline-flex items-center gap-1.5 absolute bottom-4 left-4 z-20",
        "px-3 py-1.5 text-ui font-medium rounded-md",
        "bg-primary text-primary-foreground shadow-md",
        "transition-all duration-200",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-2 pointer-events-none",
        className,
      )}
    >
      <ChevronsLeft className="h-4 w-4" />
      Jump to start
    </button>
  );
}