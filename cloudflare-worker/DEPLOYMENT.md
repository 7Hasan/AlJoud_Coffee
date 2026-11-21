# AlJoud Admin Portal — deployment notes

The static admin interface lives in `admin/`. The Worker source in this folder is the authenticated API implementation. Do not put secrets in this repository or in browser JavaScript.

## 1) Back up the current Worker
In `C:\\aljoud-push-api`, copy `src/index.js` to `src/index.js.backup`.

## 2) Apply the D1 schema
From the Worker project folder, run:

```powershell
npx wrangler d1 execute aljoud-push-db --remote --file ..\\AlJoud_Coffee\\cloudflare-worker\\schema.sql
```

Adjust the file path to where you downloaded this repository. Confirm success before deploying.

## 3) Add the one-time bootstrap secret
Generate a long random secret locally (do not send it to anyone), then run:

```powershell
npx wrangler secret put BOOTSTRAP_SECRET
```

Paste the generated secret at the prompt. Keep it private. The bootstrap endpoint refuses to create another administrator after the first admin exists.

Existing secrets must remain configured:
- `VAPID_PRIVATE_KEY`
- `ADMIN_API_KEY`
- `BOOTSTRAP_SECRET` (new)
Existing public vars remain:
- `VAPID_PUBLIC_KEY`
- `VAPID_SUBJECT`

## 4) Deploy the Worker
Copy `cloudflare-worker\\src\\index.js` over `C:\\aljoud-push-api\\src\\index.js`, then run:

```powershell
npx wrangler deploy
```

## 5) Create the first administrator
Open `https://7hasan.github.io/AlJoud_Coffee/admin/` after the GitHub Pages branch is updated to this feature branch. Choose **إعداد حساب المدير لأول مرة**, enter your own admin details and the bootstrap secret. The secret is used only for this one-time setup request; the API will reject bootstrap after an admin account exists.

## Security notes
- Passwords are stored as PBKDF2-SHA-256 hashes with a unique random salt.
- Session tokens are random opaque values; only their SHA-256 hashes are stored in D1. Sessions expire after 7 days.
- The browser keeps the session token in sessionStorage, not localStorage.
- Employee accounts can send notifications and view aggregate stats/history. Only administrators can create/list/deactivate employee accounts.
- Disabling an employee revokes all of that employee's sessions.
- The legacy ADMIN_API_KEY route remains available for your existing PowerShell test. Never share that key or embed it in the site.
- Push sends remain capped at 40 subscriptions per request. A later enhancement should add pagination/queued batches before large campaigns.
- A provider's successful HTTP response means accepted by the push service, not proof that the device displayed it.
- The Worker restricts CORS to the GitHub Pages origin, but CORS is not authentication; all management routes enforce server-side sessions and roles.
