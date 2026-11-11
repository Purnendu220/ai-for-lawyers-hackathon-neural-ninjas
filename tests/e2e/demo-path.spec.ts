import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// The blueprint §2 definition of done, clicked through in a browser against the emulators. The
// analysis is replayed from tests/integration/fixtures/recordings.json, so no AI is called.

const samplePdf = fileURLToPath(new URL('../../seed/samples/sample-order.pdf', import.meta.url));

/** A tab in the case workspace; the sidebar and the overview have links with the same names. */
const caseTab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Case sections' }).getByRole('link', { name, exact: true });

test('a court order becomes an approved task and a verified hearing', async ({ page }) => {
  const cspViolations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
      cspViolations.push(message.text());
    }
  });

  await test.step('sign up and create a workspace', async () => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Create an account' }).click();
    await page.getByLabel('Full name').fill('Demo Advocate');
    await page.getByLabel('Email').fill(`e2e-${Date.now()}@example.test`);
    await page.getByLabel('Password').fill('demo-password-42');
    await page.getByRole('button', { name: 'Create account' }).click();

    await page.getByLabel('Workspace name').fill('Demo Chambers');
    await page.getByRole('radio', { name: /Law firm/ }).check();
    await page.getByRole('button', { name: 'Create workspace' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  await test.step('create a case', async () => {
    await page.goto('/cases/new');
    await page.getByLabel('Case title').fill('ABC Traders v. XYZ Supplies');
    await page.getByLabel('Court', { exact: true }).fill('Demo Civil Court, Delhi');
    await page.getByRole('button', { name: 'Create case' }).click();
    await expect(page).toHaveURL(/\/cases\/[^/]+\/overview$/);
  });

  await test.step('upload the sample order and open its analysis', async () => {
    await caseTab(page, 'Documents').click();
    await page.getByLabel('Choose files to upload').setInputFiles(samplePdf);
    const review = page.getByRole('link', { name: 'Review' });
    await expect(review).toBeVisible({ timeout: 120_000 });
    await review.click();
    await expect(page.getByRole('heading', { name: 'AI review' })).toBeVisible();
  });

  const item = (text: string | RegExp) => page.getByRole('listitem').filter({ hasText: text });

  await test.step('review: a relative deadline waits for the lawyer', async () => {
    await expect(item(/Prepare and file the updated statement of account/)).toBeVisible();
    await expect(page.getByText(/A lawyer must set the date/).first()).toBeVisible();
  });

  await test.step('approve the hearing date and one task', async () => {
    const hearing = item(/15 Dec 2026/).filter({ hasText: 'Hearing' });
    await hearing.getByRole('button', { name: 'Approve' }).click();
    await expect(hearing.getByRole('button', { name: 'Approve' })).toHaveCount(0);

    const task = item('Confirm representatives for the next hearing');
    await task.getByRole('button', { name: 'Approve' }).click();
    await expect(task.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  await test.step('the approved work appears in the case', async () => {
    await caseTab(page, 'Tasks').click();
    await expect(page.getByText('Confirm representatives for the next hearing')).toBeVisible();
    await expect(page.getByText('Prepare and file the updated statement of account')).toHaveCount(0);

    await caseTab(page, 'Timeline').click();
    await expect(page.getByText(/15 Dec 2026/).first()).toBeVisible();
  });

  expect(cspViolations).toEqual([]);
});
