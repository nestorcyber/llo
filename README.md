# LinkedIn Local Owerri (LLO) Volunteer Engagement Tracking System

Production-oriented volunteer engagement tracking web application for LinkedIn Local Owerri.

The application manages a 30-day volunteer programme with three daily sessions at **10:00 AM (Morning)**, **3:00 PM (Afternoon)**, and **7:00 PM (Evening)** Nigeria time (**Africa/Lagos**, UTC+1). Administrators configure tasks for each session. Volunteers enter their assigned ID, choose their session and task, and report participation with instant confirmation and duplicate prevention.

---

## 1. Technology Stack

- **Frontend**: React 18 with TypeScript and Vite.
- **Styling**: Tailwind CSS with custom LinkedIn Local Owerri brand identity (Navy `#0B2545`, LinkedIn Blue `#0A66C2`). Mobile-first responsive design optimized for low-end devices and slow connections.
- **Database & Storage**: Supabase PostgreSQL with versioned SQL migrations, Foreign Keys (`ON DELETE RESTRICT`), Check Constraints, and Row Level Security (RLS).
- **Authentication**: Supabase Auth with custom role-based staff profiles (`owner`, `manager`, `viewer`).
- **Backend / Serverless**: Server-side API endpoints (`api/submissions.ts`, `api/public-schedule.ts`, etc.) deployable as Vercel Serverless Functions.
- **Development Server**: Custom Vite dev server plugin serving both the React SPA and the real serverless API endpoints on a single port (`5173`).
- **Testing**: Vitest test suite covering timezone calculations, formula injection protection, duplicate submissions, and role permissions.

---

## 2. Public Volunteer Page

- **Route**: `/`
- **Branding**: LinkedIn Local Owerri official theme, mobile-first single-page check-in.
- **Inputs**:
  - Assigned Volunteer ID (auto-capitalized, trimmed, e.g. `LLO-VOL-001`).
  - Programme Session (10:00 AM Morning, 3:00 PM Afternoon, 7:00 PM Evening) with real-time window status (`OPEN NOW`, `UPCOMING`, `CLOSED`).
  - Completed Task (dynamically loaded from database for selected session and current programme day).
  - Submit Button (instant feedback, debouncing, duplicate protection).
- **Security & Privacy**:
  - Volunteers do not create accounts or enter their names.
  - The backend resolves the volunteer's registered name from their assigned ID and displays it upon successful validation.
  - Submissions are timestamped on the server (`PostgreSQL timestamptz`) in Africa/Lagos time.
- **Feedback States**:
  - `Loading`: visual spinner while verifying schedule and reporting tasks.
  - `Success`: displays green verification card with volunteer name, task title, session name, and Lagos timestamp.
  - `Duplicate Submission`: friendly alert if the volunteer already reported that task for that session.
  - `Closed Session`: clear alert indicating session window is closed.
  - `Invalid ID`: clear alert if the ID is not found or inactive.
  - `Network Error`: retry alert if connectivity fails.

---

## 3. Impersonation Risk Analysis & PIN Architecture

### Current Release: ID-Only Check-In
In community events, low friction is paramount. Volunteers on low-end phones or spotty network connections may forget passwords. The initial release uses assigned, normalized volunteer IDs (e.g. `LLO-VOL-001`).

### Impersonation Risk
Because volunteer IDs follow a human-readable format, an individual who knows another volunteer's ID could potentially check in on their behalf.

### Built-in PIN Readiness Hook
The system architecture includes:
1. `pin_hash TEXT` column on the `volunteers` table in PostgreSQL.
2. An optional PIN input field on the check-in form.
3. Server-side validation hook in `api/submissions.ts` which checks `pin_hash` whenever a volunteer has a security PIN provisioned by an administrator.

---

## 4. Programme Management & Africa/Lagos Timezone

- **Timezone**: `Africa/Lagos` (UTC+1, West Africa Time). No daylight saving transitions.
- **Standard Sessions**:
  - **Morning Session (10:00 AM)**: Window opens at 09:30 AM (30 min before), closes at 12:00 PM (120 min after).
  - **Afternoon Session (3:00 PM)**: Window opens at 02:30 PM (30 min before), closes at 05:00 PM (120 min after).
  - **Evening Session (7:00 PM)**: Window opens at 06:30 PM (30 min before), closes at 09:00 PM (120 min after).
- **Calendar Generation**:
  - Generated via stored procedure `generate_programme_calendar(programme_id UUID)`.
  - Generates 30 programme days with 3 session slots per day (90 slots total).
- **Administrative Controls**:
  - Add, edit, open, close, and cancel tasks for each session slot.
  - Manual slot window overrides: `AUTO (WINDOW)`, `FORCE OPEN`, or `FORCE CLOSED`.
  - Programme completion and archiving without losing historical submissions.

---

## 5. Administrator Roles & Permissions

The `/admin` portal supports 3 hierarchical roles:

| Capability | Owner | Manager | Viewer |
|---|:---:|:---:|:---:|
| View Real-Time Dashboards & Analytics | Yes | Yes | Yes |
| View & Filter Attendance Records | Yes | Yes | Yes |
| Export Attendance & Volunteer CSVs | Yes | Yes | Yes |
| Add, Edit, Import Volunteers | Yes | Yes | No |
| Activate / Deactivate Volunteers | Yes | Yes | No |
| Create, Edit, Schedule Session Tasks | Yes | Yes | No |
| Override Session Open/Close Windows | Yes | Yes | No |
| Void Incorrect Submissions (with reason) | Yes | Yes | No |
| Provision Staff & Modify Team Roles | Yes | No | No |
| Complete & Archive Programme | Yes | No | No |

### Last Owner Account Protection
A PostgreSQL database trigger (`check_last_owner_protection`) and frontend guard prevent deleting or demoting the final active `owner` account.

---

## 6. Dashboard & Analytics

The `/admin` dashboard displays metrics computed from database queries:
- **Total Registered Volunteers** and active vs inactive breakdown.
- **Unique Active Volunteers Today** (distinct individuals who reported participation).
- **Total Task Submissions** (clearly distinguished from unique volunteers).
- **Task Completion Rate** based on eligible volunteer-task opportunities.
- **Session Breakdown**: Morning, Afternoon, and Evening submissions.
- **30-Day Engagement Trends**: Daily timeline across Day 1 to Day 30.
- **Most and Least Frequently Completed Tasks**.
- **Volunteer Consistency**: Distribution of volunteers across High (≥70% days), Medium (30-69%), and Low (<30%) consistency tiers.
- **Volunteer Detail View & 30-Day Matrix**: Interactive grid showing Day 1..30 with Morning (M), Afternoon (A), and Evening (E) participation states (Green = Attended, Gray = Missed, Red = Voided).

---

## 7. Attendance & Audit Reporting

- **Searchable Attendance Table**: Filters by Programme Day (1..30), Session (Morning, Afternoon, Evening), Status (`reported`, `voided`), and volunteer search.
- **Soft-Voiding**: Administrators void incorrect submissions by supplying a required reason modal. Historical records are never silently deleted.
- **Formula Injection Sanitization (CWE-1236)**:
  - When exporting CSVs, any field starting with `=`, `+`, `-`, `@`, `\t`, `\r`, or `%` is prefixed with an apostrophe (`'`) and quoted according to RFC 4180.
- **Audit Logs**:
  - Tracks all administrative operations (`RECORD_VOID`, `VOLUNTEER_ADD`, `VOLUNTEER_UPDATE`, `VOLUNTEER_IMPORT`, `TASK_CREATE`, `TASK_EDIT`, `SESSION_OVERRIDE`, `ROLE_CHANGE`, `CSV_EXPORT`).

---

## 8. Database Migrations

SQL migrations are located in `supabase/migrations/`:

1. `001_initial_schema.sql`: Core tables (`programmes`, `programme_days`, `session_slots`, `volunteers`, `session_tasks`, `staff_profiles`, `task_submissions`, `audit_logs`) and indexes.
2. `002_functions_and_triggers.sql`: Stored procedures (`generate_programme_calendar`, `get_lagos_now`, `get_lagos_today`, `is_session_slot_open`, `trg_protect_last_owner`).
3. `003_rls_policies.sql`: Row Level Security policies for anonymous and authenticated staff access.
4. `004_seed_data.sql`: Seed data for the 30-day programme, Day 1 tasks, and initial volunteers.

---

## 9. Local Setup & Testing

### Prerequisites
- Node.js 18+ (tested on Node v24)
- pnpm 9+

### Installation
```bash
# Install dependencies
pnpm install

# Run TypeScript type check
pnpm exec tsc --noEmit

# Run automated test suite (45 tests across 6 suites)
pnpm test

# Build for production
pnpm run build

# Start local development server
pnpm run dev
```

During local development, open `http://localhost:5173`:
- Check-in page: `http://localhost:5173/`
- Admin portal: `http://localhost:5173/admin`

Staff credentials:
- **Admin**: `admin@llo.com` (Password: `adminllo`)
- **Manager**: `manager@llo.com` (Password: `managerllo`)
- **Viewer**: `viewer@llo.com` (Password: `viewerllo`)

Demo Volunteer IDs for check-in:
- `LLO-VOL-001` (Chinedu Okeke, Logistics)
- `LLO-VOL-002` (Amina Yusuf, Media & Publicity)
- `LLO-VOL-003` (Ngozi Eze, Protocol)
- `LLO-VOL-004` (Emeka Nwosu, Technical)
- `LLO-VOL-005` (Fatima Bello, Registration)
- `LLO-VOL-007` (Blessing Okafor, Inactive - tests rejection)

---

## 10. Deployment Guide

### Deploying to Supabase
1. Create a new Supabase project at [https://supabase.com](https://supabase.com).
2. In the Supabase Dashboard, go to the **SQL Editor** tab.
3. Open `supabase/production_schema.sql`, copy all contents, paste into the SQL Editor, and click **Run**.
   - This sets up all 8 tables, indexes, RLS policies, Lagos timezone triggers, generates the 30 days & 90 session slots, and bootstraps the default staff accounts (`admin@llo.com`, `manager@llo.com`, `viewer@llo.com`).
4. Copy your project credentials from **Project Settings > API**:
   - Project URL -> `VITE_SUPABASE_URL` and `SUPABASE_URL`
   - Anon public key -> `VITE_SUPABASE_ANON_KEY`
   - Service role secret key -> `SUPABASE_SERVICE_ROLE_KEY`

### Deploying to Vercel
1. Push the repository to GitHub.
2. In Vercel, click **Add New Project** and select the repository.
3. Configure Environment Variables:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Public Key
   - `SUPABASE_URL`: Your Supabase Project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key (Keep Secure!)
4. Deploy. Vercel automatically:
   - Builds the Vite frontend (`dist/`).
   - Deploys `api/submissions.ts` and `api/public-schedule.ts` as serverless functions.
   - Applies the rewrites defined in `vercel.json`.
