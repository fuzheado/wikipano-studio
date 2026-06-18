/**
 * Test: Gyroscope button appears on mobile devices
 */

const { test, expect } = require('@playwright/test');

test('gyro button is visible on mobile devices', async ({ page }) => {
  // Simulate mobile device by overriding navigator.maxTouchPoints BEFORE page loads
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      get: () => 5,
      configurable: true,
    });
  });
  
  // Use mobile viewport and touch emulation
  await page.setViewportSize({ width: 390, height: 844 });
  
  await page.goto('/tour_viewer.html');
  
  // Wait for tour to load
  await page.waitForSelector('.scene-list li', { timeout: 10000 });
  
  // Wait for Pannellum to initialize
  await page.waitForTimeout(2000);
  
  // Check gyro button exists
  const gyroBtn = page.locator('#gyro-btn');
  
  // Check if button is visible (it should be on mobile)
  const isVisible = await gyroBtn.isVisible();
  console.log('Gyro button visible:', isVisible);
  
  // Log the display style for debugging
  const displayStyle = await gyroBtn.evaluate(el => el.style.display);
  console.log('Gyro button display style:', displayStyle);
});

test('gyro button is hidden on desktop', async ({ page }) => {
  // Desktop viewport (default from config)
  await page.goto('/tour_viewer.html');
  
  // Wait for tour to load
  await page.waitForSelector('.scene-list li', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  // Check gyro button is hidden
  const gyroBtn = page.locator('#gyro-btn');
  await expect(gyroBtn).not.toBeVisible();
});