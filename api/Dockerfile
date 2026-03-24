# Minimize attack surface and reduce image footprint
FROM node:20-alpine

# Enforce deterministic package manager versioning
RUN corepack enable && corepack prepare pnpm@latest --activate

# Pre-create workspace with strict least-privilege ownership
RUN mkdir -p /home/node/app && chown -R node:node /home/node/app
WORKDIR /home/node/app

# Drop root privileges to mitigate potential container breakouts
USER node

# Leverage Docker layer caching by isolating dependency resolution
COPY --chown=node:node package.json pnpm-lock.yaml ./

# pnpm v10 fix: Disable the request for manual approval of build scripts
# and install ALL dependencies (including devDeps)
RUN pnpm config set side-effects-cache true && \
    pnpm install --frozen-lockfile --prod=false

# Source code is copied after dependencies to maximize cache hits
COPY --chown=node:node . .

# Transpile TypeScript to optimized JavaScript
RUN pnpm run build

EXPOSE 3000

# Bypass development tooling for maximum runtime performance
CMD ["pnpm", "run", "start:prod"]