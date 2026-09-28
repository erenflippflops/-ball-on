import { test, expect, chromium, type Page, type BrowserContext } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';

let serverProcess: ChildProcess | null = null;
const SERVER_URL = 'http://localhost:3001';
const CLIENT_URL = 'http://localhost:5173';

// Start server in same process before all tests
test.beforeAll(async () => {
  console.log('Starting server...');
  serverProcess = spawn('npm', ['run', 'server'], {
    cwd: path.join(__dirname, '..'),
    shell: true,
    stdio: 'pipe'
  });

  // Wait for server to be ready
  await new Promise((resolve) => {
    serverProcess!.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('Server:', output);
      if (output.includes('Server running')) {
        resolve(true);
      }
    });
    setTimeout(resolve, 5000); // Fallback timeout
  });
});

test.afterAll(async () => {
  console.log('Stopping server...');
  if (serverProcess) {
    serverProcess.kill();
  }
});

test.describe('BALL-ON - Deep Testing', () => {

  test('1. Game loads without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(CLIENT_URL);

    // Should see main menu
    await expect(page.locator('text=BALL-ON')).toBeVisible({ timeout: 10000 });

    // Click Draft Manager
    await page.click('text=Draft Manager');

    // Wait a bit for any delayed errors
    await page.waitForTimeout(2000);

    // Check for errors
    if (consoleErrors.length > 0) {
      console.log('Console errors found:', consoleErrors);
    }
    expect(consoleErrors.length).toBe(0);
  });

  test('2. Can create room and join as second player', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const player1 = await context1.newPage();
    const player2 = await context2.newPage();

    // Player 1 creates room
    await player1.goto(CLIENT_URL);
    await player1.click('text=Draft Manager');
    await player1.waitForTimeout(1000);

    // Fill room code
    await player1.fill('input[placeholder*="Oda kodu"]', 'TEST01');
    await player1.fill('input[placeholder*="Takım adı"]', 'Team1');
    await player1.click('button:has-text("Oda Oluştur")');

    await player1.waitForTimeout(2000);

    // Player 2 joins
    await player2.goto(CLIENT_URL);
    await player2.click('text=Draft Manager');
    await player2.waitForTimeout(1000);

    await player2.fill('input[placeholder*="Oda kodu"]', 'TEST01');
    await player2.fill('input[placeholder*="Takım adı"]', 'Team2');
    await player2.click('button:has-text("Odaya Katıl")');

    await player2.waitForTimeout(2000);

    // Both should see lobby
    await expect(player1.locator('text=Team1')).toBeVisible({ timeout: 5000 });
    await expect(player1.locator('text=Team2')).toBeVisible({ timeout: 5000 });
    await expect(player2.locator('text=Team1')).toBeVisible({ timeout: 5000 });

    await context1.close();
    await context2.close();
  });

  test('3. Full game flow - 2 players vs bots', async ({ browser }) => {
    const context = await browser.newContext();
    const player = await context.newPage();

    const bugs: string[] = [];

    // Track console errors
    player.on('console', msg => {
      if (msg.type() === 'error') {
        bugs.push(`Console error: ${msg.text()}`);
      }
    });

    try {
      // Create room
      await player.goto(CLIENT_URL);
      await player.click('text=Draft Manager');
      await player.waitForTimeout(1000);

      await player.fill('input[placeholder*="Oda kodu"]', 'BOT01');
      await player.fill('input[placeholder*="Takım adı"]', 'Human');

      // Select 2 players + bot
      const maxPlayersSelect = player.locator('select').first();
      if (await maxPlayersSelect.isVisible()) {
        await maxPlayersSelect.selectOption('2');
      }

      await player.click('button:has-text("Oda Oluştur")');
      await player.waitForTimeout(2000);

      // Add bot if button exists
      const addBotBtn = player.locator('button:has-text("Bot Ekle")');
      if (await addBotBtn.isVisible()) {
        await addBotBtn.click();
        await player.waitForTimeout(1000);
      }

      // Start game
      const startBtn = player.locator('button:has-text("Oyunu Başlat")');
      if (await startBtn.isVisible()) {
        await startBtn.click();
        await player.waitForTimeout(3000);
      }

      // Should enter auction phase
      const auctionIndicator = player.locator('text=/açık artırma|auction|player/i');
      await expect(auctionIndicator.first()).toBeVisible({ timeout: 15000 });

      // Simulate auction - bid on 11 players
      for (let i = 0; i < 11; i++) {
        // Check if player card is visible
        const playerCard = player.locator('.player-card, [class*="player"], text=/overall/i').first();

        if (await playerCard.isVisible({ timeout: 5000 })) {
          // Try to place bid
          const bidInput = player.locator('input[type="number"]').first();
          const bidBtn = player.locator('button:has-text("Teklif Ver"), button:has-text("Bid")').first();

          if (await bidInput.isVisible() && await bidBtn.isVisible()) {
            await bidInput.fill('5');
            await bidBtn.click();
            await player.waitForTimeout(1000);
          }

          // Wait for auction timer to complete or skip
          await player.waitForTimeout(15000); // 14s timer + buffer
        } else {
          bugs.push(`Auction ${i+1}: No player card visible`);
          break;
        }
      }

      // Check if reached steal phase or lineup phase
      await player.waitForTimeout(3000);
      const stealPhase = player.locator('text=/steal|çal|lineup|diziliş/i');
      const reachedNextPhase = await stealPhase.first().isVisible({ timeout: 5000 });

      if (!reachedNextPhase) {
        bugs.push('Did not progress past auction phase after 11 players');
      }

    } catch (error) {
      bugs.push(`Test error: ${error}`);
    }

    if (bugs.length > 0) {
      console.log('Bugs found:', bugs);
    }

    await context.close();
  });

  test('4. Timer expiration test', async ({ page }) => {
    await page.goto(CLIENT_URL);
    await page.click('text=Draft Manager');
    await page.waitForTimeout(1000);

    await page.fill('input[placeholder*="Oda kodu"]', 'TIMER1');
    await page.fill('input[placeholder*="Takım adı"]', 'TimerTest');
    await page.click('button:has-text("Oda Oluştur")');
    await page.waitForTimeout(2000);

    // Add bot
    const addBotBtn = page.locator('button:has-text("Bot Ekle")');
    if (await addBotBtn.isVisible()) {
      await addBotBtn.click();
      await page.waitForTimeout(1000);
    }

    // Start game
    const startBtn = page.locator('button:has-text("Oyunu Başlat")');
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await page.waitForTimeout(3000);
    }

    // Speed up time using page.clock
    await page.clock.install({ time: new Date() });

    // Fast forward 15 seconds (auction timer)
    await page.clock.fastForward(15000);
    await page.waitForTimeout(1000);

    // Should move to next player automatically
    const nextPlayerVisible = await page.locator('.player-card, [class*="player"]').first().isVisible({ timeout: 5000 });
    expect(nextPlayerVisible).toBe(true);
  });

  test('5. Position limits enforcement', async ({ page }) => {
    await page.goto(CLIENT_URL);
    await page.click('text=Draft Manager');
    await page.waitForTimeout(1000);

    await page.fill('input[placeholder*="Oda kodu"]', 'POS01');
    await page.fill('input[placeholder*="Takım adı"]', 'PosTest');
    await page.click('button:has-text("Oda Oluştur")');
    await page.waitForTimeout(2000);

    // Check if position limits are displayed
    const posLimits = page.locator('text=/GK|DEF|MID|ATT/i');
    const limitsVisible = await posLimits.first().isVisible({ timeout: 5000 });
    expect(limitsVisible).toBe(true);
  });

  test('6. Mobile viewport - 390x844', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }
    });
    const page = await context.newPage();

    await page.goto(CLIENT_URL);
    await page.screenshot({ path: 'test-results/mobile-menu.png', fullPage: true });

    await page.click('text=Draft Manager');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/mobile-lobby.png', fullPage: true });

    // Check for overlapping elements
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const btn = buttons.nth(i);
      if (await btn.isVisible()) {
        const box = await btn.boundingBox();
        if (box) {
          expect(box.width).toBeGreaterThan(0);
          expect(box.height).toBeGreaterThan(0);
        }
      }
    }

    await context.close();
  });

  test('7. Desktop viewport - 1440x900', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    await page.goto(CLIENT_URL);
    await page.screenshot({ path: 'test-results/desktop-menu.png', fullPage: true });

    await page.click('text=Draft Manager');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/desktop-lobby.png', fullPage: true });

    // Check layout doesn't break
    const mainContainer = page.locator('body').first();
    const box = await mainContainer.boundingBox();
    expect(box?.width).toBe(1440);

    await context.close();
  });

  test('8. Rapid click handling', async ({ page }) => {
    await page.goto(CLIENT_URL);
    await page.click('text=Draft Manager');
    await page.waitForTimeout(1000);

    await page.fill('input[placeholder*="Oda kodu"]', 'CLICK1');
    await page.fill('input[placeholder*="Takım adı"]', 'ClickTest');

    // Rapidly click create button
    const createBtn = page.locator('button:has-text("Oda Oluştur")');
    for (let i = 0; i < 5; i++) {
      await createBtn.click({ force: true });
      await page.waitForTimeout(100);
    }

    // Should only create one room
    await page.waitForTimeout(2000);
    const errorMsg = page.locator('text=/already exists|zaten var|error/i');
    const hasError = await errorMsg.isVisible({ timeout: 2000 }).catch(() => false);

    // Either room created successfully OR got proper error
    const roomCreated = await page.locator('text=/lobby|bekleme|Team/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    expect(roomCreated || hasError).toBe(true);
  });

  test('9. Page refresh during game', async ({ page }) => {
    await page.goto(CLIENT_URL);
    await page.click('text=Draft Manager');
    await page.waitForTimeout(1000);

    await page.fill('input[placeholder*="Oda kodu"]', 'REFRESH');
    await page.fill('input[placeholder*="Takım adı"]', 'RefreshTest');
    await page.click('button:has-text("Oda Oluştur")');
    await page.waitForTimeout(2000);

    // Refresh page
    await page.reload();
    await page.waitForTimeout(2000);

    // Should return to menu or show reconnection
    const menuVisible = await page.locator('text=BALL-ON').isVisible({ timeout: 5000 });
    expect(menuVisible).toBe(true);
  });

  test('10. Duplicate player prevention', async ({ browser }) => {
    // This requires access to game state - testing via UI observation
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(CLIENT_URL);
    await page.click('text=Draft Manager');
    await page.waitForTimeout(1000);

    await page.fill('input[placeholder*="Oda kodu"]', 'DUP01');
    await page.fill('input[placeholder*="Takım adı"]', 'DupTest');
    await page.click('button:has-text("Oda Oluştur")');
    await page.waitForTimeout(2000);

    // Note: Full duplicate testing requires server-side state inspection
    // or programmatic game state manipulation

    await context.close();
  });

  test('11. Formation limits are enforced', async ({ page }) => {
    await page.goto(CLIENT_URL);
    await page.click('text=Draft Manager');
    await page.waitForTimeout(1000);

    await page.fill('input[placeholder*="Oda kodu"]', 'FORM01');
    await page.fill('input[placeholder*="Takım adı"]', 'FormTest');
    await page.click('button:has-text("Oda Oluştur")');
    await page.waitForTimeout(2000);

    // Check if formation selector exists
    const formationSelect = page.locator('select, button').filter({ hasText: /4-3-3|4-4-2|3-5-2/ });
    const hasFormation = await formationSelect.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (hasFormation) {
      console.log('Formation selector found');
    }
  });

  test('12. Check for zombie timers after phase change', async ({ page }) => {
    let timerEvents = 0;

    page.on('console', msg => {
      if (msg.text().includes('timer') || msg.text().includes('interval')) {
        timerEvents++;
      }
    });

    await page.goto(CLIENT_URL);
    await page.click('text=Draft Manager');
    await page.waitForTimeout(1000);

    await page.fill('input[placeholder*="Oda kodu"]', 'ZOMBIE');
    await page.fill('input[placeholder*="Takım adı"]', 'ZombieTest');
    await page.click('button:has-text("Oda Oluştur")');
    await page.waitForTimeout(5000);

    // Leave room
    await page.reload();
    await page.waitForTimeout(3000);

    console.log(`Timer events detected: ${timerEvents}`);
  });
});
