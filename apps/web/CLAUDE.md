# Uxie — notes for agents

- Next.js (Pages Router) app in `apps/web`; Electron app in `apps/desktop`.
- Shared logic → `shared/` (abstract for both apps, don't duplicate).
- `apps/web/src/components/demo` + `apps/web/src/lib/demo` are the local `/demo` (fully client-side, no backend).
- New web reader feature: wire it into the demo if it makes sense (skip anything server/AI/DB/auth/collab).
- Align before changing: check the code, explain the fix, wait for my OK — unless trivial.
- Never commit or push without my explicit approval — every time.
- Default to `main`; no PRs or new branches unless I ask.
