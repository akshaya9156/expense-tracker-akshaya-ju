/* Pocket: DOM interactions, accessible dialogs and device-local persistence. */
(() => {
  'use strict';
  const P = window.Pocket;
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons = {
    overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    transactions:'<path d="M5 7h14m-4-4 4 4-4 4M19 17H5m4-4-4 4 4 4"/>',
    chart:'<path d="M4 20h17M7 16v-5m5 5V4m5 12V8"/>',
    connections:'<path d="m9 15 6-6M7.5 16.5l-1 1a4 4 0 0 1-5.7-5.7l5-5a4 4 0 0 1 5.7 0m1 1 1-1a4 4 0 1 1 5.7 5.7l-5 5a4 4 0 0 1-5.7 0" transform="translate(2 0)"/>',
    settings:'<path d="m9 3-1 3-3 1v3l-2 2 2 2v3l3 1 1 3h6l1-3 3-1v-3l2-2-2-2V7l-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    wallet:'<path d="M20 8V5H6a3 3 0 0 0 0 6h15v9H6a3 3 0 0 1-3-3V8"/><path d="M21 12h-5v5h5"/><circle cx="17.5" cy="14.5" r=".5"/>',
    income:'<path d="M7 7h10v10M17 7 7 17"/>',
    expense:'<path d="M7 7v10h10M7 17 17 7"/>',
    spark:'<path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3Z"/>',
    clipboard:'<rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6m-6 4h4"/>',
    chevronLeft:'<path d="m14 6-6 6 6 6"/>',chevronRight:'<path d="m10 6 6 6-6 6"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
    upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 17v4h16v-4"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    edit:'<path d="m14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14Z"/>',
    trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.wallet}</svg>`;
  document.querySelectorAll('[data-icon]').forEach(el => {el.innerHTML = icon(el.dataset.icon);});
  const KEY = 'pocket:ledger:v1';
  const DEMO_KEY = 'pocket:demo:v1';
  let demo = false;
  try { demo = sessionStorage.getItem('pocket:mode') === 'demo'; } catch { /* Mode is optional. */ }
  let state = P.emptyState();
  let rawSaved = null;
  let storageBlocked = false;
  let storageUnavailable = false;
  let month = P.today().slice(0, 7);
  let currentView = 'overview';
  let filters = {type:'', category:'', search:'', sort:'newest', period:'month'};
  let pageSize = 10;
  let editingId = null;
  let formSnapshot = null;
  let pendingDelete = null;
  let undo = null;
  let toastTimer;
  let settingsSnapshot = null;
  const storageKey = () => demo ? DEMO_KEY : KEY;
  const money = (amount, compact = false) => new Intl.NumberFormat(state.currency === 'INR' ? 'en-IN' : 'en-US', {style:'currency', currency:state.currency, minimumFractionDigits:compact ? 0 : 2, maximumFractionDigits:compact ? 0 : 2}).format(amount / 100);
  const dateLabel = date => new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', year:'numeric'}).format(new Date(`${date}T12:00:00`));
  const monthLabel = value => new Intl.DateTimeFormat('en-GB', {month:'long', year:'numeric'}).format(new Date(`${value}-01T12:00:00`));
  const newId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  function warn(message) { $('storage-warning').textContent = message; $('storage-warning').hidden = !message; }
  function load() {
    storageBlocked = false;
    storageUnavailable = false;
    warn('');
    try {
      rawSaved = localStorage.getItem(storageKey());
      state = rawSaved ? P.validateState(JSON.parse(rawSaved)) : (demo ? P.sampleState() : P.emptyState());
    } catch (error) {
      state = P.emptyState();
      if (rawSaved) {
        storageBlocked = true;
        warn('Your saved ledger could not be read. Changes are paused to protect it. Download the original data in Settings before clearing this site’s browser data.');
      } else {
        storageUnavailable = true;
        warn('Browser storage is unavailable. Changes will last only for this session. Download a backup before leaving.');
      }
    }
  }
  function persist(next) {
    if (storageBlocked) throw new Error('Saved data needs attention. Download the original data from Settings first.');
    const valid = P.validateState(next);
    if (!storageUnavailable) {
      let latest;
      try { latest = localStorage.getItem(storageKey()); }
      catch { throw new Error('Cannot access browser storage. Download a backup before leaving.'); }
      if (latest !== rawSaved) {
        load(); render();
        throw new Error('This ledger changed in another tab. Close this form and try again with the updated data.');
      }
      const encoded = JSON.stringify(valid);
      try { localStorage.setItem(storageKey(), encoded); }
      catch { throw new Error('Could not save: browser storage is full or blocked. Download a backup from Settings. Your previous data is unchanged.'); }
      rawSaved = encoded;
    }
    state = valid;
    render();
  }
  function notification(message, undoAction = null) {
    clearTimeout(toastTimer);
    undo = undoAction;
    $('toast-message').textContent = message;
    $('undo-delete').hidden = !undo;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; undo = null; }, undo ? 12000 : 7000);
  }
  function savedMessage(message) { return storageUnavailable ? `${message} (this session only).` : message; }
  function showError(id, message) {$(id).textContent = message; $(id).hidden = !message;}
  function closeDialogs() {document.querySelectorAll('dialog[open]').forEach(d => d.close());}
  function changeView(view) {
    const views = {
      overview: ['Overview','Your money at a glance.','Small habits. A clearer picture.'],
      transactions: ['Transactions','Every little thing, accounted for.','A home for your payday, coffee, and everything in between.'],
      insights: ['Monthly insights','See the bigger picture.','A little perspective on where your money goes.'],
      connections: ['Connections','Less typing. More living.','Useful shortcuts today. Thoughtful connections for tomorrow.']
    };
    currentView = views[view] ? view : 'overview';
    const [name,title,subtitle] = views[currentView];
    $('breadcrumb').textContent = name;
    $('page-title').textContent = title;
    $('page-subtitle').textContent = subtitle;
    document.querySelectorAll('[data-view]').forEach(el => {
      const active = el.dataset.view === currentView;
      el.classList.toggle('active', active);
      if (active) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
    });
    $('summary').hidden = currentView === 'connections';
    $('overview-tools').hidden = currentView !== 'overview';
    $('month-toolbar').hidden = currentView === 'connections';
    $('insight-panels').hidden = !['overview','insights'].includes(currentView);
    $('transactions-panel').hidden = !['overview','transactions'].includes(currentView);
    $('trend-panel').hidden = currentView !== 'insights';
    $('connections-panel').hidden = currentView !== 'connections';
    $('add-transaction').hidden = currentView === 'connections';
    document.title = `${name} · Pocket Expense Tracker`;
  }
  function renderSummary() {
    const all = P.totals(state.transactions);
    ['income','expense','balance'].forEach(key => {$(key).textContent = money(all[key]);});
    for (const type of ['income','expense']) {
      const count = state.transactions.filter(t => t.type === type).length;
      $(`${type}-count`).textContent = `${count} ${type} transaction${count === 1 ? '' : 's'}`;
    }
    $('demo-banner').hidden = !demo;
    $('storage-status').innerHTML = `<span></span>${demo ? 'Sample ledger' : storageUnavailable ? 'Session only' : storageBlocked ? 'Storage needs attention' : 'Stored on this device'}`;
    $('currency').value = state.currency;
    $('currency').disabled = state.transactions.length > 0 || state.budget > 0;
    $('settings-demo').textContent = demo ? 'Return to personal ledger' : 'Explore sample data';
    $('backup-download').textContent = storageBlocked ? 'Download original data' : 'Download backup';
  }
  function renderInsights() {
    const monthly = P.monthTransactions(state.transactions, month);
    const total = P.totals(monthly);
    const breakdown = P.categoryTotals(monthly);
    $('month-picker').value = month;
    $('month-caption').textContent = `${monthLabel(month)} · Summary ignores list filters`;
    $('previous-month').disabled = month === '1900-01';
    $('next-month').disabled = month === '2100-12';
    $('month-spend').textContent = money(total.expense);
    const expenses = monthly.filter(t => t.type === 'expense').length;
    $('month-expense-count').textContent = `${expenses} expense${expenses === 1 ? '' : 's'}`;
    let cursor = 0;
    const gradient = breakdown.map(row => {
      const start = cursor; cursor += row.amount / total.expense * 100;
      return `${row.color} ${start.toFixed(3)}% ${cursor.toFixed(3)}%`;
    }).join(',');
    $('category-chart').style.background = gradient ? `conic-gradient(${gradient})` : '#edf1e8';
    $('category-chart').setAttribute('aria-label', `${monthLabel(month)}: ${money(total.expense)} in expenses. ${breakdown.map(r => `${r.category}: ${money(r.amount)}`).join('. ')}`);
    $('category-legend').innerHTML = breakdown.length ? breakdown.map(row => `<div class="legend-row"><i class="legend-color" style="background:${row.color}" aria-hidden="true"></i><span>${escape(row.category)}</span><strong>${escape(money(row.amount, true))}<small>${Math.round(row.amount / total.expense * 100)}%</small></strong></div>`).join('') : '<p class="legend-empty">Every small expense tells a story.<br>Add one to start yours.</p>';
    $('category-insight').innerHTML = icon('spark') + `<span>${breakdown.length ? `${escape(breakdown[0].category)} is your biggest category this month · ${Math.round(breakdown[0].amount / total.expense * 100)}% of spending.` : 'Add your first expense to see the bigger picture.'}</span>`;
    const left = state.budget - total.expense;
    $('budget-left').textContent = state.budget ? money(Math.abs(left)) : 'Your pace, your plan.';
    $('budget-subtitle').textContent = state.budget ? left >= 0 ? 'left in your monthly budget' : 'over your monthly budget' : 'Set a monthly spending budget.';
    $('budget-open').textContent = state.budget ? 'Edit budget' : 'Set budget';
    const percentage = state.budget ? Math.min(100, Math.round(total.expense / state.budget * 100)) : 0;
    $('budget-fill').style.width = `${percentage}%`;
    $('budget-progress').classList.toggle('over', state.budget > 0 && left < 0);
    $('budget-progress').setAttribute('aria-valuenow', percentage);
    $('budget-progress').setAttribute('aria-valuetext', state.budget ? `${money(total.expense)} spent of ${money(state.budget)}` : 'No budget set');
    $('budget-spent').textContent = `${money(total.expense, true)} spent`;
    $('budget-total').textContent = state.budget ? `${money(state.budget, true)} budget` : 'No budget yet';
    $('month-income').textContent = money(total.income);
    $('month-balance').textContent = money(total.balance);
    $('budget-message').textContent = state.budget ? left < 0 ? 'A little over the plan. Review your categories or adjust your budget.' : total.expense ? `${100 - percentage}% of your monthly budget is still available.` : 'A new month of possibilities. Your budget is ready.' : 'A budget is a guide. Find what works for you.';
    const trend = P.monthsEnding(month).map(m => ({month:m, ...P.totals(P.monthTransactions(state.transactions,m))}));
    const max = Math.max(1, ...trend.flatMap(t => [t.income,t.expense]));
    $('trend-chart').setAttribute('aria-label', `Six-month income and expense comparison through ${monthLabel(month)}. Exact amounts are available in View monthly numbers.`);
    $('trend-chart').innerHTML = trend.map(row => `<div class="trend-group"><div class="trend-bars"><div class="trend-bar income-key" style="height:${row.income / max * 100}%" title="Income: ${escape(money(row.income))}"></div><div class="trend-bar expense-key" style="height:${row.expense / max * 100}%" title="Expenses: ${escape(money(row.expense))}"></div></div><div class="trend-label">${escape(new Intl.DateTimeFormat('en-GB',{month:'short',year:'2-digit'}).format(new Date(`${row.month}-01T12:00:00`)))}</div></div>`).join('');
    $('trend-table').innerHTML = trend.map(row => `<tr><th scope="row">${escape(monthLabel(row.month))}</th><td>${escape(money(row.income))}</td><td>${escape(money(row.expense))}</td><td>${escape(money(row.balance))}</td></tr>`).join('');
  }
  function filtered() {return P.filterTransactions(state.transactions, {...filters, month:filters.period === 'all' ? '' : month});}
  function renderTransactions() {
    const result = filtered();
    const visible = result.slice(0,pageSize);
    const symbols = {'Food & drinks':'☕','Groceries':'◈','Transport':'⌁','Bills & rent':'⌂','Salary':'↗','Freelance':'✧','Shopping':'◇','Entertainment':'♫','Health':'+','Education':'▤','Travel':'✈','Gift':'✦','Refund':'↶','Other':'•'};
    $('transaction-list').innerHTML = visible.map(t => `<tr><td><div class="transaction-details"><span class="category-icon" aria-hidden="true">${symbols[t.category]}</span><div><strong>${escape(t.description)}</strong><small>${t.type === 'income' ? 'Income' : 'Expense'}${t.id.startsWith('demo_') ? ' · Sample' : ''}</small></div></div></td><td class="category-cell"><span class="category-pill">${escape(t.category)}</span></td><td class="date-cell">${escape(dateLabel(t.date))}</td><td class="transaction-amount ${t.type}">${t.type === 'income' ? '+' : '−'}${escape(money(t.amount))}</td><td class="actions-cell"><div class="row-actions"><button class="icon-button" data-action="repeat" data-id="${escape(t.id)}" aria-label="Repeat ${escape(t.description)}" title="Use again">${icon('copy')}</button><button class="icon-button" data-action="edit" data-id="${escape(t.id)}" aria-label="Edit ${escape(t.description)}" title="Edit">${icon('edit')}</button><button class="icon-button delete" data-action="delete" data-id="${escape(t.id)}" aria-label="Delete ${escape(t.description)}" title="Delete">${icon('trash')}</button></div></td></tr>`).join('');
    $('transaction-count').textContent = result.length;
    $('filter-summary').textContent = `${filters.period === 'all' ? 'All time' : monthLabel(month)} · ${result.length} matching transaction${result.length === 1 ? '' : 's'}`;
    $('empty-state').hidden = result.length > 0;
    const pristine = !state.transactions.length;
    $('empty-title').textContent = pristine ? 'A fresh start for your money.' : 'Nothing here just yet.';
    $('empty-description').textContent = pristine ? 'Your morning coffee, payday, and everything in between. Give each one a home.' : 'Try another month, category, or search. Your other transactions are still safe.';
    $('empty-add').textContent = pristine ? 'Add your first transaction' : 'Add transaction';
    $('try-demo').hidden = !pristine || demo;
    $('clear-filters').hidden = pristine;
    $('show-more').hidden = result.length <= pageSize;
    $('list-footer').textContent = result.length ? `Showing ${visible.length} of ${result.length} · ${money(P.totals(result).expense)} expenses in this view` : 'Your ledger is ready when you are.';
    $('export-csv').disabled = !result.length;
  }
  function render() {renderSummary();renderInsights();renderTransactions();}
  function categoryOptions(type, selected) {
    $('category').innerHTML = P.categories[type].map(c => `<option value="${escape(c)}">${escape(c)}</option>`).join('');
    $('category').value = P.categories[type].includes(selected) ? selected : P.categories[type][0];
  }
  function openTransaction(transaction = null, repeat = false, hint = '') {
    closeDialogs();
    editingId = transaction && !repeat && transaction.id ? transaction.id : null;
    formSnapshot = rawSaved;
    $('transaction-form').reset();
    showError('transaction-error','');
    const type = transaction?.type || 'expense';
    document.querySelector(`input[name="type"][value="${type}"]`).checked = true;
    categoryOptions(type,transaction?.category);
    $('amount').value = transaction?.amount ? (typeof transaction.amount === 'number' ? (transaction.amount / 100).toFixed(2) : transaction.amount) : '';
    $('date').value = repeat ? P.today() : transaction?.date || P.today();
    $('description').value = transaction?.description || '';
    $('transaction-dialog-title').textContent = editingId ? 'Edit transaction' : repeat ? 'Make it a familiar one' : 'Add a transaction';
    $('save-transaction').textContent = editingId ? 'Save changes' : 'Save transaction';
    $('transaction-hint').textContent = hint || (repeat ? 'A fresh draft with today’s date. Check the amount before saving.' : 'A few details now. A clearer picture later.');
    $('amount-currency').textContent = state.currency;
    $('currency-symbol').textContent = ({INR:'₹',USD:'$',EUR:'€',GBP:'£'})[state.currency];
    $('transaction-dialog').showModal();
    $('amount').focus();
  }
  $('transaction-form').addEventListener('submit',event => {
    event.preventDefault();
    try {
      if (formSnapshot !== rawSaved) throw new Error('Your ledger changed while this form was open. Close the form and try again.');
      const transaction = P.validateTransaction({id:editingId || newId(), type:document.querySelector('input[name="type"]:checked').value, amount:P.parseAmount($('amount').value), category:$('category').value, date:$('date').value, description:$('description').value});
      const transactions = editingId ? state.transactions.map(t => t.id === editingId ? transaction : t) : [...state.transactions,transaction];
      if (editingId && !state.transactions.some(t => t.id === editingId)) throw new Error('This transaction was removed. Close the form and try again.');
      persist({...state,transactions});
      $('transaction-dialog').close();
      month = transaction.date.slice(0,7);
      clearFilters(false);
      render();
      notification(savedMessage(editingId ? 'Transaction updated.' : 'Transaction added.'));
    } catch(error) {showError('transaction-error',error.message);}
  });
  document.querySelectorAll('input[name="type"]').forEach(el => el.addEventListener('change',() => categoryOptions(el.value,$('category').value)));
  function deleteTransaction(id) {
    const transaction = state.transactions.find(t => t.id === id);
    if (!transaction) return;
    pendingDelete = {transaction, key:storageKey()};
    $('confirm-description').textContent = `${transaction.description} · ${money(transaction.amount)}. You can undo this for 12 seconds after deletion.`;
    $('confirm-dialog').returnValue = '';
    $('confirm-dialog').showModal();
  }
  $('confirm-dialog').addEventListener('close',() => {
    if ($('confirm-dialog').returnValue !== 'delete' || !pendingDelete) {pendingDelete = null;return;}
    const removed = pendingDelete;
    pendingDelete = null;
    try {
      if (removed.key !== storageKey()) return;
      const current = state.transactions.find(t => t.id === removed.transaction.id);
      if (JSON.stringify(current) !== JSON.stringify(removed.transaction)) throw new Error('This transaction changed. Review it before deleting.');
      persist({...state,transactions:state.transactions.filter(t => t.id !== removed.transaction.id)});
      notification(savedMessage('Transaction deleted.'),() => {
        if (removed.key !== storageKey()) throw new Error('Return to the original ledger to undo.');
        if (!state.transactions.some(t => t.id === removed.transaction.id)) persist({...state,transactions:[...state.transactions,removed.transaction]});
        notification(savedMessage('Transaction restored.'));
      });
    } catch(error) {notification(error.message);}
  });
  $('transaction-list').addEventListener('click',event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const transaction = state.transactions.find(t => t.id === button.dataset.id);
    if (!transaction) return;
    if (button.dataset.action === 'delete') deleteTransaction(transaction.id);
    else openTransaction(transaction,button.dataset.action === 'repeat');
  });
  function clearFilters(resetPeriod = true) {
    filters = {type:'',category:'',search:'',sort:'newest',period:resetPeriod ? 'all' : 'month'};
    $('search').value = '';$('category-filter').value = '';$('sort-filter').value = 'newest';$('period-filter').value = filters.period;
    document.querySelectorAll('[data-filter-type]').forEach(el => {el.classList.toggle('selected',el.dataset.filterType === '');el.setAttribute('aria-pressed',String(el.dataset.filterType === ''));});
    pageSize = 10;renderTransactions();
  }
  function setMonth(value) {if (!P.validDate(`${value}-01`)) return;month = value;pageSize = 10;renderInsights();renderTransactions();}
  $('month-picker').addEventListener('change',event => {if(event.target.value) setMonth(event.target.value);else event.target.value=month;});
  for (const [id,delta] of [['previous-month',-1],['next-month',1]]) $(id).addEventListener('click',() => {
    const [year,m] = month.split('-').map(Number);setMonth(P.today(new Date(year,m - 1 + delta,1)).slice(0,7));
  });
  document.querySelectorAll('[data-filter-type]').forEach(el => el.addEventListener('click',() => {
    filters.type = el.dataset.filterType;
    document.querySelectorAll('[data-filter-type]').forEach(button => {const selected = button === el;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
    pageSize=10;renderTransactions();
  }));
  for (const [id,key,event] of [['search','search','input'],['category-filter','category','change'],['period-filter','period','change'],['sort-filter','sort','change']]) $(id).addEventListener(event,() => {filters[key] = $(id).value;pageSize=10;renderTransactions();});
  $('category-filter').innerHTML += [...new Set([...P.categories.expense,...P.categories.income])].sort().map(c => `<option value="${escape(c)}">${escape(c)}</option>`).join('');
  $('clear-filters').addEventListener('click',() => clearFilters());
  $('show-more').addEventListener('click',() => {pageSize+=20;renderTransactions();});
  for (const id of ['add-transaction','empty-add']) $(id).addEventListener('click',() => openTransaction());
  document.querySelectorAll('[data-template]').forEach(el => el.addEventListener('click',() => {
    const templates = {coffee:{category:'Food & drinks',description:'My usual coffee'},groceries:{category:'Groceries',description:'Grocery run'},transport:{category:'Transport',description:'Daily commute'}};
    openTransaction({type:'expense',...templates[el.dataset.template]},false,'Category and description are ready. Add the amount and make it yours.');
  }));
  document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click',() => $(el.dataset.close).close()));
  document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click',() => {location.hash = el.dataset.view;changeView(el.dataset.view);}));
  window.addEventListener('hashchange',() => changeView(location.hash.slice(1)));
  function openPaste() {closeDialogs();$('paste-form').reset();$('paste-dialog').showModal();$('payment-text').focus();}
  for (const id of ['paste-open','connection-paste']) $(id).addEventListener('click',openPaste);
  $('paste-example').addEventListener('click',() => {$('payment-text').value=`Paid ${state.currency} 250 at a coffee shop on ${P.today()}`;});
  $('paste-form').addEventListener('submit',event => {
    event.preventDefault();
    const draft = P.parsePaymentText($('payment-text').value);
    $('payment-text').value = '';
    const hint = `${draft.ambiguous ? 'No single amount found. Enter the correct amount.' : 'Check the suggested amount and category.'} ${draft.dateDetected ? 'Date found in the text.' : 'Date defaults to today.'} Confirm the currency; no conversion is performed. Edit the description to remove private details.`;
    openTransaction(draft,false,hint);
  });
  $('budget-open').addEventListener('click',() => {settingsSnapshot=rawSaved;$('budget-amount').value=state.budget ? (state.budget/100).toFixed(2) : '';showError('budget-error','');$('budget-dialog').showModal();$('budget-amount').focus();});
  $('budget-form').addEventListener('submit',event => {
    event.preventDefault();
    try {
      if(settingsSnapshot !== rawSaved) throw new Error('Your ledger changed in another tab. Close this form and reopen it.');
      const value=$('budget-amount').value.trim();
      const budget= !value || /^0+(\.0{1,2})?$/.test(value) ? 0 : P.parseAmount(value);
      persist({...state,budget});$('budget-dialog').close();notification(savedMessage(budget ? 'Monthly budget saved.' : 'Monthly budget removed.'));
    } catch(error) {showError('budget-error',error.message);}
  });
  function settings() {showError('settings-error','');renderSummary();$('settings-dialog').showModal();}
  for (const id of ['settings-open','mobile-settings']) $(id).addEventListener('click',settings);
  $('currency').addEventListener('change',event => {
    try {if(state.transactions.length || state.budget) throw new Error('Currency is locked while the ledger contains amounts.');persist({...state,currency:event.target.value});notification('Display currency updated.');}
    catch(error) {renderSummary();showError('settings-error',error.message);}
  });
  function download(content,name,type) {
    const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  $('export-csv').addEventListener('click',() => {download(P.csv(filtered()),`pocket-${demo ? 'sample-' : ''}${state.currency}-${filters.period === 'all' ? 'all-time' : month}.csv`,'text/csv;charset=utf-8');notification('CSV exported with the current list filters.');});
  $('backup-download').addEventListener('click',() => {download(storageBlocked ? rawSaved : JSON.stringify(state,null,2),`pocket-${demo ? 'sample-' : ''}${storageBlocked ? 'original-' : 'backup-'}${P.today()}.json`,'application/json');notification(storageBlocked ? 'Original saved data downloaded.' : 'Backup downloaded. Keep it somewhere safe.');});
  $('backup-import').addEventListener('click',() => {$('backup-file').value='';$('backup-file').click();});
  $('backup-file').addEventListener('change',async event => {
    const file=event.target.files[0];if(!file) return;
    const keyAtStart=storageKey();const snapshotAtStart=rawSaved;
    try {
      if(file.size > 4 * 1024 * 1024) throw new Error('This file is too large. Use a Pocket JSON backup under 4 MB.');
      const imported=P.validateState(JSON.parse(await file.text()));
      if(keyAtStart !== storageKey() || snapshotAtStart !== rawSaved) throw new Error('The ledger changed while reading this backup. Please select the file again.');
      if((state.transactions.length || state.budget) && imported.currency !== state.currency) throw new Error('This backup uses a different currency. Import only backups in your ledger’s currency.');
      const ids=new Set(state.transactions.map(t => t.id));
      const added=imported.transactions.filter(t => !ids.has(t.id));
      const empty=!state.transactions.length && !state.budget;
      persist({...state,transactions:[...state.transactions,...added],currency:empty ? imported.currency : state.currency,budget:empty ? imported.budget : state.budget});
      showError('settings-error','');$('settings-dialog').close();filters.period='all';$('period-filter').value='all';renderTransactions();
      notification(savedMessage(`Imported ${added.length} transactions. Skipped ${imported.transactions.length - added.length} existing IDs.`));
    } catch(error) {showError('settings-error',error instanceof SyntaxError ? 'This file is not valid JSON. Select a Pocket backup.' : error.message);}
  });
  function toggleDemo(value) {
    closeDialogs();demo=value;rawSaved=null;
    try {sessionStorage.setItem('pocket:mode',demo ? 'demo' : 'personal');} catch { /* The visible mode still works. */ }
    load();month=P.today().slice(0,7);clearFilters(false);render();changeView('overview');location.hash='overview';notification(demo ? 'Sample mode is on. Your personal ledger is untouched.' : 'Back to your personal ledger.');
  }
  for (const id of ['try-demo','settings-demo']) $(id).addEventListener('click',() => toggleDemo(!demo));
  $('exit-demo').addEventListener('click',() => toggleDemo(false));
  $('undo-delete').addEventListener('click',() => {const action=undo;if(!action)return;try{action();}catch(error){notification(error.message);}});
  $('dismiss-toast').addEventListener('click',() => {$('toast').hidden=true;undo=null;clearTimeout(toastTimer);});
  document.querySelectorAll('[data-roadmap]').forEach(button => button.addEventListener('click',() => {
    const gmail=button.dataset.roadmap === 'gmail';
    $('roadmap-title').textContent=gmail ? 'Gmail receipts · future feature' : 'Google Pay / UPI · future feature';
    $('roadmap-content').innerHTML=gmail ? '<p class="dialog-description">A preview of the experience we’d like to build. No Google account is connected in this version.</p><ol class="roadmap-list"><li><strong>Choose what to share</strong>Explicit permission to read the receipts you select.</li><li><strong>Review a draft inbox</strong>Check suggested amounts, merchants, dates, and duplicates.</li><li><strong>Import only what you approve</strong>Add reviewed transactions and disconnect whenever you want.</li></ol><div class="inline-note">Requires a secure account connection and Google approval before launch. Today, use Paste & review.</div>' : '<p class="dialog-description">A preview of a future import experience. Pocket currently has no access to Google Pay, UPI apps, or bank accounts.</p><ol class="roadmap-list"><li><strong>Bring your payment records</strong>A supported statement file you choose to share.</li><li><strong>Check the details</strong>Review amounts, categories, and possible duplicates.</li><li><strong>Save the entries you want</strong>Nothing enters your ledger without review.</li></ol><div class="inline-note">Automatic personal payment-history sync is not implemented or promised. Today, paste a payment message into a draft.</div>';
    $('roadmap-dialog').showModal();
  }));
  window.addEventListener('storage',event => {
    if(event.key !== storageKey() && event.key !== null) return;
    load();render();notification('Ledger refreshed after a change in another tab.');
  });
  load();render();changeView(location.hash.slice(1));
  // Optional browser-native agent affordance: stages a draft; never saves it silently.
  const modelContext=document.modelContext;
  if(modelContext?.registerTool) {
    const lifecycle=new AbortController();
    try {
      Promise.resolve(modelContext.registerTool({name:'stage_transaction_draft',title:'Prepare a transaction for review',description:'Open the visible transaction form with a proposed draft. Does not save a transaction. The user must review and press Save.',inputSchema:{type:'object',properties:{type:{type:'string',enum:['income','expense']},amount:{type:'string'},category:{type:'string'},date:{type:'string'},description:{type:'string'}},required:['type','amount','category','date','description'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){
        const valid=P.validateTransaction({...input,id:'draft',amount:P.parseAmount(input.amount)});
        openTransaction({...valid,id:undefined},false,'Draft prepared for your review. Nothing has been saved.');
        return {status:'draft_open',saved:false};
      }},{signal:lifecycle.signal})).catch(() => {});
    } catch { /* Unsupported optional API must not affect the expense tracker. */ }
    window.addEventListener('pagehide',() => lifecycle.abort(),{once:true});
  }
})();
