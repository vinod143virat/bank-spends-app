# Roadmap

Phase 1 is in the repository and runs. Everything below it is scoped, not built.

## Phase 1 — SMS on Android (done)

Native SMS reader, parse engine with five banks, dedupe, SQLite, and the four
screens. Runs entirely on device.

**What is deliberately missing:** the credit-limit editor (the repository call
exists, the form does not), custom date ranges beyond the four presets, and any
export.

## Phase 2 — Email ingestion

The parse engine is already source-agnostic: `RawMessage` carries
`source: 'sms' | 'email'`, `bankIdFromEmailAddress` resolves the bank from the
sender domain, and the dedupe path expects the same payment to arrive twice.
What is missing is the fetch.

**Gmail.** `react-native-app-auth` is already a dependency. Google OAuth for
installed apps uses PKCE with no client secret, so no backend is needed. Query
the API with a sender filter rather than pulling the whole mailbox.

The blocker is not code. `gmail.readonly` is a **restricted scope**: shipping to
the public needs OAuth verification plus an annual CASA third-party security
assessment — real money and four to eight weeks. Until then the OAuth consent
screen stays in Testing mode, which allows **100 test users** with no
verification at all. That is enough for a pilot and should be used fully before
paying for an assessment.

Keeping the raw body off disk is what keeps the assessment scope small. Do not
start caching message bodies for convenience.

**Outlook.** Microsoft Graph `Mail.Read`, delegated, user-consentable for
personal accounts. Publisher verification is needed for multi-tenant. No CASA
equivalent, though some corporate tenants ask for Microsoft 365 Certification.

Email alone covers roughly 50–70% of spend — many banks send small UPI and card
transactions over SMS only. It is the fallback if the Play declaration fails,
not a replacement for SMS.

## Phase 3 — Account Aggregator

The RBI/Sahamati framework: consented, structured transaction data with no
scraping. Register as an FIU and integrate through a TSP (Setu, Finvu,
Anumati/Perfios, OneMoney). Onboarding runs one to three months.

**Coverage caveat that shapes the architecture:** AA is strong on deposit
accounts and thin on credit cards. Card spend still has to come from SMS, email
and statement parsing. The end state is a hybrid — AA for bank accounts, alerts
for cards — which is why the ingestion layer is a set of sources feeding one
parse-and-dedupe pipeline rather than a single path.

## Phase 4 — Statements and iOS

Password-protected PDF statements (the password is usually a DOB/PAN pattern)
fill gaps and backfill history further than the SMS inbox reaches. This is also
the only meaningful card-data route on iOS, which has no SMS access at all.

## Deferred, deliberately

**A sync backend.** On-device-only is a feature, and it is the strongest line in
the Play declaration and the CASA scope. Add one when multi-device demand is
real, behind the existing repository layer, and expect DPDP Act 2023 obligations
to arrive with it.

**LLM parsing.** Templates handle the common cases deterministically and for
free. An LLM is for the unparsed tail only — run it over redacted text, cache by
template shape, and never on the hot path.

## Compliance, running in parallel

Start these alongside the code; they are calendar-bound, not effort-bound.

| Item | Lead time | Needed for |
|---|---|---|
| Play Permissions Declaration | 2–6 weeks, retries likely | Any SMS release |
| Google OAuth verification + CASA | 4–8 weeks, paid | Gmail beyond 100 users |
| FIU registration + TSP onboarding | 1–3 months | Account Aggregator |
| DPDP Act readiness | Ongoing | Any public release in India |
