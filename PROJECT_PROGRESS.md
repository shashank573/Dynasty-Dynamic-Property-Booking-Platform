# DynaStay — Project Progress Tracker

## Project Scope

* **Frontend:** React (planned; implementation not confirmed)
* **Backend:** Node.js + Express REST API
* **Database:** MongoDB + Mongoose
* **Current web interface:** EJS templates
* **Authentication:** Current implementation uses session-based authentication with bcrypt password hashing. JWT authentication is planned but not confirmed as implemented.
* **Roles:** Guest, Host, Admin
* **Core features:** Properties, independently bookable units, parking reservations, date/time bookings, overlap prevention, reviews, complaints, admin verification, Trust Score, trial payments, and cancellation workflows.
* **Out of scope:** Live payment gateway and mobile app.

## Source of Truth

* Use the current DynaStay repository as the code baseline.
* Preserve the existing Express Router refactoring and EJS functionality.
* Do not revert to an older ZIP or rewrite the project unnecessarily.
* Verify actual files and dependencies before recommending changes.
* Keep this file updated after verified milestones.
* Do not mark a feature complete until its behavior has been tested.

## Working Rules

* Explain concepts in simple Hinglish.
* Work on one task at a time.
* For each task, explain the goal, reason, exact file paths, code changes, commands, expected output, tests, relevant DBMS/OS concepts, and Git commands where applicable.
* Verify the current implementation before making changes.
* Never claim tests passed unless they were actually run.
* Do not move to the next planned task until the current task is verified.
* Preserve existing functionality unless a change is necessary and understood.
* Never expose or commit `.env` secrets.
* Review staged files before committing.
* Avoid destructive Git commands unless their effects are understood and explicitly intended.
* Do not run the destructive seed script against a database containing data that must be preserved.

## Current Progress

* Project synopsis and scope reviewed.
* Existing backend uses Node.js, Express 5, MongoDB/Mongoose, EJS, Joi, and Express Router.
* Existing Listing and Review functionality has been preserved and tested.
* Express application configuration is separated from server startup: `app.js` exports the app, while `server.js` handles MongoDB connection and server startup.
* Node.js built-in test runner is configured through `npm test`.
* `supertest` is installed for HTTP-level tests.
* `mongodb-memory-server` is installed as a development dependency for isolated database tests.
* `tests/db-setup.js` manages temporary MongoDB setup and cleanup.
* Listing model CRUD tests and Listing/Review route integration tests are present.
* Listing update route uses Mongoose `runValidators: true`.
* Review timestamp default uses `Date.now`.
* User model exists with password hashing and password verification using bcrypt.
* User roles include Guest, Host, and Admin, with Guest as the default role.
* Signup and login routes have been implemented using session-based authentication.
* Signup validates user input, rejects duplicate email addresses, enforces a minimum password length, and prevents public signup from assigning the Admin role.
* Session regeneration is implemented during login. Signup session handling should be reviewed during the next authentication review.
* Session configuration uses `express-session` and MongoDB-backed sessions outside the test environment.
* Session cookie configuration includes `httpOnly`, `sameSite: "lax"`, a 24-hour maximum age, and `secure` in production.
* Authentication middleware exists in `middleware/auth.js`.
* Navbar templates have been updated to support the current logged-in-user interface.
* User login and signup EJS templates exist under `views/users/`.
* An API router exists in `routes/api.js`.
* `GET /api/listings` returns listing data as JSON.
* `GET /api/listings/:id` returns a specific listing, handles invalid IDs with HTTP 400, and returns HTTP 404 when a valid ID does not match an existing listing.
* `GET /api/health` reports application API health and MongoDB connection status.
* API routes are registered in `app.js`.
* The API endpoints were manually verified during the Day 1 session.
* The most recent reported automated test run passed **29 tests, with 0 failures, 0 skipped, and 0 cancelled**.
* The test suite covers app routes, signup behavior, Listing model CRUD, Listing/Review route integration, and User model password hashing/default role.
* The latest reported `npm audit` result from the earlier progress record was zero vulnerabilities. This has not been re-run during the latest session.
* The latest observed Git status showed `main` synchronized with `origin/main` and a clean working tree.
* The exact latest commit hash was not captured in the last verification output. Use `git log -1 --oneline` to identify it.
* React frontend and JWT authentication are not confirmed as implemented.
* Independently bookable units, parking reservations, booking workflows, concurrency protection, complaints, admin verification, Trust Score, and trial payment workflows are not confirmed as implemented.
* The seed script contains a deletion operation for existing listings. Do not run it against a database containing data that must be preserved.

## Current Phase

**Day 1 — Complete**

Code audit, startup verification, testing foundation, initial API endpoints, and initial authentication foundation have been implemented and verified to the extent described above.

Day 2 has not started as a new planned work session. Existing authentication-related code is already present and must be reviewed before extending it.

## Completed Tasks

### Task 1 — Repository Audit

* Reviewed the project scope and existing repository structure.
* Identified Listing and Review models, routes, validation, and error handling.
* Confirmed the need to preserve Express Router refactoring.
* Identified the destructive seed-script risk.
* **Status:** Completed.

### Task 2 — Safe Startup and Testing Foundation

* Separated app configuration from server startup.
* Configured the Node.js built-in test runner.
* Added automated app tests.
* Added temporary MongoDB test setup.
* Added Listing model CRUD tests.
* Configured `supertest` and `mongodb-memory-server`.
* **Status:** Completed.

### Task 3 — Listing and Review Integration Tests

* Added tests for Listing index, create, show, update, and delete routes.
* Added validation tests for invalid listing input and review ratings.
* Verified review creation and deletion update the Listing relationship.
* Verified deleting a Listing also removes associated Review records.
* Updated the Review timestamp default and enabled Mongoose update validators.
* **Status:** Completed and tested.

### Task 4 — Initial Authentication Foundation

* Added the User model with password hashing and password verification.
* Added signup and login routes.
* Added Guest, Host, and Admin role definitions, with Guest as the default.
* Added validation for signup input, duplicate email, and short passwords.
* Added protection against public signup assigning the Admin role.
* Added session configuration and MongoDB-backed session storage outside the test environment.
* Added authentication middleware.
* Added login/signup EJS templates and navbar integration.
* Added authentication-related automated tests.
* **Latest test evidence:** The complete suite passed 29 tests with 0 failures.
* **Status:** Initial implementation completed; further security and authorization review remains necessary.

### Task 5 — Initial REST API

* Added `GET /api/health`.
* Added `GET /api/listings`.
* Added `GET /api/listings/:id`.
* Added invalid listing ID handling with HTTP 400.
* Added missing listing handling with HTTP 404.
* Registered API routes in `app.js`.
* Manually checked the health endpoint, listing collection endpoint, individual listing endpoint, and invalid-ID response.
* **Status:** Implemented and manually verified. Dedicated automated API endpoint tests have not yet been confirmed.

### Task 6 — Day 1 Verification and Git Synchronization

* Ran `npm test`.
* Verified 29 passing tests and 0 failures.
* Reviewed the Git working tree and staged-file list before committing.
* The last reported `git status` showed `main` up to date with `origin/main` and no pending changes.
* **Status:** Working tree clean and local/remote branches synchronized at the last check.

## Current Git Notes

* Last observed branch: `main`.
* Last observed upstream: `origin/main`.
* Last observed state: `Your branch is up to date with 'origin/main'` and `nothing to commit, working tree clean`.
* The exact latest commit hash should be checked with `git log -1 --oneline`.
* Before future commits, inspect `git status` and review staged changes.
* Do not use `git add .` without checking which files will be included.
* Do not discard existing changes without understanding their purpose.
* Never commit `.env` or other credentials.

## Next Phase — Day 2: Authentication and Roles Review

Do not start Day 2 until the user explicitly asks to begin.

When Day 2 starts:

1. Review the actual current files and dependencies before changing anything.
2. Inspect `models/user.js`, `routes/user.js`, `middleware/auth.js`, `app.js`, `server.js`, and the related tests.
3. Understand the current session-based authentication flow before deciding what needs improvement.
4. Verify signup, login, logout, password hashing, session lifecycle, and unauthorized access behavior.
5. Review role-based authorization for Guest, Host, and Admin.
6. Check ownership protection for Listing modifications and authorization for Review operations.
7. Decide how JWT authentication fits the project synopsis before implementing it; do not replace session authentication without a clear reason.
8. Make changes in small, testable steps.
9. Run relevant tests after each change and record actual results.
10. Update this tracker only after the relevant behavior is verified.

## Planned Work Remaining

### Day 3 — Bookable Units, Parking, and Basic Booking

* Design and implement independently bookable units.
* Model parking reservations if required by the approved project design.
* Implement the basic date/time booking flow.
* Validate booking input and relationships.

### Day 4 — Booking Conflicts, Reviews, and Complaints

* Implement and test overlapping-booking prevention.
* Review concurrency handling and race conditions.
* Implement or complete complaint workflows.
* Review verification and review authorization.
* Test failure paths and relevant edge cases.

### Day 5 — React Integration, Testing, and Documentation

* Integrate the frontend with the backend API.
* Test important end-to-end workflows.
* Update documentation and setup instructions.
* Verify the final test suite and record actual results.

The goal is approximately 75% project completion by the end of Day 5. This is a target, not a guarantee.

## Session Handoff

DynaStay Day 1 is complete. The last reported full automated test run passed 29 tests with 0 failures. Initial API endpoints and an initial session-based authentication foundation exist. The latest observed Git status showed the working tree clean and `main` synchronized with `origin/main`.

Continue from the actual repository state, not assumptions. Review existing authentication code before extending it. Preserve EJS and Express Router functionality. Do not mark React, JWT, booking concurrency, independently bookable units, parking, complaints, verification, Trust Score, or payment workflows complete until implemented and tested.

The user prefers simple Hinglish explanations, one task at a time, precise commands, and verification before moving forward. Do not begin Day 2 until the user explicitly requests it.
