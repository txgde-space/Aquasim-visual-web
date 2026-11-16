#!/bin/sh
# Run on a connected development machine. The resulting binary needs no Go,
# Node.js or Python on the N100 for the web UI and serial device service.
set -eu
cd "$(dirname "$0")/.."
mkdir -p out
go test ./...
target_os="${TARGET_OS:-linux}"
target_ext=""
if [ "$target_os" = windows ]; then target_ext=".exe"; fi
GOOS="$target_os" GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o "out/aquasim-n100-${target_os}-amd64${target_ext}" .
printf 'Built out/aquasim-n100-%s-amd64%s\n' "$target_os" "$target_ext"
