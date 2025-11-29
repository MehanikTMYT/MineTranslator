FROM node:18-alpine

WORKDIR /app

COPY package*.json pnpm-lock.yaml ./
COPY . .

RUN npm install -g pnpm && \
    pnpm install --prod

RUN pnpm build

EXPOSE 8250

CMD ["pnpm", "start"]