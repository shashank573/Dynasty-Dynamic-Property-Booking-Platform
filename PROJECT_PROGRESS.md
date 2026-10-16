# DynaStay — Project Progress Tracker

## 1. Project Scope

- **Project:** DynaStay — Dynamic Property Booking Platform
- **Backend:** Node.js + Express 5
- **Database:** MongoDB + Mongoose
- **Current web interface:** EJS templates
- **Testing:** Node.js built-in test runner, Supertest, and MongoDB Memory Server
- **Validation:** Joi
- **Authentication:** Session-based authentication with bcrypt password hashing
- **User roles:** Guest, Host, Admin
- **Frontend:** React planned; implementation not confirmed
- **JWT authentication:** Planned; not confirmed as implemented

### Planned Core Features

- Property listings
- Independently bookable units
- Date-based bookings
- Parking reservations
- Booking overlap prevention
- Reviews and review ownership
- Complaints
- Admin verification
- Trust Score
- Trial payment workflows
- Booking cancellation workflows

**Out of scope:** Live payment gateway and mobile app, unless the project scope changes.

---

## 2. Project Working Rules

1. Explain concepts in simple Hinglish.
2. Work on one task at a time.
3. Inspect existing code before making changes.
4. Explain the goal, reason, exact file paths, commands, expected output, and tests.
5. Do not move to the next task until the current task has been verified.
6. Preserve existing functionality unless a change is necessary.
7. Never claim tests passed unless they were actually run.
8. Keep this file updated after verified milestones.
9. Review Git status and staged changes before committing.
10. Never commit `.env` files, credentials, or secrets.
11. Avoid destructive Git commands unless their effects are understood and explicitly intended.
12. Do not run the destructive seed script against a database containing data that must be preserved.
13. Do not mark a feature complete until its behavior has been tested.
14. Continue from the actual repository state, not assumptions.
15. Before starting a new day or implementation task, explain its objective and plan; make no code changes until the user explicitly approves them.

---

## 3. Current Project Progress

### Backend and Application Structure

- The project uses Node.js, Express 5, MongoDB/Mongoose, EJS, Joi, and Express Router.
- Application configuration is separated from server startup:
  - `app.js` exports the Express application.
  - `server.js` handles MongoDB connection and server startup.
- Existing Listing and Review functionality has been preserved.
- Listing model CRUD tests and Listing/Review route integration tests are present.
- Listing update route uses Mongoose `runValidators: true`.
- Review timestamp default uses `Date.now`.
- The project has a health endpoint and initial JSON API endpoints.
- Unit and Booking models have been added.
- Unit management routes and integration tests have been added.
- Booking creation and overlapping-booking prevention have been implemented with MongoDB transaction-based coordination.

### API Endpoints

- `GET /api/health`
  - Reports API health and MongoDB connection status.
- `GET /api/listings`
  - Returns listing data as JSON.
- `GET /api/listings/:id`
  - Returns an individual listing.
  - Invalid listing IDs return HTTP 400.
  - A valid ID without a matching listing returns HTTP 404.

The API endpoints were manually verified during Day 1.

### Authentication and User Management

- User model exists in `models/user.js`.
- Passwords are hashed using bcrypt.
- Password verification uses the model's `comparePassword` method.
- User roles are `Guest`, `Host`, and `Admin`.
- The default role is `Guest`.
- Signup and login routes use session-based authentication.
- Signup validates input, rejects duplicate email addresses, and enforces a minimum password length.
- Public signup cannot assign the Admin role.
- Session configuration uses `express-session`.
- MongoDB-backed session storage is used outside the test environment.
- Session cookies include `httpOnly`, `sameSite: "lax"`, a 24-hour maximum age, and `secure` in production.
- Login session regeneration was already implemented.
- Signup session regeneration and session-save handling were added during Day 2.
- `SESSION_SECRET` startup validation has been implemented.

### Authorization and Review Security

- Authentication middleware exists in `middleware/auth.js`.
- `isHostOrAdmin` middleware has been added.
- Creating a listing and accessing the new-listing page require Host or Admin authorization.
- Listing modification routes retain ownership checks.
- Listing creation assigns the logged-in user as the listing owner.
- A missing Listing owner is handled safely by returning HTTP 403 with `Listing ownership is not configured.`
- Review creation requires login.
- New reviews record the logged-in user as their author.
- Review deletion requires login and verifies review ownership.
- Unauthorized review deletion returns HTTP 403.
- Review deletion handles a missing author reference without calling `.toString()` on an absent value.
- Review deletion removes the review record and its reference from the listing.

### Unit Model and Validation

**Status: Implemented and tested.**

- Added `models/unit.js`.
- Each Unit references its parent Listing using a Mongoose ObjectId.
- Unit fields include:
  - `listing`: required Listing reference.
  - `name`: required string with whitespace trimming.
  - `description`: optional string, defaulting to an empty string.
  - `capacity`: required integer, minimum 1.
  - `pricePerNight`: required number, minimum 0.
  - `isAvailable`: Boolean, defaulting to `true`.
  - `timestamps`: automatically maintains `createdAt` and `updatedAt`.
- Added `tests/unit.test.js`.
- Unit model validation tests cover valid creation, missing listing reference, invalid capacity, fractional capacity, negative nightly price, and missing unit name.

### Booking Model and Booking Creation

**Status: Implemented; local verification completed for the tested scenarios.**

- Added `models/booking.js`.
- Booking records reference the guest User and bookable Unit.
- Booking data includes check-in, check-out, total price, and status.
- Model validation covers required fields, date ordering, non-negative price, and supported status values.
- Added `tests/booking.test.js`.
- Added `routes/booking.js`.
- Booking creation validates request data and rejects past check-in dates using IST date handling.
- Guest identity is derived from the authenticated session.
- Total price is calculated on the server using the Unit's nightly price and booking duration.
- Unit availability and overlapping active bookings are checked.
- A MongoDB transaction and shared Unit-document write are used to coordinate concurrent booking attempts.
- Booking route tests include simultaneous overlapping booking requests.
- The simultaneous overlapping-booking test was run 10 times, and all 10 reported runs passed.

**Remaining risks and follow-up:**

- Review transaction retry and error-handling behavior.
- Verify that the intended deployment MongoDB configuration supports transactions.
- The reported test results do not guarantee correctness under every production concurrency scenario.

### Unit Management Routes

**Status: Implemented and tested.**

- Added `routes/unit.js`.
- Registered Unit routes in `app.js` under `/listings/:id/units`.
- Added Joi validation for Unit input in `schema.js`.
- Added endpoints for listing, creating, updating, and deleting Units belonging to a Listing.
- Unit operations use login and listing-owner authorization middleware.
- Unit updates verify that the Unit belongs to the requested Listing.
- Invalid Unit input is rejected.
- Updating a Unit does not unintentionally reset its availability when `isAvailable` is omitted.
- A Unit with booking history cannot be deleted; the route returns HTTP 409 and recommends setting `isAvailable` to `false`.
- Units without booking history can be deleted by the authorized Listing owner.
- Added `tests/unit-routes.test.js`.
- Integration tests cover authentication, role restrictions, ownership, validation, Unit creation, listing, updating, and deletion behavior.
- Added a regression test in `tests/routes.test.js` for a Listing with a missing owner. The test verifies that `GET /listings/:id/units` returns HTTP 403 and the message `Listing ownership is not configured.`

### Automated Testing

- Node.js built-in test runner is configured through `npm test`.
- Supertest is used for HTTP-level tests.
- MongoDB Memory Server is used for isolated database tests.
- `tests/db-setup.js` manages temporary MongoDB setup and cleanup.
- Automated tests cover:
  - Application routes
  - Signup behavior
  - Listing model CRUD
  - Listing/Review integration
  - User model password hashing and default role
  - Unit model validation
  - Booking model validation
  - Booking routes and overlapping-booking prevention
  - Unit management routes

**Latest reported full test result (user-reported):**

- Tests: 76
- Passed: 76
- Failed: 0
- Cancelled: 0
- Skipped: 0
- Todo: 0

The latest reported `npm test` run completed successfully in approximately 9.23 seconds.

These results were reported in the project conversation. Run `npm test` again if fresh verification against the current checkout is needed.

**Concurrency verification:**

- The simultaneous overlapping-booking integration test passed in 10 repeated runs.
- Each reported run verified that only one of two simultaneous overlapping booking requests succeeded and that only one active overlapping booking remained.

**Verification caveat:** These results establish that the tested scenarios passed. They do not establish that every production concurrency scenario, transaction failure, or deployment configuration has been verified.

The earlier test-process cleanup concern should still be revisited if the test runner hangs in a future run.

### Important Safety Note

The seed script contains a deletion operation for existing listings. Do not run it against a database containing data that must be preserved.

React frontend, JWT authentication, parking, complaints, admin verification, Trust Score, and payment workflows are not confirmed as implemented.

---

## 4. Day 1 — Completed

**Status: Completed**

### Task 1 — Repository Audit

- Reviewed the project scope and repository structure.
- Identified Listing and Review models, routes, validation, and error handling.
- Confirmed the need to preserve Express Router refactoring.
- Identified the destructive seed-script risk.

### Task 2 — Startup and Testing Foundation

- Separated application configuration from server startup.
- Configured the Node.js built-in test runner.
- Added automated application tests.
- Added temporary MongoDB test setup.
- Added Listing model CRUD tests.
- Configured Supertest and MongoDB Memory Server.

### Task 3 — Listing and Review Integration Tests

- Added tests for Listing index, create, show, update, and delete routes.
- Added validation tests for invalid listing input and review ratings.
- Verified review creation and deletion update the Listing relationship.
- Verified deleting a Listing also deletes associated Review records.
- Updated the Review timestamp default.
- Enabled Mongoose update validators.

### Task 4 — Initial Authentication Foundation

- Added the User model with password hashing and verification.
- Added signup and login routes.
- Added Guest, Host, and Admin role definitions.
- Added signup input validation, duplicate email handling, and password length validation.
- Prevented public signup from assigning the Admin role.
- Added session configuration and authentication middleware.
- Added signup and login EJS templates and navbar integration.

### Task 5 — Initial REST API

- Added `GET /api/health`.
- Added `GET /api/listings`.
- Added `GET /api/listings/:id`.
- Added invalid ID handling with HTTP 400.
- Added missing listing handling with HTTP 404.
- Registered API routes in `app.js`.
- Manually verified the endpoints.

### Day 1 Verification

- The reported automated test run passed 29 tests with 0 failures.
- Initial API endpoints were manually verified.
- Day 1 work was committed as part of the repository's existing history.

---

## 5. Day 2 — Authentication, Authorization, and Review Security

**Status: Completed and pushed to GitHub**

### Task 1 — Role-Based Listing Authorization

- Added `isHostOrAdmin` to `middleware/auth.js`.
- Updated `routes/listing.js` to apply role-based access control to:
  - `GET /listings/new`
  - `POST /listings`
- Guest users cannot create listings.
- Host and Admin users are allowed to proceed through the role check.

### Task 2 — Review Ownership

- Added a required `author` reference to `models/reviews.js`.
- Updated review creation in `routes/review.js` to associate a review with the logged-in user.
- Protected review creation and deletion with `isLoggedIn`.
- Added a check preventing users from deleting another user's review.
- Added a safe guard for review documents with a missing author.
- Review deletion removes both the Review record and its reference from the Listing.

### Task 3 — Session Security

- Updated signup session handling in `routes/user.js`.
- Regenerates the session after successful user creation.
- Sets the new session's `userId`.
- Saves the session before redirecting to `/listings`.
- Errors during session regeneration or saving are forwarded to error handling.

### Task 4 — Automated Test Updates

- Updated the integration-test user to use the Host role where listing creation is required.
- Added a test confirming Guests cannot create listings.
- Added a test confirming another logged-in user cannot delete someone else's review.
- Updated review test data to include the required author reference.
- Verified review creation, deletion, and Listing relationship cleanup.

### Day 2 Verification

- `npm test`: 31 tests passed, 0 failures, according to the recorded Day 2 result.
- `git diff --check`: Passed with no output.
- Reviewed the changed-file list and Git status.
- Committed the changes.
- Successfully pushed the commit to GitHub.

### Day 2 Git Information

- **Branch:** `main`
- **Commit:** `c04f20e`
- **Commit message:** `Add role-based listing access and review ownership`
- **Remote:** `origin/main`
- **Recorded final Git status:** Branch up to date with `origin/main`.
- **Recorded working tree:** Clean.

These Git details describe the recorded Day 2 state. They do not establish the current Git state after subsequent local modifications.

### Day 2 Outcome

Role-based listing access, review ownership checks, and signup session regeneration were implemented. The recorded automated test suite passed after these changes.

**Note:** Passing tests verifies the tested scenarios, not every possible security edge case. Further security review is still useful.

---

## 6. Day 3 — Bookable Units and Booking Foundation

**Status: Completed for the current Day 3 scope; deployment risks remain.**

### Task 1 — Unit Model and Validation Tests

**Status: Completed.**

- Created `models/unit.js`.
- Added the Listing reference and Unit details.
- Added validation for Unit name, capacity, and nightly price.
- Added automatic timestamps.
- Created `tests/unit.test.js`.
- Tested valid Unit creation and important invalid-data cases.

### Task 2 — Booking Model Design

**Status: Completed.**

- Created `models/booking.js`.
- Added references to the guest User and bookable Unit.
- Added check-in and check-out date fields.
- Added total price and booking status.
- Added validation for required fields, date ordering, non-negative price, and supported status values.
- Created `tests/booking.test.js`.
- Added tests for valid bookings and important invalid-data cases.

### Task 3 — Booking Flow and Conflict Prevention

**Status: Implemented and tested for the covered scenarios.**

Implemented:

- Added `routes/booking.js` for booking creation.
- Validates booking request data and rejects past check-in dates.
- Calculates the number of nights and derives the booking price from the Unit's nightly price.
- Derives the guest identity from the authenticated session.
- Checks Unit availability and detects overlapping active bookings.
- Uses a MongoDB transaction and a shared Unit-document write to coordinate concurrent booking attempts.
- Added route integration tests, including a simultaneous overlapping-booking test.

**Verification completed:**

- Full test suite: 76 passed, 0 failed, 0 cancelled.
- Simultaneous overlapping-booking test: 10 reported repeated runs passed.
- The concurrency test checks that only one of two simultaneous overlapping booking requests succeeds and that only one active overlapping booking remains.

**Remaining risks and follow-up:**

- Review transaction retry and error-handling behavior.
- Verify transaction support in the intended deployment MongoDB configuration.
- Continue reviewing date and time edge cases as the booking workflow grows.

### Task 4 — Unit Management

**Status: Completed and tested.**

Implemented:

- Added Unit management routes in `routes/unit.js`.
- Registered routes in `app.js`.
- Added Joi validation for Unit input.
- Implemented Unit listing, creation, updating, and deletion endpoints.
- Added authentication and Listing-owner authorization.
- Added checks to ensure a Unit belongs to the requested Listing.
- Prevented deletion of Units with booking history.
- Added `tests/unit-routes.test.js`.
- Verified the targeted Unit route tests.
- Ran the full test suite after implementation.

**Verification completed:**

- Full test suite: 76 passed.
- Failed tests: 0.
- Cancelled tests: 0.

### Day 3 Outcome

- Unit Model and validation tests completed.
- Booking Model and validation tests completed.
- Unit management routes implemented and tested.
- Booking creation and overlap prevention implemented and tested for the covered scenarios.
- MongoDB transaction-based coordination tested using a temporary replica-set database.
- Full test suite passed: 76/76 tests.
- Simultaneous overlapping-booking test passed in 10 repeated runs.
- `git diff --check` produced no errors in the reported check.

**Remaining risks:** Production MongoDB transaction support and transaction retry/error handling still require review. These risks do not invalidate the reported local test results, but they must be addressed before treating production readiness as verified.

---

## 7. Future Project Roadmap

The following features remain part of the broader project roadmap. Their implementation status must be verified against the actual repository before work begins.

### Booking and Inventory

- Review transaction error handling and retry behavior.
- Verify the intended deployment MongoDB configuration supports transactions.
- Implement or complete booking retrieval and cancellation workflows as required.
- Design parking reservations if required by the approved design.
- Review date and time edge cases.
- Ensure failed bookings do not leave inconsistent database relationships or records.

### Reviews, Complaints, and Verification

- Continue reviewing review authorization and edge cases.
- Implement complaint workflows.
- Implement admin verification workflows.
- Define and implement Trust Score behavior.

### Payments

- Define trial payment workflows.
- Keep live payment gateway integration out of scope unless explicitly approved.

### Frontend and Final Integration

- Plan React integration with the existing backend.
- Preserve EJS functionality unless a migration is explicitly approved.
- Test important end-to-end workflows.
- Update setup instructions and project documentation.
- Verify the final test suite and record actual results.

The goal of approximately 75% project completion by Day 5 is a target, not a guarantee. Progress should be measured by verified functionality rather than the number of tasks marked complete.

---

## 8. Current Git Notes

- Last recorded branch: `main`.
- Last recorded upstream: `origin/main`.
- Last recorded clean commit: `c04f20e`.
- Last recorded commit message: `Add role-based listing access and review ownership`.
- Subsequent local modifications and new Unit/Booking files have been reported.
- The latest reported Git status before the Day 3 commit process included modifications to existing files and new, untracked Booking/Unit files.
- Before committing, inspect `git status --short` and review the staged changes.
- Do not assume the Day 3 changes have been committed or pushed until the latest Git state is verified.
- Avoid `git add .` without checking which files will be included.
- Never commit `.env` files, credentials, or secrets.
- Do not discard existing local modifications without reviewing them.
- Latest specifically reported `git status --short`:
   M middleware/auth.js
   M tests/routes.test.js
- These are the last reported changes, not a verified current Git status. Check the actual repository before committing, pushing, or discarding any changes.
---

## 9. Session Handoff

Day 1, Day 2, and the current Day 3 scope are recorded as completed. Follow-up risks and remaining project features are listed below.

### Implemented and tested according to reported results

- Express backend and EJS views.
- MongoDB/Mongoose models for Users, Listings, Reviews, Units, and Bookings.
- Session-based authentication and role-based listing authorization.
- Review ownership checks.
- `SESSION_SECRET` startup validation.
- Unit and Booking model validation tests.
- Booking creation route with request validation, IST past-date validation, session-derived guest identity, server-calculated total price, Unit availability checks, and overlapping-booking detection.
- MongoDB transaction-based coordination using a write to the shared Unit document.
- Integration test for simultaneous overlapping booking requests.
- Unit management routes for listing, creation, updating, and deletion.
- Unit management authorization and validation checks.
- Protection against deleting Units with booking history.

### Latest Reported Verification

- Full test suite: 76 passed, 0 failed, 0 cancelled.
- The latest reported full test run completed successfully.
- The simultaneous overlapping-booking test passed in 10 repeated runs.
- Test database cleanup completed successfully in the latest full test run.
- `git diff --check` produced no errors in the latest reported check.

### Remaining Risks and Unconfirmed Features

- Review booking transaction retry and error-handling behavior.
- Verify the intended deployment MongoDB configuration supports transactions.
- Booking retrieval and cancellation workflows as required by the final design.
- Parking reservations.
- Complaints and admin verification.
- Trust Score.
- Trial payment workflows.
- React integration and any planned JWT implementation.
- Final Day 3 commit and push status must be checked from the actual repository.

### Instructions for the Next Session

1. Verify the current Git status and whether Day 3 changes have been committed and pushed.
2. If the changes are still uncommitted, review the staged diff and ensure no secrets are included before committing.
3. Verify the intended deployment MongoDB configuration supports transactions.
4. Review transaction retry and error-handling behavior.
5. Continue with the next approved project task only after reviewing its requirements.
6. Preserve existing local modifications.
7. Never commit credentials, `.env` files, or secrets.
8. Day 4 has not started. Begin with a read-only repository audit and code inspection. Do not make code changes until the user explicitly approves the proposed changes.

**Current stopping point:** Day 3 Unit Management and Booking Foundation are implemented and tested for the reported scenarios. The latest reported full test suite passed 76/76 tests, and the simultaneous overlapping-booking test passed in 10 reported repeated runs. Production MongoDB transaction support and transaction error handling remain to be reviewed. The final Day 3 Git commit and push status must be verified separately.

**Day 4 has not started.** The agreed first step is a read-only repository audit. No Day 4 code changes have been approved or made.
