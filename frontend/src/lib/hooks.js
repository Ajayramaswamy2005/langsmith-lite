import { useCallback, useEffect, useRef, useState } from "react";

/** Adds `is-visible` to a `.reveal` element the first time it scrolls into view. */
export function useReveal(options = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      node.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px", ...options },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [options.threshold, options.rootMargin]);

  return ref;
}

/** Reveals every `.reveal` descendant of the container, in document order. */
export function useRevealGroup() {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = root.querySelectorAll(".reveal");
    if (!targets.length) return;

    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return ref;
}

/** Counts up to `value` once the element is on screen. */
export function useCountUp(value, { duration = 1400, decimals = 0 } = {}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const run = () => {
      if (started.current) return;
      started.current = true;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setDisplay(value);
        return;
      }

      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(Number((value * eased).toFixed(decimals)));
        if (t < 1) requestAnimationFrame(tick);
        else setDisplay(value);
      };
      requestAnimationFrame(tick);
    };

    if (typeof IntersectionObserver === "undefined") {
      run();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && run()),
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, duration, decimals]);

  return [display, ref];
}

/** Fetch-on-mount with loading/error state and a manual `reload`. */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      if (error?.name === "AbortError") return undefined;
      setState({ data: null, loading: false, error });
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) };
}

export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — keep the value in memory only */
    }
  }, [key, value]);

  return [value, setValue];
}

/** Fires on a key combo. `combo` looks like "mod+k" or "escape". */
export function useHotkey(combo, handler) {
  useEffect(() => {
    const parts = combo.toLowerCase().split("+");
    const key = parts[parts.length - 1];
    const needsMod = parts.includes("mod");

    const onKeyDown = (event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (needsMod !== mod) return;
      if (event.key.toLowerCase() !== key) return;
      event.preventDefault();
      handler(event);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [combo, handler]);
}

export function useOnClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

/** Tracks window scroll past a threshold — used to condense the nav bar. */
export function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}
