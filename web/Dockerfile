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

# Install dependencies resolving native bindings for Alpine (ignore Windows lockfile)
RUN pnpm config set side-effects-cache true && \
    pnpm install --no-frozen-lockfile

# Source code is copied after dependencies to maximize cache hits
COPY --chown=node:node . .

# Expose Vite's default development port
EXPOSE 5173

# Bypass development tooling for maximum runtime performance
# (Using dev server bound to 0.0.0.0 for containerized local assessment)
CMD ["pnpm", "run", "dev", "--host", "0.0.0.0"]