# Upstream snapshot

This folder vendors the public N100N project into KRA so the engine source and its tests travel with the KRA repository.

- Upstream: https://github.com/turtrsst/n100n
- Base snapshot commit: `77fe26134c83103e3f4175a43cf852b91dacc8a1`
- Applied upstream auth commit: `00c81c836ed5181a2b696ce095b5f8ad8a4a99db` (`arena/c59efa9b-n100n`)
- Imported: 2026-11-01; auth update synchronized 2026-11-02

The vendored tree is therefore the base snapshot plus the v1.3.0 password/login
update. Apart from KRA's additional workflow/documentation, upstream source is
kept intact under this folder. Runtime state and secrets (`.env`, `data/`, `files/`, `node_modules/`) must remain local and are ignored by `n100n/.gitignore`. To update this snapshot, compare the upstream repository and intentionally copy new source changes; do not copy `.git`, `.env`, or runtime data.

**Bundling source does not start or publish the Node service.** N100N needs Node.js 22.5+ with `node:sqlite`, a persistent writable data directory, and a running service. See `docs/N100N_DEPLOYMENT.md` for deployment and KRA connection steps.
