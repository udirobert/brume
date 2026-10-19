// e2e/tests/authentication.test.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should allow user to register with email', async ({ page }) => {
    await page.goto('/');
    
    // Click on the register button
    await page.getByRole('button', { name: 'Get Started' }).click();
    
    // Fill in registration form
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('SecurePassword123!');
    await page.getByLabel('Confirm Password').fill('SecurePassword123!');
    
    // Submit the form
    await page.getByRole('button', { name: 'Register' }).click();
    
    // Verify successful registration
    await expect(page.getByText('Welcome to Brume')).toBeVisible();
    await expect(page.getByText('test@example.com')).toBeVisible();
  });

  test('should allow user to login with email', async ({ page }) => {
    await page.goto('/login');
    
    // Fill in login form
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('SecurePassword123!');
    
    // Submit the form
    await page.getByRole('button', { name: 'Login' }).click();
    
    // Verify successful login
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByText('test@example.com')).toBeVisible();
  });

  test('should allow user to login with wallet', async ({ page }) => {
    await page.goto('/login');
    
    // Click on wallet login button
    await page.getByRole('button', { name: 'Connect Wallet' }).click();
    
    // Mock wallet connection (in a real test, you would interact with a wallet provider)
    // For now, we'll just check that the wallet connection flow starts
    await expect(page.getByText('Connect to your wallet')).toBeVisible();
  });

  test('should allow user to login with Lens Protocol', async ({ page }) => {
    await page.goto('/login');
    
    // Click on Lens login button
    await page.getByRole('button', { name: 'Connect with Lens' }).click();
    
    // Mock Lens connection (in a real test, you would interact with Lens)
    // For now, we'll just check that the Lens connection flow starts
    await expect(page.getByText('Connect to Lens Protocol')).toBeVisible();
  });

  test('should allow user to login with Flow', async ({ page }) => {
    await page.goto('/login');
    
    // Click on Flow login button
    await page.getByRole('button', { name: 'Connect with Flow' }).click();
    
    // Mock Flow connection (in a real test, you would interact with Flow)
    // For now, we'll just check that the Flow connection flow starts
    await expect(page.getByText('Connect to Flow')).toBeVisible();
  });
});