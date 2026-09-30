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
| Release APK builds in CI | Verified green |
| SMS read, parse, dedupe, store | Built, not yet run on a device |
| HDFC, ICICI, SBI, Axis, Kotak templates | Working, unit tested |
| Dashboard, per-bank, activity, insights | Built, not yet run on a device |
| Gmail / Outlook ingestion | Not started |
| Account Aggregator | Not started |

The APK compiles, packages and signs. Nothing in it has been exercised against
a real inbox yet, so treat the first install as the start of testing rather
than the end of it - the parser templates in particular are written against
alert formats that will need checking against your actual messages.

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

## Getting an APK

You do not need an Android toolchain for this. Every push builds a release APK
in CI and attaches it to the run.

1. Open the repository's **Actions** tab → **Build Android APK**.
2. Click the most recent run for your branch and wait for it to go green
   (the native build takes roughly 15-25 minutes on a cold cache).
3. Download **bank-spends-release-apk** from the Artifacts section at the
   bottom of the run page.
4. Unzip it and copy `app-release.apk` to your phone.

To install, enable "Install unknown apps" for whatever app you transferred it
with (Files, Drive, Chrome), then open the APK. Or over USB with adb:

```bash
adb install -r app-release.apk
```

Release rather than debug on purpose: a debug APK will not start without a
Metro dev server on the same network, whereas a release APK has the JavaScript
bundled and runs standalone.

### "App blocked to protect your device"

Play Protect blocks this build on install, with a warning about sensitive data
and financial fraud. That is expected and the APK is fine.

The warning is triggered by the combination of a sideloaded app, an unknown
signing key, and a `READ_SMS` declaration - which is also the exact profile of
an SMS-stealing fraud app. Play Protect cannot tell the two apart, and a real
signing key does not silence it, because the signal is "unknown developer",
not "bad signature".

Install anyway, easiest first:

**Over adb** - the install path Play Protect does not gate:

```bash
adb install -r app-release.apk
```

If that returns `INSTALL_FAILED_VERIFICATION_FAILURE`, turn off
Settings -> Developer options -> **Verify apps over USB**, then retry.

**By pausing the scanner** - Play Store -> your profile picture ->
**Play Protect** -> gear icon -> turn off **Scan apps with Play Protect**.
Install the APK, then turn it back on. Leaving it off is a bad trade for one
sideload.

**From the dialog** - some builds offer **More details** -> **Install anyway**
on the block screen itself. Many do not, in which case use one of the above.

Play Protect may keep flagging the app after install, and may re-prompt on
update. That does not affect how the app runs.

You can also build one locally, with the Android SDK installed:

```bash
cd android && ./gradlew assembleRelease
# android/app/build/outputs/apk/release/app-release.apk
```

### Signing

With no configuration, release builds are signed with the shared React Native
**debug key**. That is deliberate — it means the build works with zero setup —
and it is fine for sideloading onto your own phone.

It is not fine for anything else. That key is public, Play rejects it, and
anyone can re-sign the APK. Before giving the build to another person, generate
a real key:

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore bankspends.keystore -alias bankspends \
  -keyalg RSA -keysize 2048 -validity 10000
```

Then either put the properties in `~/.gradle/gradle.properties` for local
builds:

```properties
BANKSPENDS_STORE_FILE=/absolute/path/bankspends.keystore
BANKSPENDS_STORE_PASSWORD=...
BANKSPENDS_KEY_ALIAS=bankspends
BANKSPENDS_KEY_PASSWORD=...
```

or add these repository secrets so CI signs with it:
`BANKSPENDS_STORE_BASE64` (`base64 -w0 bankspends.keystore`),
`BANKSPENDS_STORE_PASSWORD`, `BANKSPENDS_KEY_ALIAS`, `BANKSPENDS_KEY_PASSWORD`.

**Keep the keystore and back it up.** Losing it means never being able to
update an installed app; it has to be uninstalled and reinstalled instead.

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
