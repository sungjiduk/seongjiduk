import { chromium } from 'playwright-core';

const OUT = '/Users/teo/Project/3차 백엔드 프로젝트/발표자료/ppt';
const SITE = 'https://holymoly.cloud';
const API = SITE + '/api';
const log = (m) => console.log(`[cap2] ${m}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) 로그인 계정 확보 (API)
const email = `ppt-cap-${Date.now()}@test.com`;
await fetch(`${API}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'passw0rd1234', nickname: 'pptcap' }) });
const loginRes = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'passw0rd1234' }) });
const token = (await loginRes.json()).data.accessToken;
log('로그인 토큰 확보: ' + (token ? 'OK' : 'FAIL'));

const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.setDefaultTimeout(20000);
await page.addInitScript((t) => localStorage.setItem('seongjiduk.accessToken', t), token);

async function step(name, fn) { try { await fn(); log(`✅ ${name}`); } catch (e) { log(`⚠️ ${name}: ${e.message.split('\n')[0]}`); } }

await page.goto(SITE, { waitUntil: 'networkidle' });
await wait(2500);

// 02 작품 그리드 (스크롤 보완 — 애니 카드 뚜렷하게)
await step('works-grid', async () => {
  await page.mouse.wheel(0, 1050); await wait(1200);
  await page.screenshot({ path: `${OUT}/02_works_grid.png` });
});
// 02b 장르 확장 (비-애니 카테고리: 영화/소설/K-POP)
await step('works-genres', async () => {
  await page.mouse.wheel(0, 2600); await wait(1200);
  await page.screenshot({ path: `${OUT}/02b_works_genres.png` });
});

// 로그인 상태로 생성 → 저장 → 결제
let ready = false;
await step('generate', async () => {
  await page.mouse.wheel(0, -3400); await wait(600);
  await page.getByText('러브라이브!', { exact: true }).first().click({ timeout: 8000 });
  await wait(3500);
  await page.getByText('이 코스로 담기', { exact: false }).first().click({ timeout: 6000 });
  await wait(700);
  await page.getByText(/일정 생성/).first().click({ timeout: 6000 });
  await page.getByText('시사회 보기').first().waitFor({ timeout: 30000 });
  await wait(1500);
  ready = true;
});
await step('save', async () => {
  await page.getByText('일정 저장', { exact: false }).first().click({ timeout: 6000 });
  await wait(2500); // 저장 완료
});
await step('payment-offers', async () => {
  await page.getByText('예약·결제', { exact: false }).first().click({ timeout: 6000 });
  await page.getByText(/왕복 항공권|항공|숙소/).first().waitFor({ timeout: 15000 });
  await wait(1500);
  await page.screenshot({ path: `${OUT}/11_payment_offers.png` });
});

log('done');
await browser.close();
