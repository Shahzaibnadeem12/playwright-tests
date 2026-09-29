import { test, expect, Page } from '@playwright/test';

const BASE = 'https://flavonto.com';

// Collect all JS console errors across the entire audit
const consoleErrors: Record<string, string[]> = {};

// Helper: capture console errors on any page
async function trackConsoleErrors(page: Page, label: string) {
  consoleErrors[label] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors[label].push(msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors[label].push(`PAGE ERROR: ${err.message}`);
  });
}

// Helper: get all failed/broken network requests on a page
async function getBrokenResources(page: Page): Promise<string[]> {
  const broken: string[] = [];
  page.on('response', response => {
    if (response.status() >= 400) {
      broken.push(`${response.status()} → ${response.url()}`);
    }
  });
  return broken;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HOMEPAGE
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Homepage', () => {
  test('loads with 200, correct title, no console errors', async ({ page }) => {
    const broken: string[] = [];
    page.on('response', r => { if (r.status() >= 400) broken.push(`${r.status()} ${r.url()}`); });
    await trackConsoleErrors(page, 'homepage');

    const response = await page.goto(BASE, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/flavonto/i);

    // No JS errors
    expect(consoleErrors['homepage'], `Console errors on homepage: ${consoleErrors['homepage']?.join('\n')}`).toHaveLength(0);

    // Screenshot for visual record
    await page.screenshot({ path: 'test-results/homepage.png', fullPage: true });
  });

  test('hero section visible', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    // The React app renders a hero — at minimum the body should have visible content
    const body = page.locator('body');
    await expect(body).toBeVisible();
    const text = await page.innerText('body');
    expect(text.length).toBeGreaterThan(100);
  });

  test('navigation menu is present and has links', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const links = page.locator('nav a, header a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });

  test('no broken images on homepage', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const images = page.locator('img');
    const imgCount = await images.count();
    const brokenImgs: string[] = [];

    for (let i = 0; i < imgCount; i++) {
      const img = images.nth(i);
      const src = await img.getAttribute('src');
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      if (src && naturalWidth === 0) {
        brokenImgs.push(src);
      }
    }

    expect(brokenImgs, `Broken images: ${brokenImgs.join(', ')}`).toHaveLength(0);
  });

  test('page load time under 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const elapsed = Date.now() - start;
    expect(elapsed, `Page took ${elapsed}ms — too slow`).toBeLessThan(5000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. SHOP PAGE
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Shop Page', () => {
  test('loads and shows product listings', async ({ page }) => {
    const response = await page.goto(`${BASE}/shop`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await page.screenshot({ path: 'test-results/shop.png', fullPage: true });

    // Should show products or "no products" — either way should render
    const body = await page.innerText('body');
    expect(body.length).toBeGreaterThan(100);
  });

  test('product cards are clickable links', async ({ page }) => {
    await page.goto(`${BASE}/shop`, { waitUntil: 'networkidle' });
    // Look for WooCommerce product links or the React marketplace tiles
    const productLinks = page.locator('a[href*="/product"], .product a, .product-card a, article a');
    const count = await productLinks.count();
    // Flavonto has 36 demo listings — should be > 0
    console.log(`Found ${count} product links on shop page`);
    expect(count).toBeGreaterThan(0);
  });

  test('no console errors on shop page', async ({ page }) => {
    await trackConsoleErrors(page, 'shop');
    await page.goto(`${BASE}/shop`, { waitUntil: 'networkidle' });
    expect(consoleErrors['shop'], `Shop console errors:\n${consoleErrors['shop']?.join('\n')}`).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. CART PAGE
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Cart Page', () => {
  test('loads without error', async ({ page }) => {
    const response = await page.goto(`${BASE}/cart`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await page.screenshot({ path: 'test-results/cart.png', fullPage: true });
  });

  test('shows empty cart message or cart table (not a white screen)', async ({ page }) => {
    await page.goto(`${BASE}/cart`, { waitUntil: 'networkidle' });
    const text = await page.innerText('body');
    // Should say "empty" or show a cart — not be blank
    expect(text.trim().length).toBeGreaterThan(50);
  });

  test('no console errors on cart page', async ({ page }) => {
    await trackConsoleErrors(page, 'cart');
    await page.goto(`${BASE}/cart`, { waitUntil: 'networkidle' });
    expect(consoleErrors['cart'], `Cart console errors:\n${consoleErrors['cart']?.join('\n')}`).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CHECKOUT PAGE
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Checkout Page', () => {
  test('loads without error', async ({ page }) => {
    const response = await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await page.screenshot({ path: 'test-results/checkout.png', fullPage: true });
  });

  test('shows checkout form or redirect (not 404 or white screen)', async ({ page }) => {
    await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle' });
    const text = await page.innerText('body');
    expect(text.trim().length).toBeGreaterThan(50);
    // Should NOT show "Page not found"
    expect(text.toLowerCase()).not.toContain('page not found');
    expect(text.toLowerCase()).not.toContain('404');
  });

  test('billing fields exist on checkout', async ({ page }) => {
    await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle' });
    // WooCommerce standard billing fields
    const firstNameField = page.locator('#billing_first_name, input[name="billing_first_name"], [id*="billing"]').first();
    const exists = await firstNameField.count();
    if (exists > 0) {
      await expect(firstNameField).toBeVisible();
    } else {
      // If cart is empty, checkout may redirect — that's still OK, just log it
      console.log('No billing fields found — cart may be empty or checkout redirects to cart');
    }
  });

  test('no console errors on checkout', async ({ page }) => {
    await trackConsoleErrors(page, 'checkout');
    await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle' });
    expect(consoleErrors['checkout'], `Checkout console errors:\n${consoleErrors['checkout']?.join('\n')}`).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. MY ACCOUNT PAGE
// ─────────────────────────────────────────────────────────────────────────────
test.describe('My Account Page', () => {
  test('loads and shows login form', async ({ page }) => {
    const response = await page.goto(`${BASE}/my-account`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await page.screenshot({ path: 'test-results/my-account.png', fullPage: true });
  });

  test('login form has username and password fields', async ({ page }) => {
    await page.goto(`${BASE}/my-account`, { waitUntil: 'networkidle' });
    const usernameField = page.locator('#username, input[name="username"], input[type="email"]').first();
    const passwordField = page.locator('#password, input[name="password"], input[type="password"]').first();
    await expect(usernameField).toBeVisible();
    await expect(passwordField).toBeVisible();
  });

  test('no console errors on my account page', async ({ page }) => {
    await trackConsoleErrors(page, 'myaccount');
    await page.goto(`${BASE}/my-account`, { waitUntil: 'networkidle' });
    expect(consoleErrors['myaccount'], `My Account console errors:\n${consoleErrors['myaccount']?.join('\n')}`).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. MOBILE RESPONSIVENESS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Mobile Responsiveness', () => {
  const mobilePages = ['/', '/shop', '/cart', '/checkout', '/my-account'];

  for (const path of mobilePages) {
    test(`${path} looks correct on mobile (375px)`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      const response = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);

      // Check no horizontal scroll (content shouldn't overflow)
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth, `Horizontal overflow on mobile at ${path}: scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBeLessThanOrEqual(clientWidth + 5);

      await page.screenshot({ path: `test-results/mobile${path.replace(/\//g, '-') || '-home'}.png`, fullPage: true });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. SECURITY HEADERS CHECK
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Security & HTTP Headers', () => {
  test('site uses HTTPS', async ({ page }) => {
    const response = await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    expect(page.url()).toMatch(/^https:/);
  });

  test('HTTP redirects to HTTPS', async ({ page }) => {
    const response = await page.goto(BASE.replace('https://', 'http://'), { waitUntil: 'domcontentloaded' });
    expect(page.url()).toMatch(/^https:/);
  });

  test('no mixed content warnings', async ({ page }) => {
    const mixedContent: string[] = [];
    page.on('console', msg => {
      if (msg.text().toLowerCase().includes('mixed content')) {
        mixedContent.push(msg.text());
      }
    });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    expect(mixedContent, `Mixed content warnings: ${mixedContent.join('\n')}`).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. SEO BASICS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('SEO Basics', () => {
  const pagesToCheck = [
    { path: '/', name: 'Homepage' },
    { path: '/shop', name: 'Shop' },
  ];

  for (const { path, name } of pagesToCheck) {
    test(`${name} has meta description`, async ({ page }) => {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
      const metaDesc = await page.locator('meta[name="description"]').getAttribute('content');
      expect(metaDesc, `${name} is missing a meta description`).toBeTruthy();
      expect(metaDesc!.length).toBeGreaterThan(50);
    });

    test(`${name} has a single H1 tag`, async ({ page }) => {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      const h1Count = await page.locator('h1').count();
      expect(h1Count, `${name} has ${h1Count} H1 tags — should have exactly 1`).toBe(1);
    });

    test(`${name} has canonical URL`, async ({ page }) => {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical, `${name} is missing a canonical URL`).toBeTruthy();
    });

    test(`${name} images have alt text`, async ({ page }) => {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      const images = page.locator('img');
      const count = await images.count();
      const missingAlt: string[] = [];

      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const src = await img.getAttribute('src') || '(no src)';
        if (alt === null || alt.trim() === '') {
          missingAlt.push(src);
        }
      }

      expect(missingAlt, `Images missing alt text on ${name}:\n${missingAlt.join('\n')}`).toHaveLength(0);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. REACT APP / MARKETPLACE PAGES
// ─────────────────────────────────────────────────────────────────────────────
test.describe('React App / Marketplace', () => {
  test('React app mounts without errors (no YITH wishlist errors)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE, { waitUntil: 'networkidle' });

    const yithErrors = errors.filter(e => e.toLowerCase().includes('yith') || e.toLowerCase().includes('wishlist'));
    expect(yithErrors, `YITH/Wishlist errors still appearing:\n${yithErrors.join('\n')}`).toHaveLength(0);
  });

  test('no "Loading..." stuck spinner (hero cards animate)', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // Give React time to render

    // The loading text should NOT still be visible after 3 seconds
    const loadingText = await page.locator('text=Loading...').count();
    expect(loadingText, '"Loading..." spinner is stuck and never replaced').toBe(0);
  });

  test('hero section renders actual content (not blank)', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const visibleText = await page.innerText('body');
    // Should have product names or categories visible
    expect(visibleText.trim().length).toBeGreaterThan(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. 404 / ERROR HANDLING
// ─────────────────────────────────────────────────────────────────────────────
test.describe('404 & Error Handling', () => {
  test('non-existent page returns 404 status', async ({ page }) => {
    const response = await page.goto(`${BASE}/this-page-definitely-does-not-exist-xyz123`);
    expect(response?.status()).toBe(404);
  });

  test('404 page has helpful content (not white screen)', async ({ page }) => {
    await page.goto(`${BASE}/this-page-definitely-does-not-exist-xyz123`);
    const text = await page.innerText('body');
    expect(text.trim().length).toBeGreaterThan(50);
    await page.screenshot({ path: 'test-results/404-page.png', fullPage: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. CORE WEB VITALS (basic)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Core Web Vitals', () => {
  test('homepage LCP (Largest Contentful Paint) under 4 seconds', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });

    const lcp = await page.evaluate(() => {
      return new Promise<number>(resolve => {
        let lcpValue = 0;
        const observer = new PerformanceObserver(list => {
          const entries = list.getEntries();
          lcpValue = entries[entries.length - 1].startTime;
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => resolve(lcpValue), 1000);
      });
    });

    console.log(`LCP: ${lcp.toFixed(0)}ms`);
    expect(lcp, `LCP is ${lcp.toFixed(0)}ms — should be under 4000ms`).toBeLessThan(4000);
  });

  test('no layout shift on homepage (CLS check)', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });

    const cls = await page.evaluate(() => {
      return new Promise<number>(resolve => {
        let clsValue = 0;
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            const layoutShift = entry as any;
            if (!layoutShift.hadRecentInput) {
              clsValue += layoutShift.value;
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(clsValue), 2000);
      });
    });

    console.log(`CLS: ${cls.toFixed(4)}`);
    // Google's "good" threshold is 0.1
    expect(cls, `CLS is ${cls.toFixed(4)} — should be under 0.1 (Google's "Good" threshold)`).toBeLessThan(0.1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. WISHLIST PAGE
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Wishlist Page', () => {
  test('wishlist page loads without YITH errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));

    const response = await page.goto(`${BASE}/wishlist`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);

    const yithErrors = errors.filter(e => e.toLowerCase().includes('yith'));
    expect(yithErrors, `YITH errors on wishlist page:\n${yithErrors.join('\n')}`).toHaveLength(0);
    await page.screenshot({ path: 'test-results/wishlist.png', fullPage: true });
  });
});
