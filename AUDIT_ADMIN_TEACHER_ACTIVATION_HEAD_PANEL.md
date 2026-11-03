# Audit: School Admin, Teacher Activation, Signatures, School Head Panel

Audit scope: active root application configured by the root `package.json` (Next.js), `src/`, and `prisma/schema.prisma`. `SHULEA-SMS/` is a separate nested Android project and is not used by the root package/build. No code changes were made before this audit.

## 1. Current behavior and gaps

### Teacher invitation and activation

- `Invitation.expiresAt` is the validity period of an invitation code. It is not a teacher license or account activation expiry.
- Accepted teachers become `User` rows with `role = TEACHER`, `active = true`, a linked `Teacher` profile, and subject assignments. `User` has no activation start/end dates.
- `School.expiryDate` is the school-wide license expiry, not an individual teacher expiry. `Device.activatedAt` is a device authorization timestamp; devices have active/revoked/suspended status but no expiry date.
- School Admin can activate/deactivate accounts using `/api/shulea/users` and Settings > Users. This is a boolean switch; it does not renew an account or keep a date history.
- TeacherManagement lists accounts, role, and active/inactive status, but no license dates or renewal action. Teacher invitation and account creation are separate flows.
- Server sessions check `User.active` in `getAuthenticatedUser`; the login route checks school license and device status. No teacher-specific expiry is enforced online or offline.

### Teacher signature and report integration

- `Teacher.shortName` and `Teacher.sign` are existing nullable text fields. The School Admin invitation form does not ask for either, and invitation acceptance creates a teacher profile using only the full name.
- TeacherManagement has no profile/signature edit action. The existing manage dialog edits subject assignments only.
- Report card rendering already uses the current Class Teacher assignment for the report's class and academic year and then reads `Teacher.sign/shortName`. School Head signature and name come from School settings (`School.headTeacherSign/headTeacherName`).
- The current root application supports text/short-name signatures. There is no teacher signature image field or image rendering path. School logos are images, but that does not mean teacher signatures are supported as images.

### School Head panel and permissions

- `SchoolLeadership` records one teacher profile as the current School Head. It does not grant a distinct account role. The associated account remains `TEACHER`.
- The `HeadTeacherManagement` component is an assignment control embedded in School Admin Settings; it is not a School Head panel. Its API is restricted to School Admin/Super Admin.
- School Admin has separate menu access to school details, license, grading, users, teacher assignments, School Head assignment, devices, classes, students, exams, marks, reports and backups.
- A School Head teacher does not receive additional panel or school-wide management permissions based on `SchoolLeadership`. Teacher permissions remain those from subject and Class Teacher assignments. This is a gap in School Head visibility, but it is also a meaningful privilege boundary; granting full School Admin access implicitly would be unsafe.
- Current School Settings include formal school identity/location/contact, logos, registration number, academic year/term, School Head name/signature/comments, class teacher comment templates, bilingual grading comments and grading configuration. These fields feed report generation. No obviously redundant field was identified for removal without changing report behavior.

### Branding and application targets

- Root browser metadata in `src/app/layout.tsx` uses “Shulea v2.0 - School Results Management”; PWA `appleWebApp.title` uses “Shulea”. The root `public/manifest.json` also supplies install branding. The requested browser/page title should change while product logos, manifest name and unrelated visible branding remain intact unless it is actually the same unwanted title.
- The root application has PWA/service worker and IndexedDB-backed SQLite/offline support. No root `android/` directory exists. `SHULEA-SMS/android/` belongs to a different nested project and must not be edited to implement the root application changes.

## 2. Existing database and offline paths

- Relevant Prisma tables: `User`, `Teacher`, `Invitation`, `School`, `SchoolLeadership`, `Device`, and `AuditLog`.
- Offline storage uses `src/services/database/schema.ts` (SQLite via sql.js in IndexedDB), `SchemaManager` additive `ensureColumn()` migrations, and `OfflineAuth` provisioning after online login. `User` exists in the offline database; `CloudSyncHydrator` intentionally does not hydrate user credentials.
- Teacher profile, school settings, classes, assignments, and report inputs are synchronized into local SQLite. Existing report-card code can read cached school and teacher data offline.
- Activation changes must be server-authoritative and unavailable for offline renewal. Cached activation dates should still be checked by offline login/local API calls so offline mode does not extend an expired teacher account. New local columns must be additive and must not reset/delete offline data.
- Teacher activation history can use the existing append-only `AuditLog` while current validity lives on `User`; this avoids a new licensing subsystem/table. Schema fields require a backward-compatible PostgreSQL migration and additive SQLite columns. Signature short name can use existing `Teacher.shortName`; preserving invitation-time registration requires an optional `Invitation` text field and migration.

## 3. Proposed implementation scope

1. Add optional teacher account activation start/end timestamps on `User`, update these only through a School Admin endpoint scoped to their school, record each change and before/after values in `AuditLog`, and enforce start/end online and offline. A date/duration renewal starts from the later of now and the current expiry so repeated extensions add time rather than replacing remaining time. Legacy users with no dates remain valid until an Admin explicitly sets an activation window.
2. Add an optional invitation short signature field; copy it onto `Teacher.shortName` when the invited teacher accepts. Add an Admin edit action for existing teacher `shortName/sign`. Class-specific reports already resolve the assigned teacher, so that name/sign should flow through the established report templates. Signature images are not in scope because the active application has no such support path.
3. Add activation status/start/end and a renewal/edit action to the existing TeacherManagement table. Support days, calendar months, or a custom end date; show account active state separately from activation validity.
4. Add a restricted School Head overview panel for the teacher profile linked by active `SchoolLeadership`, with school-level summary and report links. It must not grant School Admin mutation rights. Preserve current subject/Class Teacher permissions for academic writes.
5. Change the root metadata title/description as requested. Leave unrelated product branding and the separate nested Android project untouched.

## 4. Files and database changes expected

- Database/migrations: `prisma/schema.prisma`; new additive Prisma migration for `User.activationStartDate`, `User.activationExpiryDate` and `Invitation.teacherShortName`; additive SQLite columns in `src/services/database/schema.ts` and `SchemaManager`.
- Account activation/access: `src/app/api/shulea/users/route.ts`, `src/lib/server-auth.ts`, `src/lib/access-control.ts`, `src/services/database/OfflineAuth.ts`, `src/repositories/UserRepository.ts`, `src/types/index.ts`, `src/lib/store.ts`, `src/services/api/auth.ts`, `src/lib/utils.ts`.
- Invitation/signature: `src/app/api/shulea/invitations/route.ts`, `src/app/api/shulea/auth/route.ts`, `src/app/api/shulea/teachers/route.ts`, `src/components/shulea/TeacherManagement.tsx`, report data/template paths only if integration needs a change (`src/app/api/shulea/results/route.ts`, `src/lib/print-templates.ts`, `src/components/shulea/ReportsView.tsx`).
- School Head panel: `src/app/api/shulea/school-leadership/route.ts`, `src/components/shulea/HeadTeacherManagement.tsx` or a dedicated restricted overview component, `src/components/shulea/AppLayout.tsx`, and related teacher dashboard routing.
- Branding: `src/app/layout.tsx` (root browser metadata only).
- Offline/Android: root `src/services/database/*` and local auth/API adapters require changes for account expiry. No Android-specific change is applicable to this root build; the nested Android project is separate.

This audit was completed before implementation. Live production database changes were not applied during development.

## 5. Implementation and verification update

- Added nullable `User.activationStartDate` and `User.activationExpiryDate` and nullable `Invitation.teacherShortName` through an additive Prisma migration. Added matching additive SQLite columns and persisted the values during successful online login provisioning. No local database reset or table replacement was introduced by these changes.
- School Admin can renew a registered teacher account with days, months, or an exact expiry date. Each change is written to the existing `AuditLog` with the previous and new dates. Legacy teacher accounts without dates remain valid until an administrator sets a date range.
- Online session authorization and offline credential login check the teacher activation window. The invitation flow stores the short signature on the teacher profile; reports already resolve the active class teacher's profile and the School Head signature from the School record.
- Replaced the root browser title and description with “Result Record Management System”. PWA install name, icon/logo and unrelated visible branding were left unchanged.
- The School Head is still a teacher account linked through `SchoolLeadership`; this change did not introduce a separate School Head panel or broaden its mutation permissions. Recommended next step: a read-only School Head overview for school counts, current academic period, exams and reports, with every write still authorized through existing School Admin routes.
- Prisma validation, Prisma Client generation, TypeScript (`tsc --noEmit`), ESLint and production build completed successfully. `prisma migrate status` could not connect to the configured PostgreSQL database, so database migration application and live end-to-end/online-offline scenario tests are blocked. No test runner is defined in the root package scripts.
