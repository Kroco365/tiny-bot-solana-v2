# Tiny Bot v2 — EMA Crossover Paper Trader

[![Bounty](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![Rank](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/Kroco365/tiny-bot-solana-v2/rank.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![Reward](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/Kroco365/tiny-bot-solana-v2/reward.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)

Entry for the make.fun bounty
[Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1):
a tiny long-only paper-trading bot for the `bars-replay/v1` harness
(7 Solana symbols, hourly bars). It runs on Node 22 with no dependencies,
no network access, no randomness and no clock reads — fully deterministic,
so the harness's two executions reproduce byte for byte.

## Strategy

Per symbol, on hourly closes, the bot tracks EMA(8), EMA(13) and EMA(50)
in float64, starting from zero and stepped once per bar.

**Open a long** when all three hold on the current bar:

- EMA(8) crosses above EMA(13) (strictly: previous fast below previous
  mid, current fast above current mid);
- trend filter: EMA(50) is rising, or the close is above EMA(50);
- gap filter: `(close - EMA(13)) / EMA(13) >= 0.3%`.

**Close the long** when any of these holds:

- EMA(8) crosses back below EMA(13);
- take-profit: the close reaches +50% above the entry close;
- stop-loss: the close reaches -15% below the entry close.

**Sizing and execution**

- Each entry stakes `current equity / 28` in quote currency (USDC).
- One position per symbol at a time; a new entry signal is ignored while
  already long in that symbol.
- Sell orders are sent before buy orders in every batch.
- Slippage cap 100 bps on every order.
- A position still held after a sell was sent means that sell was
  rejected, so the exit rules are simply re-evaluated on the next bar;
  the harness account is the source of truth, no in-flight flag is kept.

## Files

- `main.ts` — the bot (entrypoint, runs on Node 22).
- `vendor/makefun-bars.ts` — the kit's `agent-fun/bars-replay/v1` shim,
  copied verbatim from the competition kit.
- `.makefun/owner.json` — the claim file naming the payout wallet.

## Local grade (dev kit)

Graded with the competition kit's `grade-local` (`--driver process`):

- Net PnL **-25.72 USDC** over 33 trades (6 symbols), win rate 0.26,
  max drawdown **0.74%**, 0 rejected orders.
- Buy-and-hold baseline on the same window: -869.34 USDC, so this bot
  beats buy-and-hold by **+843.62 USDC**.
- Guardrails met (at least 8 trades, drawdown under 25%).

Reproduce it from the unpacked kit directory:

```sh
node cli/makefun.mjs grade-local --kit . --bot <this repository> --driver process --worktree
```

## License

MIT — see [LICENSE](LICENSE).
