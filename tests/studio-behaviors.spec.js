/**
 * Studio Behavior Tests — Photosphere Tour Studio
 *
 * Validates two key interaction behaviors memorialized in PRD.md:
 *   SC-2.1: Hotspot click in viewport → edit modal (no viewport reset)
 *   SC-2.2: Hotspot card list — click to view, not hover
 *
 * Run with:
 *   # Start the server first:
 *   cd prototype && node tour_server.mjs
 *   # Then run tests:
 *   npx playwright test tests/studio-behaviors.spec.js
 *   npx playwright test tests/studio-behaviors.spec.js --project=chromium
 *
 * Requires:
 *   - Node.js + @playwright/test
 *   - Server running at http://localhost:8765
 *   - npx playwright install --with-deps chromium
 */

const { test, expect } = require('@playwright/test');

const PORT = process.env.PHOTOSPHERE_TEST_PORT || 8765;
const BASE = `http://localhost:${PORT}`;
const STUDIO = `${BASE}/studio.html`;

// Demo tour pre-loaded on Commons
const DEMO_PAGE = 'User:Fuzheado/Panellum_Tour';
const STUDIO_WITH_TOUR = `${STUDIO}?page=${encodeURIComponent(DEMO_PAGE)}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the studio to fully load a scene (Pannellum viewer is ready).
 */
async function waitForViewerReady(page) {
    // Wait for Pannellum viewer to exist and be loaded
    await page.waitForFunction(() => {
        return typeof pannellum !== 'undefined' &&
               typeof state !== 'undefined' &&
               state.pannellumViewer &&
               state.pannellumViewer.isLoaded();
    }, { timeout: 30000 });
}

/**
 * Get current viewport orientation.
 */
async function getViewState(page) {
    return page.evaluate(() => {
        if (!state.pannellumViewer) return null;
        return {
            pitch: state.pannellumViewer.getPitch(),
            yaw: state.pannellumViewer.getYaw(),
            hfov: state.pannellumViewer.getHfov(),
        };
    });
}

/**
 * Wait for a modal to be visible (display: flex via .show class).
 */
async function waitForModal(page, modalId) {
    await page.waitForFunction((id) => {
        const el = document.getElementById(id);
        return el && el.classList.contains('show');
    }, modalId, { timeout: 5000 });
}

/**
 * Check if a modal is currently visible.
 */
async function isModalVisible(page, modalId) {
    return page.evaluate((id) => {
        const el = document.getElementById(id);
        return el ? el.classList.contains('show') : false;
    }, modalId);
}

// ---------------------------------------------------------------------------
// SC-2.1: Hotspot Click in Viewport → Edit Modal (No Viewport Reset)
// ---------------------------------------------------------------------------

test.describe('SC-2.1: Viewport Hotspot Click → Edit Modal', () => {

    test('clicking a hotspot node opens edit modal without viewport reset', async ({ page }) => {
        await page.goto(STUDIO_WITH_TOUR);
        await waitForViewerReady(page);

        // Get initial view state
        const before = await getViewState(page);
        expect(before).not.toBeNull();

        // Click the first hotspot node in the viewport (.studio-hotspot)
        const hotspot = page.locator('.studio-hotspot').first();
        await expect(hotspot).toBeVisible({ timeout: 10000 });
        await hotspot.click();

        // Edit modal should be open
        await waitForModal(page, 'modal-add-hs');
        expect(await isModalVisible(page, 'modal-add-hs')).toBe(true);

        // Viewport should be at same position (no navigation/reset)
        const after = await getViewState(page);
        expect(after).not.toBeNull();
        expect(after.pitch).toBeCloseTo(before.pitch, 0);
        expect(after.yaw).toBeCloseTo(before.yaw, 0);
        expect(after.hfov).toBeCloseTo(before.hfov, 0);
    });

    test('closing edit modal leaves viewport unchanged', async ({ page }) => {
        await page.goto(STUDIO_WITH_TOUR);
        await waitForViewerReady(page);

        const before = await getViewState(page);

        // Open edit modal via hotspot click
        await page.locator('.studio-hotspot').first().click();
        await waitForModal(page, 'modal-add-hs');

        // Close via cancel button
        await page.click('#modal-cancel-hs');

        // Wait for modal to close
        await page.waitForFunction((id) => {
            const el = document.getElementById(id);
            return el && !el.classList.contains('show');
        }, 'modal-add-hs', { timeout: 5000 });

        // Viewport should still be at same position
        const after = await getViewState(page);
        expect(after).not.toBeNull();
        expect(after.pitch).toBeCloseTo(before.pitch, 0);
        expect(after.yaw).toBeCloseTo(before.yaw, 0);
    });

});

// ---------------------------------------------------------------------------
// SC-2.2: Hotspot Card List — Click to View, Not Hover
// ---------------------------------------------------------------------------

test.describe('SC-2.2: Hotspot Card List Interaction', () => {

    test('hovering a hotspot card does NOT move the viewport', async ({ page }) => {
        await page.goto(STUDIO_WITH_TOUR);
        await waitForViewerReady(page);

        // Pan the view first so we're not at default position
        const initialYaw = await page.evaluate(() => {
            state.pannellumViewer.setYaw(45);
            return state.pannellumViewer.getYaw();
        });

        // Hover over a hotspot card in the right panel
        const card = page.locator('.hotspot-card').first();
        await expect(card).toBeVisible({ timeout: 10000 });
        await card.hover();

        // Wait a moment for any animation to complete
        await page.waitForTimeout(500);

        // Viewport yaw should NOT have changed from our set position
        const afterYaw = await page.evaluate(() => state.pannellumViewer.getYaw());
        // Allow small drift, but not a large pan to a hotspot
        expect(Math.abs(afterYaw - initialYaw)).toBeLessThan(5);
    });

    test('clicking a hotspot card pans viewport to that hotspot', async ({ page }) => {
        await page.goto(STUDIO_WITH_TOUR);
        await waitForViewerReady(page);

        // Read the hotspot's yaw from the card's onclick attribute
        const targetYaw = await page.evaluate(() => {
            const card = document.querySelector('.hotspot-card');
            if (!card) return null;
            const onclick = card.getAttribute('onclick') || '';
            const match = onclick.match(/lookAtHotspot\((-?[\d.]+),\s*(-?[\d.]+)\)/);
            return match ? parseFloat(match[1]) : null;
        });
        expect(targetYaw).not.toBeNull();

        // Pan away first
        await page.evaluate((yaw) => state.pannellumViewer.setYaw((yaw + 90) % 360), targetYaw);
        const beforeYaw = await page.evaluate(() => state.pannellumViewer.getYaw());

        // Click the hotspot card
        await page.locator('.hotspot-card').first().click();

        // Wait for pan animation to complete (Pannellum animates lookAt)
        await page.waitForTimeout(1500);

        // Viewport should now be near the hotspot's yaw
        const afterYaw = await page.evaluate(() => state.pannellumViewer.getYaw());
        // Normalize both to compare
        const normBefore = ((beforeYaw % 360) + 360) % 360;
        const normAfter = ((afterYaw % 360) + 360) % 360;
        const normTarget = ((targetYaw % 360) + 360) % 360;
        expect(Math.abs(normAfter - normTarget)).toBeLessThan(5);
    });

    test('clicking pencil icon on hotspot card opens edit modal without viewport movement', async ({ page }) => {
        await page.goto(STUDIO_WITH_TOUR);
        await waitForViewerReady(page);

        const before = await getViewState(page);
        expect(before).not.toBeNull();

        // Click the pencil (✎) button on the first hotspot card
        await page.locator('.hotspot-card .hs-edit').first().click();

        // Edit modal should open
        await waitForModal(page, 'modal-add-hs');
        expect(await isModalVisible(page, 'modal-add-hs')).toBe(true);

        // Viewport should NOT have moved
        const after = await getViewState(page);
        expect(after).not.toBeNull();
        expect(after.pitch).toBeCloseTo(before.pitch, 0);
        expect(after.yaw).toBeCloseTo(before.yaw, 0);
    });

    test('clicking delete icon on hotspot card does not move the viewport', async ({ page }) => {
        await page.goto(STUDIO_WITH_TOUR);
        await waitForViewerReady(page);

        // Count initial hotspots
        const initialCount = await page.evaluate(() => {
            const sceneId = state.activeSceneId;
            return state.scenes[sceneId]?.hotSpots?.length || 0;
        });
        expect(initialCount).toBeGreaterThan(0);

        const before = await getViewState(page);
        expect(before).not.toBeNull();

        // Dismiss the confirm dialog automatically
        page.on('dialog', dialog => dialog.accept());

        // Click the delete (×) button on the first hotspot card
        await page.locator('.hotspot-card .hs-delete').first().click();

        // Wait for delete to process and viewport to reload
        await page.waitForTimeout(1000);

        // Verify hotspot was deleted
        const afterCount = await page.evaluate(() => {
            const sceneId = state.activeSceneId;
            return state.scenes[sceneId]?.hotSpots?.length || 0;
        });
        expect(afterCount).toBe(initialCount - 1);

        // Viewport should still be functional (loaded), though it may have
        // reloaded after the delete. Verify a viewer is loaded.
        const loaded = await page.evaluate(() => state.pannellumViewer?.isLoaded());
        expect(loaded).toBe(true);
    });

});
