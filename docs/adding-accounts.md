# Adding Accounts

## Login Flow

Run `pi-antigravity-rotator login` (or `npm run login` from source) once per Google account:

1. A Google OAuth URL is printed to the terminal — open it in your browser
2. Complete the sign-in and grant permissions
3. The browser redirects to a `localhost` URL that won't load — this is expected
4. Copy the **full URL** from the browser's address bar and paste it into the terminal

The tool automatically:
- Creates or updates `accounts.json` with the account credentials
- Configures `~/.pi/agent/auth.json` with proxy-managed credentials (for the Pi agent)

Re-running with the same email updates the existing entry.

## Web-Based Login

The dashboard includes a web-based OAuth login flow at `/login`. This is useful for:
- Hosted deployments where CLI access is inconvenient
- Users who prefer a browser-only workflow

Set `ANTIGRAVITY_REDIRECT_URI` to the HTTPS callback registered in your OAuth client for hosted deployments.

## Activation Rule

Some accounts do not expose a discoverable `projectId` until they have been used once in the Antigravity IDE. If login fails at project discovery:

1. Open that exact Google account in Antigravity IDE
2. Send one message to any model
3. Re-run `pi-antigravity-rotator login`

## Account Management from Dashboard

The dashboard (`/dashboard`) provides a full account management UI:
- Add new accounts via web OAuth
- View account status, quota, timers, and error messages
- Enable/disable accounts
- Set account tier (`ultra`, `pro`, `plus`, `free`)
- Configure per-account fresh-window overrides
- Remove accounts

## Account Fields in accounts.json

```json
{
  "email": "user@gmail.com",
  "refreshToken": "1//...",
  "projectId": "project-abc123",
  "projectSource": "google",
  "label": "my-account",
  "tier": "pro"
}
```

| Field | Description |
|-------|-------------|
| `email` | Google account email (auto-filled by login) |
| `refreshToken` | OAuth refresh token (auto-filled by login) |
| `projectId` | Cloud project ID discovered during login |
| `projectSource` | `google` (auto-discovered) or `manual` (hand-edited) |
| `label` | Display name on the dashboard (defaults to email username) |
| `tier` | Optional: `ultra`, `pro`, `plus`, `free`, or `unknown` |

## Token Auto-Refresh

OAuth tokens are refreshed automatically before expiry. No manual token management is needed. If a token cannot be refreshed (revoked consent, expired session), the account is disabled and a clear error message is shown on the dashboard.

## Donating an Account

If you want to contribute quota to the project's development and testing, see the [Contributing](../CONTRIBUTING.md) guide for instructions on how to safely share an account.
