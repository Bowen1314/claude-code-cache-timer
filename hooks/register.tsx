import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { CacheMark, CacheTtl } from '../types'

// Each model has a cache of its own: switching models re-caches, while the
// old model's entry keeps counting down.
const byModel = atom(
  { plugin: 'cache-timer', key: 'byModel' } as const,
  {} as Record<string, CacheMark>,
)

const TTL_MS: Record<CacheTtl, number> = { '5m': 300_000, '1h': 3_600_000 }

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    $.clock.every(1000, () => $.ui.invalidate('ui.render'))
    return next(e)
  })

  // Main thread only: subagents keep caches of their own.
  on('turn.step', async function* ($, e, next) {
    const at = await $.clock.now()
    const r = yield* next(e)

    if (e.agentId === undefined && r.usage) {
      const u = r.usage
      if (u.cache_read_input_tokens > 0 || u.cache_creation_input_tokens > 0) {
        const model = u.model
        await update($, byModel, marks => {
          // Both written: the shorter one decides when the next request misses.
          // Read only (or no breakdown reported): keep this model's last TTL.
          const ttl: CacheTtl | null =
            (u.ephemeral_5m_input_tokens ?? 0) > 0
              ? '5m'
              : (u.ephemeral_1h_input_tokens ?? 0) > 0
                ? '1h'
                : (marks[model]?.ttl ?? null)
          return { ...marks, [model]: { at, ttl } }
        })
      }
    }

    return r
  })

  // Plain text in the dim mode labels at the right of the prompt footer.
  // Time first, so a narrow footer cuts the model name, not the countdown.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const marks = Object.entries(await read($, byModel)).sort((a, b) => b[1].at - a[1].at)
    if (marks.length === 0) {
      return next(e)
    }

    const now = await $.clock.now()

    // Every model still warm, newest first; the newest is kept even once expired.
    const parts = marks.flatMap(([id, mark], i) => {
      const model = id.replace(/^claude-/, '')
      if (mark.ttl === null) {
        return i === 0 ? [`Cache ? · hit ${clock(now - mark.at)} ago · ${model}`] : []
      }

      const left = mark.at + TTL_MS[mark.ttl] - now
      if (left <= 0) {
        return i === 0 ? [`Cache expired ${clock(-left)} · ${mark.ttl} · ${model}`] : []
      }

      return [`Cache ${clock(left)} · ${mark.ttl} · ${model}`]
    })

    const { Text } = $.ui.resolve(e)
    return <Text dimColor>{[...parts, ...e.props.modes].join(' & ')}</Text>
  })
}
