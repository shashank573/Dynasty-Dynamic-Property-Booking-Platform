# DynaStay — Project Progress Tracker

## Project Scope

* Frontend: React
* Backend: Node.js + Express REST API
* Database: MongoDB + Mongoose
* Authentication: JWT + bcrypt
* Roles: Guest, Host, Admin
* Core features: properties, independently bookable units, parking reservations, date/time bookings, overlap prevention, reviews, complaints, admin verification, Trust Score, trial payments, cancellation workflows.
* No live payment gateway or mobile app.

## Source of Truth

* Use the latest user-provided DynaStay ZIP/repository as the code baseline.
* Preserve the existing Express Router refactoring.
* Do not revert to an older ZIP or rewrite the project unnecessarily.
* Verify actual files before recommending code changes.

## Working Rules

* Explain in simple Hinglish.
* Work on one task at a time.
* For each task: goal, reason, exact file paths, precise code changes, commands, expected output, tests, DBMS/OS concepts, and Git commands.
* Do not mark a task complete until its behavior has been tested.
* Never claim tests passed unless they were actually run.
* Do not move to the next task until the current task is verified.

## Current Progress

* Synopsis reviewed.
* Existing project has a Node.js/Express/MongoDB foundation and EJS-based views.
* React migration is required.
* Latest uploaded ZIP is authoritative; preserve its Express Router refactoring.
* No implementation task has yet been verified as completed in the current implementation workflow.

## Current Phase

Day 1 — Task 1: Audit the latest repository structure and dependencies.

## Next Action

Inspect the latest ZIP/repository, including package.json, app.js, routes, models, middleware, views, public assets, and configuration.
Identify what already works, what is missing, and the smallest safe implementation plan.
Do not start code changes until the audit is complete.

## Task Log

For each task record:

* Task:
* Files changed:
* Commands run:
* Test results:
* Bugs or blockers:
* Git commit:
* Status: Not started / In progress / Verified

## Session Handoff

At the end of each work session, update this file with the exact next action, unresolved issues, and any changed assumptions. Distinguish verified facts from untested assumptions.
