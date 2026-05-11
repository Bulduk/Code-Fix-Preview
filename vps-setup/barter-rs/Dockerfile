FROM rust:1.78-slim AS builder
WORKDIR /app

# Bağımlılıkları önce cache'le
RUN apt-get update && apt-get install -y pkg-config libssl-dev libpq-dev && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY src ./src

RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl3 libpq5 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/nexus-barter /usr/local/bin/nexus-barter

EXPOSE 8090
CMD ["nexus-barter"]
