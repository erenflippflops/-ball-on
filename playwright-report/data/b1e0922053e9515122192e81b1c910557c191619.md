# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: amo-arena.spec.ts >> Amo Arena UI Tests >> CSS styles are loaded correctly
- Location: tests\amo-arena.spec.ts:55:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('.ambient.a1')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" locator('.ambient.a1') with timeout 5000ms
  - waiting for locator('.ambient.a1')
    14 × locator resolved to <div class="ambient a1"></div>
       - unexpected value "hidden"

```

```yaml
- main:
  - button "Amo Arena ana menü": A AMO ARENA
  - text: CANLI OYUN
  - paragraph: REAL-TIME FOOTBALL TRIVIA
  - heading "Stadyum senin. Bilgi senin silahın." [level=1]:
    - text: Stadyum senin.
    - emphasis: Bilgi
    - text: senin silahın.
  - paragraph: Amo Arena’da 2–6 oyuncu, 10 tur ve 7 farklı oyun mekaniğiyle futbol bilgisini sahaya taşı.
  - button "Oda Oluştur →"
  - button "Odaya Katıl ↗"
  - text: 10 TUR7 SORU TİPİ6 OYUNCU MCQTOP 5MATCHFORMATION ⚽ OYUN DURUMU
  - strong:
    - text: Her cevap
    - emphasis: bir hamle.
  - text: AMO ARENAFutbol bilgini sahaya çıkar.
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Amo Arena UI Tests', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Start local dev server first (npm run dev:all)
  6  |     await page.goto('http://localhost:5175');
  7  |   });
  8  | 
  9  |   test('Main menu shows both game options', async ({ page }) => {
  10 |     await expect(page.locator('text=BALL-ON')).toBeVisible();
  11 |     await expect(page.locator('text=Draft Manager')).toBeVisible();
  12 |     await expect(page.locator('text=Amo Arena')).toBeVisible();
  13 |   });
  14 | 
  15 |   test('Can navigate to Amo Arena', async ({ page }) => {
  16 |     // Click Amo Arena button
  17 |     await page.click('text=Amo Arena');
  18 | 
  19 |     // Wait for Amo Arena to load - use more specific selectors
  20 |     await expect(page.locator('button:has-text("Oda Oluştur")')).toBeVisible();
  21 |     await expect(page.locator('button:has-text("Odaya Katıl")')).toBeVisible();
  22 |   });
  23 | 
  24 |   test('Can create a room', async ({ page }) => {
  25 |     // Navigate to Amo Arena
  26 |     await page.click('text=Amo Arena');
  27 | 
  28 |     // Click Create Room
  29 |     await page.click('text=Oda Oluştur');
  30 | 
  31 |     // Fill nickname
  32 |     await page.fill('input[placeholder*="Alex"]', 'TestPlayer');
  33 | 
  34 |     // Select solo mode (default)
  35 |     await page.click('text=Oda Oluştur →');
  36 | 
  37 |     // Should see lobby
  38 |     await expect(page.locator('text=ODA KODU')).toBeVisible({ timeout: 10000 });
  39 |     await expect(page.locator('text=TestPlayer')).toBeVisible();
  40 |   });
  41 | 
  42 |   test('Room code is displayed', async ({ page }) => {
  43 |     // Create room
  44 |     await page.click('text=Amo Arena');
  45 |     await page.click('text=Oda Oluştur');
  46 |     await page.fill('input[placeholder*="Alex"]', 'Host');
  47 |     await page.click('text=Oda Oluştur →');
  48 | 
  49 |     // Get room code
  50 |     const roomCode = await page.locator('.room-code-panel strong').textContent();
  51 |     expect(roomCode).toHaveLength(6);
  52 |     expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
  53 |   });
  54 | 
  55 |   test('CSS styles are loaded correctly', async ({ page }) => {
  56 |     await page.click('text=Amo Arena');
  57 | 
  58 |     // Check background color (should have gradient)
  59 |     const bg = await page.locator('.app').evaluate(el =>
  60 |       window.getComputedStyle(el).background
  61 |     );
  62 |     expect(bg).toBeTruthy();
  63 | 
  64 |     // Check if ambient elements exist
> 65 |     await expect(page.locator('.ambient.a1')).toBeVisible();
     |                                               ^ Error: expect(locator).toBeVisible() failed
  66 |     await expect(page.locator('.ambient.a2')).toBeVisible();
  67 |   });
  68 | 
  69 |   test('Can join room with code', async ({ page, context }) => {
  70 |     // Open two pages (host and guest)
  71 |     const hostPage = page;
  72 |     const guestPage = await context.newPage();
  73 | 
  74 |     // Host creates room
  75 |     await hostPage.goto('http://localhost:5175');
  76 |     await hostPage.click('text=Amo Arena');
  77 |     await hostPage.click('text=Oda Oluştur');
  78 |     await hostPage.fill('input[placeholder*="Alex"]', 'Host');
  79 |     await hostPage.click('text=Oda Oluştur →');
  80 | 
  81 |     // Get room code
  82 |     const roomCode = await hostPage.locator('.room-code-panel strong').textContent();
  83 | 
  84 |     // Guest joins
  85 |     await guestPage.goto('http://localhost:5175');
  86 |     await guestPage.click('text=Amo Arena');
  87 |     await guestPage.click('text=Odaya Katıl');
  88 |     await guestPage.fill('input[placeholder="A3F9X2"]', roomCode || '');
  89 |     await guestPage.fill('input[placeholder*="Alex"]', 'Guest');
  90 |     await guestPage.click('text=Odaya Katıl →');
  91 | 
  92 |     // Both should see each other - use class selectors to avoid strict mode violations
  93 |     await expect(hostPage.locator('.player-name:has-text("Guest")')).toBeVisible({ timeout: 5000 });
  94 |     await expect(guestPage.locator('.player-name:has-text("Host")')).toBeVisible({ timeout: 5000 });
  95 | 
  96 |     await guestPage.close();
  97 |   });
  98 | });
  99 | 
```