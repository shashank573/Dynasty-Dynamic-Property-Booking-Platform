# DynaStay — Project Progress

**Last updated:** 18 October 2026  
**Project:** DynaStay — Dynamic Property Booking Platform

## Current Status

- Complaint workflow has been implemented across the backend and EJS interface.
- The user confirmed that the application and Admin complaints dashboard work correctly in local development.
- The latest reported automated test run passed **110/110 tests** (0 failures).
- The application is being tested locally at `http://localhost:8080`.
- Local development database: `DynaStay` on `127.0.0.1:27017`.

## Work Completed

### 1. Complaint workflow

- Backend complaint workflow work was merged into `main`.
- EJS-based complaint pages and routes were added on the `feature/complaint-ejs-ui` branch.
- Guests can submit complaints and view their own complaints.
- Guests can edit or delete their own complaints while the complaint status is `Open`.
- An admin complaint dashboard was added.
- Complaint status workflow and audit/history support were added.
- Administrative complaint actions require an Admin role.
- PR #4 contains the EJS complaint workflow and was previously reported as open and unmerged. Check its current GitHub status before assuming it has been merged: https://github.com/shashank573/Dynasty-Dynamic-Property-Booking-Platform/pull/4

### 2. Automated testing

- Latest reported test run: **110 tests passed, 0 failed**.
- Browser-based manual checks were pending at the time of that test run.
- The user has since confirmed that the local complaint workflow and Admin dashboard now work correctly.

### 3. Local Admin account setup

- Confirmed the local MongoDB connection points to `127.0.0.1:27017`, database `DynaStay`.
- Investigated an Admin login issue caused by `swarnim@gmail.com` not existing in the local database.
- The account was created through the normal signup flow, then its role was updated to `Admin` in the local development database.
- The account role was verified and the Admin complaint dashboard was successfully accessed.
- Public signup should continue to prevent users from assigning themselves the Admin role.

### 4. Password handling

- The `User` model uses `bcryptjs` and hashes modified passwords through a Mongoose pre-save hook.
- A temporary `reset-admin-password.js` script was used during troubleshooting but could not find the missing account. If this temporary file still exists in the working tree, remove it after confirming it is no longer needed:
  ```bash
  rm reset-admin-password.js
  ```
- Never commit real credentials, `.env` values, or plaintext passwords.

### 5. Session secret startup validation

- A proposed `SESSION_SECRET` startup validation change was discussed and approved by the user; the user later reported it was done.
- Check the current working tree and server startup code to confirm the exact implementation and test status before making further changes.

## Relevant Repository References

- Repository: https://github.com/shashank573/Dynasty-Dynamic-Property-Booking-Platform
- Complaint EJS UI PR: https://github.com/shashank573/Dynasty-Dynamic-Property-Booking-Platform/pull/4
- Feature branch previously used: `feature/complaint-ejs-ui`
- Local app URL: http://localhost:8080

## Next Steps

1. Confirm PR #4's current state and merge only with the user's explicit approval.
2. Review the current working tree with `git status` and remove any temporary troubleshooting script that remains.
3. Run the test suite again after any code or cleanup changes:
   ```bash
   npm test
   ```
4. Complete a manual browser smoke test for guest complaint creation, viewing, editing/deleting while Open, and the Admin status/audit workflow.
5. Verify session-secret validation in development and production configurations without exposing secret values.
6. Keep this file updated whenever meaningful implementation, testing, or review work is completed.

## Important Notes

- Do not claim PR #4 is merged unless GitHub confirms it.
- The 110/110 result is the latest reported test result; rerun tests to verify the current checkout.
- Admin-role changes described here were made only in the local development database. Use appropriate access controls for production role changes.
