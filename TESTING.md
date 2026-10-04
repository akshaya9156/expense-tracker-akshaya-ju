# Verification

## Automated checks

Run `npm test` and `npm run check`. The 20 Node tests cover exact money arithmetic, amount limits, leap dates, validation, filtering/sorting, totals, month boundaries, category aggregation, backup schema/duplicate/size rejection, payment-text drafts, formula-safe CSV formatting, and synthetic sample data.

The static build is produced by `npm run build`. CI runs the same checks; no package installation is necessary.

## Browser checks completed — 4 October 2026

Tested the running app with the embedded Chromium browser and synthetic data:

- Fresh personal ledger starts at zero; sample mode is visibly labeled and leaves the personal ledger untouched.
- Invalid zero amount gives a helpful error. Adding an expense updates the list, monthly totals, and all-time balance.
- Edit, confirmed delete, undo, and page refresh preserve the expected amounts. Sample expense total returned to ₹63,594.00 after test entries were removed.
- Adding income updates the balance. Income/category/search filters combine correctly, and Clear filters restores the list.
- A description containing an HTML image tag renders literally, without creating an image or running its event handler.
- Previous-month navigation shows the correct September summary. The six-month numeric table contains six rows.
- Budget edits show the over-budget state and cap the visual progress bar at 100%.
- Payment-text example populates amount/category/date in an unsaved review form. Escape closes the native dialog.
- A valid backup adds one new ID and skips an existing ID. Invalid negative amounts are rejected without modifying the ledger.
- Future connection dialogs explicitly state that no account is connected.
- The optional browser agent tool opens an unsaved draft for valid input; invalid input fails without changing ledger counts.
- Desktop (1440 px), mobile (390 px), and narrow mobile (320 px) layouts fit without document-level horizontal overflow. Editing works with the mobile cards.

No app console errors were observed during the tested flows. A test-tool error from deliberately invalid optional-agent input is expected.

## Scope and remaining manual checks

The embedded browser did not expose a completed download event for Blob downloads, so an actual downloaded CSV/JSON file could not be confirmed there. Export serialization is unit-tested, and export buttons use standard Blob/download links. Verify file saving in the target Chrome/Edge/Firefox browser. Browser quota exhaustion, blocked storage, corrupted existing storage, simultaneous cross-tab edits, Safari, screen readers, and 200% text enlargement require additional manual coverage; protective code is present, but those conditions were not simulated in this session.

Suggested regression pass:

1. Open a fresh ledger; add salary ₹1,000 and expense ₹125.50. Expect balance ₹874.50 after refresh.
2. Edit expense to ₹175.75; expect ₹824.25. Delete, cancel deletion, confirm deletion, and undo.
3. Try blank descriptions, invalid dates, negative/zero amounts, and more than two decimal places.
4. Combine filters, export the displayed CSV, and compare it with the visible rows.
5. Download a JSON backup, import it into an empty ledger, and import it again. The second import should add zero rows.
6. Verify keyboard focus, Escape behavior, mobile controls, and the category/table alternative to charts.
7. With a disposable test ledger, simulate blocked/full/corrupt storage and multi-tab edits. Confirm that the app reports errors and does not overwrite unrecognized data.

All sample data is fictional. Test backup files and browser data are excluded from the repository.
