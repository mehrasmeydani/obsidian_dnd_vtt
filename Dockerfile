# syntax=docker/dockerfile:1

# Dev/build toolchain for the D&D VTT Obsidian plugin.
#
# This image builds and tests the plugin bundle (main.js). It does NOT run the
# VTT itself — the plugin runs inside the Obsidian desktop app on each machine.
# The Phase 3 sync server will ship its own runtime image separately.

# Debian (glibc), not Alpine (musl): the repo (incl. node_modules and
# package-lock.json) is bind-mounted, and CI + WSL hosts are glibc. Keeping the
# container on glibc means container-installed native binaries work on the
# host, and lockfile updates made in here never drop the glibc variants of
# rollup/esbuild that CI needs (npm bug #4828).
FROM node:20-slim

WORKDIR /app

# Install dependencies first so this layer caches when only source changes.
COPY package.json ./
RUN npm install

# Bring in the rest of the source.
COPY . .

# Default one-shot: typecheck + production bundle -> /app/main.js
CMD ["npm", "run", "build"]
