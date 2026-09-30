"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "cn";

const ANIM_CLASS = {
  "reveal-up": "anim-reveal-up",
  "reveal-up-sm": "anim-reveal-up-sm",
  "reveal-up-xs": "anim-reveal-up-xs",
  "reveal-up-lg": "anim-reveal-up-lg",
  "reveal-stamp": "anim-reveal-stamp",
  "reveal-fade": "anim-reveal-fade",
  "reveal-pop": "anim-reveal-pop",
} as const;

type RevealAnimation = keyof typeof ANIM_CLASS;

type RevealProps = {
  as?: "div" | "p" | "h2" | "h3" | "span" | "li" | "blockquote";
  className?: string;
  /** seconds to wait before the reveal transition starts */
  delay?: number;
  animation?: RevealAnimation;
  style?: CSSProperties;
  children?: ReactNode;
};

/**
 * Visible-first scroll reveal.
 *
 * Server-rendered output (and any no-JS payload) is fully visible: the hidden
 * "waiting" state is only applied AFTER hydration, and only to elements that
 * are below the fold at mount time, so there is never a flash of hidden
 * content. Once an element enters the viewport the CSS animation in
 * `globals.css` plays out — same keyframes as the old framer-motion reveals.
 */
export function Reveal({
  as = "div",
  className,
  delay = 0,
  animation = "reveal-up",
  style,
  children,
}: RevealProps) {
  const Tag = as as "div";
  const elementRef = useRef<HTMLElement | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    setHydrated(true);

    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) {
      setActive(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={(el) => {
        elementRef.current = el;
      }}
      className={cn(
        hydrated && !active && "opacity-0",
        hydrated && active && ANIM_CLASS[animation],
        className,
      )}
      style={{
        ...(delay ? { animationDelay: `${delay}s` } : undefined),
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}