# @andyzasl/opencode-copilot

An [OpenCode](https://opencode.ai) v2 TUI plugin that shows your remaining GitHub Copilot quota and real-time chat usage directly in the sidebar **Context** block.

```
Context
9,234 tokens
45% used
$0.12 spent

Copilot                      ← this plugin
74% left (185k credits)
Chat: 2.5 credits
```

The block renders dynamically when the active session is running on a `github-copilot` model.

## Features

- **Billing Cycle Balance**: Displays remaining premium quota as both a percentage and total volume (credits or requests).
- **Per-Chat Usage Attribution**: Tracks baseline balance upon session view and shows how much was consumed during the conversation (`Chat: X credits`).
- **Plan Auto-detection**: Automatically adapts units based on Copilot's response (`credits` for token-metered plans, `requests` for discrete plans, or hides cleanly if unlimited).
- **Zero Configuration**: Reads existing Copilot credentials from OpenCode's internal store automatically.
- **Privacy & Security Focused**: Deliberately reads *only* the `github-copilot` OAuth token from OpenCode's local storage. Never falls back to general-purpose `GITHUB_TOKEN` / `GH_TOKEN` environment variables to prevent accidental credential leakage to undocumented endpoints.

## What the Numbers Mean

Copilot plans report quota differently:

| Plan reports | Unit shown | Example |
|---|---|---|
| `token_based_billing: true` | credits | `74% left (185k credits)` |
| `token_based_billing: false` | requests | `82% left (247 requests)` |
| `unlimited: true` | *hidden* | — |

The line below (`Chat: ...`) displays the change in quota observed since the current session was opened.

## Installation

### Option 1 — OpenCode CLI (Recommended)

Install the plugin directly into your global OpenCode configuration:

```bash
opencode plugin add @andyzasl/opencode-copilot
```

### Option 2 — Global Config (`opencode.json`)

Add the package to your `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "@andyzasl/opencode-copilot"
  ]
}
```

### Option 3 — Local or Manual Configuration (`tui.json`)

If you cloned this repository locally:

```bash
git clone git@github.com:andyzasl/opencode-copilot.git
cd opencode-copilot
npm install
```

Reference the source directly in `~/.config/opencode/tui.json` (or `.opencode/tui.json` for project-local):

```json
{
  "plugin": ["/path/to/opencode-copilot/src/tui.tsx"]
}
```

## Authentication

Authentication is completely automatic. The plugin checks the `github-copilot` OAuth access token in OpenCode's `auth.json` across standard OS storage paths:

1. `$XDG_DATA_HOME/opencode/auth.json`
2. macOS: `~/Library/Application Support/opencode/auth.json`
3. Windows: `%LOCALAPPDATA%/opencode/auth.json` and `%APPDATA%/opencode/auth.json`
4. Linux / Fallback: `~/.local/share/opencode/auth.json`

If you are not authenticated with Copilot in OpenCode, nothing is rendered.

## Polling & Network Behavior

| Aspect | Detail |
|---|---|
| **Endpoint** | `api.github.com/copilot_internal/user` |
| **Refresh Interval** | Every 5 minutes while active, plus on `session.idle` (5 s throttle) |
| **Rate Limiting** | Minimum 30 s gap between background polls; enforces single in-flight request |
| **Timeout** | 5 seconds |
| **Idle Behavior** | Background polling starts only after a Copilot session is observed |
| **Degradation** | Fails silently without cluttering the UI with error banners |

> [!NOTE]
> `copilot_internal/user` is an internal GitHub API endpoint. If GitHub modifies or restricts this endpoint, the plugin safely hides rather than throwing unhandled exceptions.

## Development

Check types:

```bash
npm install
npm run typecheck
```

Dry-run npm packaging:

```bash
npm pack --dry-run
```

## License

[MIT](LICENSE) © Andrei Zaslavskii
