/* Pure money, validation and reporting helpers. Shared by the UI and Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Pocket = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const LIMIT = 5000;
  const MAX_AMOUNT = 10000000000; // 100 million currency units, in minor units.
  const categories = {
    expense: ['Food & drinks', 'Groceries', 'Transport', 'Shopping', 'Bills & rent', 'Health', 'Entertainment', 'Education', 'Travel', 'Other'],
    income: ['Salary', 'Freelance', 'Gift', 'Refund', 'Other']
  };
  const colors = ['#176b51', '#a3c959', '#e7b254', '#779aba', '#a38abb', '#df9873', '#79b9ad', '#cf89a5', '#7e90cf', '#929993'];
  function today(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1900 || year > 2100) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  function parseAmount(value) {
    const text = String(value ?? '').trim();
    if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('Enter a positive amount with up to 2 decimal places.');
    const [whole, fraction = ''] = text.split('.');
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_AMOUNT) throw new Error('Amount must be greater than 0 and no more than 100,000,000.');
    return cents;
  }
  function validateTransaction(input) {
    if (!input || !['income', 'expense'].includes(input.type)) throw new Error('Choose income or expense.');
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > MAX_AMOUNT) throw new Error('Invalid transaction amount.');
    if (!categories[input.type].includes(input.category)) throw new Error('Choose a category for this transaction type.');
    if (!validDate(input.date)) throw new Error('Enter a valid date between 1900 and 2100.');
    if (typeof input.description !== 'string' || !input.description.trim() || input.description.trim().length > 140) throw new Error('Add a description between 1 and 140 characters.');
    if (typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.id)) throw new Error('Invalid transaction ID.');
    return {id: input.id, type: input.type, amount: input.amount, category: input.category, date: input.date, description: input.description.trim()};
  }
  function emptyState() { return {version: VERSION, transactions: [], budget: 0, currency: 'INR'}; }
  function validateState(data) {
    if (!data || data.version !== VERSION || !Array.isArray(data.transactions)) throw new Error('Use a Pocket backup with version 1.');
    if (data.transactions.length > LIMIT) throw new Error('A ledger can contain up to 5,000 transactions.');
    if (!['INR', 'USD', 'EUR', 'GBP'].includes(data.currency)) throw new Error('Unsupported backup currency.');
    if (!Number.isSafeInteger(data.budget) || data.budget < 0 || data.budget > MAX_AMOUNT) throw new Error('Invalid monthly budget.');
    const transactions = data.transactions.map(validateTransaction);
    if (new Set(transactions.map(t => t.id)).size !== transactions.length) throw new Error('This backup contains duplicate transaction IDs.');
    return {version: VERSION, transactions, budget: data.budget, currency: data.currency};
  }
  function totals(transactions) {
    const result = {income: 0, expense: 0, balance: 0};
    for (const transaction of transactions) result[transaction.type] += transaction.amount;
    result.balance = result.income - result.expense;
    return result;
  }
  function monthTransactions(transactions, month) { return transactions.filter(t => t.date.slice(0, 7) === month); }
  function filterTransactions(transactions, filters = {}) {
    const search = (filters.search || '').trim().toLocaleLowerCase();
    return transactions.filter(t =>
      (!filters.month || t.date.startsWith(filters.month)) &&
      (!filters.type || t.type === filters.type) &&
      (!filters.category || t.category === filters.category) &&
      (!search || `${t.description} ${t.category}`.toLocaleLowerCase().includes(search))
    ).sort((a, b) => {
      if (filters.sort === 'highest') return b.amount - a.amount || b.date.localeCompare(a.date);
      if (filters.sort === 'oldest') return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    });
  }
  function categoryTotals(transactions) {
    return categories.expense.map((category, index) => ({category, color: colors[index], amount: transactions.filter(t => t.type === 'expense' && t.category === category).reduce((sum, t) => sum + t.amount, 0)})).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
  }
  function monthsEnding(month, count = 6) {
    const [year, number] = month.split('-').map(Number);
    return Array.from({length: count}, (_, index) => {
      const date = new Date(year, number - count + index, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    });
  }
  function guessCategory(text, type = 'expense') {
    const rules = type === 'income' ? [
      ['Salary', /salary|payroll/i], ['Freelance', /freelance|client|invoice/i], ['Refund', /refund|reversal/i], ['Gift', /gift/i]
    ] : [
      ['Food & drinks', /coffee|cafe|lunch|dinner|breakfast|restaurant|zomato|swiggy|food/i],
      ['Groceries', /grocery|groceries|supermarket|bigbasket|blinkit|zepto/i],
      ['Transport', /uber|ola\b|metro|bus\b|petrol|fuel|taxi|train/i],
      ['Bills & rent', /rent|electric|internet|recharge|bill|wifi/i],
      ['Health', /doctor|hospital|pharmacy|medicine|health/i],
      ['Entertainment', /netflix|spotify|movie|cinema/i],
      ['Education', /course|tuition|book|school/i],
      ['Travel', /hotel|flight|travel/i], ['Shopping', /amazon|flipkart|shopping|clothes/i]
    ];
    return rules.find(([, regex]) => regex.test(text))?.[0] || 'Other';
  }
  function parsePaymentText(text, fallbackDate = today()) {
    const type = /credited|received|salary|refund/i.test(text) ? 'income' : 'expense';
    const amounts = [...text.matchAll(/(?:₹|rs\.?|inr|usd|eur|gbp|\$|€|£)\s*([\d,]+(?:\.\d{1,2})?)/gi)];
    let amount = '';
    if (amounts.length === 1) {
      try { amount = (parseAmount(amounts[0][1].replaceAll(',', '')) / 100).toFixed(2); } catch { /* Let the user supply it. */ }
    }
    const detectedDate = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
    return {type, amount, category: guessCategory(text, type), date: validDate(detectedDate) ? detectedDate : fallbackDate, description: text.replace(/\s+/g, ' ').trim().slice(0, 140), ambiguous: amounts.length !== 1, dateDetected: validDate(detectedDate)};
  }
  function csv(transactions) {
    const cell = value => {
      let text = String(value);
      if (/^[=+\-@\t\r\n]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    return '\uFEFF' + ['Date,Type,Category,Description,Amount', ...transactions.map(t => [t.date, t.type, t.category, t.description, (t.amount / 100).toFixed(2)].map(cell).join(','))].join('\r\n');
  }
  function sampleState(month = today().slice(0, 7)) {
    const previous = monthsEnding(month, 3);
    const entries = [
      ['income', 6500000, 'Salary', 'Monthly salary', 1],
      ['expense', 1500000, 'Bills & rent', 'A place to call home', 1],
      ['expense', 245000, 'Groceries', 'Weekly grocery run', 2],
      ['expense', 48000, 'Food & drinks', 'Lunch with the team', 2],
      ['expense', 15000, 'Transport', 'Metro top-up', 3],
      ['income', 850000, 'Freelance', 'Weekend design project', 3],
      ['expense', 99900, 'Entertainment', 'Music & movie night', 3],
      ['expense', 189900, 'Shopping', 'A little wardrobe refresh', 4],
      ['expense', 22000, 'Food & drinks', 'The usual coffee', 4]
    ];
    const transactions = previous.flatMap((m, monthIndex) => entries.map(([type, amount, category, description, day], index) => ({id: `demo_${monthIndex}_${index}`, type, amount: Math.round(amount * (monthIndex === 2 ? 1 : monthIndex === 1 ? 0.9 : 1.1)), category, description, date: `${m}-${String(day).padStart(2, '0')}`})));
    return {version: VERSION, transactions, budget: 3500000, currency: 'INR'};
  }
  return {VERSION, LIMIT, MAX_AMOUNT, categories, colors, today, validDate, parseAmount, validateTransaction, validateState, emptyState, totals, monthTransactions, filterTransactions, categoryTotals, monthsEnding, guessCategory, parsePaymentText, csv, sampleState};
});
