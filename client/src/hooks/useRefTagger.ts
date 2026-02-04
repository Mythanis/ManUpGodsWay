import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    refTagger?: {
      tag: () => void;
    };
  }
}

let refTaggerLoaded = false;
const loadCallbacks: (() => void)[] = [];

function onRefTaggerReady(callback: () => void) {
  if (refTaggerLoaded && window.refTagger) {
    callback();
  } else {
    loadCallbacks.push(callback);
    if (!refTaggerLoaded) {
      const checkReady = setInterval(() => {
        if (window.refTagger && typeof window.refTagger.tag === 'function') {
          refTaggerLoaded = true;
          clearInterval(checkReady);
          while (loadCallbacks.length > 0) {
            const cb = loadCallbacks.shift();
            if (cb) cb();
          }
        }
      }, 200);
      setTimeout(() => clearInterval(checkReady), 10000);
    }
  }
}

export function useRefTagger(dependencies: unknown[] = []) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      onRefTaggerReady(() => {
        try {
          window.refTagger?.tag();
        } catch (e) {
          // Non-critical: RefTagger handles most cases automatically
        }
      });
    }, 500);

    return () => clearTimeout(timer);
  }, dependencies);

  return containerRef;
}

export function triggerRefTagger() {
  setTimeout(() => {
    onRefTaggerReady(() => {
      try {
        window.refTagger?.tag();
      } catch (e) {
        // Non-critical
      }
    });
  }, 500);
}
