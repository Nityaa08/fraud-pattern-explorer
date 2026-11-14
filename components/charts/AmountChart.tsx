"use client";

import { Transaction } from "@/lib/types";
import { AMOUNT_BUCKETS, bucketKey } from "@/lib/utils";
import BreakdownBars from "./BreakdownBars";

interface Props {
  data: Transaction[];
  /** Key of the bucket that is the current amount filter, if any. */
  selected: string | null;
  onClickBucket: (key: string) => void;
}

export default function AmountChart({ data, selected, onClickBucket }: Props) {
  const rows = AMOUNT_BUCKETS.map((b) => {
    const txns = data.filter((t) => t.amount >= b.min && t.amount < b.max);
    return {
      key: bucketKey(b),
      label: b.label,
      count: txns.length,
      chargebacks: txns.filter((t) => t.status === "chargeback").length,
    };
  });
  return (
    <BreakdownBars title="Amount (USD)" rows={rows} selected={selected ? [selected] : []} onToggle={onClickBucket} />
  );
}
