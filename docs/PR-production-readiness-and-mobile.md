# PlaceFlow — Production-Readiness & Mobile Responsiveness (PR explainer)

> This PR has two logical parts on branch `claude/prod-readiness-audit-3d7165d850d78012b9cd00a9e82ac705`:
> 1. A Supabase **security / auth hardening** pass.
> 2. A **mobile responsiveness** pass.

---

## Background

PlaceFlow is a Training & Placement management platform: a React + Vite single-page app, a Supabase (PostgreSQL + Auth) backend, a Gemini-powered assistant behind a serverless function, and a Vercel deployment target. Roles are **admin** (T&P cell), **student**, and **recruiter**.

> **For newcomers — how a Supabase browser app is secured.** Supabase hands out two kinds of keys. The *anon* (publishable) key is *designed* to live in the browser; every request already carries it, and Row-Level Security (RLS) policies in the database decide what that key may read or write. The *service_role* (secret) key bypasses RLS entirely and must **never** reach the browser. So "securing the frontend" is not about hiding the anon key — it is about making sure no secret key, password, or internal configuration is ever shipped to or displayed in the client.

The parts of the system this PR touches:

- A cluster of **Supabase configuration/debug surfaces** had grown around the app: a floating `SupabaseConsoleBar` on the dashboard, a `SupabaseModal` with an editable URL + anon-key form (with a reveal toggle), a full `SupabaseSettingsPage` route, an env-var display, and a copy-paste SQL schema. These exposed internal configuration to ordinary users.
- The **create-account** flow (email OTP via Supabase Auth) was already implemented, but the login/register screens also carried one-click **"Demo Admin"** buttons that dropped any visitor straight into the admin role.
- The UI was already **substantially responsive** (a `hidden lg:flex` sidebar, a `MobileNavigationDrawer`, a `MobileBottomNav`, responsive grids, `overflow-x-auto`-wrapped tables, and `ResponsiveContainer` charts) — but a few real mobile gaps remained.

## Intuition

The security change **collapses many write/reveal surfaces into a single read-only status surface**. Before, a user could open a modal, type a URL and anon key, click an eye icon to reveal it, read env-var names, and copy the schema. After, the same button opens a small panel that says *"Supabase Connected"* plus record counts — and nothing else.

```
Before: [ Project URL: https://… ] [ Anon Key: ••••• 👁 ] [ VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY ] [ Copy SQL ]
After:  Database Status — ● Connected · 42 students · 8 companies · 5 drives · 3 offers
```

The auth change is a one-line rule made real: *no public admin*. The legitimate admin path (password login, role resolved from `public.profiles`) is untouched; only the demo shortcut that manufactured an admin session on the client was removed.

The responsiveness change **activates and completes** work that was already ~90% done. The clearest example: the bottom navigation already padded itself with `env(safe-area-inset-bottom)`, but that value is always `0` unless the page opts in with `viewport-fit=cover`. Adding nine characters to the viewport meta makes the existing safe-area code come alive on notched phones.

## Code

### Part 1 — Security / auth

- **Deleted** the debug console `SupabaseConsoleBar.tsx` and its mounts on the dashboard and drives pages.
- **Rewrote `SupabaseModal.tsx`** from a credential editor into a read-only status modal (same `isOpen`/`onClose` props, so all five call sites keep working):

```tsx
// no URL input, no anon-key field, no env vars, no SQL, no localStorage writes
const connected = isSupabaseConfigured && supabaseConnected;
// renders: status pill + Students/Companies/Drives/Offers counts + a security note
```

- **Rewrote `SupabaseSettingsPage.tsx`** (the `database-settings` route) into a read-only status page; renamed nav entries from *"Settings"* to *"Database Status"* in `Sidebar` and `MobileNavigationDrawer`.
- **Stopped leaking the project URL** in the Offers error banner and dropped the `url` field from `SupabaseDiagnosticInfo`; removed a stray `console.log("Supabase URL:", …)`.
- **Removed the one-click Demo Admin buttons** from `LoginPage` and `RegisterView` (both OTP steps), regridded those panels to two columns, and fixed the demo recruiter shortcut that pointed at a non-existent `recruiter-console` view.

> ✅ No `service_role` / secret keys existed in the frontend to begin with. The built client bundle was scanned — the only `sb_secret` hit is a *prefix-check string inside the `@supabase/supabase-js` SDK itself* (`e.startsWith("sb_secret_")`), not a real credential.

### Part 2 — Mobile responsiveness

```html
<!-- index.html: makes env(safe-area-inset-*) non-zero on notched phones -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

```css
/* index.css */
html, body { overflow-x: hidden; max-width: 100%; width: 100%;  /* was 100vw → scrollbar-width overflow */
  -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body { padding-left: env(safe-area-inset-left,0); padding-right: env(safe-area-inset-right,0); }
.pt-safe { padding-top: env(safe-area-inset-top,0); }
.pb-safe { padding-bottom: env(safe-area-inset-bottom,0); }
```

- **AiAssistantPage**: added `min-w-0` + `break-words` to chat bubbles so long tokens/URLs wrap instead of widening the page.
- **StudentPortal**: gave the apply-confirmation modal `max-h-[85vh] overflow-y-auto` so its buttons stay reachable on short screens.

## Verification

> ⚙️ Automated: `npm run lint` (tsc --noEmit) passes; `npm run build` (Vite + esbuild) succeeds. The built bundle was grep-scanned for secret patterns — none found. A live browser was **not** available in this environment, so please spot-check visually.

**Manual QA — security**
1. As a normal user, open the header **Database** button, the sidebar **Database Status**, and the Offers error state → confirm you see only a *Connected/Local* status and counts, never a URL, key, env var, or SQL.
2. On Login and Create Account, confirm there is **no** one-click Admin button; sign in with an existing admin password → still lands on the dashboard.
3. Create a student and a recruiter via the OTP flow → verify redirect to the correct portal.

**Manual QA — mobile** (DevTools device toolbar)
1. At 360 / 375 / 390 / 412 / 430 / 768 / 1024 / 1280 / 1366 px: no page-level horizontal scroll; tables scroll only inside their card; charts fit; modals fit and scroll internally.
2. On a notched device/emulator, confirm the bottom nav clears the home indicator (safe-area now active).
3. AI Assistant: paste a very long word → it wraps inside the bubble.

## Alternatives

| A. Gate config panels behind an admin/env flag (instead of removing) | B. Global `overflow-x: hidden` as the responsive fix |
| --- | --- |
| **Pros:** keeps an in-app credential editor for quick demos. | **Pros:** one line; instantly hides any horizontal scrollbar. |
| **Cons:** still ships credential UI to the client; a role bypass re-exposes it; more code than deleting; the brief asked to remove it. | **Cons:** masks real overflow instead of fixing it (explicitly discouraged); can clip scrollable content. The chosen fix (`100vw`→`100%` + wrapped tables) removes the *cause*. |

## Suggested people to talk to

> 👤 Every file in this PR was previously authored by **Shaurya** (`chauhanshaurya565@gmail.com`) — the auth/OTP flow (`RegisterView`, `LoginPage`, `sendRegistrationOtp`/`verifyRegistrationOtp` in `supabase.ts`), the Supabase config surfaces, and the earlier responsive-layout refactor. He is the best source of context on intended behavior, especially the exact `students`/`profiles` column names the OTP flow writes to.

## Quiz

<details>
<summary>1. Why is shipping the Supabase <b>anon</b> key to the browser acceptable, but the <b>service_role</b> key is not?</summary>

- A. The anon key is encrypted in transit; the service_role key is not.
- **B. The anon key is constrained by Row-Level Security policies, while service_role bypasses RLS entirely. ✅**
- C. Neither should ever be in the browser.

The anon/publishable key is designed for the client and is gated by RLS. The service_role key ignores RLS and must stay server-side, which is why the audit focuses on secrets/config, not the anon key.
</details>

<details>
<summary>2. The <code>SupabaseModal</code> was rewritten rather than deleted. Why?</summary>

- **A. So the many call sites (Header, Sidebar, MobileNav, Offers) keep working with the same `isOpen`/`onClose` props while the content becomes safe. ✅**
- B. Because deleting files is not allowed in the repo.
- C. To preserve the credential form for admins.

Keeping the component contract intact avoided touching five call sites; only the internals changed to a read-only status view.
</details>

<details>
<summary>3. Adding <code>viewport-fit=cover</code> had what effect?</summary>

- A. It shrank the layout to fit notches.
- **B. It made `env(safe-area-inset-*)` return real non-zero values, activating the bottom nav's existing safe-area padding. ✅**
- C. It disabled pinch-zoom.

Without `viewport-fit=cover`, the inset variables are 0, so the pre-existing `pb-[env(safe-area-inset-bottom)]` did nothing on notched phones.
</details>

<details>
<summary>4. Why change <code>max-width: 100vw</code> to <code>max-width: 100%</code> on html/body?</summary>

- **A. `100vw` includes the vertical scrollbar's width, so it can exceed the visible area and cause a sliver of horizontal scroll; `100%` does not. ✅**
- B. `100vw` is invalid CSS.
- C. `100%` makes the page wider.

This removes the cause of page-level horizontal scrolling instead of hiding it.
</details>

<details>
<summary>5. Existing admin login still works after removing the Demo Admin button because…</summary>

- A. The demo button was the only admin path.
- **B. Admins authenticate via `signInWithPassword`, and their role is resolved from `public.profiles` — a path left completely untouched. ✅**
- C. Admin login now uses OTP.

Only the client-side demo shortcut (`setCurrentRole('admin')`) was removed; the real password → profile-role flow is unchanged.
</details>
