import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    refTagger?: {
      tag: (element?: HTMLElement) => void;
    };
  }
}

export function useRefTagger(dependencies: unknown[] = []) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.refTagger && typeof window.refTagger.tag === 'function') {
        if (containerRef.current) {
          window.refTagger.tag(containerRef.current);
        } else {
          window.refTagger.tag();
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, dependencies);

  return containerRef;
}

export function triggerRefTagger(element?: HTMLElement) {
  setTimeout(() => {
    if (window.refTagger && typeof window.refTagger.tag === 'function') {
      if (element) {
        window.refTagger.tag(element);
      } else {
        window.refTagger.tag();
      }
    }
  }, 100);
}
