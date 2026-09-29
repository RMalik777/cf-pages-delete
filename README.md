# Pages Cleaner

Cloudflare does not delete a Pages project that has too many deployments. The Cloudflare dashboard deletes deployments one at a time only. Pages Cleaner deletes many deployments at the same time.

Users sign in with their own Cloudflare account. Then they select a Pages project and delete all its deployments or only some of them. When the deployments are gone, users can also delete the project.

## Features

- Sign-in with Cloudflare OAuth, through the generic OAuth plugin of [better-auth](https://better-auth.com).
- A list of your accounts and Pages projects. It is not necessary to find project IDs.
- A deployment list that loads all deployments. The list shows how many deployments it loaded.
- A filter for the environment (production or preview) and a "keep newest N" shortcut.
- Deletion in small batches at a controlled speed, to stay in the Cloudflare API rate limit. You can pause, stop, and retry the deletion.
- Protection for the live production deployment. The app does not delete it. When you delete the project, Cloudflare removes the live deployment too.
- No database. Encrypted cookies keep the session and the Cloudflare token.

The app uses only the official Cloudflare API (`api.cloudflare.com/client/v4`). It calls the API through the Cloudflare [TypeScript SDK](https://github.com/cloudflare/cloudflare-typescript) (`cloudflare` on npm).

The stack is TanStack Start (React), Cloudflare Workers, Tailwind CSS v4, shadcn/ui, and better-auth.

## 1. Create a Cloudflare OAuth client

1. In the Cloudflare dashboard, go to **Manage Account > OAuth clients**.
2. Select **Create client**.
3. Set these values:
   - **Grant type:** Authorization code
   - **Response type:** code
   - **Token authentication method:** `client_secret_basic`
4. Add these redirect URLs:
   - `http://localhost:3000/api/auth/callback/cloudflare` (local development)
   - `https://<your-domain>/api/auth/callback/cloudflare` (production)
5. Add these scopes:
   - `account-settings.read` (Account Settings Read)
   - `page.read` (Pages Read)
   - `page.write` (Pages Write)
   - `user-details.read` (User Details Read)
6. Copy the client ID and the client secret.

The app must have the `account-settings.read` scope. Without this scope, `GET /accounts` gives an empty list.

Do not add the `offline_access` scope. Cloudflare does not accept this scope for self-managed clients. As a result, the app gets no refresh token. When the Cloudflare access token expires, the user must sign in again.

### Private and public clients

A new client is **private**. Only members of your Cloudflare account can authorize a private client. If you want all Cloudflare users to sign in, make the client **public**. A public client must have these items:

- A client name, a logo, and a client URL
- A completed domain verification for the client URL

CAUTION: You cannot change a public client back to private. For more information, refer to [Create an OAuth client](https://developers.cloudflare.com/fundamentals/oauth/create-an-oauth-client/#private-and-public-clients).

## 2. Set the environment variables

1. Copy `.env.example` to `.env`.
2. Optionally, put local values in `.env.local`.
3. Enter the values in this table.

| Variable                   | Value                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_CLIENT_ID`     | The OAuth client ID                                                                                                 |
| `CLOUDFLARE_CLIENT_SECRET` | The OAuth client secret                                                                                             |
| `CLOUDFLARE_OAUTH_SCOPES`  | The scopes of the client, with a space between them: `account-settings.read page.read page.write user-details.read` |
| `BETTER_AUTH_SECRET`       | A random secret with 32 or more characters. To make one, run `openssl rand -base64 32`.                             |
| `BETTER_AUTH_URL`          | The public base URL, for example `http://localhost:3000`                                                            |

## 3. Run the app on your computer

1. Install the dependencies:

   ```bash
   pnpm install
   ```

2. Start the development server:

   ```bash
   pnpm dev
   ```

3. Open http://localhost:3000.

Other scripts are `pnpm lint`, `pnpm format`, and `pnpm build`.

## 4. Deploy to Cloudflare Workers

1. In `wrangler.jsonc`, set `vars.BETTER_AUTH_URL` to your production URL.
2. Add the production redirect URL to the OAuth client.
3. Set the secrets:

   ```bash
   pnpm wrangler secret put CLOUDFLARE_CLIENT_ID
   pnpm wrangler secret put CLOUDFLARE_CLIENT_SECRET
   pnpm wrangler secret put BETTER_AUTH_SECRET
   ```

4. Deploy the Worker:

   ```bash
   pnpm run deploy
   ```

## How the app operates

| Part                               | File                                                   |
| ---------------------------------- | ------------------------------------------------------ |
| better-auth configuration          | `src/lib/auth.ts`                                      |
| Cloudflare SDK client              | `src/lib/cloudflare-api.ts`                            |
| Server functions (list and delete) | `src/server/cloudflare.functions.ts`                   |
| Session and token middleware       | `src/server/auth-middleware.ts`                        |
| Delete queue                       | `src/hooks/use-bulk-delete.ts`                         |
| Deployment loader                  | `src/hooks/use-all-deployments.ts`                     |
| Project page                       | `src/routes/_app/projects/$accountId.$projectName.tsx` |

The browser controls the deletion. It sends 10 deployment IDs in each server call. The speed is approximately 3.5 deletions each second. Thus, each Worker request stays short, and the app stays in the Cloudflare rate limit of approximately 1200 requests in 5 minutes.

If the API returns `429`, the queue stops for the time in the `Retry-After` header. Then the queue continues. The delete calls do not use the automatic retries of the SDK. Thus, only the queue controls the speed.

The app uses these Cloudflare API endpoints:

- `GET /user`
- `GET /accounts`
- `GET /accounts/{account_id}/pages/projects`
- `GET /accounts/{account_id}/pages/projects/{project_name}`
- `GET /accounts/{account_id}/pages/projects/{project_name}/deployments`
- `DELETE /accounts/{account_id}/pages/projects/{project_name}/deployments/{deployment_id}?force=true`
- `DELETE /accounts/{account_id}/pages/projects/{project_name}`
