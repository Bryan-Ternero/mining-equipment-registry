#!/usr/bin/env node
/**
 * Verificación posterior al deploy que usa deploy.sh.
 *
 * Entorno: PUBLIC_API_URL, PUBLIC_WEB_URL, EXPECTED_VERSION,
 *      VERIFY_SCOPE=all|web (web: solo el frontend, se usa con el candidato sin promover),
 *      VERIFY_ATTEMPTS (por defecto 6, con esperas crecientes: el ruteo y los alias tardan unos segundos),
 *      VERIFY_LOGIN=0 para omitir la verificación del login (un rollback puede restaurar una versión anterior al login).
 *
 * Códigos de salida: 0 todo sano, 1 falló una verificación, 3 el frontend está detrás de Vercel
 * Deployment Protection (un muro de login, así que no se puede inspeccionar desde aquí).
 */

const api = (process.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');
const web = (process.env.PUBLIC_WEB_URL ?? '').replace(/\/$/, '');
const expectedVersion = process.env.EXPECTED_VERSION ?? '';
const scope = process.env.VERIFY_SCOPE ?? 'all';
const attempts = Number(process.env.VERIFY_ATTEMPTS ?? 6);
const checkLogin = process.env.VERIFY_LOGIN !== '0';

// un valor inválido nunca debe convertirse en "cero verificaciones, exit 0"
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

  // el login debe estar activo: las llamadas anónimas se rechazan y la ruta de login responde
  if (checkLogin) {
  const anonymous = await get(`${api}/api/equipment`);
  if (anonymous.status !== 401) {
    throw new Error(`API /api/equipment answered ${anonymous.status} without a session (expected 401: login not enforced)`);
  }
  const login = await get(`${api}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (login.status !== 400) throw new Error(`API /api/auth/login answered ${login.status} to an empty body (expected 400)`);
  }

  const preflight = await get(`${api}/api/equipment`, {
    method: 'OPTIONS',
    headers: { Origin: web, 'Access-Control-Request-Method': 'POST' },
  });
  const allowed = preflight.headers.get('access-control-allow-origin');
  if (allowed !== web) throw new Error(`CORS does not allow ${web} (allow-origin: ${allowed ?? 'none'})`);

  return `API healthy, version ${health.version}, ${checkLogin ? 'login enforced, ' : ''}CORS allows ${web}`;
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

  // la URL de la API queda fijada en tiempo de build: un valor incorrecto implica un sitio roto aunque cargue
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
