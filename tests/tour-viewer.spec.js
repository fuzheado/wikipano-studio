/**
 * Tour Viewer Tests — Photosphere Tour Viewer
 *
 * Validates URL parameter handling, scene navigation, and basic viewer behavior.
 * Complements studio-behaviors.spec.js (which covers the Studio editor).
 *
 * Run with:
 *   cd prototype && node tour_server.mjs   # start server first
 *   npx playwright test tests/tour-viewer.spec.js
 *
 * Requires:
 *   - Node.js + @playwright/test
 *   - Server running at http://localhost:8765
 */

const { test, expect } = require('@playwright/test');

const PORT = process.env.PHOTOSPHERE_TEST_PORT || 8765;
const BASE = `http://localhost:${PORT}`;
const VIEWER = `${BASE}/tour_viewer.html`;

// Demo tour on Commons
const DEMO_PAGE = 'User:Fuzheado/Panellum_Tour';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for the tour to fully load (status bar shows success). */
async function waitForViewerReady(page) {
    await page.waitForFunction(() => {
        const status = document.getElementById('status');
        return status && status.textContent.includes('Tour loaded successfully');
    }, { timeout: 30000 });
}

/** Wait for the status bar to show a message matching `text`. */
async function waitForStatus(page, text, timeout = 15000) {
    await page.waitForFunction(
        (t) => document.getElementById('status')?.textContent?.includes(t),
        text,
        { timeout }
    );
}

/** Return the scene ID currently active in the viewer. */
async function getCurrentScene(page) {
    // currentScene is declared with let (not on window), so we check the
    // active scene list item instead — it's always kept in sync.
    return page.evaluate(() => {
        const active = document.querySelector('.scene-list li.active .name');
        if (!active) return null;
        // Match the scene name back to its ID via the onclick attribute
        const li = active.closest('li');
        const onclick = li?.getAttribute('onclick') || '';
        const match = onclick.match(/switchToScene\('([^']+)'/);
        return match ? match[1] : active.textContent.trim();
    });
}

/** Return the list of scene IDs rendered in the sidebar. */
async function getSceneListIds(page) {
    return page.evaluate(() => {
        return Array.from(document.querySelectorAll('.scene-list li'))
            .map(li => {
                const onclick = li.getAttribute('onclick') || '';
                const match = onclick.match(/switchToScene\('([^']+)'\)/);
                return match ? match[1] : null;
            })
            .filter(Boolean);
    });
}

// ---------------------------------------------------------------------------
// 1. Hash-based loading (legacy, must keep working)
// ---------------------------------------------------------------------------

test.describe('Hash-based loading', () => {

    test('loads tour from #PageTitle', async ({ page }) => {
        await page.goto(`${VIEWER}#${DEMO_PAGE}`);
        await waitForViewerReady(page);

        const scene = await getCurrentScene(page);
        expect(scene).toBeTruthy();

        const ids = await getSceneListIds(page);
        expect(ids.length).toBeGreaterThanOrEqual(2);
        expect(ids).toContain('Museum');
        expect(ids).toContain('Road Outside');
    });

    test('shows tour info (author, scene count)', async ({ page }) => {
        await page.goto(`${VIEWER}#${DEMO_PAGE}`);
        await waitForViewerReady(page);

        const info = page.locator('#tourInfo');
        await expect(info).toBeVisible();
        await expect(info).toContainText('Andrew Lih');
        await expect(info).toContainText('2');
    });

});

// ---------------------------------------------------------------------------
// 2. Query string ?page= loading
// ---------------------------------------------------------------------------

test.describe('?page= parameter', () => {

    test('loads tour from ?page=', async ({ page }) => {
        await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}`);
        await waitForViewerReady(page);

        const scene = await getCurrentScene(page);
        expect(scene).toBeTruthy();

        // Input should be populated with the page title
        const input = await page.inputValue('#tourInput');
        expect(input).toBe(DEMO_PAGE);
    });

    test('input field reflects the ?page= value', async ({ page }) => {
        const pageParam = 'User:Fuzheado/Panellum_Tour.json';
        await page.goto(`${VIEWER}?page=${encodeURIComponent(pageParam)}`);
        await waitForViewerReady(page);

        const input = await page.inputValue('#tourInput');
        expect(input).toBe(pageParam);
    });

});

// ---------------------------------------------------------------------------
// 3. Query string ?scene= jumping
// ---------------------------------------------------------------------------

test.describe('?scene= parameter', () => {

    test('jumps to specified scene after loading', async ({ page }) => {
        // Museum is the non-default scene in this tour (firstScene is Road Outside)
        await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}&scene=Museum`);
        await waitForViewerReady(page);
        await page.waitForTimeout(1000);

        const scene = await getCurrentScene(page);
        expect(scene).toBe('Museum');
    });

    test('works with first scene too', async ({ page }) => {
        // Road Outside is the firstScene in this tour's config
        await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}&scene=Road%20Outside`);
        await waitForViewerReady(page);
        await page.waitForTimeout(500);

        const scene = await getCurrentScene(page);
        expect(scene).toBe('Road Outside');
    });

    test('?scene= works alongside hash-based loading', async ({ page }) => {
        await page.goto(`${VIEWER}?scene=Museum#${DEMO_PAGE}`);
        await waitForViewerReady(page);
        await page.waitForTimeout(1000);

        const scene = await getCurrentScene(page);
        expect(scene).toBe('Museum');
    });

    test('ignores invalid scene ID gracefully', async ({ page }) => {
        await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}&scene=NonExistent`);
        await waitForViewerReady(page);
        await page.waitForTimeout(500);

        // Should load the first scene (default) since target doesn't exist
        const scene = await getCurrentScene(page);
        expect(scene).toBe('Road Outside');
    });

});

// ---------------------------------------------------------------------------
// 4. Sidebar scene switching
// ---------------------------------------------------------------------------

test.describe('Sidebar navigation', () => {

    test('clicking a scene in the sidebar switches to it', async ({ page }) => {
        await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}`);
        await waitForViewerReady(page);

        // Verify we start on Road Outside (the firstScene in config)
        const initial = await getCurrentScene(page);
        expect(initial).toBe('Road Outside');

        // Click "Museum" in the sidebar
        const museumItem = page.locator('.scene-list li', { hasText: 'Banned Books Museum' });
        await expect(museumItem).toBeVisible();
        await museumItem.click();

        // Wait for scene change
        await page.waitForTimeout(1000);

        const after = await getCurrentScene(page);
        expect(after).toBe('Museum');
    });

    test('active class updates when scene changes', async ({ page }) => {
        await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}`);
        await waitForViewerReady(page);

        // Road Outside should have active class (it's the firstScene)
        const activeBefore = page.locator('.scene-list li.active');
        const textBefore = await activeBefore.textContent();
        expect(textBefore).toContain('Road in Vanalinn');

        // Click the other scene
        await page.locator('.scene-list li', { hasText: 'Banned Books Museum' }).click();
        await page.waitForTimeout(1000);

        const activeAfter = page.locator('.scene-list li.active');
        const textAfter = await activeAfter.textContent();
        expect(textAfter).toContain('Banned Books Museum');
    });

});

// ---------------------------------------------------------------------------
// 5. Status messages
// ---------------------------------------------------------------------------

test.describe('Status bar', () => {

    test('shows success status after load', async ({ page }) => {
        await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}`);
        await waitForStatus(page, 'Tour loaded successfully');

        const statusClass = await page.locator('#status').getAttribute('class');
        expect(statusClass).toContain('ok');
    });

    test('shows error for invalid page', async ({ page }) => {
        await page.goto(`${VIEWER}?page=NonExistent/Page_That_Does_Not_Exist`);
        await waitForStatus(page, 'Error', 15000);

        const statusClass = await page.locator('#status').getAttribute('class');
        expect(statusClass).toContain('error');
    });

});

// ---------------------------------------------------------------------------
// 6. Pannellum viewer state
// ---------------------------------------------------------------------------

test.describe('Viewer state', () => {

    test('Pannellum viewer is loaded after page load', async ({ page }) => {
        await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}`);
        await waitForViewerReady(page);

        // Verify Pannellum loaded by checking for its render container
        const hasCanvas = await page.evaluate(() => {
            return document.querySelector('.pnlm-render-container') !== null;
        });
        expect(hasCanvas).toBe(true);
    });

    test('tourData is populated after load', async ({ page }) => {
        await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}`);
        await waitForViewerReady(page);

        // Verify tour data by checking scene list has items
        const sceneCount = await page.locator('.scene-list li').count();
        expect(sceneCount).toBeGreaterThanOrEqual(2);
    });

    test('firstScene from config is respected', async ({ page }) => {
        await page.goto(`${VIEWER}?page=${encodeURIComponent(DEMO_PAGE)}`);
        await waitForViewerReady(page);

        // Road Outside is the firstScene in this tour's config
        const current = await getCurrentScene(page);
        expect(current).toBe('Road Outside');
    });

});
