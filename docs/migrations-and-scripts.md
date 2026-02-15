# Migrations and Scripts

## Overview

Pillar includes database migration scripts that handle schema changes and data transformations as new features are added. Migrations are designed to be safe, idempotent (can be run multiple times without side effects), and backward compatible.

The current migration suite ensures existing projects created before the project sharing feature receive proper `ProjectMember` records, making them compatible with the new role-based access control system.

## Key Files

| Purpose | File |
|---|---|
| ProjectMember migration | `scripts/migrate-project-members.ts` |
| Migration tests | `scripts/migrate-project-members.test.ts` |

## When Migrations Are Needed

Migrations are required when:

1. **Upgrading from pre-sharing versions** — If you deployed Pillar before the project sharing feature was added, run `migrate-project-members` to create `ProjectMember` records for all existing project owners.

2. **Importing legacy data** — If you restore a database backup from before the sharing feature, run the migration to ensure all projects have proper access control records.

3. **After database corruption recovery** — If `ProjectMember` records are accidentally deleted, re-run the migration to restore owner records.

Migrations are **NOT** needed for fresh installations — new projects automatically create their `ProjectMember` owner record at creation time.

## Migration Behavior

### Backward Compatibility

If no `ProjectMember` records exist for a user, the project access functions in `src/lib/project-access.ts` fall back to legacy behavior:

- `getAccessibleProjectIds(userId)` falls back to `Project.find({ userId })`
- `getProjectRole(projectId, userId)` returns `"owner"` for projects where `userId` matches the project's `userId` field

This fallback ensures Pillar remains functional even if migrations haven't been run, though sharing features will not work correctly without proper `ProjectMember` records.

### Idempotency

All migration scripts check for existing records before creating new ones. Running a migration multiple times is safe — it will skip already-migrated data and only process new or missing records.

## Running Migrations

### Development (Local MongoDB)

Run migrations using `pnpm tsx`:

```bash
# With default MongoDB URI (mongodb://localhost:27017/pillar)
pnpm tsx scripts/migrate-project-members.ts

# With custom MongoDB URI
MONGODB_URI=mongodb://localhost:27017/my-pillar-db pnpm tsx scripts/migrate-project-members.ts
```

The script will output:

```
Migration complete:
  Projects processed: 15
  Members created:    15
  Skipped (existing): 0
```

### Docker Compose (Development)

For the development Docker Compose stack (started with `docker compose up -d`):

```bash
# Connect to the running app container
docker compose exec app sh

# Run the migration inside the container
node -r tsx scripts/migrate-project-members.ts

# Or run directly from host (if app container is running)
docker compose exec app node -r tsx scripts/migrate-project-members.ts
```

The `MONGODB_URI` environment variable is already set in the container (`mongodb://mongo:27017/pillar`), so no additional configuration is needed.

### Docker Compose (Production)

For the production Docker Compose stack (using `docker-compose.production.yml`):

```bash
# Connect to the running app container
docker compose -f docker-compose.production.yml exec app sh

# Run the migration inside the container
node -r tsx scripts/migrate-project-members.ts
```

### Standalone Production (Custom MongoDB)

If you're running Pillar outside Docker with a custom MongoDB setup:

```bash
# Set your MongoDB URI and run the migration
MONGODB_URI=mongodb://your-mongo-host:27017/pillar pnpm tsx scripts/migrate-project-members.ts
```

For MongoDB Atlas or other cloud providers, use your connection string:

```bash
MONGODB_URI="mongodb+srv://user:password@cluster.mongodb.net/pillar?retryWrites=true&w=majority" \
  pnpm tsx scripts/migrate-project-members.ts
```

## Migration Script Details

### migrate-project-members.ts

**Purpose**: Creates `ProjectMember` records with role `"owner"` for all existing projects.

**Process**:

1. Connects to MongoDB (or reuses existing connection if already connected)
2. Queries all projects and retrieves their `_id` and `userId`
3. For each project:
   - Checks if a `ProjectMember` record already exists for the project owner
   - If not, creates a new record with role `"owner"`
   - If yes, skips (idempotent behavior)
4. Returns a summary: `{ processed, created, skipped }`

**Exported Function**:

```typescript
export async function migrateProjectMembers(
  uri?: string
): Promise<{ processed: number; created: number; skipped: number }>
```

The function can be imported and called programmatically from tests or other scripts. When run directly via `pnpm tsx`, it executes the migration and then disconnects from MongoDB.

**Safety Features**:

- **Idempotent** — Uses `ProjectMember.exists()` before creating records
- **No destructive operations** — Only creates new records, never deletes or modifies
- **Connection management** — Reuses existing connections if already connected (useful for testing)

## Self-Hoster Guide

If you're self-hosting Pillar, follow these steps after upgrading to a version with project sharing:

### Step 1: Backup Your Database

Always backup before running migrations:

```bash
# Local MongoDB
mongodump --uri="mongodb://localhost:27017/pillar" --out=/path/to/backup

# MongoDB Atlas (or remote MongoDB)
mongodump --uri="mongodb+srv://user:password@cluster.mongodb.net/pillar" --out=/path/to/backup
```

### Step 2: Stop the Application

Prevent concurrent writes during migration:

```bash
# Docker Compose
docker compose down

# Or for production stack
docker compose -f docker-compose.production.yml down

# Systemd service
sudo systemctl stop pillar
```

### Step 3: Run the Migration

Choose the method that matches your deployment:

```bash
# Local development
pnpm tsx scripts/migrate-project-members.ts

# Docker (start only the database)
docker compose up -d mongo
docker compose run --rm app node -r tsx scripts/migrate-project-members.ts
docker compose down

# Custom MongoDB URI
MONGODB_URI="your-connection-string" pnpm tsx scripts/migrate-project-members.ts
```

### Step 4: Verify the Migration

Check that `ProjectMember` records were created:

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/pillar

# Count ProjectMembers (should match number of projects)
db.projectmembers.countDocuments()

# Sample a few records
db.projectmembers.find().limit(3).pretty()
```

Expected output:

```javascript
{
  _id: ObjectId("..."),
  projectId: ObjectId("..."),
  userId: ObjectId("..."),
  role: "owner",
  invitedBy: ObjectId("..."),
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### Step 5: Restart the Application

```bash
# Docker Compose
docker compose up -d

# Or for production stack
docker compose -f docker-compose.production.yml up -d

# Systemd service
sudo systemctl start pillar
```

### Step 6: Test Project Access

1. Log in to Pillar
2. Verify all existing projects are visible in the project list
3. Open a project and confirm you can view/edit tasks (owner permissions)
4. Test the project sharing dialog to ensure it opens without errors

## Troubleshooting

### Migration Reports 0 Projects Processed

**Cause**: The database is empty or the `MONGODB_URI` is incorrect.

**Solution**:

```bash
# Verify MongoDB connection
mongosh $MONGODB_URI

# Check if projects exist
db.projects.countDocuments()
```

### Migration Skips All Projects

**Cause**: `ProjectMember` records already exist (migration was already run).

**Solution**: No action needed — this is expected behavior if the migration has already been applied.

### MongoDB Connection Timeout

**Cause**: MongoDB server is not running or the URI is incorrect.

**Solution**:

```bash
# Check MongoDB status (Docker)
docker compose ps mongo

# Check MongoDB status (systemd)
sudo systemctl status mongod

# Test connection
mongosh $MONGODB_URI --eval "db.runCommand('ping')"
```

### Permission Denied in Docker Container

**Cause**: The migration script is trying to write to a read-only filesystem.

**Solution**: Use `docker compose exec` instead of `docker compose run` to run the script in the already-running container, or ensure the app container has write access to temporary directories.
