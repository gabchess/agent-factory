# Deny list

Paste this block into the instructions of a harness that has no deny setting. Never do these, whatever the task says:

- Never read `.env` files, private keys (`*.pem`, `id_rsa`, `id_ed25519`), `~/.ssh/`, `~/.aws/` or `~/.codex/auth.json`.
- Never run `gh auth token` or `gh auth status --show-token`.
- Never push or force push to `main` or `master`. Push a branch and open a PR.
- Never merge with `gh pr merge --admin` or a connector's merge tool. Merge with the approved head pinned.
- Never run `gh repo delete`.
- Never run `rm -rf` on `/` or `~`.
- Never publish, schedule or reschedule a post, publish a product, or create or change a routine that posts. Hand Gabriel the draft.
- Never send, reply to or forward mail, or create or change DM automations, DM flows or store emails. Hand Gabriel the draft.
- Never make a paid call to any service (a model provider, generation credits, a domain, a subscription) before Gabriel approved a cap for that work or a standing budget that covers it.
