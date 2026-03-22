FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma

# `npm ci` triggers `prisma generate` via postinstall, so the schema and
# placeholder datasource URLs need to exist during image build.
ENV DATABASE_URL=postgresql://devotime:devotime@postgres:5432/devotime?schema=public
ENV DIRECT_URL=postgresql://devotime:devotime@postgres:5432/devotime?schema=public
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
