const { useState, useEffect } = React;

/* ----------------------------------------------------------------
   ANIMATION HOOKS
   Typewriter, count-up, kicker line slide-in, bar grow.
   Driven by IntersectionObserver + requestAnimationFrame.
   ---------------------------------------------------------------- */
function useOnVisible(threshold = 0.25) {
  const ref = useState(() => ({ current: null }))[0];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let done = false;

    function reveal() {
      if (done) return;
      done = true;
      setVisible(true);
      teardown();
    }

    function check() {
      if (done || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight || 800;
      if (r.height === 0) return;
      // Fire once the element's top has risen into the lower viewport — or been scrolled past.
      if (r.top < vh * 0.85) reveal();
    }

    // Watch window plus any scrollable ancestor (the DC host scrolls an inner container).
    const scrollers = [window];
    let p = el.parentElement;
    while (p) {
      const oy = getComputedStyle(p).overflowY;
      if (oy === "auto" || oy === "scroll") scrollers.push(p);
      p = p.parentElement;
    }
    const onMove = () => check();
    scrollers.forEach((s) => s.addEventListener("scroll", onMove, { passive: true }));
    window.addEventListener("resize", onMove);

    let io = null;
    try {
      io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) reveal(); }, { threshold: Math.min(threshold, 0.2) });
      io.observe(el);
    } catch (e) { /* IO unsupported — scroll listeners cover it */ }

    // Poll briefly while layout settles, then stop.
    let ticks = 0;
    const poll = setInterval(() => { check(); if (done || ++ticks > 24) clearInterval(poll); }, 150);

    function teardown() {
      scrollers.forEach((s) => s.removeEventListener("scroll", onMove));
      window.removeEventListener("resize", onMove);
      if (io) io.disconnect();
      clearInterval(poll);
    }

    check();
    return teardown;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold]);

  return [ref, visible];
}

function useTypewriter(text, start, { speed = 45, delay = 0 } = {}) {
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState(null);

  useEffect(() => {
    if (!start || startedAt) return;
    setStartedAt(Date.now());
    let cancelled = false;
    let i = 0;
    const begin = () => {
      const tick = () => {
        if (cancelled) return;
        if (i < text.length) {
          i += 1;
          setTyped(text.slice(0, i));
          setTimeout(tick, speed);
        }
      };
      tick();
    };
    const timer = setTimeout(begin, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  return { typed, done: typed.length === text.length };
}

// Character-scramble decode — each glyph cycles through random characters,
// then settles into the real one. Returns the same { typed, done } shape as
// useTypewriter so it's a drop-in replacement.
function useScramble(text, start, { delay = 0, duration = 1000, fps = 12 } = {}) {
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#%&·—";
  const scrambleAll = (src) =>
    src.split("").map((ch) => (ch === " " || ch === "\n" ? ch : glyphs[Math.floor(Math.random() * glyphs.length)])).join("");

  const [display, setDisplay] = useState(() => (start ? scrambleAll(text) : ""));
  const [done, setDone] = useState(false);
  const startedRef = useState(() => ({ started: false }))[0];

  useEffect(() => {
    if (!start || startedRef.started) return;
    startedRef.started = true;

    const reveals = [];
    for (let i = 0; i < text.length; i++) {
      const base = (i / Math.max(1, text.length - 1)) * duration * 0.7;
      reveals.push(base + Math.random() * duration * 0.3);
    }
    const t0 = performance.now() + delay;
    const interval = 1000 / fps;
    const id = setInterval(() => {
      const elapsed = performance.now() - t0;
      let out = "";
      let allDone = elapsed >= 0;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === " " || ch === "\n") { out += ch; continue; }
        if (elapsed >= 0 && elapsed >= reveals[i]) {
          out += ch;
        } else {
          allDone = false;
          out += glyphs[Math.floor(Math.random() * glyphs.length)];
        }
      }
      setDisplay(out);
      if (allDone) { setDisplay(text); setDone(true); clearInterval(id); }
    }, interval);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  return { typed: display, done };
}

function useCountUp(to, start, { duration = 1200, decimals = 0, prefix = "", suffix = "", delay = 0 } = {}) {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!start || started) return;
    setStarted(true);
    let cancelled = false;
    let rafId;
    const begin = () => {
      const startTime = performance.now();
      const update = (now) => {
        if (cancelled) return;
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(to * eased);
        if (progress < 1) rafId = requestAnimationFrame(update);
        else setValue(to);
      };
      rafId = requestAnimationFrame(update);
    };
    const timer = setTimeout(begin, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (rafId) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  const formatted = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString();
  return `${prefix}${formatted}${suffix}`;
}

function useGrow(target, start, { delay = 0, durationMs = 600 } = {}) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (!start) return;
    const timer = setTimeout(() => setCurrent(target), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);
  return { value: current, transition: `width ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)` };
}

function TypeCursor({ show }) {
  if (!show) return null;
  return (
    <span aria-hidden="true" style={{ animation: "type-cursor 0.7s ease-in-out infinite", display: "inline-block" }}>
      |
    </span>
  );
}

/* ----------------------------------------------------------------
   DESIGN TOKENS — Neo-Industrial / Swiss
   One grotesque type family, charcoal/bone base, single blue accent.
   ---------------------------------------------------------------- */
const theme = {
  color: {
    charcoal: "#1C1B19",
    panel: "#242220",
    bone: "#F1EEEB",
    accent: "#0197F6",
    accentDeep: "#0579C7",
    alert: "#D7263D",
    gray: "#8A8579",
    rule: "rgba(241,238,235,0.16)",
    ruleOnBone: "rgba(28,27,25,0.14)",
  },
  font: {
    display: "'forma-djr-deck', 'Archivo Expanded', sans-serif",
    body: "'forma-djr-text', 'Archivo', sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace",
  },
};

/* ----------------------------------------------------------------
   IMAGE ASSETS
   ---------------------------------------------------------------- */
// Brand marks — real SVG assets supplied by the brand owner.
// `color` picks the correct artwork: light value → white art, dark → black.
const LOGO_KFORT = { white: "assets/logo_kfort_white.svg", black: "assets/logo_kfort_black.svg" };
const WORDMARK_UNION = { white: "assets/wordmark_union_white.svg", black: "assets/wordmark_union_black.svg" };

function isDark(c) {
  if (!c) return false;
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
}

// Unified "HERITAGE HUBS" wordmark (single artwork, viewBox 1422×210)
function HeritageHubsWordmark({ height = 16, color = "#F1EEEB" }) {
  const src = isDark(color) ? WORDMARK_UNION.black : WORDMARK_UNION.white;
  return <img src={src} alt="Heritage Hubs" style={{ height, width: "auto", display: "block" }} />;
}

// Primary crest mark (K-Fort monogram, viewBox 365×365)
function PrimaryLogo({ size = 36, color = "#F1EEEB" }) {
  const src = isDark(color) ? LOGO_KFORT.black : LOGO_KFORT.white;
  return <img src={src} alt="Heritage Hubs crest" style={{ width: size, height: size, display: "block" }} />;
}

// Horizontal lockup — crest left of the "HERITAGE HUBS" wordmark (viewBox 321×75)
function HeritageLockup({ height = 44 }) {
  return <img src="assets/heritage_lockup_white.svg" alt="Heritage Hubs" style={{ height, width: "auto", display: "block" }} />;
}

const IMG_LOGO_CREST = "assets/logo_kfort_white.svg";
const IMG_FORTSANDERS_MAP = "assets/img_fortsanders_map.png";
const IMG_CHARTER_FLAG = "assets/img_charter_flag.jpg";

/* ----------------------------------------------------------------
   CONTENT
   ---------------------------------------------------------------- */
const NAV_LINKS = [
  { href: "#problem", label: "Problem" },
  { href: "#stats", label: "Opportunity" },
  { href: "#solution", label: "Solution" },
  { href: "#ask", label: "The Ask" },
  { href: "#roadmap", label: "Roadmap" },
  { href: "#charter", label: "Charter" },
];

const MARQUEE_TEXT = "HERITAGE HUBS · KNOXVILLE, TN · EST. 2026 · 501(C)3 · ";

// Full section index for the dropdown menu.
const SECTION_LINKS = [
  { num: "01", href: "#problem", label: "The Problem" },
  { num: "02", href: "#stats", label: "The Opportunity" },
  { num: "03", href: "#knoxville", label: "Why Knoxville" },
  { num: "04", href: "#solution", label: "Solution" },
  { num: "05", href: "#incentives", label: "Tax Incentive Stack" },
  { num: "06", href: "#ask", label: "The Ask" },
  { num: "07", href: "#roadmap", label: "Roadmap" },
  { num: "08", href: "#charter", label: "The Charter" },
];

const PROBLEM_CARDS = [
  { number: "01", title: "No Owned Spaces", description: "Digital nomads lack permanent, high-fidelity physical spaces to scale culture. High rent and cancellation culture demand a secured anchor." },
  { number: "02", title: "Institutional Desert", description: "The Southeast has invested billions in media but neglected the physical foundations of civic life. We are building the town squares of the 21st century." },
  { number: "03", title: "Cultural Vacuum", description: "Young Americans seeking tradition lack local gathering places. Online communities can't replace bonds formed face-to-face." },
];

const STATS = [
  { value: 47, decimals: 0, prefix: "", suffix: "%", label: "Voted Conservative", sublabel: "18-29 Age Group // 2024" },
  { value: 6, decimals: 0, prefix: "-", suffix: "PT", label: "Democratic Drop", sublabel: "Youth Support Erosion" },
  { value: 52.7, decimals: 1, prefix: "", suffix: "%", label: "Approval Rating", sublabel: "Trump Support Generation Z" },
  { value: 4, decimals: 0, prefix: "", suffix: "YR", label: "Donor Decline", sublabel: "Legacy Vehicle Failure" },
];

const KNOXVILLE_STATS = [
  { low: 2, value: 4, prefix: "$", suffix: "M", decimals: 0, range: true, label: "Buys a marquee 15k sq ft historic anchor." },
  { value: 42000, prefix: "", suffix: "+", decimals: 0, label: "UT Students and young pros in radius." },
  { value: 58, prefix: "", suffix: "%", decimals: 0, label: "Support for conservative infrastructure." },
];

const HUB_MODULES = [
  { number: "1", title: "Event Space", description: "5k–15k sq ft for lectures, debates, and screenings.", image: "assets/dither-community.jpg" },
  { number: "2", title: "Co-Working", description: "Shared offices and workspace for aligned creators.", image: "assets/dither-culture.jpg" },
  { number: "3", title: "Front Café", description: "Street-level revenue engine and soft outreach.", image: "assets/dither-civic.jpg" },
  { number: "4", title: "Makerspace", description: "Studio space for physical craft and traditional production.", image: "assets/dither-community.jpg" },
  { number: "5", title: "Broadcast Labs", description: "Podcast studios and digital reach facilities.", image: "assets/dither-culture.jpg" },
  { number: "6", title: "Civic Program", description: "Formal education and historical lecture series.", image: "assets/dither-civic.jpg" },
];

const INCENTIVES = [
  { value: 20, decimals: 0, prefix: "", suffix: "%", label: "FEDERAL HISTORIC TAX CREDIT" },
  { value: 30, decimals: 0, prefix: "", suffix: "%+", label: "OPPORTUNITY ZONE BENEFITS" },
  { value: 500, decimals: 0, prefix: "$", suffix: "K", label: "TN HISTORIC DEV. GRANTS" },
  { value: 75, decimals: 0, prefix: "", suffix: "%", label: "TAX ABATEMENT SCALE" },
];

const DONOR_TIERS = [
  { value: 1, decimals: 0, prefix: "$", suffix: "M+", title: "Founding Patron", benefit: "Naming rights on flagship" },
  { value: 500, decimals: 0, prefix: "$", suffix: "K", title: "Legacy Partner", benefit: "Dedicated space naming" },
  { value: 100, decimals: 0, prefix: "$", suffix: "K", title: "Charter Benefactor", benefit: "Lifetime membership" },
  { value: 25, decimals: 0, prefix: "$", suffix: "K", title: "Cornerstone Donor", benefit: "Wall recognition" },
];

const ALLOCATION = [
  { label: "Acquisition", amount: 2.4 },
  { label: "Renovation", amount: 1.2 },
  { label: "Operating", amount: 0.4 },
];
const ALLOCATION_MAX = Math.max(...ALLOCATION.map((item) => item.amount));

const PHASES = [
  { phase: "PHASE 01", timeline: "2026-2027", title: "FLAGSHIP HUB", items: ["Acquire historic anchor", "Launch programming", "1,000 members"] },
  { phase: "PHASE 02", timeline: "2027-2029", title: "EXPANSION", items: ["Acquire 2-3 regional hubs", "Specialized trade centers", "15k+ annual visitors"] },
  { phase: "PHASE 03", timeline: "2029-2032", title: "ECOSYSTEM", items: ["Self-funding network", "Integrated civic campus", "50,000+ youth served"] },
];

const FOOTER_SITEMAP = ["Strategy", "Demographics", "Real Estate", "Partners"];
const FOOTER_LEGAL = ["Charter", "Privacy", "Donor Terms", "Contact"];

/* ----------------------------------------------------------------
   SHARED PRIMITIVES
   ---------------------------------------------------------------- */
function Marquee() {
  return (
    <div className="h-11 border-t border-b flex items-center overflow-hidden" style={{ borderColor: theme.color.rule }}>
      <div className="whitespace-nowrap animate-marquee text-xs uppercase tracking-widest" style={{ color: `${theme.color.bone}40`, fontFamily: theme.font.mono, letterSpacing: "0.12em" }}>
        {MARQUEE_TEXT.repeat(8)}
      </div>
    </div>
  );
}

function Label({ children, color, style }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: color || theme.color.gray,
        fontFamily: theme.font.mono,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// Section header: "NN — LABEL" in the display face, with a small eyebrow tag.
function SectionHead({ number, label, dark = false, visible, eyebrow }) {
  return (
    <div className="flex justify-between items-baseline flex-wrap gap-4 pb-5 mb-16" style={{ position: "relative" }}>
      <div
        style={{
          fontFamily: theme.font.mono,
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: "0.1em",
          color: theme.color.accent,
          transform: visible ? "translateX(0)" : "translateX(-22px)",
          opacity: visible ? 1 : 0,
          transition: "transform 0.7s cubic-bezier(0.22,1,0.36,1), opacity 0.6s ease",
          willChange: "transform, opacity",
        }}
      >
        {number} — {label}
      </div>
      {eyebrow && <Label color={dark ? "rgba(28,27,25,0.5)" : undefined}>{eyebrow}</Label>}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 1,
          backgroundColor: dark ? theme.color.ruleOnBone : theme.color.rule,
          transform: visible ? "scaleX(1)" : "scaleX(0)",
          transformOrigin: "left center",
          transition: "transform 0.7s cubic-bezier(0.22,1,0.36,1)",
          transitionDelay: visible ? "0.18s" : "0s",
          willChange: "transform",
        }}
      />
    </div>
  );
}

function RegCorner({ pos, dark = false }) {
  const base = { position: "absolute", width: 18, height: 18, opacity: 0.45, borderColor: dark ? theme.color.charcoal : theme.color.bone };
  const styles = {
    tl: { top: 24, left: 24, borderTop: "1.5px solid", borderLeft: "1.5px solid" },
    tr: { top: 24, right: 24, borderTop: "1.5px solid", borderRight: "1.5px solid" },
    bl: { bottom: 24, left: 24, borderBottom: "1.5px solid", borderLeft: "1.5px solid" },
    br: { bottom: 24, right: 24, borderBottom: "1.5px solid", borderRight: "1.5px solid" },
  };
  return <div style={{ ...base, ...styles[pos] }} />;
}

function StatNumber({ stat, start, delay, className, style }) {
  const display = useCountUp(stat.value, start, {
    decimals: stat.decimals,
    prefix: stat.prefix,
    suffix: stat.suffix,
    duration: 1200,
    delay,
  });
  return <div className={className} style={{ fontFamily: theme.font.display, fontWeight: 900, ...style }}>{display}</div>;
}

/* ----------------------------------------------------------------
   MAIN COMPONENT
   ---------------------------------------------------------------- */
// Title whose box is locked to its FINAL text: an invisible spacer reserves
// the real size, and the decoding text is overlaid absolutely so the scramble
// can never reflow the graphic containers around it.
function ScrambleTitle({ text, typed, className, style }) {
  return (
    <h2 className={className} style={style}>
      <span style={{ position: "relative", display: "block", width: "100%" }}>
        <span aria-hidden="true" style={{ visibility: "hidden" }}>{text}</span>
        <span style={{ position: "absolute", left: 0, top: 0, width: "100%" }}>{typed}</span>
      </span>
    </h2>
  );
}

window.HeritageHubsLanding = function HeritageHubsLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [heroRef, heroVisible] = useOnVisible(0.1);
  // Video overlay tagline — typewriter that grows from the centered midpoint.
  const videoTagline = useTypewriter("Permanent Infrastructure for Community, Culture & Civic Life", true, { speed: 52, delay: 700 });
  // Hero is above the fold — start immediately rather than waiting on scroll-visibility.
  const heroLine1 = useScramble("THE LACK IS NOT CONVICTION", true, { duration: 1900, delay: 250, fps: 22 });
  const heroLine2 = useScramble("IT'S INFRASTRUCTURE.", heroLine1.done, { duration: 1500, fps: 22 });
  const heroCoord = useScramble("35.9606°N / 83.9207°W", true, { duration: 1100, delay: 100, fps: 22 });
  const heroStatus = useScramble("STATUS: FUNDRAISING ACTIVE", true, { duration: 1300, delay: 450, fps: 22 });

  const [problemRef, problemVisible] = useOnVisible(0.25);
  const problemTitle = useScramble("A Generation without a home base.", problemVisible, { duration: 2400 });

  const [statsRef, statsVisible] = useOnVisible(0.25);
  const statsTitle = useScramble("Young Americans are turning right — fast.", statsVisible, { duration: 2400 });
  // After the title decodes, count up each figure in turn (next waits for previous to finish).
  const [statsStep, setStatsStep] = useState(0);
  useEffect(() => {
    if (!statsTitle.done) { setStatsStep(0); return; }
    const STEP_MS = 1300; // count duration (1200) + gap
    const timers = STATS.map((_, i) => setTimeout(() => setStatsStep(i + 1), i * STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, [statsTitle.done]);

  const [knoxRef, knoxVisible] = useOnVisible(0.25);
  const knoxTitle = useScramble("The most undervalued civic opportunity in the Southeast.", knoxVisible, { duration: 2400 });
  // After the title decodes, count up each figure in turn (next waits for previous to finish).
  const [knoxStep, setKnoxStep] = useState(0);
  useEffect(() => {
    if (!knoxTitle.done) { setKnoxStep(0); return; }
    const STEP_MS = 1300; // count duration (1100) + gap
    const timers = KNOXVILLE_STATS.map((_, i) => setTimeout(() => setKnoxStep(i + 1), i * STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, [knoxTitle.done]);

  const [solutionRef, solutionVisible] = useOnVisible(0.25);
  const solutionTitle = useScramble("Buy, renovate, and own mixed-use cultural hubs.", solutionVisible, { duration: 2400 });
  const [activeModule, setActiveModule] = useState(0);

  const [taxRef, taxVisible] = useOnVisible(0.25);
  const taxTitle = useScramble("Knoxville's structure slashes project costs by 25–40%.", taxVisible, { duration: 2400 });
  // After the title decodes, count up each incentive in turn (next waits for previous to finish).
  const [taxStep, setTaxStep] = useState(0);
  useEffect(() => {
    if (!taxTitle.done) { setTaxStep(0); return; }
    const STEP_MS = 1300; // count duration (1100) + gap
    const timers = INCENTIVES.map((_, i) => setTimeout(() => setTaxStep(i + 1), i * STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, [taxTitle.done]);

  const [askRef, askVisible] = useOnVisible(0.25);
  const askTitle = useScramble("$4M Seed Round to Acquire and Launch the Flagship Hub.", askVisible, { duration: 2400 });
  // Chain: allocation bars begin once the title finishes decoding…
  const askAllocStart = askTitle.done;
  // …and the donor tiers begin once the bars finish (last bar: 560ms delay + 1000ms grow).
  const [askAllocDone, setAskAllocDone] = useState(false);
  useEffect(() => {
    if (!askAllocStart) { setAskAllocDone(false); return; }
    const t = setTimeout(() => setAskAllocDone(true), 1660);
    return () => clearTimeout(t);
  }, [askAllocStart]);

  const [roadmapRef, roadmapVisible] = useOnVisible(0.25);
  const roadmapTitle = useScramble("From one building to a citywide network.", roadmapVisible, { duration: 2400 });

  const [charterRef, charterVisible] = useOnVisible(0.25);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;900&family=Archivo+Expanded:wght@700;900&family=IBM+Plex+Mono:wght@400;500;600;700&family=Instrument+Serif:ital@1&display=swap');

        * { box-sizing: border-box; }
        html { width: 100%; overflow-x: hidden; scroll-behavior: smooth; }
        body { background-color: ${theme.color.charcoal}; margin: 0; padding: 0; width: 100%; overflow-x: hidden; }

        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { display: inline-block; animation: marquee 32s linear infinite; white-space: nowrap; }

        @keyframes type-cursor { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes status-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        .status-blink { animation: status-blink 2s ease-in-out infinite; }

        @keyframes scanline-draw { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }
        .scanline-draw { transform-origin: left center; animation: scanline-draw 1.1s cubic-bezier(0.22,1,0.36,1) forwards; }

        @keyframes scroll-cue { 0%, 100% { transform: translateY(0); opacity: 0.45; } 50% { transform: translateY(7px); opacity: 1; } }
        .scroll-cue { animation: scroll-cue 1.8s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .animate-marquee { animation: none; }
          .status-blink { animation: none; }
          .scanline-draw { animation: none; transform: scaleX(1); }
          .scroll-cue { animation: none; }
        }

        .font-display { font-family: ${theme.font.display}; }
        .font-body { font-family: ${theme.font.body}; }
      `}</style>

      <div className="w-full min-h-screen" style={{ backgroundColor: theme.color.charcoal, color: theme.color.bone, fontFamily: theme.font.body }}>

        {/* Top accent scan-line — draws across on load */}
        <div className="fixed top-0 left-0 right-0 z-[60] scanline-draw" style={{ height: 2, backgroundColor: theme.color.accent, boxShadow: `0 0 12px ${theme.color.accent}` }} />

        {/* ============== NAVIGATION ============== */}
        <nav className="fixed top-0 left-0 right-0 z-50 border-b" style={{ backgroundColor: "#000000", borderColor: theme.color.rule }}>
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PrimaryLogo size={40} color={theme.color.bone} />
              <div className="flex flex-col gap-1">
                <HeritageHubsWordmark height={26} color={theme.color.bone} />
                <div className="text-[10px] leading-tight whitespace-nowrap" style={{ color: theme.color.gray, fontFamily: theme.font.mono }}>KNOXVILLE // TN</div>
              </div>
            </div>

            <div className="hidden lg:flex items-center" style={{ gap: 22 }}>
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="uppercase transition-colors"
                  style={{ color: "rgba(255,255,255,0.5)", fontFamily: theme.font.mono, fontSize: 10, lineHeight: "16px", letterSpacing: "0.5px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = theme.color.accent)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
                >
                  {link.label}
                </a>
              ))}
              <button
                className="uppercase transition-colors"
                style={{ padding: "7px 16px", border: "1px solid rgba(255,255,255,0.3)", color: theme.color.bone, fontFamily: theme.font.mono, fontSize: 10, fontWeight: 700, lineHeight: "15px", letterSpacing: "0.5px", background: "transparent", whiteSpace: "nowrap" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.color.accent; e.currentTarget.style.borderColor = theme.color.accent; e.currentTarget.style.color = theme.color.charcoal; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; e.currentTarget.style.color = theme.color.bone; }}
              >
                Patron Portal
              </button>
            </div>

            <button
              className="lg:hidden flex flex-col gap-1.5 p-2"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <span className="w-6 h-0.5" style={{ backgroundColor: theme.color.bone }} />
              <span className="w-6 h-0.5" style={{ backgroundColor: theme.color.bone }} />
              <span className="w-6 h-0.5" style={{ backgroundColor: theme.color.bone }} />
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="lg:hidden border-t px-6 py-6 flex flex-col gap-4" style={{ borderColor: theme.color.rule, backgroundColor: theme.color.charcoal }}>
              {SECTION_LINKS.map((link) => (
                <a key={link.href} href={link.href} className="flex items-baseline gap-3 uppercase" style={{ fontFamily: theme.font.mono, fontSize: 13, letterSpacing: "0.04em" }} onClick={() => setMobileMenuOpen(false)}>
                  <span style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.accent }}>{link.num}</span>
                  <span>{link.label}</span>
                </a>
              ))}
              <button className="mt-2 px-5 h-10 uppercase" style={{ backgroundColor: theme.color.accent, color: theme.color.charcoal, fontFamily: theme.font.mono, fontSize: 11, letterSpacing: "0.04em" }}>
                Patron Portal
              </button>
            </div>
          )}
        </nav>

        {/* ============== HERO VIDEO ============== */}
        <section className="relative w-full overflow-hidden" style={{ height: "100vh", backgroundColor: theme.color.charcoal }}>
          {/* placeholder shown until the video paints */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundImage: `repeating-linear-gradient(45deg, ${theme.color.panel} 0px, ${theme.color.panel} 12px, ${theme.color.charcoal} 12px, ${theme.color.charcoal} 24px)` }}>
            <div className="text-center" style={{ fontFamily: theme.font.mono, color: theme.color.gray, fontSize: 12, letterSpacing: "0.12em" }}>LOADING …</div>
          </div>

          <video
            className="absolute inset-0 w-full h-full object-cover"
            src="assets/hero-video.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          />

          {/* legibility scrims */}
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${theme.color.charcoal}66 0%, transparent 22%, transparent 55%, ${theme.color.charcoal}cc 100%)` }} />

          {/* overlay: logo + tagline */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <PrimaryLogo size={88} color={theme.color.bone} />
            <div className="mt-6" style={{ fontFamily: theme.font.mono, fontSize: 12, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)", minHeight: "2.8em", lineHeight: 1.4 }}>
              {videoTagline.typed}<TypeCursor show={true} />
            </div>
          </div>

          {/* scroll cue */}
          <a href="#hero-start" className="absolute left-1/2 bottom-9 -translate-x-1/2 flex flex-col items-center gap-2" style={{ fontFamily: theme.font.mono, fontSize: 10, letterSpacing: "0.24em", color: theme.color.bone, textDecoration: "none" }}>
            <span>SCROLL</span>
            <span className="scroll-cue" style={{ fontSize: 17, lineHeight: 1 }}>↓</span>
          </a>
        </section>

        {/* ============== HERO ============== */}
        <section id="hero-start" ref={heroRef} className="relative min-h-screen flex flex-col justify-between pt-32 pb-10 px-6 md:px-16 overflow-hidden">
          <RegCorner pos="tl" /><RegCorner pos="tr" /><RegCorner pos="bl" /><RegCorner pos="br" />

          <div className="absolute inset-0 z-0" style={{ opacity: 0.06 }}>
            <img src={IMG_FORTSANDERS_MAP} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>

          <div className="relative z-10 flex justify-end">
            <div className="border px-4 py-3 text-right" style={{ borderColor: theme.color.rule }}>
              <Label>CIVIC INFRASTRUCTURE PROJECT</Label><br />
              <span className="text-[11px] uppercase tracking-wide" style={{ color: theme.color.bone, fontWeight: 700 }}>KNOXVILLE, TN</span>
              <span style={{ color: theme.color.gray, fontFamily: theme.font.mono }}> &nbsp;©&nbsp; </span>
              <span className="text-[11px] uppercase tracking-wide" style={{ color: theme.color.bone, fontWeight: 700 }}>EST. 2026</span><br />
              <Label>REG &nbsp;</Label><span className="text-[11px] uppercase tracking-wide" style={{ color: theme.color.bone, fontWeight: 700 }}>#001 — FLAGSHIP</span>
            </div>
          </div>

          <div className="relative z-10 max-w-5xl">
            <div className="flex items-center gap-3 mb-7 flex-wrap">
              <Label style={{ fontSize: 14 }}>{heroCoord.typed}</Label>
              <div className="w-1.5 h-1.5 status-blink" style={{ backgroundColor: theme.color.alert }} />
              <span className="status-blink">
                <Label color={theme.color.alert} style={{ fontSize: 14 }}>{heroStatus.typed}</Label>
              </span>
            </div>

            <h1 className="font-display font-bold uppercase mb-8" style={{ fontSize: "clamp(2rem, 5.5vw, 4.75rem)", lineHeight: 1.0, letterSpacing: "-0.01em", minHeight: "3.1em" }}>
              <span>{heroLine1.typed}</span>
              <br />
              <span style={{ color: theme.color.accent }}>{heroLine2.typed}</span>
            </h1>

            <p className="max-w-xl mb-10" style={{ color: theme.color.gray, lineHeight: 1.5, fontFamily: theme.font.mono, fontSize: 22 }}>
              Building permanent infrastructure for community, culture, and civic life.
            </p>

            <div className="flex items-center gap-6 flex-wrap">
              <button
                className="px-9 py-4 text-sm font-bold uppercase tracking-wider transition-colors"
                style={{ backgroundColor: "transparent", color: theme.color.bone, border: "1px solid rgba(255,255,255,0.3)", fontFamily: theme.font.mono }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.color.accent; e.currentTarget.style.borderColor = theme.color.accent; e.currentTarget.style.color = theme.color.charcoal; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; e.currentTarget.style.color = theme.color.bone; }}
              >
                Become a Founding Partner
              </button>
              <Label>$4M Seed Round — Open</Label>
            </div>
          </div>

          <div className="relative z-10 flex justify-between items-end border-t pt-5" style={{ borderColor: theme.color.rule }}>
            <Label>Scroll — 01 / 08</Label>
            <Label>501(C)3 Nonprofit</Label>
          </div>
        </section>

        <Marquee />

        {/* ============== 01 — PROBLEM ============== */}
        <section id="problem" ref={problemRef} className="min-h-screen flex flex-col py-24 px-6 md:px-16">
          <div className="max-w-7xl mx-auto w-full flex flex-col flex-1">
            <SectionHead number="01" label="THE PROBLEM" visible={problemVisible} eyebrow="A Generation Without a Home Base" />

            <div className="flex-1 flex flex-col justify-center">
            <ScrambleTitle text="A Generation without a home base." typed={problemTitle.typed} className="font-display font-medium uppercase mb-16" style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)", lineHeight: 1.1 }} />

            <div className="grid grid-cols-1 md:grid-cols-3" style={{ borderTop: `1px solid ${theme.color.rule}` }}>
              {PROBLEM_CARDS.map((card, i) => (
                <article key={card.number} className="pt-8" style={{ paddingLeft: i === 0 ? 0 : 28, paddingRight: i === PROBLEM_CARDS.length - 1 ? 0 : 28, borderRight: i < PROBLEM_CARDS.length - 1 ? `1px solid ${theme.color.rule}` : "none" }}>
                  <div className="font-display font-bold text-sm mb-6" style={{ color: theme.color.accent }}>{card.number}</div>
                  <h3 className="text-xl uppercase mb-5 font-display font-bold">{card.title}</h3>
                  <p className="leading-relaxed" style={{ color: theme.color.gray, fontFamily: theme.font.mono, fontSize: 18 }}>{card.description}</p>
                </article>
              ))}
            </div>
            </div>
          </div>
        </section>

        {/* ============== 02 — STATS / OPPORTUNITY ============== */}
        <section id="stats" ref={statsRef} className="min-h-screen flex flex-col py-24 px-6 md:px-16">
          <div className="max-w-7xl mx-auto w-full flex flex-col flex-1">
            <SectionHead number="02" label="THE OPPORTUNITY" visible={statsVisible} eyebrow="Demographic / Economic Data" />

            <div className="flex-1 flex flex-col justify-center">
            <ScrambleTitle text="Young Americans are turning right — fast." typed={statsTitle.typed} className="font-display font-medium uppercase mb-16" style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)", lineHeight: 1.1 }} />

            <div className="grid grid-cols-2 md:grid-cols-4" style={{ borderTop: `1px solid ${theme.color.rule}`, borderBottom: `1px solid ${theme.color.rule}` }}>
              {STATS.map((stat, i) => (
                <div
                  key={stat.label}
                  className="py-10"
                  style={{
                    paddingLeft: i === 0 ? 0 : 28,
                    paddingRight: i === STATS.length - 1 ? 0 : 28,
                    borderRight: i < STATS.length - 1 ? `1px solid ${theme.color.rule}` : "none",
                  }}
                >
                  <StatNumber
                    stat={stat}
                    start={statsStep > i}
                    delay={0}
                    className="leading-none mb-5"
                    style={{ fontSize: "clamp(2rem, 3.5vw, 3.25rem)", color: theme.color.accent }}
                  />
                  <div className="text-xs font-bold uppercase tracking-wide mb-1">{stat.label}</div>
                  <div className="uppercase tracking-wide" style={{ color: theme.color.gray, fontFamily: theme.font.mono, fontSize: 15 }}>{stat.sublabel}</div>
                </div>
              ))}
            </div>
            </div>
          </div>
        </section>

        {/* ============== 03 — WHY KNOXVILLE ============== */}
        <section id="knoxville" ref={knoxRef} className="min-h-screen flex flex-col py-24 px-6 md:px-16">
          <div className="max-w-7xl mx-auto w-full flex flex-col flex-1">
            <SectionHead number="03" label="WHY KNOXVILLE" visible={knoxVisible} eyebrow="Fort Sanders District" />

            <div className="flex-1 flex flex-col justify-center">
            <ScrambleTitle text="The most undervalued civic opportunity in the Southeast." typed={knoxTitle.typed} className="font-display font-medium uppercase mb-16" style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)", lineHeight: 1.1 }} />

            <div className="flex flex-col lg:flex-row gap-12">
              <div className="flex-1 grid grid-cols-1" style={{ borderTop: `1px solid ${theme.color.rule}` }}>
                {KNOXVILLE_STATS.map((stat, index) => {
                  const high = useCountUp(stat.value, knoxStep > index, { decimals: stat.decimals, duration: 1100 });
                  const low = useCountUp(stat.low || 0, knoxStep > index && !!stat.range, { decimals: stat.decimals, duration: 1100 });
                  const display = stat.range ? `${stat.prefix}${low}–${high}${stat.suffix}` : `${stat.prefix}${high}${stat.suffix}`;
                  return (
                  <div key={stat.label} className="pt-8 pb-8" style={{ borderBottom: index < KNOXVILLE_STATS.length - 1 ? `1px solid ${theme.color.rule}` : "none" }}>
                    <div className="font-display font-extrabold mb-3" style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)", lineHeight: 1, color: theme.color.accent }}>
                      {display}
                    </div>
                    <div className="text-sm font-bold uppercase tracking-wide">{stat.label}</div>
                  </div>
                  );
                })}
              </div>

              <div className="flex-1 relative min-h-[420px]" style={{ backgroundColor: theme.color.panel, border: `1px solid ${theme.color.rule}` }}>
                <img src={IMG_FORTSANDERS_MAP} alt="Fort Sanders District map" className="absolute inset-0 w-full h-full object-contain" />
                <div className="absolute top-5 left-5 px-3 py-2" style={{ backgroundColor: theme.color.charcoal }}>
                  <Label color={theme.color.accent}>MAP_REF // FORT_SANDERS_DISTRICT</Label>
                </div>
              </div>
            </div>
            </div>
          </div>
        </section>

        {/* ============== 04 — SOLUTION ============== */}
        <section id="solution" ref={solutionRef} className="min-h-screen flex flex-col py-24 px-6 md:px-16">
          <div className="max-w-7xl mx-auto w-full flex flex-col flex-1">
            <SectionHead number="04" label="SOLUTION" visible={solutionVisible} eyebrow="Six Modules, One Building" />

            <div className="flex-1 flex flex-col justify-center">
            <ScrambleTitle text="Buy, renovate, and own mixed-use cultural hubs." typed={solutionTitle.typed} className="font-display uppercase mb-16 font-medium" style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)", lineHeight: 1.1 }} />

            {/* Tab nav — module selector */}
            <div className="flex flex-wrap items-center gap-7" style={{ borderBottom: "1px solid #B0B0A9" }}>
              {HUB_MODULES.map((module, i) => (
                <button
                  key={module.number}
                  onClick={() => setActiveModule(i)}
                  className="relative uppercase"
                  style={{
                    fontFamily: theme.font.body,
                    fontSize: 13,
                    letterSpacing: "0.02em",
                    color: theme.color.bone,
                    background: "transparent",
                    border: "none",
                    padding: "14px 0",
                    cursor: "pointer",
                    opacity: i === activeModule ? 1 : 0.55,
                    transition: "opacity 0.2s ease",
                  }}
                  onMouseEnter={(e) => { if (i !== activeModule) e.currentTarget.style.opacity = 0.85; }}
                  onMouseLeave={(e) => { if (i !== activeModule) e.currentTarget.style.opacity = 0.55; }}
                >
                  {module.title}
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: -1,
                      height: 1,
                      backgroundColor: theme.color.bone,
                      transform: i === activeModule ? "scaleX(1)" : "scaleX(0)",
                      transformOrigin: "left center",
                      transition: "transform 0.35s cubic-bezier(0.22,1,0.36,1)",
                    }}
                  />
                </button>
              ))}
            </div>

            {/* Content panel */}
            <div className="flex flex-col md:flex-row" style={{ backgroundColor: theme.color.bone, color: theme.color.charcoal }}>
              {/* index + giant numeral */}
              <div className="flex md:flex-col items-start justify-between md:justify-start gap-6 p-8 md:w-[230px] flex-shrink-0">
                <div style={{ fontFamily: theme.font.mono, fontSize: 11, letterSpacing: "0.1em", color: theme.color.charcoal }}>
                  0{activeModule + 1} / 0{HUB_MODULES.length}
                </div>
                <div style={{ fontFamily: theme.font.display, fontWeight: 500, fontSize: "clamp(5rem, 11vw, 8.5rem)", lineHeight: 0.9, letterSpacing: "-0.02em", color: theme.color.charcoal }}>
                  {HUB_MODULES[activeModule].number}
                </div>
              </div>

              {/* label + description */}
              <div className="flex-1 p-8 md:py-10 flex flex-col justify-center" style={{ borderLeft: `1px solid ${theme.color.rule}` }}>
                <div style={{ fontFamily: theme.font.mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: theme.color.accent, marginBottom: 18 }}>
                  HUB_MODULE_{HUB_MODULES[activeModule].number}
                </div>
                <div style={{ fontFamily: theme.font.body, fontSize: "clamp(1.25rem, 2.2vw, 1.6rem)", lineHeight: 1.25, letterSpacing: "-0.01em", color: theme.color.charcoal, maxWidth: 420 }}>
                  {HUB_MODULES[activeModule].description}
                </div>
              </div>

              {/* image */}
              <div className="p-8 md:w-[400px] flex-shrink-0 flex items-center">
                <div className="w-full" style={{ aspectRatio: "16 / 9", borderRadius: 2, overflow: "hidden", backgroundColor: theme.color.panel }}>
                  <img src={HUB_MODULES[activeModule].image} alt={HUB_MODULES[activeModule].title} className="w-full h-full object-cover" style={{ display: "block" }} />
                </div>
              </div>
            </div>
            </div>
          </div>
        </section>

        {/* ============== 05 — TAX INCENTIVE STACK ============== */}
        <section id="incentives" ref={taxRef} className="min-h-screen flex flex-col py-24 px-6 md:px-16">
          <div className="max-w-7xl mx-auto w-full flex flex-col flex-1">
            <SectionHead number="05" label="TAX INCENTIVE STACK" visible={taxVisible} eyebrow="Cost Structure" />

            <div className="flex-1 flex flex-col justify-center">
            <ScrambleTitle text="Knoxville's structure slashes project costs by 25–40%." typed={taxTitle.typed} className="font-display font-medium uppercase mb-16" style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.5rem)", lineHeight: 1.2 }} />

            <div className="grid grid-cols-2 md:grid-cols-4" style={{ borderTop: `1px solid ${theme.color.rule}` }}>
              {INCENTIVES.map((incentive, i) => (
                <div key={incentive.label} className="pt-9 mb-8" style={{ paddingLeft: i === 0 ? 0 : 28, paddingRight: i === INCENTIVES.length - 1 ? 0 : 28, borderRight: i < INCENTIVES.length - 1 ? `1px solid ${theme.color.rule}` : "none" }}>
                  <StatNumber
                    stat={incentive}
                    start={taxStep > i}
                    delay={0}
                    className="leading-none mb-4"
                    style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)", color: theme.color.accent }}
                  />
                  <div className="font-bold uppercase tracking-wide" style={{ color: theme.color.gray, fontFamily: theme.font.mono, fontSize: 15 }}>{incentive.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-7 text-center" style={{ backgroundColor: theme.color.panel, border: `1px solid ${theme.color.rule}` }}>
              <div className="font-display font-bold uppercase" style={{ fontSize: "clamp(1.1rem, 2.2vw, 1.6rem)" }}>
                $875K – $1.4M Effective Savings Per Flagship.
              </div>
            </div>
            </div>
          </div>
        </section>

        {/* ============== 06 — THE ASK ============== */}
        <section id="ask" ref={askRef} className="min-h-screen flex flex-col py-24 px-6 md:px-16">
          <div className="max-w-7xl mx-auto w-full flex flex-col flex-1">
            <SectionHead number="06" label="THE ASK" visible={askVisible} eyebrow="Capital Allocation" />

            <div className="flex-1 flex flex-col justify-center">
            <div className="flex flex-col lg:flex-row gap-14">
              <div className="flex-1">
                <ScrambleTitle text="$4M Seed Round to Acquire and Launch the Flagship Hub." typed={askTitle.typed} className="font-display font-medium uppercase mb-12" style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.5rem)", lineHeight: 1.2 }} />

                <Label color={theme.color.accent}>Allocation of Capital</Label>

                <div className="mt-6 space-y-6">
                  {ALLOCATION.map((item, i) => {
                    const pct = Math.round((item.amount / ALLOCATION_MAX) * 100);
                    const bar = useGrow(pct, askAllocStart, { delay: 200 + i * 180, durationMs: 1000 });
                    return (
                      <div key={item.label}>
                        <div className="flex justify-between text-sm mb-2">
                          <span>{item.label}</span>
                          <span className="font-bold" style={{ color: theme.color.accent }}>${item.amount}M</span>
                        </div>
                        <div className="h-1.5" style={{ backgroundColor: theme.color.rule }}>
                          <div className="h-full" style={{ width: `${bar.value}%`, backgroundColor: theme.color.accent, transition: bar.transition }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1" style={{ border: `1px solid ${theme.color.rule}` }}>
                <div className="px-6 py-5" style={{ backgroundColor: theme.color.accent }}>
                  <Label color={theme.color.charcoal}>Strategic Donor Tiers</Label>
                </div>

                {DONOR_TIERS.map((tier, i) => (
                  <div key={tier.title} className="px-7 py-7 flex gap-6" style={{ borderBottom: `1px solid ${theme.color.rule}` }}>
                    <StatNumber
                      stat={tier}
                      start={askAllocDone}
                      delay={i * 220}
                      className="w-[110px]"
                      style={{ fontSize: 22, color: theme.color.accent }}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-bold mb-1">{tier.title}</div>
                      <div style={{ color: theme.color.gray, fontFamily: theme.font.mono, fontSize: 16 }}>{tier.benefit}</div>
                    </div>
                  </div>
                ))}

                <div className="px-7 py-7">
                  <button
                    className="w-full h-12 text-xs font-bold uppercase tracking-wider transition-colors"
                    style={{ backgroundColor: "transparent", color: theme.color.bone, border: "1px solid rgba(255,255,255,0.3)", fontFamily: theme.font.mono }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.color.accent; e.currentTarget.style.borderColor = theme.color.accent; e.currentTarget.style.color = theme.color.charcoal; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; e.currentTarget.style.color = theme.color.bone; }}
                  >
                    Apply for Access
                  </button>
                </div>
              </div>
            </div>
            </div>
          </div>
        </section>

        {/* ============== QUOTE ============== */}
        <section className="py-20 px-6 md:px-16" style={{ backgroundColor: theme.color.panel }}>
          <div className="max-w-7xl mx-auto">
            <blockquote className="border-l-2 pl-9 m-0" style={{ borderColor: theme.color.accent }}>
              <p className="italic m-0" style={{ fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)", lineHeight: 1.4, fontFamily: "'Instrument Serif', serif", color: theme.color.bone }}>
                "Digital nomads lack permanent, high-fidelity physical spaces to scale culture. We are building
                the town squares of the 21st century - permanent, secured anchors for tradition."
              </p>
            </blockquote>
          </div>
        </section>

        {/* ============== 07 — ROADMAP ============== */}
        <section id="roadmap" ref={roadmapRef} className="min-h-screen flex flex-col py-24 px-6 md:px-16">
          <div className="max-w-7xl mx-auto w-full flex flex-col flex-1">
            <SectionHead number="07" label="ROADMAP" visible={roadmapVisible} eyebrow="2026 — 2032" />

            <div className="flex-1 flex flex-col justify-center">
            <ScrambleTitle text="From one building to a citywide network." typed={roadmapTitle.typed} className="font-display font-medium uppercase mb-16" style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)", lineHeight: 1.1 }} />

            <div className="grid grid-cols-1 md:grid-cols-3" style={{ borderTop: `1px solid ${theme.color.rule}` }}>
              {PHASES.map((phase, i) => (
                <div key={phase.phase} className="pt-9" style={{ paddingLeft: i === 0 ? 0 : 28, paddingRight: i === PHASES.length - 1 ? 0 : 28, borderRight: i < PHASES.length - 1 ? `1px solid ${theme.color.rule}` : "none" }}>
                  <Label color={theme.color.accent}>{phase.phase}</Label>
                  <div className="font-display font-bold mt-3 mb-1" style={{ fontSize: 30 }}>{phase.timeline}</div>
                  <div className="text-sm font-bold uppercase tracking-wide mb-7">{phase.title}</div>

                  <div style={{ borderTop: `1px solid ${theme.color.rule}` }} className="pt-6">
                    <ul className="space-y-3 list-none p-0 m-0">
                      {phase.items.map((item) => (
                        <li key={item} className="flex items-start gap-3" style={{ color: theme.color.gray, fontFamily: theme.font.mono, fontSize: 18 }}>
                          <div className="w-1 h-1 mt-2 flex-shrink-0" style={{ backgroundColor: theme.color.accent }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
        </section>

        <Marquee />

        {/* ============== 08 — CHARTER ============== */}
        <section id="charter" ref={charterRef} className="relative w-full overflow-hidden" style={{ minHeight: "100vh" }}>
          <img src={IMG_CHARTER_FLAG} alt="Flag bearer on horseback at Knoxville Raceway, crowd in stands" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${theme.color.charcoal}b3 0%, ${theme.color.charcoal}66 35%, ${theme.color.charcoal}e6 100%)` }} />

          <div className="relative h-full px-6 md:px-16 py-16 flex flex-col justify-between" style={{ minHeight: "100vh" }}>
            <div className="flex justify-between items-baseline flex-wrap gap-4 pb-5" style={{ borderBottom: `1px solid ${theme.color.rule}` }}>
              <div className="font-display font-extrabold text-sm tracking-wide" style={{ color: theme.color.accent }}>
                08 — THE CHARTER
              </div>
              <Label>Statement of Purpose</Label>
            </div>

            <blockquote className="max-w-xl m-0">
              <p style={{ fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)", lineHeight: 1.3, fontFamily: theme.font.display, fontWeight: 500, color: theme.color.bone }}>
                "The charitable purpose of the Organization shall include the advancement and facilitation of
                historical and civics education; the promotion of civic knowledge, participation, and informed
                public discourse; and the facilitation of community gatherings."
              </p>
            </blockquote>

            <Label>Founding Charter // Statement of Purpose</Label>
          </div>
        </section>

        {/* ============== COMMUNITY / CULTURE / CIVIC LIFE ============== */}
        <section className="flex flex-col md:flex-row" style={{ borderTop: `1px solid ${theme.color.rule}` }}>
          {["COMMUNITY", "CULTURE", "CIVIC LIFE"].map((word, i) => (
            <div
              key={word}
              className="relative flex-1 flex items-center justify-center py-20 md:py-28 overflow-hidden"
              style={{ borderRight: i < 2 ? `1px solid ${theme.color.rule}` : "none" }}
            >
              <h3 className="relative font-bold uppercase m-0" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", color: theme.color.bone, fontFamily: theme.font.mono }}>{word}</h3>
            </div>
          ))}
        </section>

        {/* ============== FOOTER ============== */}
        <footer className="px-6 md:px-16 pt-20 pb-10" style={{ borderTop: `1px solid ${theme.color.rule}`, backgroundColor: "#000000" }}>
          <div className="max-w-7xl mx-auto">

            {/* Sign-off moment: crest + wordmark, large and centered */}
            <div className="flex flex-col items-center text-center mb-20">
              <HeritageLockup height={72} />
              <Label style={{ marginTop: 18 }}>Knoxville, Tennessee — Established 2026</Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 pb-16" style={{ borderBottom: `1px solid ${theme.color.rule}` }}>
              <div>
                <address className="text-xs leading-relaxed not-italic" style={{ color: theme.color.gray, fontFamily: theme.font.mono }}>
                  114 Agnes Rd Ste 200<br />
                  Knoxville, TN 37919<br /><br />
                  501(c)(3) Nonprofit · EST. 2026
                </address>
              </div>

              <nav aria-label="Sitemap">
                <Label color={theme.color.accent}>Sitemap</Label>
                <div className="mt-4 space-y-3 text-sm" style={{ color: theme.color.gray, fontFamily: theme.font.mono }}>
                  {FOOTER_SITEMAP.map((item) => <div key={item}>{item}</div>)}
                </div>
              </nav>

              <nav aria-label="Legal">
                <div className="flex items-center gap-2.5">
                  <Label color={theme.color.accent}>Legal</Label>
                  <span style={{ fontFamily: theme.font.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.color.alert, border: `1px solid ${theme.color.alert}`, padding: "2px 6px", lineHeight: 1.2 }}>
                    Under Construction
                  </span>
                </div>
                <div className="mt-4 space-y-3 text-sm" style={{ color: theme.color.gray, fontFamily: theme.font.mono, opacity: 0.45 }}>
                  {FOOTER_LEGAL.map((item) => (
                    <div key={item} className="flex items-center gap-2" style={{ cursor: "not-allowed" }}>
                      <span>{item}</span>
                      <span style={{ fontSize: 9, letterSpacing: "0.1em" }}>// SOON</span>
                    </div>
                  ))}
                </div>
              </nav>

              <form onSubmit={(e) => e.preventDefault()} aria-label="Email signup">
                <label htmlFor="footer-email" className="block">
                  <Label color={theme.color.accent}>Tactical Updates</Label>
                </label>
                <div className="flex items-center justify-between border px-4 h-11 w-full mt-4" style={{ borderColor: theme.color.rule }}>
                  <input
                    id="footer-email"
                    type="email"
                    placeholder="COMMAND@HERITAGEHUBS.ORG"
                    className="bg-transparent text-xs outline-none w-full"
                    style={{ color: theme.color.gray, fontFamily: theme.font.mono }}
                  />
                  <button type="submit" className="text-xs font-bold whitespace-nowrap" style={{ color: theme.color.accent }}>SUBMIT →</button>
                </div>
              </form>
            </div>

            <div className="pt-6 text-[11px] uppercase tracking-wide text-center" style={{ color: theme.color.gray, fontFamily: theme.font.mono }}>
              Building Permanent Infrastructure for Community, Culture & Civic Life.
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
