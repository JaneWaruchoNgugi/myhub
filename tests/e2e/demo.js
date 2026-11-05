const L = require('./lib');
const { step, select, dialog, save, closedDialog, BASE } = L;
const money = (s) => Number(s.replace(/[^\d.-]/g, ''));
(async () => {
  const { b, p, errors } = await L.setup();
  const login = async () => {
    await p.goto(BASE + '/login');
    await p.fill('#email', 'demo@myhub.local'); await p.fill('#password', 'demo-password-123');
    await p.click('button[type=submit]'); await p.waitForURL('**/dashboard', { timeout: 30000 });
  };
  await step(p, errors, 'demo login', login);
  const openRowMenu = async (rowText) => {
    const row = p.locator('tr, li, [data-slot=card]').filter({ hasText: rowText }).first();
    await row.getByRole('button', { name: 'Actions' }).click();
  };
  const menu = (name) => p.getByRole('menuitem', { name, exact: true }).click();

  await step(p, errors, 'bills: pay then undo restores balance', async () => {
    await p.goto(BASE + '/accounts');
    const before = await p.textContent('body');
    await p.goto(BASE + '/bills');
    await openRowMenu('Nairobi Water');
    await menu('Mark as paid');
    const d = await dialog(p);
    await save(d); await closedDialog(p);
    await p.getByText('Bill marked as paid').first().waitFor();
    // paying twice for the same period is impossible: the bill moved to the next period
    await openRowMenu('Nairobi Water');
    await p.getByRole('menuitem', { name: /Payment history/ }).click();
    const h = await dialog(p);
    await h.getByRole('button', { name: 'Undo' }).first().click();
    await p.getByRole('alertdialog').getByRole('button', { name: /undo/i }).click();
    await p.getByText('Payment undone').first().waitFor();
    await p.goto(BASE + '/accounts');
    const after = await p.textContent('body');
    if (before.match(/Ksh\s[\d,]+\.\d\d/g).join() !== after.match(/Ksh\s[\d,]+\.\d\d/g).join()) throw new Error('balances differ after pay+undo');
  });

  await step(p, errors, 'loans: repayment splits principal/interest', async () => {
    await p.goto(BASE + '/loans');
    await p.getByRole('link', { name: /KCB/ }).first().click();
    await p.waitForURL('**/loans/**');
    const outBefore = await p.locator('text=Outstanding').first().locator('xpath=..').textContent();
    await p.getByRole('button', { name: 'Record repayment' }).click();
    const d = await dialog(p);
    await d.getByLabel('Principal').fill('1000');
    await d.getByLabel('Interest').fill('200');
    await save(d); await closedDialog(p);
    await p.getByText('Repayment recorded').first().waitFor();
    await p.goto(BASE + '/transactions?q=KCB');
    await p.getByText(/principal repaid/).first().waitFor();
    await p.getByText(/: interest/).first().waitFor();
  });

  await step(p, errors, 'savings: contribution over account balance blocked', async () => {
    await p.goto(BASE + '/savings');
    await p.getByRole('link').filter({ hasText: /Emergency/ }).first().click();
    await p.waitForURL(/\/savings\/.+/);
    await p.getByRole('button', { name: 'Contribute' }).click();
    const d = await dialog(p);
    await d.getByLabel('Amount').fill('999999999');
    await save(d);
    await p.getByText(/goals already earmark/).first().waitFor();
    await p.keyboard.press('Escape');
  });

  await step(p, errors, 'investments: buy and price update', async () => {
    await p.goto(BASE + '/investments');
    await p.getByRole('link', { name: /Safaricom/ }).first().click();
    await p.waitForURL('**/investments/**');
    await p.getByRole('button', { name: 'Buy' }).click();
    let d = await dialog(p);
    await d.getByLabel('Units').fill('10');
    await d.getByLabel('Price per unit').fill('20');
    await save(d); await closedDialog(p);
    await p.getByText('Investment transaction recorded').first().waitFor();
    await p.getByRole('button', { name: 'Update price' }).click();
    d = await dialog(p);
    await d.getByLabel('Value').fill('30');
    await save(d); await closedDialog(p);
    await p.getByText('Price updated').first().waitFor();
  });

  await step(p, errors, 'investments: overselling blocked', async () => {
    await p.getByRole('button', { name: 'Sell' }).click();
    const d = await dialog(p);
    await d.getByLabel('Units').fill('99999999');
    await d.getByLabel('Price per unit').fill('1');
    await save(d);
    await p.getByText(/Can't sell/).first().waitFor();
    await p.keyboard.press('Escape');
  });

  await step(p, errors, 'subscriptions: record + undo charge', async () => {
    await p.goto(BASE + '/subscriptions');
    await openRowMenu('Netflix');
    await menu('Record charge');
    const d = await dialog(p);
    await save(d); await closedDialog(p);
    await p.getByText('Charge recorded as an expense').first().waitFor();
    await openRowMenu('Netflix');
    await p.getByRole('menuitem', { name: /Charge history/ }).click();
    const h = await dialog(p);
    await h.getByRole('button', { name: 'Undo' }).first().click();
    await p.getByRole('alertdialog').getByRole('button', { name: /undo/i }).click();
    await p.getByText('Charge undone').first().waitFor();
  });

  await step(p, errors, 'tasks: add, complete, delete', async () => {
    await p.goto(BASE + '/tasks');
    await p.getByRole('button', { name: 'Add task' }).click();
    const d = await dialog(p);
    await d.getByLabel('Title').fill('QA task');
    await save(d); await closedDialog(p);
    await p.getByText('QA task').first().waitFor();
    await p.getByRole('checkbox', { name: /QA task/ }).click();
    await p.getByText('Task completed').or(p.getByText('Saved')).first().waitFor().catch(() => {});
    await p.getByRole('tab', { name: 'Completed' }).click();
    await p.getByText('QA task').first().waitFor();
    await openRowMenu('QA task'); await menu('Delete');
    await p.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await p.getByText('QA task').first().waitFor({ state: 'detached' });
  });

  await step(p, errors, 'tasks: search and filter', async () => {
    await p.getByRole('tab', { name: 'All open' }).click();
    await p.getByLabel('Search').fill('zzzz-no-match');
    await p.getByText('No tasks match your filters').waitFor();
    await p.getByRole('button', { name: 'Clear filters' }).click();
  });

  await step(p, errors, 'notes: create, preview, pin, delete', async () => {
    await p.goto(BASE + '/notes');
    await p.getByRole('button', { name: 'New note' }).first().click();
    await p.getByLabel('Title').fill('QA note');
    await p.getByLabel('Content').fill('# Heading\n\n- [x] done item\n\n**bold** <script>alert(1)</script>');
    await p.getByRole('button', { name: /Save/ }).click();
    await p.getByText('Note saved').first().waitFor();
    await p.getByRole('tab', { name: 'Preview' }).click();
    await p.locator('.prose-note h1', { hasText: 'Heading' }).waitFor();
    if (await p.locator('.prose-note script').count()) throw new Error('script rendered');
    await p.getByRole('button', { name: 'Delete note' }).click();
    await p.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await p.getByText('Note deleted').first().waitFor();
  });

  await step(p, errors, 'documents: upload, reject spoof, download, delete', async () => {
    await p.goto(BASE + '/documents');
    await p.getByRole('button', { name: 'Upload' }).first().click();
    let d = await dialog(p);
    await d.locator('#doc-file').setInputFiles({ name: 'receipt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%test\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF') });
    await d.getByRole('button', { name: 'Upload' }).click();
    await p.getByText('Document uploaded').first().waitFor();
    await closedDialog(p);
    await p.getByRole('button', { name: 'Upload' }).first().click();
    d = await dialog(p);
    await d.locator('#doc-file').setInputFiles({ name: 'evil.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html><script>alert(1)</script></html>') });
    await d.getByRole('button', { name: 'Upload' }).click();
    await d.getByText("don't match its extension").waitFor();
    await p.keyboard.press('Escape');
    const href = await p.getByRole('link', { name: /Download receipt/ }).first().getAttribute('href');
    const r = await p.request.get(BASE + href);
    if (r.status() !== 200 || !(r.headers()['content-disposition'] || '').startsWith('attachment') || r.headers()['x-content-type-options'] !== 'nosniff') throw new Error('download headers ' + JSON.stringify(r.headers()));
    await openRowMenu('receipt'); await menu('Delete');
    await p.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await p.getByText('Document deleted').first().waitFor();
    const r2 = await p.request.get(BASE + href);
    if (r2.status() !== 404) throw new Error('deleted doc still served ' + r2.status());
  });

  await step(p, errors, 'reports: tabs + CSV', async () => {
    await p.goto(BASE + '/reports');
    for (const t of ['Categories', 'Budgets', 'Savings', 'Loans', 'Investments', 'Net worth', 'Subscriptions', 'Income & expenses']) await p.getByRole('tab', { name: t }).click();
    await p.getByRole('button', { name: 'Last month' }).click();
    await p.waitForURL('**from=**');
    for (const type of ['monthly', 'categories', 'budgets', 'savings', 'goals', 'loans', 'loan-summary', 'investments', 'networth', 'subscriptions', 'transactions']) {
      const r = await p.request.get(BASE + '/api/export/' + type);
      if (r.status() !== 200) throw new Error(type + ' ' + r.status());
    }
  });

  await step(p, errors, 'kanban: keyboard move between columns', async () => {
    await p.goto(BASE + '/dev/kanban');
    const card = p.getByText('AI spending insights');
    await card.waitFor();
    const colName = async () => (await p.locator('section').filter({ hasText: 'AI spending insights' }).locator('h2').textContent()).replace(/\s*\d+$/, '');
    const startCol = await colName();
    const handle = card.locator('xpath=ancestor::div[@role="button"][1]');
    await handle.focus();
    await p.keyboard.press('Space');
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(300);
    await p.keyboard.press('Space');
    await p.waitForTimeout(1500);
    await p.reload({ waitUntil: 'networkidle' });
    const col = await colName();
    if (col === startCol) throw new Error('card did not move from ' + startCol);
  });

  await step(p, errors, 'snippets: copy button', async () => {
    await p.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await p.goto(BASE + '/dev/snippets');
    await p.getByRole('button', { name: 'Copy code' }).first().click();
    await p.getByRole('button', { name: 'Copied' }).first().waitFor();
  });

  await step(p, errors, 'bookmarks: favourite toggle', async () => {
    await p.goto(BASE + '/dev/bookmarks');
    const btn = p.getByRole('button', { name: /favourites/ }).first();
    await btn.click();
    await p.getByText(/(Added to|Removed from) favourites/).first().waitFor();
  });

  await step(p, errors, 'settings: preferences + category', async () => {
    await p.goto(BASE + '/settings');
    await p.getByRole('tab', { name: /Preferences/ }).click();
    await p.getByLabel('Bill reminders (days before)').fill('4');
    await p.getByRole('button', { name: 'Save preferences' }).click();
    await p.getByText('Preferences saved').first().waitFor();
    await p.getByRole('tab', { name: /Categories/ }).click();
    await p.getByRole('button', { name: 'Add category' }).click();
    const d = await dialog(p);
    await d.getByLabel('Name').fill('QA cat');
    await save(d); await closedDialog(p);
    await openRowMenu('QA cat'); await menu('Delete');
    await p.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await p.getByText(/Category deleted/).first().waitFor();
    await p.getByRole('tab', { name: /Activity/ }).click();
    await p.getByText('login').first().waitFor();
  });

  await step(p, errors, 'notifications: mark all read', async () => {
    await p.goto(BASE + '/notifications');
    const btn = p.getByRole('button', { name: 'Mark all read' });
    if (await btn.isEnabled()) { await btn.click(); await p.getByText('All caught up').first().waitFor(); }
  });

  await step(p, errors, 'calendar renders events', async () => {
    await p.goto(BASE + '/calendar');
    await p.locator('.fc-event').first().waitFor({ timeout: 15000 });
  });

  await step(p, errors, 'every nav link loads', async () => {
    const hrefs = await p.locator('aside a[href^="/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
    for (const h of hrefs) {
      const r = await p.goto(BASE + h);
      if (!r || r.status() >= 400) throw new Error(h + ' ' + (r && r.status()));
    }
    if (hrefs.length < 20) throw new Error('only ' + hrefs.length + ' links');
  });

  console.log('fails', L.fails, 'errors', errors.length);
  await b.close();
})();
