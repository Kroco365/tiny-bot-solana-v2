// Tiny Bot v2 — long-only EMA crossover paper trader for bars-replay/v1.
//
// Strategy, per symbol, on hourly closes:
//   * Track EMA(8), EMA(13) and EMA(50) in float64, starting from zero and
//     stepped once per bar after that.
//   * Open a long when EMA(8) crosses above EMA(13) on this bar, the trend
//     filter holds (EMA(50) rising, or the close above EMA(50)), and the gap
//     filter holds: (close - EMA(13)) / EMA(13) >= 0.3%.
//   * Close the long when EMA(8) crosses back below EMA(13), or the close
//     reaches +50% above the entry close, or -15% below it.
//   * Each entry stakes equity / 28 in quote currency. One position per
//     symbol; a new entry signal is ignored while already long in that
//     symbol. Sells are sent before buys in every batch; slippage cap
//     100 bps.
//   * Deterministic: no clock, no randomness, no network, no environment
//     reads. Warm-up bars only build indicator history; no orders are sent
//     on them.

import { runBars } from "./vendor/makefun-bars.ts";
import type { BarsState, Batch, OrderInput } from "./vendor/makefun-bars.ts";

// --- tuning ---------------------------------------------------------------
const FAST_LEN = 8;
const MID_LEN = 13;
const SLOW_LEN = 50;
const GAP_MIN = 0.003; // 0.3% above EMA(13)
const TAKE_PROFIT = 1.5; // +50% over the entry close
const STOP_LOSS = 0.85; // -15% under the entry close
const STAKE_PARTS = 28n; // stake = current equity / 28
const MAX_SLIPPAGE_BPS = 100;

// --- per-symbol indicator + position memory -------------------------------
interface SymbolBook {
  fast: number;
  mid: number;
  slow: number;
  prevFast: number;
  prevMid: number;
  prevSlow: number;
  bars: number;
  entryClose: number | null; // close on the bar that opened the current long
  buyPending: boolean; // a buy was sent and its fill is not confirmed yet
}

function newBook(): SymbolBook {
  return {
    fast: 0,
    mid: 0,
    slow: 0,
    prevFast: 0,
    prevMid: 0,
    prevSlow: 0,
    bars: 0,
    entryClose: null,
    buyPending: false,
  };
}

const books = new Map<string, SymbolBook>();

function bookFor(symbol: string): SymbolBook {
  const known = books.get(symbol);
  if (known !== undefined) return known;
  const book = newBook();
  books.set(symbol, book);
  return book;
}

function emaStep(prev: number, price: number, len: number): number {
  const k = 2 / (len + 1);
  return price * k + prev * (1 - k);
}

// Fold one bar's close into the symbol's EMAs, keeping the previous values
// around so this bar's crosses can be read off them. The EMAs start at
// zero, so the first bars only build them up; a cross needs the fast EMA
// to move from strictly below the mid EMA to strictly above it.
function noteClose(book: SymbolBook, price: number): void {
  book.prevFast = book.fast;
  book.prevMid = book.mid;
  book.prevSlow = book.slow;
  book.fast = emaStep(book.fast, price, FAST_LEN);
  book.mid = emaStep(book.mid, price, MID_LEN);
  book.slow = emaStep(book.slow, price, SLOW_LEN);
  book.bars += 1;
}

// --- decision -------------------------------------------------------------
function decide(state: BarsState, batch: Batch): OrderInput[] {
  const sells: OrderInput[] = [];
  const buys: OrderInput[] = [];

  for (const bar of batch.bars) {
    const meta = state.symbols.get(bar.symbol);
    if (meta === undefined) continue;
    const price = Number(bar.c) / 10 ** meta.price_scale;
    if (!Number.isFinite(price) || price <= 0) continue;

    const book = bookFor(bar.symbol);
    noteClose(book, price);
    if (state.warmingUp) continue;

    const held = state.positions.get(bar.symbol);
    const holding = held !== undefined && held.qty > 0n;
    // The harness account is the source of truth: a position still held
    // after a sell was sent means that sell was rejected, so the exit
    // rules below are simply re-evaluated on the next bar. The entry
    // close is therefore kept until the position is actually gone, and a
    // buy whose fill never shows up is dropped the same way.
    if (holding) {
      book.buyPending = false;
      const crossedDown = book.prevFast > book.prevMid && book.fast < book.mid;
      const entry = book.entryClose;
      const tookProfit = entry !== null && price >= entry * TAKE_PROFIT;
      const stoppedOut = entry !== null && price <= entry * STOP_LOSS;
      if (crossedDown || tookProfit || stoppedOut) {
        sells.push({
          side: "sell",
          symbol: bar.symbol,
          qty: held.qty,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        });
      }
      continue;
    }
    // Not holding: a pending buy that never filled was rejected, and any
    // entry close left over from a sold position no longer applies.
    book.buyPending = false;
    book.entryClose = null;

    const crossedUp = book.prevFast < book.prevMid && book.fast > book.mid;
    if (!crossedUp) continue;
    const trendOk = book.slow > book.prevSlow || price > book.slow;
    if (!trendOk) continue;
    const gapOk = (price - book.mid) / book.mid >= GAP_MIN;
    if (!gapOk) continue;

    const stake = state.equity / STAKE_PARTS;
    const notional = stake <= state.cash ? stake : state.cash;
    const minNotional = BigInt(state.hello.fees.min_notional_quote_units);
    if (notional <= 0n || notional < minNotional) continue;
    buys.push({
      side: "buy",
      symbol: bar.symbol,
      notional_quote_units: notional,
      max_slippage_bps: MAX_SLIPPAGE_BPS,
    });
    book.entryClose = price;
    book.buyPending = true;
  }

  return [...sells, ...buys];
}

await runBars({ onBatch: decide });
