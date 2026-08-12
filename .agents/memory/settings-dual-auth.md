---
name: Settings page dual-auth routing
description: Why /settings kept showing Coming Soon or bouncing to Talent Profile, and how SettingsRoute handles both auth systems.
---

## The two auth systems

This app has two completely separate authentication mechanisms that coexist:

1. **JWT auth** (`useAuth()` from `AuthContext`) — used by clients, admins, and general talent sessions. Token stored in `localStorage` as `onspot_jwt_token`.
2. **Talent-only auth** (`loadTalentAuth()` from `TalentLoginModal`) — used by the talent portal login (`/api/talent-auth/login`). Token stored in `localStorage` under key `talent_profile_token` as `TalentAuthState { token, candidateId, email, fullName }`.

`useAuth()` has NO knowledge of the talent-only session. A talent who logs in via the portal appears as `user: null` to any component that only calls `useAuth()`.

## Root causes that were fixed

1. **Auth loading race** — The original inline arrow-function at `<Route path="/settings" component={() => { const { user } = useAuth() ... }}>` read `user === null` during the ~200ms JWT verification window (`isLoading` starts as `true` but the arrow component was recreated every render). It fell to `return <PublicRouter />` → catch-all → `NotFound` → `ComingSoon` ("The next evolution of outsourcing.").

2. **Talent-only auth not checked** — Even after fixing the race, talent portal users (who use `loadTalentAuth()` not `useAuth()`) still saw `user: null` → redirected to `/login` → PortalLogin bounced them back to `/talent-profile/:id`, making it look like "Settings redirects to Talent Profile."

## The fix: SettingsRoute in App.tsx

```tsx
function SettingsRoute() {
  const { isLoading, user } = useAuth();
  const [, navigate] = useLocation();
  const [talentOnlyAuth] = useState(() => loadTalentAuth()); // sync localStorage read

  useEffect(() => {
    if (!isLoading && !user && !talentOnlyAuth) navigate("/login");
  }, [isLoading, user, talentOnlyAuth]);

  if (isLoading) return <spinner>;
  if (talentOnlyAuth) return <ProfileSettings />; // talent-only session
  if (user?.role === "talent") return <ProfileSettings />;
  if (user?.role === "client") return <ClientLayout><ProfileSettings /></ClientLayout>;
  return null; // useEffect navigates to /login
}
```

**Why:** `loadTalentAuth()` is synchronous (reads localStorage), so it's safe to call in a `useState` initializer. No async issues.

## What NOT to do

- Do NOT nest `TalentProtectedRoute` / `ClientProtectedRoute` inside `SettingsRoute` — those run independent redirect `useEffect`s that can race with `SettingsRoute`'s own effects.
- Do NOT use an inline arrow function for authenticated routes — React recreates the component identity every render, causing remounts on every parent re-render.
- Do NOT check only `useAuth()` when talent-only sessions may be active — always check `loadTalentAuth()` too for talent-facing routes.

## Key files

- `client/src/App.tsx` — `SettingsRoute` function (named, before `AppContent`)
- `client/src/components/TalentLoginModal.tsx` — `loadTalentAuth`, `saveTalentAuth`, `TalentAuthState`, `TOKEN_KEY`
- `client/src/contexts/AuthContext.tsx` — JWT auth, `isLoading` starts as `true`
- `client/src/hooks/usePortalLogin.ts` — talent portal login flow, `redirectTo: /talent-profile/:id` on success
