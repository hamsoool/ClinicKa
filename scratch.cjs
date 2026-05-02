const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', msg => console.log('BROWSER_LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER_ERROR:', err));
  await page.goto('http://localhost:5173/auth?mode=signin');
  // we might not even need to login, or maybe we do.
  await page.fill('input[type="email"]', 'staff1@gordoncollege.edu.ph');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  await page.goto('http://localhost:5173/clinic/dashboard');
  await page.waitForTimeout(5000);
  // Also try going to the student records since the error mentions student signatures
  await page.goto('http://localhost:5173/clinic/student-records');
  await page.waitForTimeout(5000);
  await browser.close();
})();
