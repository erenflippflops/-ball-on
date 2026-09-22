import { test, expect } from '@playwright/test';

test.describe('Amo Arena UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start local dev server first (npm run dev:all)
    await page.goto('http://localhost:5175');
  });

  test('Main menu shows both game options', async ({ page }) => {
    await expect(page.locator('text=BALL-ON')).toBeVisible();
    await expect(page.locator('text=Draft Manager')).toBeVisible();
    await expect(page.locator('text=Amo Arena')).toBeVisible();
  });

  test('Can navigate to Amo Arena', async ({ page }) => {
    // Click Amo Arena button
    await page.click('text=Amo Arena');

    // Wait for Amo Arena to load - use more specific selectors
    await expect(page.locator('button:has-text("Oda Oluştur")')).toBeVisible();
    await expect(page.locator('button:has-text("Odaya Katıl")')).toBeVisible();
  });

  test('Can create a room', async ({ page }) => {
    // Navigate to Amo Arena
    await page.click('text=Amo Arena');

    // Click Create Room
    await page.click('text=Oda Oluştur');

    // Fill nickname
    await page.fill('input[placeholder*="Alex"]', 'TestPlayer');

    // Select solo mode (default)
    await page.click('text=Oda Oluştur →');

    // Should see lobby
    await expect(page.locator('text=ODA KODU')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=TestPlayer')).toBeVisible();
  });

  test('Room code is displayed', async ({ page }) => {
    // Create room
    await page.click('text=Amo Arena');
    await page.click('text=Oda Oluştur');
    await page.fill('input[placeholder*="Alex"]', 'Host');
    await page.click('text=Oda Oluştur →');

    // Get room code
    const roomCode = await page.locator('.room-code-panel strong').textContent();
    expect(roomCode).toHaveLength(6);
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
  });

  test('CSS styles are loaded correctly', async ({ page }) => {
    await page.click('text=Amo Arena');

    // Check background color (should have gradient)
    const bg = await page.locator('.app').evaluate(el =>
      window.getComputedStyle(el).background
    );
    expect(bg).toBeTruthy();

    // Check if ambient elements exist
    await expect(page.locator('.ambient.a1')).toBeVisible();
    await expect(page.locator('.ambient.a2')).toBeVisible();
  });

  test('Can join room with code', async ({ page, context }) => {
    // Open two pages (host and guest)
    const hostPage = page;
    const guestPage = await context.newPage();

    // Host creates room
    await hostPage.goto('http://localhost:5175');
    await hostPage.click('text=Amo Arena');
    await hostPage.click('text=Oda Oluştur');
    await hostPage.fill('input[placeholder*="Alex"]', 'Host');
    await hostPage.click('text=Oda Oluştur →');

    // Get room code
    const roomCode = await hostPage.locator('.room-code-panel strong').textContent();

    // Guest joins
    await guestPage.goto('http://localhost:5175');
    await guestPage.click('text=Amo Arena');
    await guestPage.click('text=Odaya Katıl');
    await guestPage.fill('input[placeholder="A3F9X2"]', roomCode || '');
    await guestPage.fill('input[placeholder*="Alex"]', 'Guest');
    await guestPage.click('text=Odaya Katıl →');

    // Both should see each other - use class selectors to avoid strict mode violations
    await expect(hostPage.locator('.player-name:has-text("Guest")')).toBeVisible({ timeout: 5000 });
    await expect(guestPage.locator('.player-name:has-text("Host")')).toBeVisible({ timeout: 5000 });

    await guestPage.close();
  });
});
