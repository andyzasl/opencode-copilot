/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { createSignal } from "solid-js"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/** The only auth.json key this plugin will ever read. */
const PROVIDER = "github-copilot"
const ENDPOINT = "https://api.github.com/copilot_internal/user"
const POLL_MS = 5 * 60_000
const MIN_GAP_MS = 30_000
/** Shorter gap after each turn so the chat cost stays current. */
const IDLE_GAP_MS = 5_000
const TIMEOUT_MS = 5_000

type Quota = {
  percent_remaining?: number
  remaining?: number
  entitlement?: number
  /** Plans with this flag meter credits; without it, discrete requests. */
  token_based_billing?: boolean
  unlimited?: boolean
}
type UserResponse = { quota_snapshots?: { premium_interactions?: Quota } }
type Usage = { percent: number; remaining?: number; unit: "credit" | "request" }

/**
 * Read the Copilot OAuth token from opencode's auth.json.
 *
 * Deliberately narrow: only the "github-copilot" entry is considered, and no
 * environment variable fallback exists. A general-purpose PAT must never be
 * sent to an undocumented endpoint. Read fresh on every call so that a logout
 * or token rotation takes effect immediately.
 */
function readToken(): string | null {
  const dirs: string[] = []
  if (process.env["XDG_DATA_HOME"]) dirs.push(join(process.env["XDG_DATA_HOME"], "opencode"))
  if (process.platform === "darwin") dirs.push(join(homedir(), "Library", "Application Support", "opencode"))
  if (process.platform === "win32") {
    if (process.env["LOCALAPPDATA"]) dirs.push(join(process.env["LOCALAPPDATA"], "opencode"))
    if (process.env["APPDATA"]) dirs.push(join(process.env["APPDATA"], "opencode"))
  }
  dirs.push(join(homedir(), ".local", "share", "opencode"))

  for (const dir of dirs) {
    try {
      const entry = JSON.parse(readFileSync(join(dir, "auth.json"), "utf8"))[PROVIDER]
      const access = entry?.type === "oauth" ? entry.access : undefined
      if (typeof access === "string" && access.trim()) return access.trim()
    } catch {
      // Missing or malformed file: try the next candidate.
    }
  }
  return null
}

async function fetchUsage(): Promise<Usage | null> {
  const token = readToken()
  if (!token) return null

  try {
    const res = await fetch(ENDPOINT, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null

    const quota = ((await res.json()) as UserResponse).quota_snapshots?.premium_interactions
    if (!quota) return null

    // An unlimited plan reports entitlement/remaining as 0, which would render
    // a misleading "0 credits". Show nothing instead.
    if (quota.unlimited === true) return null

    const { percent_remaining: pct, remaining, entitlement } = quota
    const percent =
      typeof pct === "number"
        ? pct
        : typeof remaining === "number" && typeof entitlement === "number" && entitlement > 0
          ? (remaining / entitlement) * 100
          : undefined

    if (percent === undefined || !Number.isFinite(percent)) return null
    return {
      percent: Math.round(percent),
      remaining: typeof remaining === "number" ? remaining : undefined,
      unit: quota.token_based_billing === true ? "credit" : "request",
    }
  } catch {
    return null
  }
}

/** 185338 -> "185k", 9200 -> "9,200". Keeps the sidebar line short. */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`
  return n.toLocaleString()
}

function label(usage: Usage): string {
  const n = usage.remaining
  if (n === undefined) return `${usage.percent}% left`
  return `${usage.percent}% left (${compact(n)} ${usage.unit}${n === 1 ? "" : "s"})`
}

function creditsLabel(spent: number, unit: Usage["unit"]): string {
  const n = Math.round(spent * 100) / 100
  return `Chat: ${n.toLocaleString()} ${unit}${n === 1 ? "" : "s"}`
}

export default Plugin.define({
  id: "opencode-copilot",
  setup(context) {
    /**
     * Balance seen when each session was first displayed. The API exposes only
     * the account-wide balance, so a chat's cost is baseline minus current.
     * Usage from other clients during the chat is attributed to it as well.
     */
    const baselines = new Map<string, number>()

    const [usage, setUsage] = createSignal<Usage | null>(null)
    let lastFetch = 0
    let inFlight = false
    /** Set once any visible session uses Copilot; gates background polling. */
    let isCopilotSeen = false

    const refresh = async (minGap = MIN_GAP_MS) => {
      if (inFlight || Date.now() - lastFetch < minGap) return
      inFlight = true
      lastFetch = Date.now()
      try {
        setUsage(await fetchUsage())
      } finally {
        inFlight = false
      }
    }

    const sessionIsCopilot = (sessionID: string) => {
      const provider = context.data.session.get(sessionID)?.model?.providerID
      return provider === PROVIDER || provider === "copilot"
    }

    void refresh()

    // Poll only after a Copilot session was shown, so the token leaves the
    // machine only when the line could actually be rendered.
    const timer = setInterval(() => {
      if (isCopilotSeen) void refresh()
    }, POLL_MS)
    const stopIdle = context.data.on("session.idle", () => void refresh(IDLE_GAP_MS))

    const theme = context.theme as any
    const textColor = theme.text?.base
    const mutedColor = theme.text?.muted ?? theme.text?.subtle ?? textColor

    const stopSlot = context.ui.slot({
      prepend: "sidebar.content",
      render: (props) => {
        // Read the signal first so the slot re-renders once the quota arrives.
        const current = usage()
        if (!sessionIsCopilot(props.sessionID)) return null
        isCopilotSeen = true
        if (!current) return null
        let spent: number | undefined
        if (current.remaining !== undefined) {
          if (!baselines.has(props.sessionID)) baselines.set(props.sessionID, current.remaining)
          spent = Math.max(0, baselines.get(props.sessionID)! - current.remaining)
        }
        return (
          <box>
            <text fg={textColor}>
              <b>Copilot</b>
            </text>
            <text fg={mutedColor}>{label(current)}</text>
            {spent !== undefined && <text fg={mutedColor}>{creditsLabel(spent, current.unit)}</text>}
          </box>
        )
      },
    })

    return () => {
      clearInterval(timer)
      stopIdle()
      if (typeof stopSlot === "function") stopSlot()
    }
  },
})
