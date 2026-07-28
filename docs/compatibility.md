# Compatibility Adapters

The proxy exposes three API formats on top of the native Google Antigravity endpoint. The native `/v1internal:streamGenerateContent` route used by Pi is unaffected.

## Available Models

```bash
curl http://localhost:51200/v1/models
```

| Model | Family | Notes |
|-------|--------|-------|
| `gemini-3.6-flash-high` | Gemini 3.6 Flash | High thinking budget |
| `gemini-3.6-flash-medium` | Gemini 3.6 Flash | Medium thinking budget |
| `gemini-3.6-flash-low` | Gemini 3.6 Flash | Low thinking budget |
| `gemini-3.6-flash-tiered` | Gemini 3.6 Flash | Auto-selects tier based on quota |
| `gemini-3.5-flash-high` | Gemini 3.5 Flash | |
| `gemini-3.5-flash-medium` | Gemini 3.5 Flash | |
| `gemini-3.5-flash-low` | Gemini 3.5 Flash | |
| `gemini-3.1-pro-high` | Gemini 3.1 Pro | |
| `gemini-3.1-pro-low` | Gemini 3.1 Pro | |
| `claude-sonnet-4-6` | Claude | Via Antigravity |
| `claude-opus-4-6-thinking` | Claude | Via Antigravity, with thinking |
| `gpt-oss-120b-medium` | GPT-OSS | Via Antigravity |

Short aliases (e.g. `gemini-3.6-flash`, `gemini-3.1-pro`, `claude-sonnet`) are also accepted and resolve to sensible defaults.

---

## OpenAI Chat Completions

**Endpoint:** `POST /v1/chat/completions`

```bash
curl http://localhost:51200/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gemini-3.6-flash-high",
    "messages": [{"role": "user", "content": "Say pong"}],
    "stream": false
  }'
```

**Supported features:**
- Text chat (streaming and non-streaming)
- `system`, `user`, `assistant`, `developer`, and `model` roles
- Tool/function calling (`tools`, `tool_choice`)
- Image input (base64 data URL: `image_url.url = data:image/...;base64,...`)
- Native reasoning visibility as `reasoning_content` chunks (models with thinking enabled)
- Request normalization (non-array messages, legacy `prompt`/`input` fields, raw native requests)

---

## OpenAI Responses API

**Endpoint:** `POST /v1/responses`

For Codex-style agentic systems that use the OpenAI Responses API.

```bash
curl http://localhost:51200/v1/responses \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gemini-3.6-flash-high",
    "input": [{"role": "user", "content": [{"type": "input_text", "text": "Say pong"}]}],
    "stream": false
  }'
```

**Supported operations:**
- `POST /v1/responses` — create
- `GET /v1/responses/<id>` — retrieve
- `DELETE /v1/responses/<id>` — delete
- `POST /v1/responses/<id>/cancel` — cancel
- `GET /v1/responses/<id>/input_items` — list input items

**Supported tool types:** `type: "function"` only. Built-in tools (`web_search`, `file_search`, `computer`, `code_interpreter`) are rejected explicitly with a clear error.

---

## Anthropic Messages API

**Endpoint:** `POST /v1/messages`

```bash
curl http://localhost:51200/v1/messages \
  -H 'Content-Type: application/json' \
  -H 'anthropic-version: 2023-06-01' \
  -d '{
    "model": "claude-sonnet-4-6",
    "system": "Be terse.",
    "messages": [{"role": "user", "content": "Say pong"}],
    "max_tokens": 128,
    "stream": false
  }'
```

**Supported features:**
- Text chat (streaming and non-streaming)
- Tool use (`tool_use` / `tool_result` content block format)
- Parallel tool calls (batched into a single turn, results properly grouped)
- Image input (base64 source: `type=image`, `source.type=base64`)
- Thinking blocks exposed as `thinking_delta` chunks

---

## Feature Matrix

| Feature | OpenAI Chat | OpenAI Responses | Anthropic Messages |
|---------|:-----------:|:----------------:|:-----------------:|
| Text chat | ✓ | ✓ | ✓ |
| Streaming | ✓ | ✓ | ✓ |
| Tool/function calling | ✓ | ✓ (function only) | ✓ |
| Image input | ✓ | — | ✓ |
| Thinking/reasoning blocks | ✓ | ✓ | ✓ |
| Multi-turn conversations | ✓ | ✓ | ✓ |
| Parallel tool calls | ✓ | ✓ | ✓ |
| System/developer role | ✓ | ✓ | ✓ |

> **Note:** Streaming mode emits one compatible final delta (full buffer passthrough). Native token-by-token passthrough is not yet implemented. See [ROADMAP.md](../ROADMAP.md).
