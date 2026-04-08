#!/bin/bash
set -e

echo "Installing dependencies..."
pnpm install

echo "Building packages..."
pnpm run build

echo "Starting platform (Postgres + API + MCP)..."
docker compose up -d

echo "Installing CLI globally..."
cd packages/cli && pnpm link --global && cd ../..

echo "Verifying..."
docker compose ps
curl -s http://localhost:3002/v1/health | jq . || curl -s http://localhost:3002/v1/health

echo ""
echo "✓ ACP is ready. Run: acp init --demo ~/projects/acp-demo"
