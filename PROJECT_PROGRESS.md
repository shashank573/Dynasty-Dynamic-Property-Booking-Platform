# DynaStay — Complete Project Scope, Architecture & Progress

> **Last updated:** 2026-10-18  
> **Repository:** `shashank573/Dynasty-Dynamic-Property-Booking-Platform`  
> **Primary branch:** `main`  
> **Purpose of this document:** Give a new reader enough context to understand what DynaStay is, how its current implementation works, what is verified, what remains, and how future work should be approached. This is a living progress record, not a claim that the application is production-ready.

---

## 1. Executive Summary — What Are We Building?

**DynaStay is a property-booking platform built with Node.js, Express, MongoDB/Mongoose and server-rendered EJS pages.** Its central workflow is to let users discover property listings, book an individual unit for a date range, and optionally coordinate parking. The platform distinguishes Guests, Hosts and Admins so that ordinary users can book and manage their own activity, property owners can manage their own listings and inventory, and administrators can handle platform-level work such as complaints.

The project is more than a basic listing website. Its backend has been developed with particular attention to ownership checks, server-side validation, password hashing, session handling, booking-date correctness and concurrency. A booking request must not be accepted merely because a unit looked available a moment earlier: the application checks overlapping active bookings and uses MongoDB transactions plus shared-document writes to coordinate competing requests. Parking reservations use a similar transactional approach. A complaint-management backend provides private complaint history for the person who submitted a complaint and a restricted queue for administrators, including controlled status changes and an auditable reopen operation.

The current interface is EJS-based. A migration to React is **not confirmed** and must not be treated as completed scope. Likewise, JWT authentication, a live payment gateway and a mobile app are not confirmed as implemented. The project roadmap also includes Admin Verification, a Trust Score, frontend integration for backend capabilities, and a final security/deployment review.

### Project at a glance

- **Product:** Property and unit booking, with optional parking reservations and complaint handling.
- **Main roles:** Guest, Host, Admin.
- **Runtime:** Node.js with Express 5.
- **Data:** MongoDB through Mongoose.
- **Pages:** EJS templates rendered on the server, using EJS-Mate.
- **Validation:** Joi request schemas plus Mongoose model constraints.
- **Authentication:** Express sessions, Mongo-backed session storage dependency, and bcrypt password hashing.
- **Booking reliability:** Date-overlap checks, MongoDB transactions, shared Unit/Parking document writes, and conditional updates.
- **Automated tests:** Node.js built-in test runner, Supertest and MongoDB Memory Server.
- **Verified recent test report:** User-reported `npm test` run on the cleanup branch: **107 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo**. This result was supplied in terminal output during the project conversation; it was not executed by this documentation update.
- **Recently merged:** PR #6, conservative cleanup of obsolete commented-out code, merged into `main` using squash merge. Merge commit: `e66ca4c5fcb4437e25de142599801cfe782dfff6`.
- **Not yet complete:** Complaint UI integration, Admin Verification, Trust Score, full frontend integration decisions, final security review, production deployment verification and end-to-end smoke testing.

---

## 2. How the Application Works — Main User Journeys

### 2.1 Guest journey

1. A visitor opens the application and reaches the listings page.
2. A user can sign up or log in. Passwords are hashed with bcrypt; a public signup request cannot grant itself the Admin role.
3. A logged-in user requests a booking for a Unit with check-in and check-out dates.
4. The server validates the request and dates. The total price is calculated on the server rather than trusted from a client-supplied amount.
5. The server checks the Unit's availability and searches for overlapping Pending or Confirmed bookings.
6. When parking inventory exists, the booking workflow can attempt to allocate an eligible parking slot. If slots exist but none are available, the user can be asked to choose whether to continue without parking. A configured absence of parking inventory does not by itself block an otherwise valid property booking.
7. The booking and any linked parking reservation are coordinated in a MongoDB transaction so related writes commit or roll back together.
8. The user can access booking-related flows, and eligible cancellation updates the booking and releases its linked property-parking reservation transactionally.

**Important:** These are implementation-level workflows, not a guarantee that every screen has been fully integrated or that every production deployment scenario has been tested.

### 2.2 Host journey

1. A Host manages property listings they own.
2. Listing creation and updates pass through validation and role/ownership middleware.
3. A Listing can have Units. Unit data includes capacity, nightly price and availability.
4. A listing owner can configure numbered parking inventory and hourly/daily prices.
5. Ownership checks prevent a different Host from modifying another Host's listings or their Units.

### 2.3 Parking journey

Parking supports two broad reservation paths:

- **Property-linked parking:** parking allocated as part of a property booking, using the same date range and transaction lifecycle as that booking.
- **Independent parking reservation:** a logged-in user reserves a parking slot for a start/end time with hourly or daily billing.

The backend checks valid time ranges and active reservation overlap. It also rechecks slot state when performing writes so a slot deactivated during selection is not assigned based on stale query results. Independent reservations have their own status and cancellation rules.

### 2.4 Complaint journey

1. A logged-in user submits a complaint with a category, subject and description.
2. A complaint may optionally refer to a Booking. If it does, the server verifies that the booking belongs to the currently logged-in user.
3. A user can retrieve only their own complaint history. Internal admin notes, handler details and reopen history are omitted from that user-facing response.
4. An Admin can view the complaint queue and filter by status.
5. An Admin can progress a complaint through the controlled workflow: `Open → In Review → Resolved` or `Open → In Review → Rejected`.
6. Closed complaints cannot be changed through the ordinary status endpoint. An Admin must use the explicit reopen endpoint, supply a reason, and leave an audit record of the previous status, reason, administrator and timestamp.

The complaint backend exists, but its complete user-facing EJS interface integration remains future work.

### 2.5 Admin journey — current and planned

**Current:** Admin role checks exist for complaint queue/status management and the complaint reopen workflow.

**Planned:** a Host/property verification workflow and a Trust Score system. Their detailed policies and scoring rules must be agreed before implementation. Do not assume these planned features already exist.

---

## 3. Architecture and Technology

### 3.1 Technology stack

| Layer | Current technology / purpose |
|---|---|
| Runtime | Node.js |
| Web framework | Express 5 |
| Database | MongoDB |
| ODM | Mongoose |
| Page rendering | EJS and EJS-Mate |
| Request validation | Joi and model-level Mongoose validation |
| Authentication | Express sessions |
| Password security | bcryptjs password hashing |
| Session storage dependency | connect-mongo |
| Environment configuration | dotenv |
| Method support | method-override |
| Automated HTTP tests | Supertest |
| Test database support | MongoDB Memory Server |
| Test runner | Node.js built-in `node --test` |

The repository uses CommonJS modules. The `start` script runs `node server.js`; the `test` script runs `NODE_ENV=test node --test`.

### 3.2 Startup and configuration

- `server.js` loads environment variables.
- Outside test mode, startup requires `SESSION_SECRET`; absence causes an explicit startup error.
- MongoDB URL comes from `MONGO_URL`, with a local development fallback of `mongodb://127.0.0.1:27017/DynaStay`.
- Port comes from `PORT`, with a default of `8080`.
- The server connects to MongoDB before it starts listening.
- Startup connection failures are logged and terminate the process.
- Secrets must stay in environment configuration and must never be committed.

### 3.3 Application composition

- `app.js` configures middleware, static assets, session/auth-related handling, route mounts, the root redirect, the API health check and the final error handler.
- Route files hold feature-specific HTTP logic.
- Model files define persistence structure, constraints, references, indexes and hooks.
- `schema.js` holds Joi request schemas.
- `middleware/auth.js` supplies role/authentication/ownership middleware.
- `utils/wrapAsync.js` wraps async route handlers; `utils/ExpressError.js` represents application HTTP errors.
- `views/` contains server-rendered templates.
- `public/` contains static client assets.
- `tests/` contains automated tests.
- `docs/OS_CONCEPT_LENS.md` explains how the project's database coordination maps to concurrency concepts.

This list describes the current observed structure at a high level. Inspect the actual file tree before assuming a specific endpoint, page, or module exists.

---

## 4. Data Model and Entity Responsibilities

### 4.1 User

Represents an account. Current fields include name, unique normalized email, hashed password, role and timestamps. Roles are `Guest`, `Host` and `Admin`; new users default to Guest. The model hashes a modified password using bcryptjs and exposes a password comparison method.

### 4.2 Listing

Represents a property offered on the platform. It includes title, description, image, price/location/country fields, owner reference and a list of Review references. Listing ownership is important for Host authorization. A Mongoose post-`findOneAndDelete` hook deletes the Listing's associated reviews when the Listing is deleted; the cleanup must preserve both this hook and the explanatory comment in the delete route.

### 4.3 Unit

Represents a bookable unit under a Listing. It references its Listing and stores name, description, capacity, nightly price, availability and timestamps. Capacity must be a positive integer; nightly price cannot be negative. The `bookingVersion` counter is used as part of the shared-document write pattern that coordinates competing booking transactions.

### 4.4 Booking

Represents a guest's reservation of a Unit. It references the Guest and Unit and stores check-in, check-out, total price, status and timestamps. Check-out must be after check-in; total price must be non-negative. Status values include Pending, Confirmed, Cancelled and Completed. Overlap checks treat Pending and Confirmed bookings as active conflicts.

### 4.5 Parking and ParkingReservation

The Parking inventory model represents a numbered slot associated with a Listing, with active/inactive state, hourly/daily pricing and a booking-version counter used for concurrency coordination. `ParkingReservation` records the Guest, Parking slot, start/end, reservation type, optional related Booking, billing unit, total price, status and timestamps. Its reservation type distinguishes property-linked and independent reservations; billing units include free, hour and day. Active Pending/Confirmed reservations participate in overlap checks.

### 4.6 Review

Represents feedback associated with a Listing and user. The current routes and tests enforce ownership when deleting a review and verify that a review cannot be deleted through an unrelated Listing URL. Listing deletion cascades to its referenced reviews through the Listing model hook.

### 4.7 Complaint

Represents a user-submitted issue. Current fields include complainant, optional Booking reference, category, subject, description, status, internal admin note, handler and handling timestamp, reopen history, and timestamps. The model constrains categories/statuses and validates text lengths. Reopen history stores the previous closed status, reason, Admin who reopened it and time.

### 4.8 Relationships — simplified

- One User may own many Listings.
- One Listing may contain many Units and Parking slots.
- One Guest may have many Bookings.
- Each Booking references one Unit and a Guest.
- A Booking may have a linked property-parking reservation; independent parking reservations do not require a Booking reference.
- A Listing can reference multiple Reviews; deleting a Listing triggers deletion of its associated reviews.
- A Complaint belongs to one complainant and may optionally reference one of that user's Bookings.
- A Complaint may record the Admin who handled it and one or more reopen-history events.

This is a conceptual summary; consult the actual Mongoose schemas before producing a formal ER diagram or migration.

---

## 5. Feature-by-Feature Status

### 5.1 Authentication, accounts and roles
**Status: Core backend implemented; final security review remains.**

Implemented:
- Signup and login routes.
- bcrypt password hashing and password comparison.
- Guest, Host and Admin roles.
- Public signup cannot self-assign Admin.
- Session-related protections, including session regeneration described in the project history.
- Startup validation requiring `SESSION_SECRET` outside test mode.

Remaining:
- Audit session cookie flags, secure deployment configuration, session lifetime and invalidation behavior.
- Confirm the active session-store configuration in the current deployment environment.
- Verify all privileged routes enforce server-side role and ownership checks.
- Perform production smoke tests; automated tests alone are not a deployment sign-off.

### 5.2 Listings and Reviews
**Status: Core CRUD and ownership controls implemented; covered by tests.**

Implemented:
- Listing index/show/create/edit/update/delete routes.
- Joi validation for listing inputs.
- Host/Admin restrictions for creation and owner restrictions for edits/deletes.
- Review creation and deletion ownership checks.
- Protection against deleting a review via the wrong Listing URL.
- Listing deletion triggers associated-review cleanup through a model hook.

Remaining:
- Review UX, error states and data-integrity behavior should be checked end to end.
- Review malformed/missing record handling and user-facing error messages.
- Preserve model hooks and important explanatory comments during future cleanup.

### 5.3 Units
**Status: Core backend implemented; integration tests cover key authorization and validation cases.**

Implemented:
- Listing owner can list/create/update Units.
- A Host cannot change another Host's Units.
- Capacity and price validation.
- A Unit with booking history cannot be deleted; a Unit without booking history can be deleted.
- Booking version field supports concurrency coordination.

Remaining:
- Review lifecycle rules for disabling Units and future bookings.
- Verify the UI exposes capacity, availability and price validation clearly.
- Check behavior for archived listings and Units with historical bookings.

### 5.4 Property bookings and concurrency
**Status: Core booking flow and automated concurrency coverage implemented; production reliability review remains.**

Implemented:
- Authenticated booking creation.
- Request schema and date validation, including invalid calendar dates and check-out ordering.
- Past check-in rejection using the Asia/Kolkata calendar date.
- Server-side total-price calculation.
- Unit existence/availability checks.
- Overlap detection for Pending and Confirmed bookings.
- MongoDB transaction and shared Unit write to coordinate simultaneous overlapping requests.
- Optional parking allocation in the property-booking transaction.
- Conditional cancellation behavior and linked parking release.
- Tests include two simultaneous overlapping booking attempts; only one is expected to succeed.

Remaining:
- Review transaction retries, transient errors, write conflicts and user-facing retry behavior.
- Verify the production MongoDB deployment is a replica set/sharded setup that supports transactions.
- Audit date-only conversion, timezone boundaries, daylight/time assumptions and booking status transitions.
- Confirm the policy for Pending reservations and how long they remain active.
- Do not claim concurrency is mathematically or operationally guaranteed for all scenarios merely because the current automated cases pass.

### 5.5 Parking Reservations
**Status: Implemented and merged to main through PR #2.**

Implemented:
- Listing owners create/list parking slots.
- Availability endpoint checks active slots and overlapping active reservations.
- Independent hourly and daily reservation flow with server-side pricing.
- Optional selection of a particular slot.
- Transactional slot selection, conflict check and reservation creation.
- Conditional cancellation; completed reservations and another guest's reservation cannot be cancelled by an unauthorized user.
- Property booking may automatically allocate parking.
- Guest choice is requested when parking inventory exists but all eligible slots are unavailable.
- Deactivating a slot during selection is handled by rechecking the conditional write.
- Tests cover overlap, simultaneous requests, billing, cancellation and linked reservation lifecycle.

Remaining:
- Production transaction support and operational failure recovery.
- Review slot provisioning, duplicate slot identifiers and deactivation lifecycle.
- Confirm hourly/daily rounding, minimum charge and partial-period billing rules match product requirements.
- Confirm parking screens are accessible and understandable from the current UI.
- Smoke-test linked and independent reservations in a deployed environment.

### 5.6 Complaints
**Status: Backend and controlled reopen workflow implemented and merged to main through PR #3. Frontend integration remains pending.**

Implemented:
- Complaint model with constrained categories, statuses, text lengths and audit metadata.
- Logged-in users can submit complaints.
- Optional Booking link is accepted only when that Booking belongs to the current user.
- Users can retrieve only their own complaints.
- User-facing history excludes internal admin notes, handler metadata and reopen history.
- Admin-only queue and status filtering.
- Admin-only status update and internal notes.
- Allowed progression: Open → In Review → Resolved/Rejected.
- Explicit Admin-only reopen route for closed complaints, requiring a reason and storing audit history.
- Tests cover authorization, validation, booking ownership, privacy, status transitions and reopen behavior.

Remaining:
- Integrate submission/history into the EJS interface.
- Integrate the Admin complaint queue, status filters, internal notes and reopen reason UI.
- Add success, validation and error states.
- Review simultaneous Admin updates and race conditions on status transitions.
- Smoke-test complaint privacy and Admin permissions after deployment.

### 5.7 Admin Verification
**Status: Planned / not implemented in the progress record.**

Work to do:
1. Inspect existing User, Listing and authorization models/routes.
2. Decide what is being verified: Host identity, property ownership, property details, or a combination.
3. Define required evidence, allowed formats, retention/privacy rules and review expectations.
4. Define states and transitions (for example Pending, Approved, Rejected, Resubmission Required) only after agreement.
5. Add Admin-only review/decision routes and audit metadata.
6. Decide what Guests and Hosts can see about a verification decision.
7. Add validation, authorization, privacy and transition tests.
8. Integrate status display and submission screens into the UI.
9. Do not invent legal/compliance requirements or automatically approve submissions.

### 5.8 Trust Score
**Status: Planned / not implemented in the progress record.**

Work to do:
1. Agree on what the score measures and whose score it is (Host, Listing, Guest, or more than one).
2. Define explainable signals, eligibility and score bounds.
3. Decide how verified status, completed stays and reviews are used.
4. Define how complaints are treated: an allegation alone must not automatically penalize a person; only carefully defined, reviewed outcomes should be considered.
5. Define missing-data behavior, update timing, recalculation and auditability.
6. Test edge cases and document why a score changes.
7. Obtain approval for weights and thresholds before implementing them.

### 5.9 Frontend / EJS integration
**Status: Existing EJS interface; new backend workflows still need UI integration. React migration is unconfirmed.**

Work to do:
- Audit existing templates and route response formats before building new screens.
- Integrate booking date/price/parking-choice feedback.
- Integrate parking slot management, availability, independent reservations and cancellation.
- Integrate complaint submission/history and Admin complaint management.
- Later integrate Admin Verification and Trust Score once their rules are agreed.
- Add loading, empty, success, validation and error states.
- Ensure the UI never substitutes for server-side authorization.
- Keep current EJS flows working unless a React migration is explicitly planned and approved.
- Add end-to-end coverage for key user journeys.

### 5.10 Final security, QA, deployment and documentation
**Status: In progress; no complete production sign-off recorded.**

Work to do:
- Run focused and full automated tests after changes.
- Review authentication, role checks, ownership, request validation and sensitive data exposure.
- Review session settings, secret handling, database permissions and production configuration.
- Confirm MongoDB transaction support.
- Check dependency health and startup behavior.
- Run smoke tests against a deployment environment.
- Document deployment, environment variables, backup/recovery expectations and operational troubleshooting.
- Record test evidence accurately, including branch/commit and environment.
- Check diffs and Git status before commits; never commit credentials.
- Keep architecture, diagrams, setup documentation and this progress tracker synchronized with actual implementation.

### 5.11 Conservative dead-code cleanup
**Status: PR #6 merged into main.**

PR #6: [chore: remove confirmed obsolete commented-out code](https://github.com/shashank573/Dynasty-Dynamic-Property-Booking-Platform/pull/6)

- Removed a disabled sample `/testListing` route and obsolete commented alternatives in `app.js`.
- Removed obsolete commented-out listing creation/validation code and debug logging in `routes/listing.js`.
- Normalized route section comments/spacing.
- Restored and preserved the explanatory comment that Listing deletion triggers the post middleware which deletes associated reviews.
- Squash merge commit: `e66ca4c5fcb4437e25de142599801cfe782dfff6`.
- The user reported 107 passing tests on the cleanup branch before the final comment-only restoration. The suite was not rerun after that comment restoration or by this documentation update.
- No feature/business logic was intended to change in this cleanup.

---

## 6. Testing and Evidence

### 6.1 Latest reported full-suite result

The latest complete test output provided by the user during the cleanup review reported:

- Tests: 107
- Passed: 107
- Failed: 0
- Cancelled: 0
- Skipped: 0
- Todo: 0
- Runtime: approximately 10.6 seconds

This is evidence that the suite passed in that local checkout at that time. It is **not** evidence of a fresh run on the current `main` commit, and it does not replace a deployed smoke test.

### 6.2 Test areas visible in the reported run

- Root and authentication-gated listing routes.
- Signup, password hashing, duplicate email, password policy and role assignment.
- Booking integration: date validation, unit availability, overlapping reservations, simultaneous booking requests, parking allocation and cancellation.
- Booking schema/model validation.
- Complaint submission, ownership/privacy, Admin access, status transitions and reopening.
- Listing CRUD and review cleanup.
- Parking availability, billing, overlaps, simultaneous reservations and cancellation.
- Unit authorization, validation and booking-history restrictions.
- User password hashing and default role.

### 6.3 Test strategy going forward

After a meaningful code change:
1. Run the focused test file(s).
2. Run `npm test`.
3. Record the branch/commit, environment and exact result.
4. Review `git diff` and `git status --short`.
5. For concurrency/transaction work, include realistic overlapping requests and transaction-failure cases where feasible.
6. Before release, run a smoke test against the intended deployment configuration.

---

## 7. Operating Systems / Concurrency Concepts in the Project

The project uses database-backed concurrency techniques to coordinate overlapping HTTP requests. It does **not** implement its own OS scheduler, thread manager, mutex or semaphore.

The shared documentation lens is in `docs/OS_CONCEPT_LENS.md`:

- **Concurrency Control:** shared Unit/Parking document writes make competing transactions coordinate.
- **Race Condition:** two guests can request the same unit dates or parking slot at nearly the same time.
- **Atomicity / Transaction:** related writes (such as a Booking and its linked parking reservation) commit or roll back together.
- **Atomic Conditional Update:** cancellation and inventory operations check current state at update time to avoid overwriting a competing change.

Relevant code locations include `routes/booking.js`, `routes/parking.js`, and booking/parking integration tests. When creating or updating sequence diagrams, keep their messages consistent with actual transaction boundaries, conditions and error paths. The HTML sequence diagrams discussed in earlier project conversations were not confirmed present in the current main branch during this update; do not assume they are version-controlled unless the repository is checked.

---

## 8. Current Progress — Honest Overall Assessment

The core backend is substantially developed: accounts/roles, Listings, Reviews, Units, property booking, booking concurrency controls, parking reservations and complaint handling have implementations and automated test coverage. Parking and complaint backend milestones have been merged to `main`; the latest cleanup PR has also been merged. The reported test suite is healthy in the user's local cleanup checkout.

However, **“107 tests pass” does not mean the project is finished**. Complaint UI integration is still pending, Admin Verification and Trust Score are roadmap items, production transaction/configuration support is not confirmed here, and no complete production deployment/end-to-end sign-off is recorded. The project should be described as a functional backend foundation with meaningful automated coverage and several product/integration/reliability tasks remaining—not as a fully shipped production service.

No single completion percentage is stated because there is no agreed weighting for the seven workstreams; assigning one would imply precision that the current evidence does not support.

---

## 9. Recommended Next Steps — In Order

1. **Synchronize local checkout with GitHub `main`.** Fetch and inspect the latest main commit; avoid overwriting local work.
2. **Refresh this progress document whenever a feature or test milestone changes.**
3. **Integrate the Complaint workflows into EJS**: submit complaint, view own complaints, Admin queue/filter/status update/reopen.
4. **Review booking and parking transaction behavior**: production MongoDB transaction support, retries/write conflicts, cancellation races and date boundaries.
5. **Plan Admin Verification**: inspect existing models/routes and propose exact policy, files and tests before implementation.
6. **Agree on Trust Score policy** before coding: signals, weights, transparency, missing data and complaint treatment.
7. **Complete frontend integration** for parking and future features without silently migrating from EJS to React.
8. **Perform final security and deployment review** and run end-to-end smoke tests.
9. **Update architecture diagrams and supporting docs** so they reflect actual code, not an aspirational design.

Priorities can be reordered with the user's approval.

---

## 10. Project Working Agreement

- Explain technical work in simple Hinglish when discussing it with the user.
- Work in small, reviewable steps and explain the purpose, affected files and tests before substantial changes.
- Inspect the current code before changing it; do not assume older conversation notes are still accurate.
- Preserve existing behavior, useful comments and local uncommitted work.
- For potentially risky or broad changes, explain the proposal and wait for approval.
- Never claim a test was run unless a real result is available.
- Do not commit `.env`, credentials, access tokens or secrets.
- Avoid destructive Git commands; inspect status and diffs before commits.
- Do not run destructive seed scripts against data that must be preserved.
- Do not merge branches/PRs without explicit user approval.
- Keep `PROJECT_PROGRESS.md` accurate: separate implemented, planned, user-reported, independently verified and deployment-verified work.
- Do not invent product rules, Trust Score weights, verification policy or deployment state.
- Do not treat future React/JWT/payment/mobile plans as implemented features unless the repository and approved scope confirm them.

---

## 11. Milestone History

- **Foundation:** repository audit, server/testing foundation, Listing/Review coverage and initial authentication/API work.
- **Authentication/roles:** role-based listing access, review ownership checks, signup session regeneration and session-secret validation.
- **Units and bookings:** Unit management, Booking model/creation, date validation and concurrency foundation.
- **Parking Reservations:** backend implemented and merged into `main` through PR #2.
- **Complaints:** complaint backend and controlled reopen workflow merged into `main` through PR #3.
- **Conservative cleanup:** PR #6 merged into `main`; obsolete commented-out code removed while active routes and model behavior were retained.
- **Current documentation milestone:** `PROJECT_PROGRESS.md` expanded to describe product purpose, user flows, architecture, entities, feature status, evidence, remaining work and working rules.

**Source-of-truth rule:** The current repository, its tests and merged Git history take precedence over stale progress notes. When a statement cannot be verified from those sources or an explicit user-reported result, label it as planned, reported or unverified rather than presenting it as fact.
