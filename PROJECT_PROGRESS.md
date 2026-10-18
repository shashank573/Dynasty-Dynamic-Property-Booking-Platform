# DynaStay — Complete Project Scope, Architecture & Progress

> **Last updated:** 2026-10-18  
> **Repository:** `shashank573/Dynasty-Dynamic-Property-Booking-Platform`  
> **Primary branch:** `main`  
> **Purpose of this document:** Give a new reader enough context to understand what DynaStay is, how its current implementation works, what is verified, what remains, and how future work should be approached. This is a living progress record, not a claim that the application is production-ready.

---

- **Repository:** `shashank573/Dynasty-Dynamic-Property-Booking-Platform`
- **Current feature branch:** `feature/complaint-ejs-ui` (EJS complaint interface integration pending review)
- **Parking Reservations:** merged into `main` through PR #2.
- **Complaints backend:** merged into `main` through PR #3 (squash merge commit `2cc497f705a59425958d2582c44f9a22e80ac499`).
- **Latest user-reported full test run before the latest PR review fixes:** `npm test` — **111 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo** (about 10.7 seconds).
- The user ran this test suite locally at commit `7faaced`. Additional PR review changes were subsequently pushed, including a new complaint UI transition test; rerun `npm test` before treating the current branch as verified.
- Deployment behavior has not been verified in this update.

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

### 3. Complaints
**Status: Backend and controlled reopen workflow merged through PR #3; EJS frontend integration implemented on `feature/complaint-ejs-ui` and awaiting review/testing.**

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
- Review admin authorization, input validation, information exposure and concurrency/race behavior around complaint status changes.
- Run `npm test` on the branch and review the new EJS page-render/role-access tests.
- Perform browser-level end-to-end testing of complaint submission, privacy, admin transitions and reopening; automated HTTP tests do not execute browser JavaScript.
- Smoke-test complaint flows in the deployed application after deployment.
- PR #3 was previously merged into `main`; PR #4 remains open until GitHub confirms otherwise.

### 4. Admin Verification
**Status: Not started.**

Planned:
- Inspect existing User, Host and property models and authorization before designing changes.
- Agree on evidence/data Hosts must submit and what an Admin reviews.
- Define verification states and permitted transitions, such as Pending, Approved and Rejected.
- Add admin-only review/decision routes and audit metadata.
- Add model, route, validation, authorization and edge-case tests.
- Propose the design and exact file changes before implementation; wait for approval.

### 5. Trust Score
**Status: Not started.**

Planned:
- Agree on a transparent and explainable scoring model before coding.
- Identify reliable signals and how each affects the score, such as completed stays, reviews, verified status and upheld complaints.
- Define score bounds, missing-data behavior, update strategy and abuse resistance.
- Do not automatically penalize users for unverified allegations.
- Add calculation tests and document score explanations.
- Do not invent scoring weights without approval.

### 6. Frontend Integration
**Status: Pending. Existing interface uses EJS; a React migration is not confirmed.**

Planned:
- Audit current EJS pages and available routes.
- Decide whether to integrate features into EJS first or explicitly plan a React integration.
- Integrate parking, complaints, verification and Trust Score flows.
- Add loading, validation, success/error and authorization-aware states.
- Add end-to-end/integration coverage for key user flows.
- Preserve existing EJS functionality unless a migration is explicitly approved.

### 7. Final Security, Testing & Documentation
**Status: In progress; final phase not complete.**

Planned:
- Run focused tests and full `npm test` after meaningful changes.
- Review authentication, authorization, ownership, input validation, sessions, secrets, error handling and sensitive-data exposure.
- Review transaction behavior and production configuration.
- Check dependencies and deployment setup.
- Update setup instructions, API/architecture documentation and this progress tracker.
- Record only tests actually run and their real results.
- Review Git status/diffs and ensure secrets are never committed.
- Run a final end-to-end smoke test and document known risks.

## Immediate Next Steps

1. Run and review the full test suite for `feature/complaint-ejs-ui` after the latest review fixes.
2. Perform browser-level end-to-end testing of complaint submission, user privacy, admin status transitions and reopening.
3. Confirm PR #4 mergeability after the duplicate case-conflicting progress file is removed and the admin status controls are aligned with backend transitions.
4. Before implementing Admin Verification or Trust Score, inspect the current repository and propose the design/file changes and scoring rules for approval.
5. After deployment, smoke-test complaint flows in the deployed application.

## Project Stack and Working Rules

- **Backend:** Node.js, Express 5
- **Database:** MongoDB + Mongoose
- **Current interface:** EJS templates
- **Validation:** Joi
- **Authentication:** session-based authentication and bcrypt password hashing
- **Testing:** Node.js built-in test runner, Supertest and MongoDB Memory Server
- **Roles:** Guest, Host, Admin
- **React frontend:** planned; migration not confirmed
- **JWT:** planned; implementation not confirmed
- **Live payment gateway/mobile app:** out of scope unless project scope changes

Working rules:
1. Explain changes in simple Hinglish and work one task at a time.
2. Inspect current code before changing it.
3. Explain the goal, files affected and tests before implementation.
4. Preserve existing functionality and local changes.
5. Never claim tests passed unless the result is available.
6. Do not commit `.env`, credentials or secrets.
7. Avoid destructive Git commands and review diffs before committing.
8. Do not run a destructive seed script against data that must be preserved.
9. Do not merge a feature branch into `main` without explicit user approval.
10. Keep this document current when a milestone is verified.

## Historical Notes

- Day 1: repository audit, startup/testing foundation, Listing/Review tests, initial authentication and REST API were implemented.
- Day 2: role-based listing access, review ownership checks and signup session regeneration were implemented.
- Day 3: Unit model/management and Booking model/creation/concurrency foundation were implemented and tested for covered scenarios.
- Parking Reservations: implemented and merged into `main` through PR #2.
- Complaints: backend and controlled reopen workflow merged into `main` through PR #3.
