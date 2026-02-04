import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    lsbXref?: {
      tag: () => void;
    };
  }
}

let lsbXrefLoaded = false;
const loadCallbacks: (() => void)[] = [];

function onLsbXrefReady(callback: () => void) {
  if (lsbXrefLoaded && window.lsbXref) {
    callback();
  } else {
    loadCallbacks.push(callback);
    if (!lsbXrefLoaded) {
      const checkReady = setInterval(() => {
        if (window.lsbXref && typeof window.lsbXref.tag === 'function') {
          lsbXrefLoaded = true;
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
      onLsbXrefReady(() => {
        try {
          window.lsbXref?.tag();
        } catch (e) {
          // Non-critical: LSB XRef handles most cases automatically
        }
      });
    }, 500);

    return () => clearTimeout(timer);
  }, dependencies);

  return containerRef;
}

export function triggerRefTagger() {
  setTimeout(() => {
    onLsbXrefReady(() => {
      try {
        window.lsbXref?.tag();
      } catch (e) {
        // Non-critical
      }
    });
  }, 500);
}
