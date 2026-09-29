# Bank Spends

An Android app that reads bank alerts already sitting on your phone and turns
them into a per-bank view of what you spent, what came in, and what is worth
worrying about.

Everything happens on the device. There is no server, no account, and nothing
is uploaded.

## Status

Phase 1. SMS ingestion is complete end to end; email ingestion is scoped but
not built. See [docs/ROADMAP.md](docs/ROADMAP.md).

| Area | State |
|---|---|
| SMS read, parse, dedupe, store | Working |
| HDFC, ICICI, SBI, Axis, Kotak templates | Working |
| Dashboard, per-bank, activity, insights | Working |
| Gmail / Outlook ingestion | Not started |
| Account Aggregator | Not started |

## Requirements

- Node >= 22.11
- JDK 21
- Android SDK with an API 34+ platform, and `ANDROID_HOME` set
- A physical device or emulator running Android 8.0 (API 26) or newer

React Native 0.87.1, New Architecture, no Expo.

## Running it

```bash
npm install
npm start                # Metro, in one terminal
npm run android          # build and install, in another
```

The first launch asks for SMS permission. Granting it triggers a 180-day
backfill; expect a few seconds on a busy inbox. Without it the app still runs,
just with nothing to show until email ingestion lands.

## Checks

```bash
npm test         # 39 unit tests over the parser and the insight rules
npm run typecheck
npm run lint
```

## How it works

```
SMS inbox ──► NativeSmsReader (Kotlin)     filters to bank senders natively
                    │
                    ▼
              parse/engine.ts              noise filter ─► bank templates
                    │                      ─► merchant normalise ─► categorise
                    ▼
            db/transactions.ts             dedupe against existing rows,
                    │                      merge richer fields, persist
                    ▼
               SQLite (on device)
                    │
                    ▼
          state/store.ts ──► screens       aggregates + insight rules
```

Four decisions worth knowing before you change anything:

**Money is integer minor units everywhere.** `45000` is ₹450.00. Rupees as
floats drift once you sum thousands of rows, and this is a money app.

**Sender filtering happens in Kotlin, not JS.** `NativeSmsReader.query` takes an
allow-list of bank sender fragments and drops everything else before it crosses
the bridge. Personal SMS never enters the JS heap. There is deliberately no API
to read the inbox unfiltered — keep it that way.

**Only the derived transaction is stored, never the message body.** Parse,
extract, discard. This is what keeps a device compromise from being a
correspondence leak, and it is what will keep the eventual Gmail CASA
assessment small.

**A transaction has an identity independent of how we heard about it.** The same
payment arrives over SMS *and* email; `transactionId()` plus the time-window
lookup in `findDuplicate` collapse them into one row that keeps the best fields
from each. Without this, every total is inflated.

## Adding a bank

1. Add an entry to `BANKS` in `src/domain/banks.ts` with the bank's SMS sender
   fragments (the part after the `VM-`/`AD-` prefix).
2. Add templates to `src/parse/templates/india.ts` using the shared `AMT`,
   `L4`, `CUR` and `DATE` fragments.
3. Add a test in `__tests__/parse.test.ts` using a real alert, with the digits
   changed.

Unrecognised messages from a known bank are counted as `unparsed` and surfaced
in Settings → Last sync, which is how you find the templates you still owe.

## Docs

- [docs/ROADMAP.md](docs/ROADMAP.md) — what is next and what it costs
- [docs/PLAY_SMS_PERMISSION.md](docs/PLAY_SMS_PERMISSION.md) — **read before
  attempting a Play release**
