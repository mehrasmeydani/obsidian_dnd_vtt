# syntax=docker/dockerfile:1

# Dev/build toolchain for the D&D VTT Obsidian plugin.
#
# This image builds and tests the plugin bundle (main.js). It does NOT run the
# VTT itself — the plugin runs inside the Obsidian desktop app on each machine.
# The Phase 3 sync server will ship its own runtime image separately.

FROM node:20-alpine

WORKDIR /app

# Install dependencies first so this layer caches when only source changes.
COPY package.json ./
RUN npm install

# Bring in the rest of the source.
COPY . .

# Default one-shot: typecheck + production bundle -> /app/main.js
CMD ["npm", "run", "build"]
