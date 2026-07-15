#!/bin/zsh
# Launch wrapper for the Next.js dev server.
# Turbopack's CSS loader spawns pooled `node` worker processes, so `node` must
# be discoverable on PATH — not just the binary that started the server. This
# prepends the active Node install's bin dir before handing off to next dev.
export PATH="/Users/nuradhikarie/.nvm/versions/node/v24.18.0/bin:$PATH"
cd "$(dirname "$0")/.."
exec node node_modules/next/dist/bin/next dev --port 3000
