# Shipping SMS access on Google Play

`READ_SMS` and `RECEIVE_SMS` are **restricted permissions**. An app requesting
them cannot be published without an approved Permissions Declaration Form, and
approval is not a formality. Read this before planning a release date.

## The problem

Google Play's SMS and Call Log Permissions policy lists a set of permitted core
use cases — default SMS handler, default phone handler, backup and restore,
device automation, and a few others. **Generic expense tracking is not on that
list.** Requesting `READ_SMS` for this app means requesting a case-by-case
exception.

Exceptions are granted. Several Indian personal-finance apps hold them. But:

- Review takes weeks, and rejections are common on the first attempt.
- The declaration must be re-submitted and re-reviewed on changes.
- An exception can be withdrawn later. Google has removed SMS access from whole
  app categories before.

## The hard rule

**If this app ever offers lending, SMS access is off the table permanently.**
Play policy explicitly bars personal-loan apps from accessing SMS and contacts.
This is not negotiable and not appealable. Decide early, because it constrains
the product, not just the manifest.

## Making the declaration as strong as possible

The build is already arranged to support the argument. Point at the code:

1. **Minimal scope.** `NativeSmsReaderModule.query` takes an allow-list of bank
   sender fragments and filters natively. Messages from anyone who is not a
   registered bank are never read into the app. There is no unfiltered read
   path in the codebase.
2. **No transmission.** There is no server. Nothing leaves the device. This is
   the single strongest point available and it is worth keeping true.
3. **No body retention.** Only the derived transaction is stored. The message
   text is discarded after parsing.
4. **Graceful degradation.** The app runs and is useful without the permission,
   which demonstrates SMS is an enhancement rather than a pretext.
5. **In-context rationale.** The permission prompt is preceded by a screen that
   explains what is read and why, not a cold system dialog on launch.

Record a short screencast of the permission flow and the privacy copy — the
review asks for one, and a clear video settles most first-round questions.

## Plan for rejection

Keep the email path (Gmail / Microsoft Graph) on the roadmap as the fallback
ingestion route, not as a nice-to-have. If the declaration is refused, email
plus statement import plus Account Aggregator is a shipping product; SMS alone
is not a business you can build on.

## iOS, for completeness

There is no equivalent. iOS offers no API to read SMS at any entitlement level.
`ILMessageFilterExtension` sees only messages from unknown senders and is
heavily sandboxed. An iOS version of this app is email, statements and Account
Aggregator — never SMS. Plan the data model for that from the start.
