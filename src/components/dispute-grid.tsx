"use client";
// The dispute queue, built on AG Grid. Sorted by reply deadline so the most
// urgent case is always at the top.

import { AllCommunityModule, type ColDef, ModuleRegistry, themeQuartz } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useRouter } from "next/navigation";

ModuleRegistry.registerModules([AllCommunityModule]);

export type DisputeRow = {
  id: string;
  item: string;
  amount: string; // "38.00"
  currency: string;
  reason: string;
  status: string;
  daysLeft: number | null;
  dueDate: string | null;
  suggestion: string | null;
  confidence: number | null;
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

const columns: ColDef<DisputeRow>[] = [
  { field: "item", headerName: "Item", flex: 1.5, minWidth: 170 },
  {
    field: "amount",
    headerName: "Amount",
    width: 120,
    type: "rightAligned",
    comparator: (a, b) => Number(a) - Number(b),
    valueFormatter: (p) => `${p.value} ${p.data?.currency ?? ""}`,
  },
  { field: "reason", headerName: "Reason", flex: 1, minWidth: 140 },
  { field: "status", headerName: "Status", flex: 1, minWidth: 175 },
  {
    field: "daysLeft",
    headerName: "Reply by",
    width: 170,
    sort: "asc",
    valueFormatter: (p) =>
      p.value === null ? "No deadline" : `${p.data?.dueDate}, ${p.value} day${p.value === 1 ? "" : "s"}`,
    cellClass: (p) => (p.value !== null && p.value <= 5 ? "font-semibold text-due" : ""),
  },
  {
    field: "suggestion",
    headerName: "Suggested step",
    flex: 1,
    minWidth: 220,
    valueFormatter: (p) =>
      p.value ? `${p.value} (${Math.round((p.data?.confidence ?? 0) * 100)}%)` : "Not analysed yet",
  },
];

export function DisputeGrid({ rows }: { rows: DisputeRow[] }) {
  const router = useRouter();

  return (
    <div className="w-full">
      <AgGridReact<DisputeRow>
        theme={theme}
        domLayout="autoHeight"
        rowData={rows}
        columnDefs={columns}
        defaultColDef={{ sortable: true, resizable: true }}
        getRowId={(p) => p.data.id}
        onRowClicked={(e) => e.data && router.push(`/disputes/${e.data.id}`)}
        rowStyle={{ cursor: "pointer" }}
        overlayNoRowsTemplate="No disputes yet. Press Sync with PayPal to load them."
      />
    </div>
  );
}
