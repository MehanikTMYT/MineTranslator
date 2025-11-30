FROM node:18-alpine

WORKDIR /app

COPY package*.json pnpm-lock.yaml ./
COPY . .

RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile --dev

RUN pnpm build

EXPOSE 8250

CMD ["pnpm", "start"]