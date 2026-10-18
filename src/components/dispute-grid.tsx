"use client";
// The dispute queue, built on AG Grid. Sorted by reply deadline so the most
// urgent case is always at the top. Custom cell renderers turn PayPal's data
// into something a merchant can scan: status pills, days left, and whether
// the suggested step has already been sent.

import {
  AllCommunityModule,
  type ColDef,
  type ICellRendererParams,
  ModuleRegistry,
  themeQuartz,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

ModuleRegistry.registerModules([AllCommunityModule]);

export type DisputeRow = {
  id: string;
  item: string;
  amount: string; // "38.00"
  currency: string;
  reason: string;
  status: string;
  statusTone: "due" | "wait" | "done";
  daysLeft: number | null;
  dueDate: string | null;
  suggestion: string | null;
  confidence: number | null;
  sent: string | null; // e.g. "Offer sent", once the suggested step has gone to PayPal
};

const theme = themeQuartz.withParams({
  fontFamily: "inherit",
  accentColor: "#0d6b67",
  foregroundColor: "#18202e",
  borderColor: "#d6dce5",
  headerBackgroundColor: "#f2f4f7",
  headerFontWeight: 600,
  rowHoverColor: "#e3f1f0",
  wrapperBorderRadius: 8,
  fontSize: 14,
});

const TONE_CLASS: Record<DisputeRow["statusTone"], string> = {
  due: "bg-due-wash text-due",
  wait: "bg-paper text-muted",
  done: "bg-decide-wash text-decide-dark",
};

function ItemCell({ data }: ICellRendererParams<DisputeRow>) {
  if (!data) return null;
  return (
    <div className="flex h-full flex-col justify-center leading-tight">
      <span className="font-medium">{data.item}</span>
      <span className="text-xs text-muted">{data.id}</span>
    </div>
  );
}

function StatusCell({ data }: ICellRendererParams<DisputeRow>) {
  if (!data) return null;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[data.statusTone]}`}>
      {data.status}
    </span>
  );
}

function DeadlineCell({ data }: ICellRendererParams<DisputeRow>) {
  if (!data) return null;
  if (data.daysLeft === null) return <span className="text-muted">No deadline</span>;

  const urgent = data.daysLeft <= 5;
  const left =
    data.daysLeft < 0
      ? `${-data.daysLeft} day${data.daysLeft === -1 ? "" : "s"} overdue`
      : data.daysLeft === 0
        ? "Due today"
        : `${data.daysLeft} day${data.daysLeft === 1 ? "" : "s"} left`;
  return (
    <div className="flex h-full flex-col justify-center leading-tight">
      <span className={urgent ? "font-semibold text-due" : ""}>{data.dueDate}</span>
      <span className={`text-xs ${data.daysLeft < 0 ? "font-semibold text-risk" : urgent ? "text-due" : "text-muted"}`}>
        {left}
      </span>
    </div>
  );
}

function StepCell({ data }: ICellRendererParams<DisputeRow>) {
  if (!data) return null;
  if (data.sent) return <span className="font-semibold text-decide-dark">{data.sent}</span>;
  if (!data.suggestion) return <span className="text-muted">Not analysed yet</span>;
  return (
    <span>
      {data.suggestion}{" "}
      <span className="text-muted">{Math.round((data.confidence ?? 0) * 100)}%</span>
    </span>
  );
}

const columns: ColDef<DisputeRow>[] = [
  { field: "item", headerName: "Item", flex: 1.6, minWidth: 220, cellRenderer: ItemCell },
  {
    field: "amount",
    headerName: "Amount",
    width: 120,
    type: "rightAligned",
    // A column's own cellStyle replaces the default one, so repeat the centring here.
    cellStyle: { display: "flex", alignItems: "center", justifyContent: "flex-end" },
    comparator: (a, b) => Number(a) - Number(b),
    valueFormatter: (p) => `${p.value} ${p.data?.currency ?? ""}`,
  },
  { field: "reason", headerName: "Reason", flex: 1, minWidth: 140 },
  { field: "status", headerName: "Status", flex: 1, minWidth: 170, cellRenderer: StatusCell },
  {
    field: "daysLeft",
    headerName: "Reply by",
    width: 150,
    sort: "asc",
    // Disputes with no deadline (PayPal is reviewing, or waiting on the buyer) go last.
    comparator: (a: number | null, b: number | null) => (a ?? Infinity) - (b ?? Infinity),
    getQuickFilterText: (p) => p.data?.dueDate ?? "",
    cellRenderer: DeadlineCell,
  },
  {
    field: "suggestion",
    headerName: "Suggested step",
    flex: 1.2,
    minWidth: 210,
    getQuickFilterText: (p) => p.data?.sent ?? p.data?.suggestion ?? "",
    cellRenderer: StepCell,
  },
];

export function DisputeGrid({ rows }: { rows: DisputeRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const open = (id: string) => router.push(`/disputes/${encodeURIComponent(id)}`);

  return (
    <div className="w-full">
      <label className="mb-3 block max-w-xs">
        <span className="sr-only">Search disputes</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search item, reason or ID"
          className="w-full rounded-md border border-line bg-sheet px-3 py-2 text-sm"
        />
      </label>
      <AgGridReact<DisputeRow>
        theme={theme}
        domLayout="autoHeight"
        rowHeight={60}
        rowData={rows}
        columnDefs={columns}
        // Every cell is a flex box so one-line and two-line cells line up in the middle.
        defaultColDef={{ sortable: true, resizable: true, cellStyle: { display: "flex", alignItems: "center" } }}
        quickFilterText={search}
        getRowId={(p) => p.data.id}
        onRowClicked={(e) => e.data && open(e.data.id)}
        // Keyboard users can open a dispute with Enter, like clicking the row.
        onCellKeyDown={(e) => {
          if ((e.event as KeyboardEvent | null)?.key === "Enter" && e.data) open(e.data.id);
        }}
        rowStyle={{ cursor: "pointer" }}
        overlayNoRowsTemplate="No disputes yet. Unlock sending, then press Sync with PayPal to load them."
      />
    </div>
  );
}
