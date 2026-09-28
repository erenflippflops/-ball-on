import { test, expect } from '@playwright/test';

test.describe('Amo Arena UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Main menu shows both game options', async ({ page }) => {
    await expect(page.locator('text=BALL-ON')).toBeVisible();
    await expect(page.locator('text=Draft Manager')).toBeVisible();
    await expect(page.locator('text=Amo Arena')).toBeVisible();
  });

  test('Can navigate to Amo Arena', async ({ page }) => {
    await page.click('text=Amo Arena');
    await expect(page.locator('button:has-text("Oda Oluştur")')).toBeVisible();
    await expect(page.locator('button:has-text("Odaya Katıl")')).toBeVisible();
  });

  test('Can create a room', async ({ page }) => {
    await page.click('text=Amo Arena');
    await page.click('text=Oda Oluştur');
    await page.fill('input[placeholder*="Alex"]', 'TestPlayer');
    await page.click('text=Oda Oluştur →');
    await expect(page.locator('text=ODA KODU')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=TestPlayer')).toBeVisible();
  });

  test('Room code is displayed', async ({ page }) => {
    await page.click('text=Amo Arena');
    await page.click('text=Oda Oluştur');
    await page.fill('input[placeholder*="Alex"]', 'Host');
    await page.click('text=Oda Oluştur →');
    const roomCode = await page.locator('.room-code-panel strong').textContent();
    expect(roomCode).toHaveLength(6);
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
  });

  test('CSS styles are loaded correctly', async ({ page }) => {
    await page.click('text=Amo Arena');
    const bg = await page.locator('.app').evaluate(el =>
      window.getComputedStyle(el).background
    );
    expect(bg).toBeTruthy();
    await expect(page.locator('.ambient.a1')).toBeVisible();
    await expect(page.locator('.ambient.a2')).toBeVisible();
  });

  test('Can join room with code', async ({ page, context }) => {
    const hostPage = page;
    const guestPage = await context.newPage();

    await hostPage.goto('/');
    await hostPage.click('text=Amo Arena');
    await hostPage.click('text=Oda Oluştur');
    await hostPage.fill('input[placeholder*="Alex"]', 'Host');
    await hostPage.click('text=Oda Oluştur →');
    const roomCode = await hostPage.locator('.room-code-panel strong').textContent();

    await guestPage.goto('/');
    await guestPage.click('text=Amo Arena');
    await guestPage.click('text=Odaya Katıl');
    await guestPage.fill('input[placeholder="A3F9X2"]', roomCode || '');
    await guestPage.fill('input[placeholder*="Alex"]', 'Guest');
    await guestPage.click('text=Odaya Katıl →');

    await expect(hostPage.locator('.player-name:has-text("Guest")')).toBeVisible({ timeout: 5000 });
    await expect(guestPage.locator('.player-name:has-text("Host")')).toBeVisible({ timeout: 5000 });

    await guestPage.close();
  });
});
