<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Store authorization roles separately from profiles and enforce room access in database policies, because client-visible identity fields are not authorization controls.
- Persist room access grants per user and revoke them when an administrator changes a room password, so remembered access remains secure.
- Use the Insert key as the default Push-to-Talk shortcut, keeping Space available for normal keyboard use.
- Send ephemeral in-call attention alerts through the room presence channel broadcast, keeping them separate from WebRTC media and chat history.
- Keep the curated room icon catalog centralized so database values, admin selection, and map rendering stay synchronized.
- Keep room call state ephemeral in presence/broadcast; persist only durable chat replies and per-user reactions.

## Base44 dev environment

- **Runtime**: Bun (`oven/bun:1` image) with `bun install --frozen-lockfile` on startup, then `bun run dev` (Vite 8 + TanStack Start SSR).
- **Compose**: `docker compose -f docker-compose.base44.yml up -d` — bind-mounts the repo to `/app`, uses an anonymous volume for `node_modules`, maps port 3000.
- **Env vars**: The committed `.env` has Supabase publishable credentials (both `VITE_*` and non-`VITE_*` variants). Vite loads `.env` automatically; compose also passes them via `env_file`.
- **Secrets**: `SUPABASE_SERVICE_ROLE_KEY` is optional (not required to boot) — only needed for server-side admin operations via `supabaseAdmin`. Provide it through the Base44 secrets dashboard if admin features are needed.
- **Healthcheck**: `bun -e 'fetch("http://127.0.0.1:3000/")...'` — probes the Vite dev server.
- **No local database**: The app connects to a hosted Supabase instance on Lovable Cloud; no Postgres/Redis containers needed.
