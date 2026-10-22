# Nigerian transaction rules for the Cashflow pilot

This rulebook sets the compact taxonomy and safe behavior for the first Nigerian solopreneur cohort. Treat it as the target specification; validate provider-specific parsing against the anonymized statement export before enabling automatic confirmation.

## Separate four dimensions

- **Movement:** income, expense, own-account transfer, savings/investment movement, or refund/reversal.
- **Category:** what an expense was for.
- **Purpose:** Business, Personal, or Owner draw.
- **Review state:** confirmed, suggested, or Needs sorting. Needs sorting is a state, not a category.

OPay, PalmPay, Moniepoint, banks, POS, USSD, NIP, ATM, and mobile apps identify an account/provider or payment channel. They do not establish transaction meaning. The CBN reports these as distinct channels; classification needs row evidence and user feedback.

## Ten broad expense categories

1. **Food & household** — groceries, market purchases, meals, household consumables.
2. **Housing & utilities** — rent, electricity, water, waste, household services.
3. **Transport** — fuel, public transport, ride-hailing, parking, vehicle upkeep.
4. **Phone & internet** — airtime, data, broadband, communication services.
5. **Health** — pharmacy, clinic, hospital, tests, health cover.
6. **Education** — school fees, lessons, courses, books, exams.
7. **Business & work** — supplies, software, workspace, ads, packaging, contractors, work equipment.
8. **Personal & leisure** — clothing, entertainment, personal care, non-work subscriptions.
9. **Fees & debt** — bank/transfer charges, stamp duty, POS fees, loan repayments, penalties.
10. **Other** — confirmed expense that does not fit; never use it for an unclear row.

Income, transfer, savings, and refund are movement types, not extra expense categories. Do not create categories for each merchant or payment rail. NBS’s 2019 expenditure report supports broad food, transport, housing/services, health, and education labels; it is dated context, not a claim that all users behave alike.

## Classification rules

| Evidence | Treatment | Auto-confirm? |
|---|---|---|
| Explicit debit/credit columns | Determine direction from the provider field; retain raw row and source column | Only after provider parser tests |
| Provider name, POS, USSD, NIP, ATM, or “transfer” alone | Record provider/channel only; infer no category or own-account movement | No |
| Matched reference between accounts the user tagged as theirs | Transfer; exclude from income/expense; pair both sides if reliable | No until matching is tested |
| Transfer to unknown person/business | Could be purchase, supplier, support, or own transfer; ask | No |
| ATM cash withdrawal | Cash movement, not automatically an expense; reconcile cash spending separately | No |
| Known client settlement with credit evidence | Business income; optionally match invoice | Only for a validated pattern |
| Generic “credit alert” or unidentified credit | Could be income, own transfer, loan, refund, or support | No |
| Salary/payroll with credit evidence | Income; employer stays in description, not its own category | Suggest first |
| Refund, reversal, chargeback, failed-transfer reversal | Link to original if possible; never count as earned income; unknown original stays in review | No |
| Bank fee, stamp duty, commission, POS fee | Fees & debt, separate from transfer/purchase principal | Only validated fee marker |
| Loan proceeds | Borrowed money, not income | No |
| Loan repayment | Fees & debt; retain principal/interest detail when supplied | Suggest/review |
| User-owned savings/investment transfer | Own-account movement, not household expense; return/interest is separate | No |
| “market”, “POS”, or person’s name only | Not enough evidence to assume Food or Business | No |
| Airtime/data, utility bill, ride/fuel with validated merchant pattern | Phone & internet; Housing & utilities; Transport respectively | Suggest until tested |

### Confidence, learning, and review

- At least **0.95** can preselect a suggestion only after provider test rows validate the rule; preserve review and undo during beta.
- **0.65–0.94** requires confirmation. Below **0.65**, missing direction, or conflicting evidence means Needs sorting and exclusion from confirmed totals.
- Never bulk-confirm refunds/reversals, unknown transfers, or ambiguous debit/credit direction.
- Learn only from explicit user saves. Match normalized merchant plus direction and compatible context; a debit correction must not classify the same merchant’s credits/refunds.
- “Apply to similar transactions” is opt-in, inspectable, and undoable. Chat text is not training data or evidence.

## Import safety

1. Preserve raw description/date/reference/amount/currency/debit-credit fields/provider/filename/source row.
2. Parse DD/MM/YYYY only under an explicit provider locale; never silently swap day and month.
3. Prefer provider transaction references for dedupe. Otherwise compare account, date, amount, direction, normalized description, and overlap. Identical same-day purchases may both be real: flag ambiguity instead of silently dropping one.
4. Overlapping imports should be idempotent and report added/matched/skipped/review counts.
5. Preview before commit; malformed or interrupted imports must not leave a half-written ledger.
6. Missing months are coverage gaps, not zero-spend months. Mark summaries partial and offer backfill.
7. Imports must not change manually entered balances without an explicit reconciliation action.

## Pilot test matrix for the supplied statement

Actual examples and column names must come from the anonymized export.

| Case | Expected behavior |
|---|---|
| Known client credit | Suggested Business income; invoice match where possible |
| Unknown “credit alert” | Review; excluded from confirmed income |
| OPay to Moniepoint between user-owned accounts | Transfer pair; no double count |
| Transfer to unknown beneficiary | Review; not assumed internal |
| Airtime/data; grocery; electricity; ride/fuel | Phone & internet; Food & household; Housing & utilities; Transport suggestions |
| Transfer fee/stamp duty | Separate Fees & debt row |
| Refund matching purchase | Linked reversal; not income |
| ATM withdrawal | Cash movement |
| Two identical same-day purchases | Keep both unless references prove duplication |
| DD/MM plus overlapping import | Correct date; no duplicate ledger row |
| Corrupt file/interrupted parse | Error; no partial commit |
| Statement two months old | Show stale coverage; do not present current totals |

## Research and current code risk

- [NBS 2019 household expenditure report](https://www.nigerianstat.gov.ng/elibrary/read/1094): food was 56.65% of household expenditure in that year; food away from home, transport, and staple foods were major items. Dated evidence, used only for broad labels.
- [CBN e-payment statistics](https://www.cbn.gov.ng/PaymentsSystem/ePaymentStatistics.html) distinguishes ATM, POS, web, NEFT/RTGS, USSD, mobile-app transfers, direct debits, and mobile money. Those are rails, not categories.

The current `guess()` in `app.js` groups `refund` and generic `credit alert` with Income at confidence 0.87. That risks confirming refunds and unknown credits as earned income. Keep them in review until reversal handling and provider-specific tests exist.