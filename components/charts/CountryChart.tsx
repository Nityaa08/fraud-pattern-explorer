"use client";

import { Transaction } from "@/lib/types";
import { groupBy } from "@/lib/utils";
import BreakdownBars from "./BreakdownBars";

interface Props {
  data: Transaction[];
  selected: string[];
  onClickCountry: (country: string) => void;
}

export default function CountryChart({ data, selected, onClickCountry }: Props) {
  const rows = Object.entries(groupBy(data, (t) => t.country))
    .map(([name, txns]) => ({
      key: name,
      label: name,
      count: txns.length,
      chargebacks: txns.filter((t) => t.status === "chargeback").length,
    }))
    .sort((a, b) => b.count - a.count);
  return <BreakdownBars title="Country" rows={rows} selected={selected} onToggle={onClickCountry} />;
}
