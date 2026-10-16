# OS Concept Lens — DynaStay

Use this lens wherever the implementation relies on an Operating Systems (OS) concept. Keep the same labels in code comments, tests, and diagrams:

- **OS CONCEPT:** the concept name.
- **USE HERE:** the concrete reason the project uses it.

## 1. Concurrency Control

**OS CONCEPT:** Concurrency Control  
**USE HERE:** Booking requests and parking-reservation requests can overlap in time. The code writes to a shared Unit or Parking document inside a MongoDB transaction so competing operations conflict instead of both claiming the same inventory.

**Code locations:**
- `routes/booking.js` — shared Unit write and booking transaction.
- `routes/parking.js` — shared Parking write and parking-reservation transaction.

## 2. Race Condition

**OS CONCEPT:** Race Condition  
**USE HERE:** Two guests may request the same unit/date range or parking slot at nearly the same time. The transaction and shared-document write coordinate these requests so the system does not accept overlapping active reservations.

**Code locations:**
- `tests/booking-routes.test.js` — simultaneous overlapping booking requests.
- `routes/booking.js` — booking conflict check within the transaction.
- `routes/parking.js` — parking conflict check within the transaction.

## 3. Atomicity / Transaction

**OS CONCEPT:** Atomicity (Database Transaction)  
**USE HERE:** Related database changes must succeed or roll back together. A property booking and its linked parking reservation are created in one transaction; cancellation changes the booking and its linked property-parking reservation in one transaction.

**Code locations:**
- `routes/booking.js` — property booking plus linked parking creation.
- `routes/booking.js` — booking cancellation plus linked parking release.
- `routes/parking.js` — slot selection, conflict check, and independent reservation creation.

## 4. Atomic Conditional Update

**OS CONCEPT:** Atomic Operation / Race Condition Prevention  
**USE HERE:** Cancellation updates the record only if it still has an eligible status and the reservation has not started. A stale or competing request cannot overwrite a status change made by another request.

**Code locations:**
- `routes/booking.js` — conditional booking cancellation.
- `routes/parking.js` — conditional independent-parking cancellation.

## Important accuracy note

These are database-backed concurrency and atomicity techniques used by the Node.js application. They are not a custom OS thread scheduler, mutex, semaphore, or process manager. The code coordinates concurrent requests through MongoDB transactions and conditional writes.

## Diagram coverage

Apply the same lens to any sequence diagrams or other project diagrams that show simultaneous requests, transactions, or cancellation. The sequence-diagram HTML files discussed in the project conversation were not present in the current GitHub branch tree during this update, so those separate files have not been edited here.
