# Tiny Bot v2 — EMA Crossover Trend Follower

![Bounty](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1.svg)
![Rank](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/Kroco365/tiny-bot-solana-v2/rank.svg)
![Reward](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/Kroco365/tiny-bot-solana-v2/reward.svg)

Entry for the [Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1) bounty on make.fun.

## Strategy

A tiny, deterministic paper-trading bot for the bars-replay harness. Long only,
hourly bars, 7 Solana symbols (FARTCOIN, JITOSOL, POPCAT, RAY, SOL, WETH, WIF).

Per symbol it tracks EMA(8), EMA(13) and EMA(50) over closes in float64. Each
EMA starts as the mean of its first `span` closes, then moves 2 / (span + 1) of
the way to each new close. Bars are read during warm-up too, so the indicators
are already seeded when trading opens.

**Entry** — EMA(8) crosses above EMA(13) on a symbol not held, and only when
both filters pass:

- **Trend filter** — the slow EMA is rising, or the close is above EMA(50).
- **Gap filter** — (close − EMA(13)) / EMA(13) is at least 0.3% at the cross
  bar. A zero-volume bar signals nothing.

**Exit** — the whole position, when EMA(13) crosses back above EMA(8) (the
sell signal is held while EMA(13) stays above EMA(8), so a refused sell is
re-sent on the next bar), or the position is worth at least 50% over its cost
(take-profit), or at least 15% under it (stop-loss).

**Sizing** — equity / 28 per entry, capped at the 25% per-position weight limit
and at the cash this reply has not spent yet; below the minimum notional it
buys nothing. Sells go first in each reply (their proceeds only fund later
replies, never the buys in the same reply). At most `max_orders_per_bar`
orders per reply. Slippage is capped at 100 bps past the close the order was
decided on.

**Deterministic** — float64 math only, no clock, no randomness, no
environment, no network, no file reads.

## Dev grade (136-bar dev window)

| Metric | v2 | v1 | Buy-and-hold |
| --- | --- | --- | --- |
| Net PnL (USDC) | −39.42 | −233.07 | −869.34 |
| Margin over buy-and-hold | +829.92 | +636.27 | — |
| Trades | 32 | 47 | — |
| Max drawdown | 0.75% | 3.69% | — |
| Rejected orders | 0 | 0 | — |

The small equity/28 stake keeps most of the capital in USDC, so the bot loses
little in a broad downtrend while still trading often enough to clear the
8-trade guardrail.
