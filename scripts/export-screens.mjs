import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'exports', 'figma');
const BASE_URL = 'http://127.0.0.1:4173';
const VIEWPORT = { width: 1440, height: 1024 };
const STUDENT_ID = '2023-10421';

const routes = [
  { name: 'role-selection', path: '/' },
  { name: 'student-dashboard', path: '/student' },
  { name: 'student-records', path: '/student/records' },
  { name: 'student-year-selection', path: '/student/year-selection' },
  { name: 'student-requirements', path: '/student/requirements' },
  { name: 'student-profile', path: '/student/profile' },
  { name: 'staff-dashboard', path: '/staff' },
  { name: 'staff-submissions', path: '/staff/submissions' },
  { name: 'staff-records', path: '/staff/records' },
  { name: 'staff-record-review', path: '/staff/review/sub-001' },
  { name: 'staff-reports', path: '/staff/reports' },
  { name: 'staff-certificates', path: '/staff/certificates' },
  { name: 'staff-settings', path: '/staff/settings' },
  { name: 'admin-dashboard', path: '/admin' },
  { name: 'admin-settings', path: '/admin/settings' },
  { name: 'admin-staff', path: '/admin/staff' },
  { name: 'admin-users', path: '/admin/users' },
];

const medicalFormSteps = {
  name: 'student-medical-form',
  path: '/student/medical-form/2026',
  steps: 6,
};

const startDevServer = () => {
  const child = spawn(
    'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
    { cwd: ROOT, shell: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let readyResolve;
  let readyReject;
  const readyPromise = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  const onData = (data) => {
    const text = data.toString();
    if (text.includes('Local:') && text.includes('127.0.0.1:4173')) {
      readyResolve();
    }
  };

  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('exit', (code) => {
    readyReject(new Error(`Dev server exited early (code ${code})`));
  });

  return { child, readyPromise };
};

const ensureFixtures = async () => {
  const fixturesDir = path.join(OUTPUT_DIR, '_fixtures');
  await fs.mkdir(fixturesDir, { recursive: true });

  const oneByOnePng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
    'base64',
  );
  const pngPath = path.join(fixturesDir, 'sample.png');
  await fs.writeFile(pngPath, oneByOnePng);

  const pdfPath = path.join(fixturesDir, 'sample.pdf');
  await fs.writeFile(
    pdfPath,
    '%PDF-1.4\n1 0 obj<<>>endobj\nxref\n0 1\n0000000000 65535 f \ntrailer<<>>\nstartxref\n0\n%%EOF\n',
  );

  return { pngPath, pdfPath };
};

const main = async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const skipServer = process.argv.includes('--no-server');
  let child = null;
  let readyPromise = null;

  if (!skipServer) {
    ({ child, readyPromise } = startDevServer());
  }

  try {
    if (readyPromise) {
      await Promise.race([
        readyPromise,
        delay(20000).then(() => {
          throw new Error('Timed out waiting for Vite dev server');
        }),
      ]);
    } else {
      await delay(2000);
    }

    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: VIEWPORT });

    await context.addInitScript((studentId) => {
      localStorage.setItem('studentId', studentId);
    }, STUDENT_ID);

    const fixtures = await ensureFixtures();
    let index = 1;

    for (let i = 0; i < routes.length; i += 1) {
      const route = routes[i];
      const page = await context.newPage();
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(700);
      const filename = `${String(index).padStart(2, '0')}-${route.name}.png`;
      await page.screenshot({
        path: path.join(OUTPUT_DIR, filename),
        fullPage: false,
      });
      await page.close();
      index += 1;
    }

    // Capture multi-step medical form
    {
      const page = await context.newPage();
      await page.goto(`${BASE_URL}${medicalFormSteps.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(700);

      for (let step = 1; step <= medicalFormSteps.steps; step += 1) {
        const filename = `${String(index).padStart(2, '0')}-${medicalFormSteps.name}-step-${step}.png`;
        await page.screenshot({
          path: path.join(OUTPUT_DIR, filename),
          fullPage: false,
        });
        index += 1;

        if (step === medicalFormSteps.steps) {
          break;
        }

        if (step === 5) {
          await page.setInputFiles('input#xray', fixtures.pdfPath);
          await page.setInputFiles('input#cbc', fixtures.pdfPath);
          await page.setInputFiles('input#urinalysis', fixtures.pdfPath);
          await page.waitForTimeout(200);
        }

        await page.click('button:has-text("Next")');
        await page.waitForTimeout(500);
      }

      await page.close();
    }

    await browser.close();
  } finally {
    if (child) {
      child.kill();
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
