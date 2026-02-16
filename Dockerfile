FROM oven/bun:1

WORKDIR /app

COPY bun.lock package.json ./
RUN bun install --frozen-lockfile

COPY . .

RUN chmod +x docker-entrypoint.sh

EXPOSE 8080 8081

ENTRYPOINT ["./docker-entrypoint.sh"]
