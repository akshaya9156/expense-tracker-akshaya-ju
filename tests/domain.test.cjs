const { test } = require("node:test");
const assert = require("node:assert/strict");
const P = require("../assets/domain.js");
const transaction = (overrides = {}) => ({
  id: "test_1",
  type: "expense",
  amount: 25000,
  category: "Food & drinks",
  date: "2026-10-04",
  description: "Lunch",
  ...overrides,
});

test("money is parsed as exact integer minor units", () => {
  assert.equal(P.parseAmount("0.10") + P.parseAmount("0.20"), 30);
  assert.equal(P.parseAmount("12.3"), 1230);
  assert.equal(P.parseAmount(" 250 "), 25000);
  assert.equal(P.parseAmount("100000000"), P.MAX_AMOUNT);
});
test("invalid, negative, excessive and over-precision amounts are rejected", () => {
  for (const input of [
    "",
    "0",
    "-5",
    "1.001",
    "NaN",
    "Infinity",
    "1e3",
    "1,000",
    "100000000.01",
    ".50",
    "1.",
  ])
    assert.throws(() => P.parseAmount(input));
});
test("dates reject rollover dates and accept leap days", () => {
  assert.equal(P.validDate("2024-02-29"), true);
  for (const input of [
    "2026-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-01",
    "2026-1-1",
    "1899-12-31",
    "2101-01-01",
    "",
  ])
    assert.equal(P.validDate(input), false);
});
test("today uses local calendar parts without UTC day shifting", () => {
  assert.equal(P.today(new Date(2026, 0, 1, 0, 1)), "2026-01-01");
});
test("transaction validation trims description and drops untrusted fields", () => {
  const result = P.validateTransaction(
    transaction({ description: "  Coffee  ", source: "untrusted" }),
  );
  assert.equal(result.description, "Coffee");
  assert.equal(result.source, undefined);
});
test("transaction validation enforces type, category, date, description and safe IDs", () => {
  for (const override of [
    { type: "debt" },
    { amount: 0 },
    { amount: NaN },
    { amount: 1.2 },
    { category: "Salary" },
    { date: "2026-02-31" },
    { description: "  " },
    { description: "a".repeat(141) },
    { id: "<img>" },
  ])
    assert.throws(() => P.validateTransaction(transaction(override)));
});
test("income and expenses produce exact totals and allow negative balance", () => {
  assert.deepEqual(
    P.totals([
      transaction({ amount: 10 }),
      transaction({ id: "i", type: "income", category: "Salary", amount: 20 }),
      transaction({ id: "x", amount: 30 }),
    ]),
    { income: 20, expense: 40, balance: -20 },
  );
  assert.deepEqual(P.totals([]), { income: 0, expense: 0, balance: 0 });
});
test("filters combine month, type, category and case-insensitive search", () => {
  const rows = [
    transaction(),
    transaction({ id: "next", date: "2026-11-01" }),
    transaction({
      id: "salary",
      type: "income",
      category: "Salary",
      description: "Monthly salary",
    }),
  ];
  const result = P.filterTransactions(rows, {
    month: "2026-10",
    type: "expense",
    category: "Food & drinks",
    search: " LUNCH ",
  });
  assert.deepEqual(
    result.map((t) => t.id),
    ["test_1"],
  );
  assert.equal(rows.length, 3);
});
test("sorting works without mutating the ledger", () => {
  const rows = [
    transaction({ id: "low", amount: 100, date: "2026-10-01" }),
    transaction({ id: "high", amount: 300, date: "2026-10-03" }),
    transaction({ id: "mid", amount: 200, date: "2026-10-02" }),
  ];
  assert.deepEqual(
    P.filterTransactions(rows, { sort: "highest" }).map((t) => t.id),
    ["high", "mid", "low"],
  );
  assert.equal(P.filterTransactions(rows, { sort: "oldest" })[0].id, "low");
  assert.equal(rows[0].id, "low");
});
test("month selection excludes transactions from adjacent years", () => {
  assert.equal(
    P.monthTransactions(
      [transaction(), transaction({ id: "older", date: "2025-10-04" })],
      "2026-10",
    ).length,
    1,
  );
});
test("category summary includes expenses only, with descending amounts", () => {
  const rows = [
    transaction(),
    transaction({ id: "grocery", category: "Groceries", amount: 45000 }),
    transaction({
      id: "salary",
      type: "income",
      category: "Salary",
      amount: 100000,
    }),
  ];
  const summary = P.categoryTotals(rows);
  assert.equal(summary.length, 2);
  assert.equal(summary[0].category, "Groceries");
  assert.equal(
    summary.reduce((s, t) => s + t.amount, 0),
    70000,
  );
});
test("six-month windows cross year boundaries correctly", () => {
  assert.deepEqual(P.monthsEnding("2026-02"), [
    "2025-09",
    "2025-10",
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
  ]);
});
test("backup validation rejects malformed, unsupported and duplicate ledgers", () => {
  const base = P.emptyState();
  for (const data of [
    {},
    { ...base, version: 2 },
    { ...base, currency: "BTC" },
    { ...base, budget: -1 },
    { ...base, transactions: [transaction(), transaction()] },
  ])
    assert.throws(() => P.validateState(data));
  assert.deepEqual(
    P.validateState({ ...base, transactions: [transaction()] }).transactions,
    [transaction()],
  );
});
test("backup size is bounded before rendering", () => {
  assert.throws(
    () =>
      P.validateState({
        ...P.emptyState(),
        transactions: Array.from({ length: 5001 }, (_, i) =>
          transaction({ id: `test_${i}` }),
        ),
      }),
    /5,000/,
  );
});
test("payment text yields a reviewable draft with inferred category", () => {
  const draft = P.parsePaymentText(
    "Paid INR 1,250.50 at the grocery store on 2026-10-04",
    "2026-10-01",
  );
  assert.equal(draft.amount, "1250.50");
  assert.equal(draft.category, "Groceries");
  assert.equal(draft.date, "2026-10-04");
  assert.equal(draft.type, "expense");
  assert.equal(draft.ambiguous, false);
});
test("ambiguous payment amounts are not silently selected", () => {
  const draft = P.parsePaymentText(
    "Paid Rs 250. Balance INR 6000.",
    "2026-10-04",
  );
  assert.equal(draft.amount, "");
  assert.equal(draft.ambiguous, true);
});
test("payment parser uses explicit fallback date and handles income", () => {
  const draft = P.parsePaymentText("Salary credited INR 65000", "2026-10-04");
  assert.equal(draft.type, "income");
  assert.equal(draft.category, "Salary");
  assert.equal(draft.date, "2026-10-04");
  assert.equal(draft.dateDetected, false);
});
test("CSV escapes quotation marks, commas, newlines and spreadsheet formulas", () => {
  const exported = P.csv([
    transaction({ description: '=HYPERLINK("example")' }),
    transaction({ id: "second", description: "Lunch, coffee\nand cake" }),
  ]);
  assert.ok(exported.includes('"\'=HYPERLINK(""example"")"'));
  assert.ok(exported.includes('"Lunch, coffee\nand cake"'));
  assert.ok(
    P.csv([transaction({ description: "  =1+1" })]).includes("'  =1+1"),
  );
});
test("sample data is synthetic, isolated by IDs, and passes validation", () => {
  const sample = P.validateState(P.sampleState("2026-10"));
  assert.equal(sample.transactions.length, 27);
  assert.ok(sample.transactions.every((t) => t.id.startsWith("demo_")));
  assert.deepEqual(
    P.totals(P.monthTransactions(sample.transactions, "2026-10")),
    { income: 7350000, expense: 2119800, balance: 5230200 },
  );
});

test("payment drafts do not silently round invalid or zero amounts", () => {
  for (const message of ["Paid INR 12.999", "Paid INR 0"]) {
    const draft = P.parsePaymentText(message, "2026-10-04");
    assert.equal(draft.amount, "");
    assert.equal(draft.ambiguous, true);
  }
});
