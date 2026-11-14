"use client";

import { Transaction } from "@/lib/types";
import { groupBy } from "@/lib/utils";
import BreakdownBars from "./BreakdownBars";

interface Props {
  data: Transaction[];
  selected: string[];
  onClickMethod: (method: string) => void;
}

export default function PaymentMethodChart({ data, selected, onClickMethod }: Props) {
  const rows = Object.entries(groupBy(data, (t) => t.paymentMethod))
    .map(([name, txns]) => ({
      key: name,
      label: name,
      count: txns.length,
      chargebacks: txns.filter((t) => t.status === "chargeback").length,
    }))
    .sort((a, b) => b.count - a.count);
  return <BreakdownBars title="Payment method" rows={rows} selected={selected} onToggle={onClickMethod} />;
}
