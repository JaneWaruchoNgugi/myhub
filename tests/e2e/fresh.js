const L = require('./lib');
const { step, toast, select, dialog, save, closedDialog, BASE } = L;
(async () => {
  const { b, p, errors } = await L.setup();
  const email = `qa${Date.now()}@example.com`;
  await step(p, errors, 'register', async () => {
    await p.goto(BASE + '/register');
    await p.fill('#name', 'QA Tester'); await p.fill('#email', email);
    await p.fill('#password', 'correct-horse-battery'); await p.fill('#confirmPassword', 'correct-horse-battery');
    await p.click('button[type=submit]'); await p.waitForURL('**/dashboard', { timeout: 30000 });
    await p.getByText("Let's set up your MYHUB").waitFor();
  });
  await step(p, errors, 'create accounts', async () => {
    await p.goto(BASE + '/accounts');
    for (const [name, type, bal] of [['M-Pesa', 'Mobile money (M-Pesa etc.)', '5000'], ['Equity', 'Bank', '20000']]) {
      await p.getByRole('button', { name: /add account/i }).first().click();
      const d = await dialog(p);
      await d.getByLabel('Account name').fill(name);
      await select(p, 'Type', type, d);
      await d.getByLabel('Opening balance').fill(bal);
      await save(d); await closedDialog(p);
    }
    await p.getByText('Ksh 25,000.00').first().waitFor();
  });
  await step(p, errors, 'add expense + transfer, balances update', async () => {
    await p.goto(BASE + '/transactions');
    await p.getByRole('button', { name: 'Expense', exact: true }).click();
    let d = await dialog(p);
    await d.getByLabel('Amount').fill('1,250.50');
    await d.getByLabel('Description').fill('Lunch QA');
    await select(p, 'Account', 'M-Pesa', d);
    await save(d); await closedDialog(p);
    await p.getByText('Lunch QA').waitFor();
    await p.getByRole('button', { name: 'Transfer', exact: true }).click();
    d = await dialog(p);
    await d.getByLabel('Amount').fill('3000');
    await d.getByLabel('Description').fill('Top up');
    await select(p, 'From account', 'Equity', d);
    await select(p, 'To account', 'M-Pesa', d);
    await save(d); await closedDialog(p);
    await p.goto(BASE + '/accounts');
    await p.getByText('Ksh 6,749.50').first().waitFor(); // 5000 - 1250.50 + 3000
    await p.getByText('Ksh 17,000.00').first().waitFor();
    await p.getByText('Ksh 23,749.50').first().waitFor();
  });
  await step(p, errors, 'transfer to same account rejected', async () => {
    await p.goto(BASE + '/transactions');
    await p.getByRole('button', { name: 'Transfer', exact: true }).click();
    const d = await dialog(p);
    await d.getByLabel('Amount').fill('10');
    await d.getByLabel('Description').fill('Bad');
    await select(p, 'From account', 'Equity', d);
    await select(p, 'To account', 'Equity', d);
    await save(d);
    await d.getByText('Pick a different account').waitFor();
    await p.keyboard.press('Escape');
  });
  await step(p, errors, 'income/expense excludes transfers on dashboard', async () => {
    await p.goto(BASE + '/dashboard');
    await p.getByText('Ksh 1,250.50').first().waitFor();
    const body = await p.textContent('body');
    if (body.includes('Ksh 4,250.50')) throw new Error('transfer counted as expense');
  });
  await step(p, errors, 'isolation: export has only own rows', async () => {
    const r = await p.request.get(BASE + '/api/export/transactions');
    const t = await r.text();
    if (!t.includes('Lunch QA') || t.includes('Salary')) throw new Error('export leak or missing: ' + t.slice(0, 200));
  });
  await step(p, errors, 'isolation: demo ids not reachable', async () => {
    const r = await p.request.get(BASE + '/api/documents/does-not-exist');
    if (r.status() !== 404) throw new Error('status ' + r.status());
  });
  await step(p, errors, 'unauthenticated API is 401', async () => {
    const r = await p.request.get(BASE + '/api/export/transactions', { headers: { cookie: '' } });
    const ctx2 = await p.context().browser().newContext();
    const r2 = await ctx2.request.get(BASE + '/api/export/transactions');
    if (r2.status() !== 401) throw new Error('status ' + r2.status());
    const r3 = await ctx2.request.get(BASE + '/api/cron/run');
    if (r3.status() !== 401) throw new Error('cron status ' + r3.status());
    const r4 = await ctx2.request.get(BASE + '/api/cron/run', { headers: { authorization: 'Bearer dev-cron-secret-0123456789abcdef' } });
    if (r4.status() !== 200) throw new Error('cron with secret ' + r4.status());
    await ctx2.close();
  });
  await step(p, errors, 'password change signs out', async () => {
    await p.goto(BASE + '/settings');
    await p.fill('#pw-cur', 'correct-horse-battery'); await p.fill('#pw-new', 'new-horse-battery-1'); await p.fill('#pw-conf', 'new-horse-battery-1');
    await p.getByRole('button', { name: 'Change password' }).click();
    await p.waitForURL('**/login**', { timeout: 20000 });
    await p.fill('#email', email); await p.fill('#password', 'new-horse-battery-1');
    await p.click('button[type=submit]'); await p.waitForURL('**/dashboard', { timeout: 30000 });
  });
  console.log('fails', L.fails);
  await b.close();
})();
