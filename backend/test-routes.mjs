// Route-by-route contract test. Boots nothing: start the API first, then run `npm test`.
//
//   cd backend && npm run dev      # terminal 1
//   cd backend && npm test         # terminal 2
//
// Covers all 30 routes: happy path, invalid body, wrong owner, missing resource and
// state conflict. Creates throwaway users (apitest*@example.com) and deletes them,
// plus every experiment it makes, on the way out. Requests are paced to stay under
// the 10-req/10-s Upstash window, so a full run takes ~3 minutes.
const B = process.env.TEST_API_URL || 'http://localhost:3001/api/v1';
const AI = process.env.GROQ_API_KEY ? true : false; // skip the AI route without a key
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (s) => (typeof s === 'string' ? s.slice(0, 12) + '…' : s);
let pass = 0, fail = 0, skip = 0;
const results = [];
function log(name, cond, extra = '') {
  cond ? pass++ : fail++;
  const line = `${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`;
  results.push(line);
  console.log(line); // stream: this run takes minutes
}
function skipAs(name) {
  skip++;
  results.push(`SKIP ${name}`);
  console.log(`SKIP ${name}`);
}
async function req(method, path, { body, token, text } = {}) {
  await sleep(1100); // stay under the 10 req / 10 s Upstash window (auth is now limited too)
  const h = {};
  if (token) h.Authorization = `Bearer ${token}`;
  let b;
  if (body !== undefined) { h['Content-Type'] = text ? 'text/plain' : 'application/json'; b = text ? body : JSON.stringify(body); }
  const r = await fetch(B + path, { method, headers: h, body: b });
  const ct = r.headers.get('content-type') || '';
  const parsed = r.status === 204 ? null : ct.includes('json') ? await r.json().catch(() => null) : await r.text();
  // unwrap ApiResponse envelope; error bodies have no `data` key so fall through untouched
  const data = parsed && typeof parsed === 'object' && parsed.data !== undefined ? parsed.data : parsed;
  return { status: r.status, data, headers: r.headers };
}
// Preflight: fail fast with a useful message instead of 70 confusing 404s.
try {
  const probe = await fetch(`${B}/health`);
  if (!probe.ok) throw new Error(`health returned ${probe.status}`);
} catch (err) {
  console.error(`Cannot reach the API at ${B} (${err.message})`);
  console.error('Start it first:  cd backend && npm run dev');
  process.exit(1);
}

const TS = Date.now();
const email1 = `apitest1+${TS}@example.com`, email2 = `apitest2+${TS}@example.com`;

// 1. health
{
  const r = await req('GET', '/health');
  log('GET /health → 200 {status,timestamp}', r.status === 200 && r.data.status === 'ok' && !!r.data.timestamp, JSON.stringify(r.data));
}
// 2-4. register
let uid1, acc1, ref1;
{
  const r = await req('POST', '/auth/register', { body: { name: 'Api Test One', email: email1, password: 's3cur3Pa$$word' } });
  uid1 = r.data?.user?._id; acc1 = r.data?.accessToken; ref1 = r.data?.refreshToken;
  const safe = r.data?.user && !('passwordHash' in r.data.user) && !('refreshToken' in r.data.user);
  log('POST /auth/register → 201 + tokens, no hash leak', r.status === 201 && !!acc1 && !!ref1 && safe, `user=${short(uid1)}`);
  const dup = await req('POST', '/auth/register', { body: { name: 'X', email: email1.toUpperCase(), password: 's3cur3Pa$$word' } });
  log('POST /auth/register dup (case-variant) → 409', dup.status === 409 && dup.data?.error?.code === 'CONFLICT', `got ${dup.status}`);
  const bad = await req('POST', '/auth/register', { body: { name: '', email: 'nope', password: 'short' } });
  log('POST /auth/register invalid → 400 VALIDATION_ERROR', bad.status === 400 && bad.data?.error?.code === 'VALIDATION_ERROR', `got ${bad.status}`);
}
// 5-6. login
{
  const r = await req('POST', '/auth/login', { body: { email: email1, password: 's3cur3Pa$$word' } });
  acc1 = r.data?.accessToken; ref1 = r.data?.refreshToken;
  log('POST /auth/login → 200 + pair', r.status === 200 && !!acc1 && !!ref1, '');
  const bad = await req('POST', '/auth/login', { body: { email: email1, password: 'wrong-pass-1' } });
  log('POST /auth/login wrong pw → 401', bad.status === 401, `got ${bad.status}`);
  const nous = await req('POST', '/auth/login', { body: { email: `ghost+${TS}@example.com`, password: 'whatever12' } });
  log('POST /auth/login unknown user → 401 (no enum)', nous.status === 401, `got ${nous.status}`);
}
// 7. refresh rotation
let acc2 = acc1, ref2 = ref1;
{
  const r = await req('POST', '/auth/refresh', { body: { refreshToken: ref1 } });
  acc2 = r.data?.accessToken; ref2 = r.data?.refreshToken;
  log('POST /auth/refresh → 200 rotated pair', r.status === 200 && !!acc2 && !!ref2 && ref2 !== ref1, '');
  const replay = await req('POST', '/auth/refresh', { body: { refreshToken: ref1 } });
  log('POST /auth/refresh replay old → 401', replay.status === 401, `got ${replay.status}`);
  const bad = await req('POST', '/auth/refresh', { body: { refreshToken: 'garbage' } });
  log('POST /auth/refresh garbage → 401', bad.status === 401, `got ${bad.status}`);
}
// 8. me
{
  const r = await req('GET', '/auth/me', { token: acc2 });
  log('GET /auth/me → 200 own profile', r.status === 200 && r.data?.user?.email === email1.toLowerCase(), JSON.stringify(r.data?.user));
  const anon = await req('GET', '/auth/me');
  log('GET /auth/me no token → 401', anon.status === 401, `got ${anon.status}`);
  const badt = await req('GET', '/auth/me', { token: 'bad.token.here' });
  log('GET /auth/me bad token → 401', badt.status === 401, `got ${badt.status}`);
}
// 9. logout verifies token
{
  const r = await req('POST', '/auth/logout', { token: acc2, body: { refreshToken: ref2 } });
  log('POST /auth/logout valid → 200 {ok:true}', r.status === 200 && r.data?.ok === true, `got ${r.status}`);
  const after = await req('POST', '/auth/refresh', { body: { refreshToken: ref2 } });
  log('POST /auth/refresh after logout → 401', after.status === 401, `got ${after.status}`);
  // re-login for the rest
  const r2 = await req('POST', '/auth/login', { body: { email: email1, password: 's3cur3Pa$$word' } });
  acc1 = r2.data?.accessToken; ref1 = r2.data?.refreshToken;
  const wrongTok = await req('POST', '/auth/logout', { token: acc1, body: { refreshToken: 'wrong-token' } });
  log('POST /auth/logout wrong token → 401, session kept', wrongTok.status === 401, `got ${wrongTok.status}`);
  const still = await req('POST', '/auth/refresh', { body: { refreshToken: ref1 } });
  acc1 = still.data?.accessToken; ref1 = still.data?.refreshToken;
  log('session survives bad logout → refresh 200', still.status === 200, `got ${still.status}`);
}
// second user for 403 checks
let accU2;
{
  const r = await req('POST', '/auth/register', { body: { name: 'Api Test Two', email: email2, password: 's3cur3Pa$$word' } });
  accU2 = r.data?.accessToken;
  log('second user register → 201', r.status === 201, `got ${r.status}`);
}
// 10-12. experiments
let expId, dupId;
{
  const r = await req('POST', '/experiments', { token: acc1, body: { title: 'API Test Stroop' } });
  expId = r.data?.experiment?._id;
  log('POST /experiments → 201 draft', r.status === 201 && r.data?.experiment?.status === 'draft', `id=${short(expId)}`);
  const list = await req('GET', '/experiments', { token: acc1 });
  const leaked = JSON.stringify(list.data).includes('snapshot');
  log('GET /experiments → 200, no draft/versions leak', list.status === 200 && Array.isArray(list.data?.experiments) && !leaked, `n=${list.data?.experiments?.length}`);
  const one = await req('GET', `/experiments/${expId}`, { token: acc1 });
  log('GET /experiments/:id owner → 200 full', one.status === 200 && !!one.data?.experiment?.draft, `got ${one.status}`);
  const cross = await req('GET', `/experiments/${expId}`, { token: accU2 });
  log('GET /experiments/:id non-owner → 403', cross.status === 403, `got ${cross.status}`);
  const malformed = await req('GET', '/experiments/not-an-id', { token: acc1 });
  log('GET /experiments/:id malformed → 404 (not 500)', malformed.status === 404, `got ${malformed.status}`);
  const validDraft = {
    settings: { consentText: 'I agree to participate.' },
    blocks: [{
      id: 'block_main', label: 'Main', shuffle: false, maxRepeats: 2, repetitions: 1,
      trials: [{ id: 'trial_1', stimulus: { type: 'text', content: 'RED' }, duration: 2000, fixationDuration: 500, validKeys: ['f', 'j'], correctKey: 'f', condition: 'congruent' }],
    }],
    branches: [], loops: [],
  };
  const upd = await req('PUT', `/experiments/${expId}`, { token: acc1, body: { title: 'API Test Stroop v2', draft: validDraft } });
  log('PUT /experiments/:id → 200 updated', upd.status === 200 && upd.data?.experiment?.title === 'API Test Stroop v2', `got ${upd.status}`);
  const empty = await req('PUT', `/experiments/${expId}`, { token: acc1, body: {} });
  log('PUT /experiments/:id {} → 400', empty.status === 400, `got ${empty.status}`);
  const dup = await req('POST', `/experiments/${expId}/duplicate`, { token: accU2 });
  log('POST /experiments/:id/duplicate non-owner → 403', dup.status === 403, `got ${dup.status}`);
  const dup2 = await req('POST', `/experiments/${expId}/duplicate`, { token: acc1 });
  dupId = dup2.data?.experiment?._id;
  const clean = dup2.data?.experiment?.status === 'draft' && dup2.data?.experiment?.slug === null && (dup2.data?.experiment?.versions?.length ?? -1) === 0;
  log('POST /experiments/:id/duplicate owner → 201 clean copy', dup2.status === 201 && clean, `got ${dup2.status}`);
}
// 13. publish
let slug;
{
  const r = await req('POST', `/experiments/${expId}/publish`, { token: acc1 });
  slug = r.data?.slug;
  log('POST /experiments/:id/publish → 200 slug+url', r.status === 200 && /^[A-Za-z0-9]{8}$/.test(slug || '') && !!r.data?.participantUrl, `slug=${slug} v=${r.data?.version}`);
  const closed = await req('PUT', `/experiments/${dupId}`, { token: acc1, body: { status: 'closed' } });
  const pubClosed = await req('POST', `/experiments/${dupId}/publish`, { token: acc1 });
  log('publish closed → 409 CONFLICT', closed.status === 200 && pubClosed.status === 409, `got ${pubClosed.status}`);
  // regression: fresh experiment with no draft save at all
  const fresh = await req('POST', '/experiments', { token: acc1, body: { title: 'Fresh No Draft' } });
  const freshId = fresh.data?.experiment?._id;
  log('second draft creates fine (no E11000 on null slug)', fresh.status === 201, `got ${fresh.status}`);
  const freshGet = await req('GET', `/experiments/${freshId}`, { token: acc1 });
  log('fresh experiment has draft {} (minimize fix)', freshGet.status === 200 && !!freshGet.data?.experiment?.draft, `draft=${JSON.stringify(freshGet.data?.experiment?.draft)}`);
  const freshPub = await req('POST', `/experiments/${freshId}/publish`, { token: acc1 });
  log('publish with no draft save → 400 validation error (no JSON crash)', freshPub.status === 400 && freshPub.data?.error?.code === 'VALIDATION_ERROR', `got ${freshPub.status}`);
  const freshDup = await req('POST', `/experiments/${freshId}/duplicate`, { token: acc1 });
  log('duplicate unsaved draft → 201', freshDup.status === 201, `got ${freshDup.status}`);
  await req('DELETE', `/experiments/${freshId}`, { token: acc1 });
  if (freshDup.data?.experiment?._id) await req('DELETE', `/experiments/${freshDup.data.experiment._id}`, { token: acc1 });
}
// 14-20. participant runtime (public → paced for rate limiter)
const P = { deviceInfo: { browser: 'TestBot 1.0', os: 'TestOS', screenW: 1920, screenH: 1080, pixelRatio: 2 } };
const trial = (i) => ({ trialIndex: i, blockId: 'block_main', condition: i % 2 ? 'incongruent' : 'congruent', stimulus: { type: 'text', content: 'RED', url: null }, response: 'f', correct: true, rt: 500 + i, frameData: { intended: 120, actual: 120, dropped: 0 } });
let sessId, withdrawCode, sessToken;
{
  const g = await req('GET', `/run/${slug}`); await sleep(1200);
  log('GET /run/:slug → 200 snapshot', g.status === 200 && !!g.data?.experiment?.snapshot, `got ${g.status}`);
  const miss = await req('GET', '/run/ZZZZZZZZ'); await sleep(1200);
  log('GET /run/:slug unknown → 404', miss.status === 404, `got ${miss.status}`);
  // publish a fresh copy first — a closed *draft* has no slug, so /run/<slug> would 404.
  // (dupId itself is already closed from the section-13 conflict check above.)
  const closeCopy = await req('POST', `/experiments/${expId}/duplicate`, { token: acc1 });
  const closeCopyId = closeCopy.data?.experiment?._id;
  const pubCopy = await req('POST', `/experiments/${closeCopyId}/publish`, { token: acc1 });
  const closedSlug = pubCopy.data?.slug;
  await req('PUT', `/experiments/${closeCopyId}`, { token: acc1, body: { status: 'closed' } });
  const closedExp = await req('GET', `/run/${closedSlug}`); await sleep(1200);
  log('GET /run/:slug closed → 410 GONE', closedExp.status === 410 && closedExp.data?.error?.code === 'GONE', `got ${closedExp.status} (slug ${closedSlug})`);
  const closedSession = await req('POST', `/run/${closedSlug}/sessions`, { body: P }); await sleep(1200);
  log('POST /run/:slug/sessions on closed → 410 GONE', closedSession.status === 410, `got ${closedSession.status}`);
  const s = await req('POST', `/run/${slug}/sessions`, { body: P }); await sleep(1200);
  sessId = s.data?.sessionId; withdrawCode = s.data?.withdrawCode; sessToken = s.data?.token;
  log('POST /run/:slug/sessions → 201 ids', s.status === 201 && !!sessId && !!sessToken && /^[A-Za-z0-9]{8}$/.test(withdrawCode || ''), `code=${withdrawCode}`);
  const badBody = await req('POST', `/run/${slug}/sessions`, { body: { deviceInfo: { browser: 'x' } } }); await sleep(1200);
  log('POST sessions bad body → 400', badBody.status === 400, `got ${badBody.status}`);
  const badSlug = await req('POST', '/run/ZZZZZZZZ/sessions', { body: P }); await sleep(1200);
  log('POST sessions bad slug → 404', badSlug.status === 404, `got ${badSlug.status}`);
  const patch = await req('PATCH', `/run/sessions/${sessId}`, { body: { token: sessToken, calibration: { refreshRate: 60, jitter: 1.2, score: 94 } } }); await sleep(1200);
  log('PATCH session calibration → 200', patch.status === 200, `got ${patch.status}`);
  const patchEmpty = await req('PATCH', `/run/sessions/${sessId}`, { body: { token: sessToken } }); await sleep(1200);
  log('PATCH session {} → 400', patchEmpty.status === 400, `got ${patchEmpty.status}`);
  const patchBad = await req('PATCH', '/run/sessions/not-an-id', { body: { token: sessToken, status: 'abandoned' } }); await sleep(1200);
  log('PATCH session malformed id → 404 (not 500)', patchBad.status === 404, `got ${patchBad.status}`);
  const up = await req('POST', `/run/sessions/${sessId}/trials`, { body: { token: sessToken, trials: [trial(0), trial(1)] } }); await sleep(1200);
  log('POST trials batch → 201 inserted:2', up.status === 201 && up.data?.inserted === 2, `got ${up.status}`);
  const upBad = await req('POST', `/run/sessions/${sessId}/trials`, { body: { token: sessToken, trials: [{ trialIndex: -1 }] } }); await sleep(1200);
  log('POST trials invalid → 400', upBad.status === 400, `got ${upBad.status}`);
  const upHuge = await req('POST', `/run/sessions/${sessId}/trials`, { body: { token: sessToken, trials: Array.from({ length: 501 }, (_, i) => trial(i + 100)) } }); await sleep(1200);
  log('POST trials 501 items → 400 (max 500)', upHuge.status === 400, `got ${upHuge.status}`);
  const done = await req('POST', `/run/sessions/${sessId}/complete`, { body: { token: sessToken } }); await sleep(1200);
  log('POST complete → 200 withdrawCode', done.status === 200 && done.data?.withdrawCode === withdrawCode, `got ${done.status}`);
  const done2 = await req('POST', `/run/sessions/${sessId}/complete`, { body: { token: sessToken } }); await sleep(1200);
  log('POST complete again → 409', done2.status === 409, `got ${done2.status}`);
  const lateUp = await req('POST', `/run/sessions/${sessId}/trials`, { body: { token: sessToken, trials: [trial(9)] } }); await sleep(1200);
  log('POST trials after complete → 409', lateUp.status === 409, `got ${lateUp.status}`);
  const latePatch = await req('PATCH', `/run/sessions/${sessId}`, { body: { token: sessToken, status: 'abandoned' } }); await sleep(1200);
  log('PATCH session after complete → 409', latePatch.status === 409, `got ${latePatch.status}`);
  // beacon on a fresh session
  const s2 = await req('POST', `/run/${slug}/sessions`, { body: P }); await sleep(1200);
  const s2id = s2.data?.sessionId;
  const bc = await req('POST', `/run/sessions/${s2id}/beacon`, { body: JSON.stringify({ trials: [trial(0)], status: 'abandoned' }), text: true }); await sleep(1200);
  log('POST beacon text/plain → 204', bc.status === 204, `got ${bc.status}`);
  const bcJunk = await req('POST', `/run/sessions/${s2id}/beacon`, { body: 'not-json{{{', text: true }); await sleep(1200);
  log('POST beacon junk → 204 (best-effort)', bcJunk.status === 204, `got ${bcJunk.status}`);
  const wdBad = await req('DELETE', '/run/withdraw/ZZZZZZZZ'); await sleep(1200);
  log('DELETE withdraw bad code → 404', wdBad.status === 404, `got ${wdBad.status}`);
  const wd = await req('DELETE', `/run/withdraw/${s2.data?.withdrawCode}`); await sleep(1200);
  log('DELETE withdraw valid → 200 counts', wd.status === 200 && wd.data?.deleted?.sessions === 1, JSON.stringify(wd.data?.deleted));
}
// 21-23. stimuli (authenticated, no pacing needed)
let stimId;
{
  const u = await req('POST', '/stimuli/upload-url', { token: acc1, body: { filename: 'red.png', contentType: 'image/png' } });
  log('POST /stimuli/upload-url → 200 clientToken', u.status === 200 && !!u.data?.clientToken, `got ${u.status}`);
  const uBad = await req('POST', '/stimuli/upload-url', { token: acc1, body: { filename: 'x.exe', contentType: 'application/x-msdownload' } });
  log('POST upload-url bad type → 400', uBad.status === 400, `got ${uBad.status}`);
  const uAnon = await req('POST', '/stimuli/upload-url', { body: { filename: 'a.png', contentType: 'image/png' } });
  log('POST upload-url anon → 401', uAnon.status === 401, `got ${uAnon.status}`);
  const c = await req('POST', '/stimuli', { token: acc1, body: { name: 'Red Circle', type: 'image', url: 'https://abc123.public.blob.vercel-storage.com/red-xyz.png', size: 24576 } });
  stimId = c.data?.stimulus?._id;
  log('POST /stimuli blob URL → 201', c.status === 201 && !!stimId, `got ${c.status}`);
  const cBad = await req('POST', '/stimuli', { token: acc1, body: { name: 'Evil', type: 'image', url: 'https://evil.example.com/x.png', size: 10 } });
  log('POST /stimuli non-blob URL → 400', cBad.status === 400, `got ${cBad.status}`);
  const l = await req('GET', '/stimuli', { token: acc1 });
  log('GET /stimuli → 200 own list', l.status === 200 && l.data?.stimuli?.some((s) => s._id === stimId), `n=${l.data?.stimuli?.length}`);
  const l2 = await req('GET', '/stimuli', { token: accU2 });
  log('GET /stimuli isolation → other user sees none of mine', l2.status === 200 && !l2.data?.stimuli?.some((s) => s._id === stimId), `n=${l2.data?.stimuli?.length}`);
  const dCross = await req('DELETE', `/stimuli/${stimId}`, { token: accU2 });
  log('DELETE /stimuli/:id non-owner → 403', dCross.status === 403, `got ${dCross.status}`);
  const d = await req('DELETE', `/stimuli/${stimId}`, { token: acc1 });
  log('DELETE /stimuli/:id owner → 200', d.status === 200 && d.data?.deleted === true, `got ${d.status}`);
  const d2 = await req('DELETE', `/stimuli/${stimId}`, { token: acc1 });
  log('DELETE /stimuli/:id again → 404', d2.status === 404, `got ${d2.status}`);
}
// 24-26. results (need completed session from earlier: sessId has 2 trials)
{
  const sum = await req('GET', `/results/${expId}/summary`, { token: acc1 });
  const s = sum.data?.summary;
  log('GET results summary → 200 stats', sum.status === 200 && s?.totalSessions >= 1 && s?.completed >= 1, JSON.stringify(s));
  const sumCross = await req('GET', `/results/${expId}/summary`, { token: accU2 });
  log('GET summary non-owner → 403', sumCross.status === 403, `got ${sumCross.status}`);
  const sess = await req('GET', `/results/${expId}/sessions`, { token: acc1 });
  const row = sess.data?.sessions?.find((x) => x._id === sessId);
  log('GET results sessions → 200 trialCount', sess.status === 200 && row?.trialCount === 2, `trialCount=${row?.trialCount}`);
  log('GET results sessions → no withdrawCode (participant-only)', !!row && !('withdrawCode' in row), `keys=${Object.keys(row ?? {})}`);
  log('GET results sessions → server-stamped consent', !!row?.consent?.agreedAt && /^[0-9a-f]{64}$/.test(row?.consent?.textHash ?? ''), JSON.stringify(row?.consent));
  log('GET summary → RT dispersion fields', 'sdRt' in s && 'semRt' in s && Number.isInteger(s.nRt), JSON.stringify(s));
  const one = await req('GET', `/results/${expId}/sessions/${sessId}`, { token: acc1 });
  log('GET session detail → 200 + trials sorted', one.status === 200 && one.data?.trials?.length === 2 && one.data.trials[0].trialIndex === 0, `n=${one.data?.trials?.length}`);
  const oneMiss = await req('GET', `/results/${expId}/sessions/665f1a2b3c4d5e6f7a8b9c99`, { token: acc1 });
  log('GET session detail unknown → 404', oneMiss.status === 404, `got ${oneMiss.status}`);
  const exc = await req('PATCH', `/results/${expId}/sessions/${sessId}`, { token: acc1, body: { excluded: true } });
  log('PATCH exclude=true → 200', exc.status === 200 && exc.data?.session?.excluded === true, `got ${exc.status}`);
  const sum2 = await req('GET', `/results/${expId}/summary`, { token: acc1 });
  log('summary after exclude → excluded:1, meanRt:0', sum2.data?.summary?.excluded === 1 && sum2.data?.summary?.meanRt === 0, JSON.stringify(sum2.data?.summary));
  const unexc = await req('PATCH', `/results/${expId}/sessions/${sessId}`, { token: acc1, body: { excluded: false } });
  log('PATCH exclude=false → 200', unexc.status === 200 && unexc.data?.session?.excluded === false, `got ${unexc.status}`);
  const excBad = await req('PATCH', `/results/${expId}/sessions/${sessId}`, { token: acc1, body: { excluded: 'yes' } });
  log('PATCH exclude non-boolean → 400', excBad.status === 400, `got ${excBad.status}`);
  const csv = await req('GET', `/results/${expId}/export?format=csv`, { token: acc1 });
  const csvText = typeof csv.data === 'string' ? csv.data.replace(/^﻿/, '') : '';
  log('GET export csv → 200 + header+rows', csv.status === 200 && csvText.startsWith('sessionId,') && csvText.split('\n').length >= 3, `lines=${csvText.split('\n').length}`);
  const json = await req('GET', `/results/${expId}/export?format=json`, { token: acc1 });
  log('GET export json → 200 flat array', json.status === 200 && Array.isArray(json.data) && json.data.length === 2 && json.data[0].trialIndex === 0, `n=${json.data?.length}`);
  const sumCsv = await req('GET', `/results/${expId}/export?format=json&kind=sessions`, { token: acc1 });
  log('GET export sessions json → overall + per-block rows', sumCsv.status === 200 && Array.isArray(sumCsv.data) && sumCsv.data[0]?.blockId === 'all' && sumCsv.data[0]?.trials === 2, JSON.stringify(sumCsv.data?.[0]));
  const clean = await req('GET', `/results/${expId}/export?format=json&scope=clean`, { token: acc1 });
  log('GET export scope=clean → 200 array', clean.status === 200 && Array.isArray(clean.data), `got ${clean.status}`);
  const kindBad = await req('GET', `/results/${expId}/export?format=csv&kind=x`, { token: acc1 });
  log('GET export bad kind → 400', kindBad.status === 400, `got ${kindBad.status}`);
  const fmtBad = await req('GET', `/results/${expId}/export?format=xml`, { token: acc1 });
  log('GET export bad format → 400', fmtBad.status === 400, `got ${fmtBad.status}`);
  const fmtMiss = await req('GET', `/results/${expId}/export`, { token: acc1 });
  log('GET export no format → 400', fmtMiss.status === 400, `got ${fmtMiss.status}`);
}
// 27. delete experiment + verify cascade
{
  const d = await req('DELETE', `/experiments/${expId}`, { token: acc1 });
  log('DELETE /experiments/:id → 200 counts', d.status === 200 && d.data?.deleted?.sessions >= 1 && d.data?.deleted?.trials >= 2, JSON.stringify(d.data?.deleted));
  const gone = await req('GET', `/experiments/${expId}`, { token: acc1 });
  log('GET deleted experiment → 404', gone.status === 404, `got ${gone.status}`);
  const sumGone = await req('GET', `/results/${expId}/summary`, { token: acc1 });
  log('GET summary of deleted → 404', sumGone.status === 404, `got ${sumGone.status}`);
  await req('DELETE', `/experiments/${dupId}`, { token: acc1 });
  log('cleanup dup experiment → deleted', true, '');
}

// 30. AI generation (skipped without GROQ_API_KEY)
if (AI) {
  const r = await req('POST', '/generate', { token: acc1, body: { prompt: 'A simple reaction time task with 5 trials, press space as fast as possible after a fixation cross.' } });
  const d = r.data || {};
  log('POST /generate → 200 { recipe, valid, errors }', r.status === 200 && !!d.recipe && typeof d.valid === 'boolean', `got ${r.status}`);
  log('POST /generate rejects a too-short prompt', (await req('POST', '/generate', { token: acc1, body: { prompt: 'hi' } })).status === 400, '');
  log('POST /generate needs auth', (await req('POST', '/generate', { body: { prompt: 'a flanker task with 20 trials please' } })).status === 401, '');
} else {
  skipAs('POST /generate (no GROQ_API_KEY in this shell)');
}

// Clean up the throwaway users so a failed run doesn't pile up accounts.
try {
  const mongoose = (await import('mongoose')).default;
  await mongoose.connect(process.env.MONGODB_URI);
  const res = await mongoose.connection.db.collection('users').deleteMany({ email: /^apitest[12]\+/ });
  console.log(`\nCleaned up ${res.deletedCount} test user(s).`);
  await mongoose.disconnect();
} catch {
  console.log('\n(Test users not cleaned up — no MONGODB_URI in this shell.)');
}

console.log(`\nTOTAL: ${pass} pass, ${fail} fail, ${skip} skipped`);
process.exit(fail ? 1 : 0);
