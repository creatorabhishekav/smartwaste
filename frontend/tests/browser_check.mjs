/**
 * Real-browser verification harness for the SmartWaste 360 frontend.
 *
 * Drives headless Chrome over the DevTools Protocol (no external dependencies:
 * Node >=22 ships a global WebSocket). For each page it
 *   - records console errors/warnings and uncaught exceptions,
 *   - records every failed network request and its status,
 *   - asserts that expected copy is present in the rendered DOM,
 *   - captures a screenshot at a given viewport.
 *
 * Usage:  node tests/browser_check.mjs [--shot-dir <dir>] [--role citizen|worker|admin|anon]
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const APP = process.env.SW_APP_URL ?? "http://localhost:5173";
const API = process.env.SW_API_URL ?? "http://127.0.0.1:8000";
const CHROME =
  process.env.SW_CHROME ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9333;

const argv = process.argv.slice(2);
const shotDir = argValue("--shot-dir") ?? null;
const onlyRole = argValue("--role") ?? null;

function argValue(flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ CDP glue */

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        (this.handlers.get(msg.method) ?? []).forEach((fn) => fn(msg.params));
      }
    });
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error("ws error " + wsUrl)), {
        once: true,
      });
    });
    return new Cdp(ws);
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout ${method}`));
        }
      }, 45000);
    });
  }

  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }
}

/* ------------------------------------------------------------- session state */

class PageSession {
  constructor(cdp) {
    this.cdp = cdp;
    this.consoleErrors = [];
    this.consoleWarnings = [];
    this.pageErrors = [];
    this.failedRequests = [];
    this.apiCalls = [];
  }

  static attach(cdp) {
    const s = new PageSession(cdp);
    cdp.on("Runtime.consoleAPICalled", (p) => {
      if (p.type === "error") s.consoleErrors.push(fmtArgs(p.args));
      if (p.type === "warning") s.consoleWarnings.push(fmtArgs(p.args));
    });
    cdp.on("Runtime.exceptionThrown", (p) => {
      const d = p.exceptionDetails ?? {};
      s.pageErrors.push(d.exception?.description ?? d.text ?? "unknown exception");
    });
    cdp.on("Network.responseReceived", (p) => {
      const url = p.response.url;
      if (!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(url)) return;
      s.apiCalls.push({ url, status: p.response.status });
      if (p.response.status >= 400) {
        s.failedRequests.push({ url, status: p.response.status });
      }
    });
    cdp.on("Network.loadingFailed", (p) => {
      s.failedRequests.push({
        url: "(request) " + (p.requestId ?? ""),
        status: "net-fail:" + (p.errorText ?? ""),
      });
    });
    return s;
  }

  reset() {
    this.consoleErrors = [];
    this.consoleWarnings = [];
    this.pageErrors = [];
    this.failedRequests = [];
    this.apiCalls = [];
  }
}

function fmtArgs(args = []) {
  return args
    .map((a) => a.value ?? a.description ?? a.unserializableValue ?? a.type)
    .join(" ")
    .slice(0, 300);
}

/* ------------------------------------------------------------------- helpers */

async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error(
      "eval failed: " +
        (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text),
    );
  }
  return r.result.value;
}

const TEXT = "document.body ? document.body.innerText : ''";

async function setViewport(cdp, width, height, mobile = false) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
}

async function goto(cdp, path) {
  await cdp.send("Page.navigate", { url: APP + path });
  await sleep(1400);
  await waitFor(cdp, "document.readyState === 'complete'", 20000);
}

async function waitFor(cdp, expr, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      if (await evaluate(cdp, `!!(${expr})`)) return true;
    } catch {
      /* page may be mid-navigation */
    }
    await sleep(250);
  }
  return false;
}

/** Wait until the SPA has painted something other than the root placeholder. */
async function waitForRender(cdp, timeout = 20000) {
  return waitFor(
    cdp,
    "(document.querySelector('#root')?.children.length ?? 0) > 0",
    timeout,
  );
}

async function login(role) {
  const r = await fetch(`${API}/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!r.ok) throw new Error(`demo-login ${role} -> ${r.status}`);
  return r.json();
}

async function installSession(cdp, session) {
  await evaluate(
    cdp,
    `(() => {
      localStorage.setItem("smartwaste360.token", ${JSON.stringify(session.access_token)});
      localStorage.setItem("smartwaste360.user", ${JSON.stringify(JSON.stringify(session.user))});
      return true;
    })()`,
  );
}

async function clearSession(cdp) {
  await evaluate(
    cdp,
    `(() => {
      localStorage.removeItem("smartwaste360.token");
      localStorage.removeItem("smartwaste360.user");
      return true;
    })()`,
  );
}

/* ---------------------------------------------------------------------- test */

const results = [];
function record(page, ok, detail = "") {
  results.push({ page, ok, detail });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`${tag}  ${page}${detail ? `  (${detail})` : ""}`);
}

async function checkPage(cdp, session, spec) {
  const { name, path, expect = [], forbid = [], role = "anon", widths = [1366] } = spec;

  // localStorage is origin-scoped and unavailable on about:blank, so land on the
  // app origin once before seeding or clearing a session.
  await goto(cdp, "/");
  if (role === "anon") await clearSession(cdp);
  else await installSession(cdp, await login(role));
  // Reset only AFTER seeding: the bootstrap navigation above renders with the
  // previous page's session, and its calls must not count against this page.
  session.reset();

  for (const width of widths) {
    await setViewport(cdp, width, width < 500 ? 812 : 900, width < 500);
    await goto(cdp, path);
    await waitForRender(cdp);
    // let data fetches + animations settle
    await sleep(1600);

    const text = await evaluate(cdp, TEXT);
    const missing = expect.filter((e) => !text.includes(e));
    const present = forbid.filter((f) => text.includes(f));
    const url = await evaluate(cdp, "location.pathname");

    if (widths.indexOf(width) === 0) {
      if (expect.length) {
        record(
          `${name} copy`,
          missing.length === 0,
          missing.length ? `missing: ${missing.join(" | ")}` : `${expect.length} assertions`,
        );
      }
      if (forbid.length) {
        record(
          `${name} no-bad-copy`,
          present.length === 0,
          present.length ? `found: ${present.join(" | ")}` : "clean",
        );
      }
      if (spec.expectPath) {
        record(`${name} redirect`, url === spec.expectPath, `pathname=${url}`);
      }
    }

    record(
      `${name} @${width}px`,
      session.consoleErrors.length === 0 && session.pageErrors.length === 0,
      [
        session.pageErrors.length ? `uncaught:${session.pageErrors[0]}` : "",
        session.consoleErrors.length ? `console:${session.consoleErrors[0]}` : "",
      ]
        .filter(Boolean)
        .join(" ") || "no console/uncaught errors",
    );

    // Anonymous users must not hit protected endpoints. Only inspect calls to
    // the API origin (dev-server module URLs like /src/pages/admin/*.tsx are not API calls).
    if (role === "anon") {
      const guarded = session.apiCalls.filter(
        (c) =>
          c.url.startsWith(API) &&
          /\/notifications|\/auth\/me(\?|$)|\/analytics\/dashboard|\/complaints(\?|$)|\/admin\/|\/workers\/me/.test(
            c.url.replace(API, ""),
          ),
      );
      record(
        `${name} anon no-auth-calls`,
        guarded.length === 0,
        guarded.length
          ? guarded.map((g) => `${g.url.replace(API, "")} ${g.status}`).join(", ")
          : "none",
      );
    }

    // A blocked role must not mount the protected subtree (no data leak).
    if (spec.forbidApi) {
      const leaked = session.apiCalls.filter((c) => {
        const p = c.url.replace(API, "");
        return c.url.startsWith(API) && spec.forbidApi.some((frag) => p.includes(frag));
      });
      record(
        `${name} no protected calls`,
        leaked.length === 0,
        leaked.length ? leaked.map((g) => g.url.replace(API, "")).join(", ") : "none",
      );
    }

    const hardFails = session.failedRequests.filter((f) => {
      const u = String(f.url);
      return u.startsWith(API) || u.includes("/api");
    });
    if (role !== "anon" && spec.expectFailures !== true) {
      record(
        `${name} @${width}px no failed api`,
        hardFails.length === 0,
        hardFails.length
          ? hardFails.map((f) => `${f.url.replace(API, "")} ${f.status}`).slice(0, 3).join(", ")
          : `${session.apiCalls.length} api calls ok`,
      );
    }

    if (shotDir) {
      const safe = name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(shotDir, `${safe}-${width}.png`), Buffer.from(shot.data, "base64"));
    }
  }
}

/* ------------------------------------------------------------------ ui audit */

/**
 * Layout assertions that a screenshot cannot express reliably:
 * horizontal overflow at each breakpoint, map/chart rendering,
 * responsive chrome (sidebar vs mobile nav), tap-target sizes.
 */
const AUDITS = [
  { name: "Landing", path: "/", role: "anon", shell: false, widths: [375, 768, 1366, 1920] },
  { name: "Awareness (anon)", path: "/awareness", role: "anon", shell: false, widths: [375, 1366] },
  { name: "Login", path: "/login", role: "anon", shell: false, widths: [375, 1366] },
  { name: "Citizen dashboard", path: "/app/dashboard", role: "citizen", widths: [375, 768, 1920] },
  { name: "Report waste", path: "/app/report", role: "citizen", widths: [375, 768, 1920] },
  { name: "My complaints", path: "/app/complaints", role: "citizen", widths: [375, 1920] },
  { name: "Pickup request", path: "/app/pickup", role: "citizen", widths: [375, 1366] },
  { name: "Notifications", path: "/app/notifications", role: "citizen", widths: [375, 1366] },
  { name: "Eco points", path: "/app/eco-points", role: "citizen", widths: [375, 1366] },
  { name: "Profile", path: "/app/profile", role: "citizen", widths: [375, 1366] },
  { name: "Worker dashboard", path: "/worker", role: "worker", widths: [375, 1366] },
  { name: "Worker tasks", path: "/worker/tasks", role: "worker", widths: [375, 1366] },
  { name: "Admin dashboard", path: "/admin", role: "admin", widths: [375, 1920] },
  { name: "Admin complaints", path: "/admin/complaints", role: "admin", widths: [375, 1920] },
  { name: "Priority queue", path: "/admin/queue", role: "admin", widths: [375, 1920] },
  { name: "Hotspot map", path: "/admin/hotspots", role: "admin", widths: [375, 1366] },
  { name: "Admin pickups", path: "/admin/pickups", role: "admin", widths: [375, 1920] },
  { name: "Admin workers", path: "/admin/workers", role: "admin", widths: [375, 1920] },
  { name: "Admin analytics", path: "/admin/analytics", role: "admin", widths: [375, 1366, 1920] },
  { name: "Admin awareness", path: "/admin/awareness", role: "admin", widths: [375, 1366] },
  { name: "Admin settings", path: "/admin/settings", role: "admin", widths: [375, 1366] },
];

const OVERFLOW_PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const doc = document.documentElement.scrollWidth;
  const contained = (el) => {
    // An ancestor that clips or scrolls the axis makes this non-buggy
    // (map panes, wide tables inside overflow-x-auto, etc).
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (['auto','scroll','hidden','clip'].includes(cs.overflowX)) return true;
      if (p.classList && p.classList.contains('leaflet-container')) return true;
    }
    return false;
  };
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (['auto','scroll','hidden','clip'].includes(cs.overflowX)) continue;
    if (el.classList && el.classList.contains('leaflet-tile')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 2 && !contained(el)) {
      const card = el.closest('[class*="rounded-2xl"],[class*="rounded-xl"]');
      offenders.push(el.tagName.toLowerCase()
        + '.' + String(el.className).split(/\\s+/).slice(0,3).join('.')
        + ' right=' + Math.round(r.right) + ' w=' + Math.round(r.width)
        + ' in[' + (card ? String(card.className).split(/\\s+/).slice(0,2).join('.') : 'no-card') + ']');
    }
    if (offenders.length >= 4) break;
  }
  return { vw, doc, offenders };
})()`;

const CHROME_PROBE = `(() => {
  const vis = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const aside = document.querySelector('aside');
  const menuButton = [...document.querySelectorAll('header button')].find((b) =>
    /menu|nav/i.test((b.getAttribute('aria-label') || '') + (b.title || '')));
  const smallTargets = [];
  for (const b of document.querySelectorAll('button, a[href]')) {
    if (!vis(b)) continue;
    // Leaflet renders third-party attribution/zoom chrome; not our UI.
    if (b.closest('.leaflet-container')) continue;
    const cs = getComputedStyle(b);
    // Plain inline links inside prose ("Sign in", "View all") are legitimately
    // text-sized. Only flag real controls: <button> and flex/block link buttons.
    const isControl = b.tagName === 'BUTTON' || /flex|block|grid|list-item/.test(cs.display);
    if (!isControl) continue;
    const r = b.getBoundingClientRect();
    if (r.height > 0 && r.height < 28) {
      smallTargets.push(b.tagName.toLowerCase() + ' h=' + Math.round(r.height) +
        ' "' + (b.innerText || b.textContent || '').trim().slice(0, 18) + '"');
    }
    if (smallTargets.length >= 4) break;
  }
  return {
    sidebarVisible: vis(aside),
    mobileMenuVisible: vis(menuButton),
    smallTargets,
  };
})()`;

const WIDGET_PROBE = `(() => ({
  leaflet: !!document.querySelector('.leaflet-container'),
  tiles: document.querySelectorAll('.leaflet-tile').length,
  tilesLoaded: document.querySelectorAll('.leaflet-tile-loaded').length,
  svgPaths: document.querySelectorAll('svg path, svg rect, svg line').length,
  recharts: document.querySelectorAll('.recharts-wrapper').length,
  canvas: document.querySelectorAll('canvas').length,
  tables: document.querySelectorAll('table').length,
  rows: document.querySelectorAll('tbody tr').length,
  cards: document.querySelectorAll('[class*="rounded-2xl"], [class*="rounded-xl"]').length,
  skeletons: document.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]').length,
  images: document.querySelectorAll('img').length,
  brokenImages: [...document.querySelectorAll('img')].filter(
    (i) => i.complete && i.naturalWidth === 0).length,
}))()`;

/* ------------------------------------------------------------- layout diag */

const CHAIN_PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const contained = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (['auto','scroll','hidden','clip'].includes(cs.overflowX)) return true;
      if (p.classList && p.classList.contains('leaflet-container')) return true;
    }
    return false;
  };
  let worst = null;
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (['auto','scroll','hidden','clip'].includes(cs.overflowX)) continue;
    if (el.classList && el.classList.contains('leaflet-tile')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 2 && !contained(el) && (!worst || r.right > worst.right)) {
      worst = { el, right: r.right, width: r.width };
    }
  }
  if (!worst) return { vw, chain: [] };
  const chain = [];
  for (let el = worst.el; el && el.tagName !== 'HTML'; el = el.parentElement) {
    const cs = getComputedStyle(el);
    chain.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className).split(/\\s+/).slice(0, 4).join('.'),
      offsetWidth: el.offsetWidth,
      scrollWidth: el.scrollWidth,
      cssWidth: cs.width,
      minWidth: cs.minWidth,
      display: cs.display,
      overflowX: cs.overflowX,
      gtc: cs.gridTemplateColumns,
    });
  }
  return { vw, right: worst.right, width: worst.width, chain };
})()`;

async function runDiag(cdp, session, arg) {
  const [role, path, widthRaw] = arg.split("::");
  const width = Number(widthRaw) || 375;
  await goto(cdp, "/");
  if (role === "anon") await clearSession(cdp);
  else await installSession(cdp, await login(role));
  await setViewport(cdp, width, 812, width < 500);
  await goto(cdp, path);
  await waitForRender(cdp);
  await sleep(1800);
  const out = await evaluate(cdp, CHAIN_PROBE);
  console.log(`\nviewport=${out.vw}  offender width=${out.width} right=${out.right}`);
  if (!out.chain.length) {
    console.log("  no uncontained overflow");
    return;
  }
  for (const c of out.chain) {
    console.log(
      `  ${c.tag.padEnd(7)} w=${String(c.offsetWidth).padEnd(5)} scroll=${String(
        c.scrollWidth,
      ).padEnd(5)} css=${c.cssWidth.padEnd(9)} min=${c.minWidth.padEnd(7)} ${
        c.overflowX !== "visible" ? "ovx=" + c.overflowX + " " : ""
      }${c.display.includes("grid") ? "grid[" + c.gtc + "]" : c.display.padEnd(12)} .${c.cls}`,
    );
  }
}

async function runAudit(cdp, session) {
  for (const spec of AUDITS) {
    await goto(cdp, "/");
    if (spec.role === "anon") await clearSession(cdp);
    else await installSession(cdp, await login(spec.role));

    for (const width of spec.widths) {
      await setViewport(cdp, width, width < 500 ? 812 : 900, width < 500);
      await goto(cdp, spec.path);
      await waitForRender(cdp);
      await sleep(1800);

      const ov = await evaluate(cdp, OVERFLOW_PROBE);
      record(
        `${spec.name} @${width}px no h-overflow`,
        ov.offenders.length === 0 && ov.doc <= ov.vw + 2,
        ov.offenders.length
          ? ov.offenders.join(" | ")
          : `scrollWidth=${ov.doc} <= ${ov.vw}`,
      );

      const ch = await evaluate(cdp, CHROME_PROBE);
      // Public marketing/auth pages use their own header, not AppShell chrome.
      if (spec.shell !== false) {
        if (width < 1024) {
          record(
            `${spec.name} @${width}px mobile nav`,
            ch.mobileMenuVisible && !ch.sidebarVisible,
            `menu=${ch.mobileMenuVisible} sidebar=${ch.sidebarVisible}`,
          );
        } else {
          record(
            `${spec.name} @${width}px sidebar`,
            ch.sidebarVisible,
            `sidebar=${ch.sidebarVisible} menu=${ch.mobileMenuVisible}`,
          );
        }
        if (width === 375) {
          record(
            `${spec.name} @375px tap targets`,
            ch.smallTargets.length === 0,
            ch.smallTargets.length ? ch.smallTargets.join(" | ") : "all >=28px",
          );
        }
      }

      const w = await evaluate(cdp, WIDGET_PROBE);
      record(
        `${spec.name} @${width}px images`,
        w.brokenImages === 0,
        w.brokenImages ? `${w.brokenImages} broken` : `${w.images} imgs ok`,
      );

      if (spec.name === "Admin analytics") {
        record(
          `Analytics charts rendered`,
          w.recharts >= 1 && w.svgPaths >= 10,
          `recharts=${w.recharts} shapes=${w.svgPaths}`,
        );
      }
      if (spec.name === "Hotspot map") {
        record(
          `Hotspot map tiles loaded`,
          w.leaflet && w.tilesLoaded > 0,
          `leaflet=${w.leaflet} tilesLoaded=${w.tilesLoaded}/${w.tiles}`,
        );
      }
      // Admin lists render cards, not <table> rows. Count the deepest element
      // carrying a record id so parents holding many rows are not double counted.
      if (spec.name === "Admin complaints" || spec.name === "Admin workers") {
        const key = spec.name === "Admin complaints" ? "SW" : "WK";
        const re =
          key === "SW" ? "SW-[0-9]{4}-[0-9]{4}" : "SW-WK-[0-9]{4}";
        const items = await evaluate(
          cdp,
          `(() => {
            const re = new RegExp('${re}');
            let n = 0;
            for (const el of document.querySelectorAll('*')) {
              if (!re.test(el.textContent || '')) continue;
              // Deepest match only: a wrapper whose descendants already carry
              // the id is a container, not a record.
              let deeper = false;
              for (const c of el.children) {
                if (re.test(c.textContent || '')) { deeper = true; break; }
              }
              if (!deeper) n++;
            }
            return n;
          })()`,
        );
        record(
          `${spec.name} records rendered`,
          items > 0,
          `${items} ${key} records`,
        );
      }
    }
  }
}

/* ---------------------------------------------------------------------- main */

const PAGES = [
  // ---- anonymous / public
  {
    name: "Landing",
    path: "/",
    role: "anon",
    expect: ["Report", "Awareness"],
    forbid: ["Cannot connect"],
  },
  {
    name: "Login",
    path: "/login",
    role: "anon",
    expect: ["SmartWaste 360", "Sign in"],
  },
  {
    name: "Register",
    path: "/register",
    role: "anon",
    expect: ["Create", "account"],
  },
  { name: "Awareness (anon)", path: "/awareness", role: "anon", expect: ["Segregation guide"] },
  {
    name: "NotFound",
    path: "/definitely-not-a-page",
    role: "anon",
    expect: ["404"],
  },

  // ---- citizen
  {
    name: "Citizen dashboard",
    path: "/app/dashboard",
    role: "citizen",
    expect: ["Dashboard"],
    forbid: ["Cannot connect", "Something went wrong"],
  },
  {
    name: "Report waste",
    path: "/app/report",
    role: "citizen",
    expect: ["Report"],
    widths: [1366, 375],
  },
  { name: "My complaints", path: "/app/complaints", role: "citizen", expect: ["Complaint"] },
  { name: "Pickup request", path: "/app/pickup", role: "citizen", expect: ["Pickup"] },
  { name: "Notifications", path: "/app/notifications", role: "citizen", widths: [1366, 375] },
  { name: "Citizen awareness", path: "/app/awareness", role: "citizen", expect: ["Segregation guide"] },
  { name: "Eco points", path: "/app/eco-points", role: "citizen", expect: ["Eco"] },
  { name: "Profile", path: "/app/profile", role: "citizen", expect: ["Security"] },
  {
    name: "Complaint detail",
    path: "/app/complaints/REPLACE_ME",
    role: "citizen",
    expect: [],
  },

  // ---- worker
  { name: "Worker dashboard", path: "/worker", role: "worker", expect: ["Dashboard"] },
  { name: "Worker tasks", path: "/worker/tasks", role: "worker", expect: ["Task"] },
  { name: "Worker profile", path: "/worker/profile", role: "worker", expect: ["Profile"] },

  // ---- admin
  { name: "Admin dashboard", path: "/admin", role: "admin", expect: ["Admin"] },
  { name: "Admin complaints", path: "/admin/complaints", role: "admin", expect: ["Complaint"] },
  { name: "Priority queue", path: "/admin/queue", role: "admin", expect: ["Priority"] },
  { name: "Hotspot map", path: "/admin/hotspots", role: "admin", expect: ["Hotspot"], widths: [1366] },
  { name: "Admin pickups", path: "/admin/pickups", role: "admin", expect: ["Pickup"] },
  { name: "Admin workers", path: "/admin/workers", role: "admin", expect: ["Worker"] },
  { name: "Admin analytics", path: "/admin/analytics", role: "admin", expect: ["Analytics"] },
  { name: "Admin awareness", path: "/admin/awareness", role: "admin", expect: ["Awareness"] },
  { name: "Admin settings", path: "/admin/settings", role: "admin", expect: ["Settings"] },

  // ---- route guards (blocked roles render an in-place notice; the protected
  //      subtree must never mount, which forbidApi proves.)
  {
    name: "Guard: citizen -> admin",
    path: "/admin",
    role: "citizen",
    expect: ["needs a different role"],
    forbidApi: ["/admin/"],
  },
  {
    name: "Guard: citizen -> worker",
    path: "/worker",
    role: "citizen",
    expect: ["needs a different role"],
    forbidApi: ["/workers/me"],
  },
  {
    name: "Guard: worker -> admin",
    path: "/admin",
    role: "worker",
    expect: ["needs a different role"],
    forbidApi: ["/admin/"],
  },
  { name: "Guard: anon -> dashboard", path: "/app/dashboard", role: "anon", expectPath: "/login" },
];

async function main() {
  if (shotDir) mkdirSync(shotDir, { recursive: true });
  const userDataDir =
    "C:\\Users\\ASUS\\AppData\\Local\\Temp\\opencode\\sw-cdp-profile";

  rmSync(userDataDir, { recursive: true, force: true });

  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--window-size=1440,1000",
      `--user-data-dir=${userDataDir}`,
      `--remote-debugging-port=${PORT}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(400);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === "page");
    } catch {
      /* not up yet */
    }
  }
  if (!target) {
    chrome.kill();
    throw new Error("chrome devtools endpoint never came up");
  }

  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Log.enable");
  const session = PageSession.attach(cdp);

  // Resolve a real complaint id for the detail page.
  let complaintPath = "/app/complaints/REPLACE_ME";
  try {
    const s = await login("citizen");
    const r = await fetch(`${API}/complaints?page=1&page_size=1`, {
      headers: { Authorization: `Bearer ${s.access_token}` },
    });
    const j = await r.json();
    if (j.items?.length) complaintPath = `/app/complaints/${j.items[0].complaint_id}`;
  } catch {
    /* keep placeholder */
  }

  const specs = PAGES.map((p) =>
    p.name === "Complaint detail" ? { ...p, path: complaintPath } : p,
  ).filter((p) => !onlyRole || p.role === onlyRole);

  try {
    if (argv.includes("--audit")) {
      await runAudit(cdp, session);
    } else {
      const diag = argv.find((a) => a.startsWith("--diag="));
      if (diag) {
        await runDiag(cdp, session, diag.slice("--diag=".length));
      } else {
      for (const spec of specs) {
        try {
          await checkPage(cdp, session, spec);
        } catch (err) {
          record(spec.name, false, `harness error: ${err.message}`);
        }
      }
      }
    }
  } finally {
    try {
      await cdp.send("Browser.close");
    } catch {
      /* ignore */
    }
    chrome.kill();
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n" + "=".repeat(72));
  console.log(`PASSED: ${results.length - failed.length}    FAILED: ${failed.length}`);
  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed) console.log(`  - ${f.page}: ${f.detail}`);
  }
  console.log("=".repeat(72));
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error("harness crashed:", err);
  process.exit(2);
});
