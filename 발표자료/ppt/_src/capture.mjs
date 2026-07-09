import { chromium } from 'playwright-core';
import fs from 'fs';

const OUT = '/Users/teo/Project/3차 백엔드 프로젝트/발표자료/ppt';
const SITE = 'https://holymoly.cloud';
fs.mkdirSync(OUT, { recursive: true });

const log = (m) => console.log(`[cap] ${m}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const done = [];
async function shot(page, name, opts = {}) {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  done.push(name);
  log(`✅ ${name}`);
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.setDefaultTimeout(20000);

async function step(name, fn) {
  try { await fn(); } catch (e) { log(`⚠️ ${name} 실패: ${e.message.split('\n')[0]}`); }
}

await step('home', async () => {
  await page.goto(SITE, { waitUntil: 'networkidle' });
  await wait(2500);
  await shot(page, '01_home_hero');
});

await step('works', async () => {
  await page.mouse.wheel(0, 620);
  await wait(1200);
  await shot(page, '02_works_grid');
});

await step('enter-work', async () => {
  await page.getByText('러브라이브!', { exact: true }).first().click({ timeout: 8000 });
  await wait(3800); // 지도 타일 + describe
});

await step('map', async () => { await shot(page, '03_map_markers'); });
await step('spotcard', async () => { await shot(page, '04_spot_card', { clip: { x: 980, y: 60, width: 460, height: 810 } }); });
await step('verified', async () => { await shot(page, '05_verified_course', { clip: { x: 980, y: 130, width: 460, height: 210 } }); });

let generated = false;
await step('add-course', async () => {
  await page.getByText('이 코스로 담기', { exact: false }).first().click({ timeout: 6000 });
  await wait(700);
});
await step('generate', async () => {
  await page.getByText(/일정 생성/).first().click({ timeout: 6000 });
  await page.getByText('시사회 보기').first().waitFor({ timeout: 30000 });
  await wait(1600);
  generated = true;
});

if (generated) {
  await step('timeline', async () => {
    await page.mouse.wheel(0, -1000); await wait(600);
    await shot(page, '06_trip_timeline');
  });
  await step('regenerate', async () => {
    await shot(page, '07_regenerate_bar', { clip: { x: 495, y: 495, width: 570, height: 95 } });
  });
  await step('preview', async () => {
    await page.mouse.wheel(0, 720); await wait(1000);
    await shot(page, '08_preview_filmstrip');
  });
  await step('nearby', async () => {
    await page.mouse.wheel(0, 950); await wait(1200);
    await shot(page, '10_nearby_chips');
  });
  await step('cinematic', async () => {
    await page.mouse.wheel(0, -2400); await wait(600);
    await page.getByText('시사회 보기').first().click({ timeout: 6000 });
    await wait(6500); // GLB 로드+씬 조립
    await shot(page, '09_cinematic_glb');
    try {
      await page.getByText(/자동 진행/).first().click({ timeout: 4000 });
      await wait(4500);
      await shot(page, '09b_cinematic_play');
    } catch {}
    try { await page.getByText(/건너뛰기|닫기/).first().click({ timeout: 3000 }); await wait(1000); } catch {}
  });
  await step('payment', async () => {
    await page.getByText('예약·결제', { exact: false }).first().click({ timeout: 6000 });
    await wait(2200);
    await shot(page, '11_payment_flow');
  });
}

log('완료: ' + done.length + '컷 — ' + done.join(', '));
await browser.close();
