#!/usr/bin/env node
/**
 * Post-deploy verification used by deploy.sh.
 *
 * Env: PUBLIC_API_URL, PUBLIC_WEB_URL, EXPECTED_VERSION,
 *      VERIFY_SCOPE=all|web (web: only the frontend, used on the unpromoted candidate),
 *      VERIFY_ATTEMPTS (default 6, with growing waits: routing and aliases take a few seconds).
 *
 * Exit codes: 0 healthy, 1 a check failed, 3 the frontend is behind Vercel Deployment
 * Protection (a login wall, so it cannot be inspected from here).
 */

const api = (process.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');
const web = (process.env.PUBLIC_WEB_URL ?? '').replace(/\/$/, '');
const expectedVersion = process.env.EXPECTED_VERSION ?? '';
const scope = process.env.VERIFY_SCOPE ?? 'all';
const attempts = Number(process.env.VERIFY_ATTEMPTS ?? 6);

// a bad value must never turn into "zero checks, exit 0"
if (!Number.isInteger(attempts) || attempts < 1) {
  console.error(`    fail  VERIFY_ATTEMPTS must be a positive integer (got ${process.env.VERIFY_ATTEMPTS})`);
  process.exit(1);
}
if (!api || !web) {
  console.error('    fail  PUBLIC_API_URL and PUBLIC_WEB_URL are required');
  process.exit(1);
}

class Protected extends Error {}

async function get(url, init = {}) {
  return fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(15_000) });
}

async function checkApi() {
  const res = await get(`${api}/health`);
  if (res.status !== 200) throw new Error(`API /health answered ${res.status} (expected 200)`);
  const health = await res.json();
  if (health.status !== 'ok' || health.db !== 'up') {
    throw new Error(`API /health is not healthy: ${JSON.stringify(health)}`);
  }
  if (expectedVersion && health.version !== expectedVersion) {
    throw new Error(`API reports version ${health.version}, expected ${expectedVersion} (old build still live?)`);
  }

  const types = await get(`${api}/api/equipment-types`);
  if (types.status !== 200) throw new Error(`API /api/equipment-types answered ${types.status}`);
  const rows = await types.json();
  if (!Array.isArray(rows) || rows.length !== 3) throw new Error('API returned an unexpected equipment type catalogue');

  const preflight = await get(`${api}/api/equipment`, {
    method: 'OPTIONS',
    headers: { Origin: web, 'Access-Control-Request-Method': 'POST' },
  });
  const allowed = preflight.headers.get('access-control-allow-origin');
  if (allowed !== web) throw new Error(`CORS does not allow ${web} (allow-origin: ${allowed ?? 'none'})`);

  return `API healthy, version ${health.version}, CORS allows ${web}`;
}

async function checkWeb() {
  const res = await get(`${web}/`);
  const location = res.headers.get('location') ?? '';
  if (res.status === 401 || res.status === 403 || location.includes('vercel.com/login') || location.includes('/sso-api')) {
    throw new Protected(`${web} is behind Vercel Deployment Protection`);
  }
  if (res.status !== 200) throw new Error(`frontend answered ${res.status} (expected 200)`);
  const html = await res.text();
  if (!html.includes('id="root"')) throw new Error('frontend did not return the application page');

  // the API URL is baked in at build time: a wrong value means a broken site even if it loads
  const script = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  if (!script) throw new Error('frontend page has no application bundle');
  const bundle = await (await get(`${web}${script}`)).text();
  if (!bundle.includes(api)) throw new Error(`frontend bundle does not point to ${api} (wrong VITE_API_URL)`);

  return `frontend serves the app and points to ${api}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (let attempt = 1; attempt <= attempts; attempt++) {
  try {
    const results = [await checkWeb()];
    if (scope === 'all') results.push(await checkApi());
    for (const line of results) console.log(`    ok    ${line}`);
    process.exit(0);
  } catch (error) {
    if (error instanceof Protected) {
      console.error(`    warn  ${error.message}`);
      process.exit(3);
    }
    const last = attempt === attempts;
    console.error(`    ${last ? 'fail' : 'retry'}  (${attempt}/${attempts}) ${error.message}`);
    if (last) process.exit(1);
    await sleep(attempt * 5_000);
  }
}
