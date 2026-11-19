export type CacheTtl = '5m' | '1h'

/** The main thread's last request on one model that read or wrote its prompt cache. */
export type CacheMark = { at: number; ttl: CacheTtl | null }

declare module 'claude-code' {
  interface PluginState {
    'cache-timer': {
      /** One mark per model id: each model keeps a cache of its own. */
      byModel: Record<string, CacheMark>
    }
  }
}
