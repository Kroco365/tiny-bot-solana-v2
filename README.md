# Tiny Bot v2

A tiny paper-trading bot for the make.fun bounty
[Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1).
It trades hourly bars of 7 Solana symbols (FARTCOIN, JITOSOL, POPCAT, RAY, SOL,
WETH, WIF) on the `agent-fun/bars-replay/v1` harness, long only, starting from
10,000 USDC.

[![Bounty](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![Rank](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/Kroco365/tiny-bot-solana-v2/rank.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![Reward](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/Kroco365/tiny-bot-solana-v2/reward.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)

## Strategy

Per symbol, track EMA(8), EMA(13) and EMA(50) over closes in float64. Each EMA
starts as the mean of its first `span` closes, then moves 2 / (span + 1) of the
way to each new close. Bars are read during the warm-up too, so the indicators
are already seeded when trading opens.

- **Entry:** EMA(8) crosses above EMA(13) on a symbol not held, and only when
  both filters pass: (a) the trend filter — the slow EMA is rising, or the
  close is above the long EMA(50); (b) the gap filter — (close − EMA(13)) /
  EMA(13) is at least 0.2% at the cross bar. A zero-volume bar signals nothing.
- **Exit (whole position):** EMA(13) crosses back above EMA(8) (the sell
  signal is held while EMA(13) stays above EMA(8), so a refused sell is
  re-sent on the next bar), or the position is worth at least 50% over its
  cost (take-profit), or at least 15% under it (stop-loss).
- **Sizing:** equity / 28 per entry — the small stake keeps the bot mostly in
  USDC and losing little in downtrends — capped at the 25% per-position
  weight limit and at the cash this reply has not spent yet; below the minimum
  notional it buys nothing. Sells go first in each reply; their proceeds only
  fund later replies, never the buys in the same reply.
- **Slippage** is capped at 100 bps past the close the order was decided on.

The bot is fully deterministic: float64 math only, no clock, no randomness, no
environment, no network, no file reads — the two grading runs produce
byte-identical action logs.

## Dev result

On the 136-bar dev window: net PnL about −49.45 USDC, 42 trades, max drawdown
about 0.85%, 0 rejected orders, fees about 17.09 USDC — versus the buy-and-hold
baseline's −869.34 USDC, a margin of about +820 USDC.

## Layout

- `main.ts` — the strategy entrypoint (`node main.ts`)
- `vendor/makefun-bars.ts` — byte-identical copy of the kit's bot shim
- `.makefun/owner.json` — claim wallet
