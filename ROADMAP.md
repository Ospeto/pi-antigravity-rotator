# Roadmap — Pi Antigravity Rotator

3-month roadmap based on community feedback and strategic positioning goals.

---

## Month 1 — Positioning & Documentation

**Goal:** Make pi-antigravity-rotator the default recommendation when anyone asks about Google Antigravity proxies or gateways.

- [x] Restructure README as a gateway-first document (not "rotation proxy")
- [x] Add live stats badges (installations, requests routed, estimated savings)
- [x] Create full documentation in `docs/` — configuration, how it works, compatibility, deployment, troubleshooting, telemetry
- [x] Create integration guides for 12 agents: Pi, OpenCode, Hermes, OpenClaw, Cursor, Claude Code, Codex, Cline, Roo Code, Continue, Aider, Open WebUI
- [x] Add PostgreSQL setup guide with AI-agent-friendly prompt
- [x] Add architecture Mermaid diagram to README
- [x] Add `GET /v1/public-stats` to telemetry receiver (no auth, 5-min cache) for shields.io dynamic badges

---

## Month 2 — Dashboard & Observability

**Goal:** Make the dashboard a compelling reason to use the gateway even with a single account.

- [ ] **Health score visual** — Surface the per-account health score (0.0–1.0) prominently on account cards (e.g. colored badge with numeric value and label: Excellent / Good / Degraded / Poor)
- [ ] **Benchmark tool** — Button in the dashboard that runs a latency/throughput probe against all accounts simultaneously and ranks them. Output: account, avg latency, success rate, p95.
- [ ] **Dashboard improvements** — Improve the routing inspector modal to show health score breakdown (quota component, error penalty, cooldown penalty, availability penalty)
- [ ] **Public telemetry stats page** — Static page at `telemetry.tuxevil.com/stats` showing aggregated installation metrics (powered by the new `/v1/public-stats` endpoint)

---

## Month 3 — Streaming & Performance

**Goal:** Eliminate the main technical gap vs. native API usage.

- [ ] **Real token-by-token streaming** — Replace the current buffer-then-emit SSE passthrough with true chunk-by-chunk streaming in the compatibility adapters (`compat.ts`, `proxy.ts`). This is the highest-impact UX improvement: eliminates perceived latency for long completions.
- [ ] **Async I/O migration** — Migrate `writeFileSync`/`readFileSync`/`renameSync` in `src/storage.ts` to `fs.promises` equivalents to avoid blocking the event loop under high concurrency.

---

## Ongoing / Backlog

These items are tracked but not scheduled for the current 3-month window:

- **Public telemetry panel** — Full analytics page with historical charts, model distribution, flag incident analysis. Requires the Month 2 static page as a foundation.
- **Prometheus / OpenTelemetry export** — `/metrics` endpoint for Grafana/Prometheus integration. Low demand currently.
- **App of any kind** — No plans for a desktop app or Tauri wrapper. The target users are developers comfortable with CLI and Docker.
- **Multi-provider backends** — No plans to add direct OpenAI/Anthropic/Ollama upstream integrations. The gateway is purpose-built for Google Antigravity.

---

## Technical Debt (from architecture audit)

| # | Issue | Status |
|---|-------|--------|
| 1 | Responses API persistence (Codex sessions survive restarts) | Resolved — `responses-store.ts` with file/DB persistence |
| 2 | Real SSE streaming (token-by-token passthrough) | Planned — Month 3 |
| 3 | Admin routes secured by default | Resolved — auto-generated token on first run |
| 4 | External service dependencies (telemetry, version check) non-blocking | Resolved — all async with aggressive timeouts |
| 5 | Dynamic model configuration | Resolved — `modelSpecs` and `modelAliases` in config |
| 6 | Async I/O in storage layer | Planned — Month 3 |
