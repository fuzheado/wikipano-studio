/**
 * FR-16: Immersive Mode Stickiness Tests
 *
 * Validates that immersive mode follows the priority chain:
 *   1. URL ?mode= param (highest priority)
 *   2. Tour JSON default.viewMode
 *   3. Default to 'immersive' if neither specified
 *
 * And that localStorage persistence is REMOVED (no stickiness).
 *
 * Run with:
 *   cd prototype && node tour_server.mjs
 *   npx playwright test tests/immersive-mode.spec.js --project=chromium
 *
 * Requires:
 *   - Node.js + @playwright/test
 *   - Server running at http://localhost:8765
 */

const { test, expect } = require('@playwright/test');

const VIEWER = '/tour_viewer.html';

// Demo tour on Commons
const DEMO_PAGE = 'User:Fuzheado/Panellum_Tour';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if the body has the 'immersive' class.
 */
async function isImmersive(page) {
    return page.evaluate(() => document.body.classList.contains('immersive'));
}

/**
 * Wait for the viewer to fully load a tour (scene list has real scenes).
 */
async function waitForTourLoad(page) {
    // Wait until the scene list has at least one real scene (not the placeholder)
    await page.waitForFunction(() => {
        const items = document.querySelectorAll('.scene-list li');
        return Array.from(items).some(li => li.querySelector('.name'));
    }, { timeout: 20000 });
    await page.waitForTimeout(1000); // Let Pannellum finish initializing
}

/**
 * Clear all sessionStorage (simulates fresh session).
 */
async function clearSessionStorage(page) {
    await page.evaluate(() => sessionStorage.clear());
}

// ---------------------------------------------------------------------------
// Tests: Default Behavior (no URL param, no tour JSON viewMode)
// ---------------------------------------------------------------------------

test.describe('FR-16: Immersive Mode Non-Sticky Behavior', () => {

    test.describe('Default behavior (no overrides)', () => {

        test('starts in immersive mode by default', async ({ page }) => {
            await page.goto(VIEWER);
            await waitForTourLoad(page);

            // Should start immersive by default
            expect(await isImmersive(page)).toBe(true);
        });

        test('toggle button shows correct icon in immersive mode', async ({ page }) => {
            await page.goto(VIEWER);
            await waitForTourLoad(page);

            const toggleBtn = page.locator('#toggle-immersive-btn');
            await expect(toggleBtn).toHaveText('☰');
        });
    });

    // -----------------------------------------------------------------------
    // Tests: URL ?mode= Parameter
    // -----------------------------------------------------------------------

    test.describe('URL ?mode= parameter overrides', () => {

        test('?mode=detailed starts in detailed mode', async ({ page }) => {
            await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}&mode=detailed`);
            await waitForTourLoad(page);

            expect(await isImmersive(page)).toBe(false);
        });

        test('?mode=detailed shows × button icon', async ({ page }) => {
            await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}&mode=detailed`);
            await waitForTourLoad(page);

            const toggleBtn = page.locator('#toggle-immersive-btn');
            await expect(toggleBtn).toHaveText('×');
        });

        test('?mode=immersive starts in immersive mode', async ({ page }) => {
            await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}&mode=immersive`);
            await waitForTourLoad(page);

            expect(await isImmersive(page)).toBe(true);
        });

        test('?mode=invalid defaults to immersive', async ({ page }) => {
            await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}&mode=invalid`);
            await waitForTourLoad(page);

            // Invalid value should fall through to default (immersive)
            expect(await isImmersive(page)).toBe(true);
        });

        test('no ?mode= param defaults to immersive', async ({ page }) => {
            await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}`);
            await waitForTourLoad(page);

            expect(await isImmersive(page)).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Tests: Non-Sticky Behavior (No localStorage Persistence)
    // -----------------------------------------------------------------------

    test.describe('Non-sticky behavior (no persistence)', () => {

        test('toggle to detailed does NOT persist across page reload', async ({ page }) => {
            // Load tour
            await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}`);
            await waitForTourLoad(page);

            // Should start immersive
            expect(await isImmersive(page)).toBe(true);

            // Toggle to detailed
            await page.click('#toggle-immersive-btn');
            await page.waitForTimeout(500);

            // Now in detailed mode
            expect(await isImmersive(page)).toBe(false);

            // Reload the same URL (no ?mode= param)
            await page.reload();
            await waitForTourLoad(page);

            // Should be back to immersive (not sticky!)
            expect(await isImmersive(page)).toBe(true);
        });

        test('toggle to immersive does NOT persist across page reload', async ({ page }) => {
            // Start with ?mode=detailed
            await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}&mode=detailed`);
            await waitForTourLoad(page);

            // Should start detailed
            expect(await isImmersive(page)).toBe(false);

            // Toggle to immersive
            await page.click('#toggle-immersive-btn');
            await page.waitForTimeout(500);

            // Now immersive
            expect(await isImmersive(page)).toBe(true);

            // Reload with ?mode=detailed (URL param should win)
            await page.reload();
            await waitForTourLoad(page);

            // Should be detailed again (URL param wins, not last toggle)
            expect(await isImmersive(page)).toBe(false);
        });

        test('localStorage does NOT contain immersive preference', async ({ page }) => {
            await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}`);
            await waitForTourLoad(page);

            // Toggle a few times
            await page.click('#toggle-immersive-btn');
            await page.waitForTimeout(300);
            await page.click('#toggle-immersive-btn');
            await page.waitForTimeout(300);

            // Check localStorage - should NOT have 'immersive' key
            const hasImmersiveKey = await page.evaluate(() => {
                return localStorage.getItem('immersive') !== null;
            });

            expect(hasImmersiveKey).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // Tests: Keyboard Shortcut
    // -----------------------------------------------------------------------

    test.describe('Keyboard shortcuts', () => {

        test('Escape key toggles immersive mode', async ({ page }) => {
            await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}`);
            await waitForTourLoad(page);

            // Start immersive
            expect(await isImmersive(page)).toBe(true);

            // Press Escape
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);

            // Should toggle to detailed
            expect(await isImmersive(page)).toBe(false);

            // Press Escape again
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);

            // Should toggle back to immersive
            expect(await isImmersive(page)).toBe(true);
        });

        test('Escape does not trigger when typing in input', async ({ page }) => {
            await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}`);
            await waitForTourLoad(page);

            // Toggle to detailed mode so the input is visible
            await page.click('#toggle-immersive-btn');
            await page.waitForTimeout(500);
            expect(await isImmersive(page)).toBe(false);

            // Focus the input field
            await page.click('#tourInput');
            await page.waitForTimeout(200);

            // Press Escape while focused on input
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);

            // Should STILL be detailed (Escape ignored in input)
            expect(await isImmersive(page)).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // Tests: URL Param Precedence Over Tour JSON
    // -----------------------------------------------------------------------

    test.describe('URL param precedence', () => {

        test('URL ?mode= wins over tour JSON default.viewMode', async ({ page }) => {
            // The demo tour may or may not have viewMode set.
            // This test verifies URL param always wins.
            // We test with ?mode=detailed to ensure it's respected.
            await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}&mode=detailed`);
            await waitForTourLoad(page);

            // URL param says detailed → should be detailed
            expect(await isImmersive(page)).toBe(false);
        });

        test('URL ?mode=immersive overrides any tour JSON setting', async ({ page }) => {
            await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}&mode=immersive`);
            await waitForTourLoad(page);

            // URL param says immersive → should be immersive
            expect(await isImmersive(page)).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Tests: Button Functionality
    // -----------------------------------------------------------------------

    test.describe('Toggle button behavior', () => {

        test('click toggle button switches from immersive to detailed', async ({ page }) => {
            await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}`);
            await waitForTourLoad(page);

            // Start immersive
            expect(await isImmersive(page)).toBe(true);

            // Click toggle
            await page.click('#toggle-immersive-btn');
            await page.waitForTimeout(500);

            // Should be detailed
            expect(await isImmersive(page)).toBe(false);

            // Button should now show ×
            const toggleBtn = page.locator('#toggle-immersive-btn');
            await expect(toggleBtn).toHaveText('×');
        });

        test('click toggle button switches from detailed to immersive', async ({ page }) => {
            await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}&mode=detailed`);
            await waitForTourLoad(page);

            // Start detailed
            expect(await isImmersive(page)).toBe(false);

            // Click toggle
            await page.click('#toggle-immersive-btn');
            await page.waitForTimeout(500);

            // Should be immersive
            expect(await isImmersive(page)).toBe(true);

            // Button should now show ☰
            const toggleBtn = page.locator('#toggle-immersive-btn');
            await expect(toggleBtn).toHaveText('☰');
        });

        test('toggle button title updates correctly', async ({ page }) => {
            await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}`);
            await waitForTourLoad(page);

            // Immersive mode title
            const toggleBtn = page.locator('#toggle-immersive-btn');
            await expect(toggleBtn).toHaveAttribute('title', 'Show sidebar (Esc)');

            // Toggle to detailed
            await page.click('#toggle-immersive-btn');
            await page.waitForTimeout(500);

            // Detailed mode title
            await expect(toggleBtn).toHaveAttribute('title', 'Hide sidebar (Esc)');
        });
    });

    // -----------------------------------------------------------------------
    // Tests: Session-Only Persistence (Optional)
    // -----------------------------------------------------------------------

    test.describe('Session behavior', () => {

        test('mode persists within same session (no reload)', async ({ page }) => {
            await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}`);
            await waitForTourLoad(page);

            // Start immersive
            expect(await isImmersive(page)).toBe(true);

            // Toggle to detailed
            await page.click('#toggle-immersive-btn');
            await page.waitForTimeout(500);

            // Navigate to a different scene (same session)
            const firstScene = page.locator('.scene-list li').nth(1);
            if (await firstScene.isVisible()) {
                await firstScene.click();
                await page.waitForTimeout(1000);

                // Should STILL be detailed (mode persists within session)
                expect(await isImmersive(page)).toBe(false);
            }
        });
    });
});
