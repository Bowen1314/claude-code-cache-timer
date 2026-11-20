# cache-timer

A Claude Code mod that shows how long the main conversation's prompt cache stays warm.

It reads the cache usage the API reports on every response, so it uses the real TTL instead of assuming one: 1 hour on most subscription sessions, 5 minutes when the request wrote a 5-minute entry. The countdown starts when the request was sent and restarts on every cache read or write. Each model keeps its own cache, so each one gets its own countdown.

It appears as dim text at the right of the prompt footer:

```
Cache 59:33 · 1h · opus-5-5
```

Once the entry lapses it reads `Cache expired · 1h · opus-5-5`, meaning the next request writes the cache again. Subagents keep caches of their own and are not counted.

## Install

```
/plugin install cache-timer --marketplace Bowen1314/claude-code-cache-timer
```

Or from a shell:

```bash
claude plugin marketplace add Bowen1314/claude-code-cache-timer
claude plugin install cache-timer@claude-code-cache-timer
```

New sessions load it; restart any session that is already open.
