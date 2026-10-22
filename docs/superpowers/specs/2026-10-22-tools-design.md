# Tools: groups, debts, savings calculator and currency converter

## Why

The user went on a holiday with four friends. Different people paid for groceries, restaurants and shops, each time for everyone, and in different currencies: Albanian lek in cash, euro in cash, hryvnia by card, złoty by card. Some people ordered more than others. Debts were paid back gradually during the trip, person to person and in part, not in one settlement at the end. Nobody could tell at any moment who owed whom how much.

Separately, the user lends and borrows money privately ("I lent Max 500 zł", "I borrowed 2000 zł from mum"). They want to record this for themselves without involving the other person, and see it in their own statistics.

dock.mita gets a new "Tools" section that holds these and a couple of small calculators.

## Goals

- **Expense groups:** shared expenses and partial repayments in any currency, so everyone in a trip can see at any moment who owes whom.
- **Two ways to use a group, at the same time:** the owner records everything alone, or shares a link so others add entries themselves without an account.
- **Personal accounting for members with an account:** group activity of members linked to a dock.mita account flows into their accounts, budgets and reports correctly. Only their real share counts as spending.
- **Private debts** ("I owe X" and "X owes me") with partial repayments, visible in the user's statistics.
- **Savings calculator and currency converter.**
- **Travel currencies:** support every currency for which NBP publishes rates.

## Non-goals

These are not in this work:

- loan or credit calculator (later);
- real-time chat, comments or notifications inside groups;
- payments or money transfers between people (the app only records them);
- receipt photos or attachments;
- recurring group expenses.

## Anti-goals

The work fails, even if it technically runs, if any of these happens:

- **Inflated spending:** paying for five people shows up as five times the user's real spending in budgets and reports, or a repayment shows up as income.
- **Lost entries:** a group entry silently changes or disappears and nobody can tell who did it.
- **Leaked groups:** a link holder can reach anything other than that one group.
- **Leaked debts:** private debts are visible to anyone but their owner.

## Decided with the user

### Navigation

A new main section, "Tools" (en: Tools, pl: Narzędzia, ru: Инструменты, uk: Інструменти). It lists:

1. Groups
2. Debts
3. Savings calculator
4. Currency converter

### Groups

- **Ownership.** A registered user creates a group, for example "Albania 2026", and is its owner.
- **Members.** Members are names. Any member can be linked to a dock.mita account.
- **Only the owner changes the group itself:**
  - adds, renames and removes members;
  - invites by email;
  - enables, disables and regenerates the share link;
  - deletes the group.
- **Invite by email.** The owner can invite a dock.mita user by email. The group then appears in that user's app, linked to their member.
- **Share link.**
  - The link opens the group in a browser without signing in.
  - On the first visit the person picks "who am I" from the member list, and the browser remembers it.
  - If the visitor is signed in to dock.mita, they are offered to link the chosen member to their account, so the link doubles as an invitation.
  - A link holder can add and edit every expense and repayment in the group.
  - A link holder cannot change members or anything else about the group.
- **Authorship.** Every entry shows who created it and who changed it last. For a link holder this is the member they picked.
- **Expense fields:**
  - payer (one member);
  - amount and currency;
  - date;
  - category, tags and description, as on a personal transaction;
  - the split.
- **Split.** Equal between all members by default. It can be limited to some members, or given an exact amount per member when people ordered differently.
- **Repayment:** one member gives another an amount in any currency on a date. Partial repayments are normal and need not settle everything.
- **Currencies.**
  - Every entry has its own currency.
  - The group has a main currency for totals.
  - Every entry converts at the official rate on its date.
  - The rate can be overridden by hand on any expense or repayment.
- **Balances.**
  - At any moment the group shows each member's balance, and who owes whom after all repayments.
  - It also suggests the smallest set of transfers that settles everyone.
  - Balances can also be viewed in another currency.

### Personal accounting for members with an account (option B, confirmed by the user)

The example used throughout: a dinner of €120 for five people, the user's share is €24.

**Nothing in the group changes a linked user's accounts, budgets or reports until that user confirms it.** Group activity that touches the user's money lands in a "To confirm" list in their app.

- **Confirming an item.**
  - The user chooses the account, which can be in any currency; the amount converts at the entry date's rate.
  - The user also chooses the category, tags and description. The group entry's values are pre-filled as suggestions.
  - The user can reject an item instead. The group stays untouched and nothing personal is created.
- **What lands in "To confirm":**
  - an expense the user paid for;
  - a settlement the user marked as paid;
  - a settlement someone else marked on the user's behalf. Any member, link holders included, can mark a settlement, and the linked user must confirm it.
- **The user paid.**
  - On confirmation €120 leaves the chosen account.
  - Only the user's share, €24, is an expense in its category.
  - The other €96 is "owed to me". It is not spending and does not count in budgets or reports.
- **Someone else paid.**
  - The user's €24 share is "I owe".
  - Nothing reaches the user's accounts or budgets yet.
- **The user settles.**
  - This happens when the user marks that they paid back, or confirms someone else's mark.
  - The money leaves the chosen account, and the €24 share becomes an expense in its category on the settlement date.
  - A settlement is never a second expense and never income.
- **Two ways to settle:**
  - **Specific shares:** the user settles one or more shares ("I paid Olya for the dinner").
  - **Free-form amount to a member:** the amount covers that pair's oldest open shares first. A partly covered share becomes an expense for the covered part.
- **Repayments received.**
  - When someone pays the user back and the user confirms it, the money enters the chosen account and reduces "owed to me".
  - It is not income.
- **Changes after confirmation.**
  - When a confirmed group entry is later edited or deleted in the group, the user gets a new "To confirm" item describing the change.
  - Personal records change only when the user confirms it.
- **Category suggestion.**
  - The group uses the standard dock.mita categories plus group-specific categories. Any member can add a group-specific category, link holders included.
  - A standard category suggests the user's category with the same standard key.
  - A group-specific category suggests the user's category with the same name. If that category does not exist, confirming creates it.
- **Tags and description** are suggested from the group entry.

### Private debts

- **Visibility.** Debts are private to their owner and never shared.
- **Lending** ("I lent Max 500 zł"): money leaves an account. It is "owed to me", not an expense.
- **Borrowing** ("I borrowed 2000 zł from mum"): money enters an account. It is "I owe", not income.
- **Repayments** are partial, in any currency, at the rate on the repayment date or a manual rate.
- **Due date** is optional. Overdue debts are highlighted.
- **Group balances** of the user appear on the Debts page as one line per group, so every debt is in one place.
- **Overview** gets an "Owed to me / I owe" summary, and a balance figure that can include debts.

### Savings calculator

- **Two modes:**
  - "I want X by date Y": the monthly amount needed, given the amount already saved and an optional annual interest rate.
  - "I save X a month": the amount reached by a date, or the date a target is reached.
- **Making a goal.** One button turns the result into a goal on the Goals page.

### Currency converter

Converts an amount between any two supported currencies at the official NBP rate on a chosen date, today by default.

### Currencies

- **Supported list.** Every currency for which NBP publishes rates, from tables A and B, is supported everywhere a currency is chosen: accounts, transactions, transfers, groups, debts and the converter.
- **Base currency.** It stays limited to the current four (PLN, EUR, USD, UAH).
- **Rate source.** Table B is published weekly, so a rate for a table B currency on a given date is the latest published rate on or before that date.

## Delivery

Each part gets its own plan and pull requests, in this order:

1. **Currency list:** extend currencies to the NBP tables A and B (backend sync, validation, contract, frontend pickers and formatting).
2. **Tools section and private debts:** the section, the Debts page, debt records with their effect on accounts and statistics, and the Overview summary.
3. **Groups, core:** groups, members, expenses, splits, repayments, balances and the share link, without personal accounting.
4. **Groups, personal accounting:** email invites, linking members to accounts, the "To confirm" list with confirmation into personal records, settlements, and group balances on the Debts page.
5. **Calculators:** the savings calculator and the currency converter.

A part may be split further if its plan turns out too large.

## Calls made by the designer (not discussed with the user, can be revisited)

- **Standard category keys:** starter categories get an internal standard key independent of their name. For existing users a migration derives the key from the name in any of the four locales. When the matching category was deleted, the suggestion falls back to "Other".
- **Late linking:** when a member is linked after entries already exist, past entries that involve them appear in their "To confirm" list.
- **Unlinking or deleting:** when a member is unlinked or removed, or the group is deleted, the personal records the user already confirmed stay as ordinary records. Past budgets never change behind the user's back.
- **History:** every group entry keeps a full change history (who, when, what changed). Deleted entries stay visible in a "deleted" view and can be restored.
- **Debts without an account:** an account on a private debt is optional, for example an old loan paid in cash.
- **Debts in reports:** debts are neither income nor expense, so they do not appear in Reports. They appear on the Debts page, in the Overview summary and in the optional balance-with-debts figure.
- **Group balances on the Debts page** use the group's figures, confirmed or not, so the user sees what they really owe.

## Left to the builder

- **Data model and API shape.** This includes how personal records of group activity and debts are stored (special transactions, a separate ledger, or rows in `account_movements`), as long as balances, budgets and reports behave as described.
- **Link security:** the token format, its length, and rate limiting for anonymous access.
- **Settlement algorithm** for the smallest set of transfers.
- **Rounding of splits:** remainders go to the payer or the first member.
- **UI layout** within the existing design system and both mobile and desktop layouts.
- **Mock backend coverage** for the E2E suite.
- **Mobile behaviour for the "who am I" choice**, and a way to switch it.
- **Notifications:** none in this work.

## Constraints

- **Stack and rules.** The stack and project rules in both repositories' guides and `docs/STACK.md` apply. New libraries need approval.
- **Languages.** Every user-facing string is in en, pl, ru and uk.
- **Contract.** The backend contract is documented in the backend `docs/api-contract.md`.
- **Money.** Money is stored in minor units. For currencies with zero or three decimal places, minor units follow ISO 4217.
