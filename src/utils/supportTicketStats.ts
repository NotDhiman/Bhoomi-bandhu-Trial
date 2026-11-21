export type TicketStatusKey = "open" | "in_review" | "resolved";

export interface SupportTicketSummaryItem {
  key: TicketStatusKey;
  label: "Open" | "In Progress" | "Resolved";
  count: number;
  percentage: number;
  color: string;
  bgTintClass: string;
  textClass: string;
}

export interface SupportTicketSummary {
  total: number;
  openCount: number;
  inProgressCount: number;
  resolvedCount: number;
  urgentActiveCount: number;
  resolutionRatePct: number;
  segments: SupportTicketSummaryItem[];
}

export function summarizeSupportTickets(
  tickets: Array<{ status: TicketStatusKey; priority?: "normal" | "urgent" }>
): SupportTicketSummary {
  let openCount = 0;
  let inProgressCount = 0;
  let resolvedCount = 0;
  let urgentActiveCount = 0;

  for (const t of tickets) {
    if (t.status === "open") {
      openCount += 1;
      if (t.priority === "urgent") urgentActiveCount += 1;
    } else if (t.status === "in_review") {
      inProgressCount += 1;
      if (t.priority === "urgent") urgentActiveCount += 1;
    } else if (t.status === "resolved") {
      resolvedCount += 1;
    }
  }

  const total = openCount + inProgressCount + resolvedCount;
  const pct = (count: number) =>
    total > 0 ? Math.round((count / total) * 100) : 0;

  const segments: SupportTicketSummaryItem[] = [
    {
      key: "open",
      label: "Open",
      count: openCount,
      percentage: pct(openCount),
      color: "#E9A23B",
      bgTintClass: "bg-amber-50",
      textClass: "text-amber-800",
    },
    {
      key: "in_review",
      label: "In Progress",
      count: inProgressCount,
      percentage: pct(inProgressCount),
      color: "#3A7CA5",
      bgTintClass: "bg-sky-50",
      textClass: "text-sky-800",
    },
    {
      key: "resolved",
      label: "Resolved",
      count: resolvedCount,
      percentage: pct(resolvedCount),
      color: "#2D6A4F",
      bgTintClass: "bg-[#EAF4EE]",
      textClass: "text-[#2D6A4F]",
    },
  ];

  return {
    total,
    openCount,
    inProgressCount,
    resolvedCount,
    urgentActiveCount,
    resolutionRatePct: pct(resolvedCount),
    segments,
  };
}
