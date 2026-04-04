# ── Stage 1: Build React UI ──────────────────────────────────────────────────
FROM node:22-alpine AS ui
WORKDIR /ui
COPY ui/package*.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# ── Stage 2: Python runtime ─────────────────────────────────────────────────
FROM python:3.14-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       curl jq openssh-client \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -r -s /bin/false -m conduit

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py ./
COPY conduit-*.sh ./
COPY lib/ ./lib/
COPY templates/ ./templates/
COPY --from=ui /ui/dist ./ui/dist

RUN chown -R conduit:conduit /app

USER conduit
EXPOSE 9999
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "9999"]
