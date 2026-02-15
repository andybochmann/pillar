# Napkin — Pillar Project

## Mistakes & Lessons

### MongoDB transactions require replica set
- All 4 DELETE routes used `mongoose.startSession()` + `startTransaction()` which fails silently on standalone MongoDB
- Fixed by removing transactions and using sequential operations
- **Rule**: Never use MongoDB transactions in this project — standalone server only

### Owner loses access after sharing project
- `getAccessibleProjectIds` fallback logic was too restrictive: it excluded owned projects if ANY ProjectMember record existed (even if the owner wasn't one)
- Root cause: POST members route didn't auto-create owner's ProjectMember record when first member was added
- Fixed both: simplified fallback to always include `Project.userId` projects, and auto-create owner record in POST route

### Share dialog missing role change
- `updateMemberRole` existed in hook but was never wired to UI — static Badge showed "Editor" with no interaction
- Fixed by adding Select dropdown for non-owner members when viewed by owner
