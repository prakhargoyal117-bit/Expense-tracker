# CampusLedger Firestore Security Specification

## 1. Data Invariants
1. **Zero Plaintext in Cloud**: `/vaults/{userId}` stores only AES-256-GCM ciphertext (`ciphertextBase64`), salt, IV, and KDF parameters.
2. **Strict Owner Isolation**: A user may only `get`, `create`, `update`, or `delete` `/vaults/{userId}` where `userId == request.auth.uid`, `request.auth.token.email_verified == true`, and `incoming().ownerId == request.auth.uid`. No cross-user `list` queries are permitted.
3. **Immutable Ownership & Creation Time**: `ownerId` and `createdAt` cannot change after document creation.
4. **Server-Enforced Timestamps**: `createdAt` (on create) and `updatedAt` (on create & update) must strictly equal `request.time`.
5. **Strict Schema & Bounds**: Unknown/shadow fields are rejected via `hasAll` + `hasOnly` on create and `affectedKeys().hasOnly` on update; all strings enforce `.size()` limits to prevent 1MB exhaustion attacks.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read of `/vaults/uid123`.
2. Authenticated read of another user's `/vaults/otherUser`.
3. Collection-wide `list` query on `/vaults`.
4. Unverified email (`email_verified == false`) attempting to write `/vaults/uid123`.
5. Create with spoofed `ownerId` (`ownerId: "victim"` under `/vaults/attacker`).
6. Create with invalid document ID containing disallowed characters (`$badId`).
7. Create with shadow/ghost field (`isAdmin: true` or `role: "admin"`).
8. Create with client-spoofed `createdAt` not equal to `request.time`.
9. Create with unsupported cipher (`algorithm: "NONE"`).
10. Update attempting to mutate `ownerId` or `createdAt`.
11. Update attempting to inject oversized `ciphertextBase64` (> 900,000 bytes).
12. Update with client-spoofed `updatedAt` not equal to `request.time`.
