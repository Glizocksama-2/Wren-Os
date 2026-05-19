# Northwatch Team Migration Guide

This guide moves an existing single-user or isolated multi-user Northwatch database into the team-ready schema without losing personal data.

## 1. Back Up The Database

Run a full dump before applying team schema changes:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=northwatch-before-teams.dump
```

Keep the dump until you have verified login, personal workspace reads, team creation, invite acceptance, and notification reads in production.

## 2. Apply Base Auth Schema

If the auth schema is not already applied, run:

```bash
psql "$DATABASE_URL" -f server/db/northwatch_auth_rls.sql
```

This creates `users`, `user_sessions`, login failure tracking, the existing workspace tables, and personal RLS policies.

## 3. Apply Team Schema

Run the team migration:

```bash
psql "$DATABASE_URL" -f server/db/northwatch_team_feature.sql
```

The migration creates `teams`, `team_members`, `team_invites`, and `notifications`; then it adds `workspace_type` and `team_id` to team-shareable workspace tables.

Existing rows remain personal because `workspace_type` defaults to `personal` and `team_id` stays `NULL`.

## 4. Verify Personal Data Stayed Personal

Run these checks:

```sql
select count(*) from kanban_cards where workspace_type = 'personal' and team_id is null;
select count(*) from projects where workspace_type = 'personal' and team_id is null;
select count(*) from documents where workspace_type = 'personal' and team_id is null;
select count(*) from content_queue where workspace_type = 'personal' and team_id is null;
```

Every pre-existing row should remain visible only to its `user_id` owner.

## 5. Create A Team From The App

Sign in as the user who should own the first team, open `/team/create`, choose a name and slug, and submit. The server inserts the team and an owner membership in one transaction.

## 6. Move Selected Personal Records Into A Team

Only move records the user explicitly wants shared. Replace the IDs and team slug with real values:

```sql
with selected_team as (
  select id from teams where slug = 'birunda-farms'
)
update kanban_cards
set workspace_type = 'team',
    team_id = (select id from selected_team),
    updated_at = now()
where id in ('card-id-1', 'card-id-2');
```

Repeat for `projects`, `documents`, `content_queue`, `activity_feed`, and `agent_configs` only when the owner approves the move.

## 7. Configure Invite Email

Set these server environment variables on Render or the chosen Express host:

```bash
NORTHWATCH_APP_URL=https://northwatch.app
INVITE_EMAIL_FROM="Northwatch <no-reply@northwatch.app>"
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=mailer@example.com
SMTP_PASS=replace-with-provider-password
```

If `SMTP_HOST` is empty, the API logs the invite link instead of sending email. That is acceptable for local development only.

## 8. Smoke Test

1. Owner creates a team.
2. Owner invites a second registered user as `member`.
3. Second user opens `/invite/{token}`, signs in or signs up, and is redirected to the team.
4. Owner sees the invite accepted notification.
5. Second user can view team workspace data but cannot delete team records unless promoted.
6. Personal workspace records for both users remain invisible to each other.
