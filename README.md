# Pocket · Expense Tracker

A responsive expense tracker built with **HTML, CSS, and vanilla JavaScript**. No framework, runtime dependencies, account, API key, or backend required.

## Run locally

Open `index.html` in a modern browser, or, for consistent Local Storage behavior, install Node.js 20+ and run:

```sh
npm start
```

Visit **http://127.0.0.1:4173**. No `npm install` is needed. Keep using the same address and browser: storage is tied to the browser and origin. Some browsers restrict storage for directly opened files.

## Features

- Add, edit, delete, and repeat income/expense transactions with amount, category, date, and description.
- All-time income, expenses, and balance; combined type/category/month/search filters and sorting.
- Monthly category chart, six-month income/expense comparison with an accessible data table, and adjustable monthly budget.
- Local Storage persistence, validation, storage failure messages, multi-tab conflict detection, and delete confirmation with a 12-second undo.
- Quick-entry templates and **Paste & review**: local rules suggest a draft from payment text. Nothing is automatically saved.
- CSV export of the filtered list; validated JSON backup import/export, with duplicate IDs skipped.
- Separate sample mode, mobile cards, keyboard-accessible dialogs, visible focus styles, and reduced-motion support.
- INR by default; USD/EUR/GBP available before adding amounts. A ledger has one currency; no currency conversion.

The app starts empty. Choose **Explore sample data** to try every feature without mixing examples into your own ledger. Data is local, not encrypted or synced. Back up before clearing browser data or changing devices.

## Checks and build

```sh
npm test       # Node's built-in tests; no test dependency
npm run check # JavaScript syntax checks
npm run build # Copy the static app to dist/ for hosting
```

See [TESTING.md](TESTING.md) for the test scope and manual checklist, and [CHANGELOG.md](CHANGELOG.md) for changes. Source is split into `assets/domain.js` (pure validation/reporting), `assets/app.js` (UI/storage), and `assets/styles.css` (responsive styling). Money is stored in integer minor units to avoid floating-point rounding errors.

## Future connections

The Connections screen includes **clearly labeled previews** for Gmail receipt drafts and Google Pay/UPI statement import. Neither is connected in this version. The payment-text assistant is functional today. [INTEGRATIONS.md](INTEGRATIONS.md) explains the proposed implementation and boundaries.

## GitHub Pages

The included Pages workflow tests and publishes `dist/` on pushes to `main`. Enable **Settings → Pages → Source → GitHub Actions** in the GitHub repository. All asset paths are relative, so repository-path hosting works.

Built for the Expense Tracker assignment. Sample descriptions and transactions are fictional.
