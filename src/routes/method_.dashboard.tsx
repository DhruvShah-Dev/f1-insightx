import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Gauge,
  Search,
  ShieldCheck,
  Table2,
  Timer,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SectionHeading, SiteShell, Stat } from "@/components/site-shell";
import { fmtDateTime } from "@/lib/format";
import {
  getMethodDashboard,
  getMethodDashboardLiveCounts,
  type MethodDashboardData,
  type MethodDashboardFile,
  type MethodDashboardLiveCount,
} from "@/lib/f1.functions";

const dashboardQuery = queryOptions({
  queryKey: ["method-dashboard"],
  queryFn: () => getMethodDashboard(),
  staleTime: 10 * 60_000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
});

export const Route = createFileRoute("/method_/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  head: () => ({
    meta: [
      { title: "Methods Dashboard - F1 InsightX data trust" },
      {
        name: "description",
        content:
          "Power BI-style data trust dashboard for F1 InsightX source categories, freshness, validation status, quality limits and table inventory.",
      },
      { property: "og:title", content: "F1 InsightX Methods Dashboard" },
      {
        property: "og:description",
        content: "Data source inventory, freshness and validation coverage for F1 InsightX.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <SiteShell fullWidth>
      <p
        role="alert"
        className="border border-destructive bg-card p-4 text-sm font-bold text-destructive"
      >
        Methods dashboard unavailable: {error.message}
      </p>
    </SiteShell>
  ),
  component: MethodDashboard,
});

type DashboardData = NonNullable<Awaited<ReturnType<typeof getMethodDashboard>>>;

const nf = new Intl.NumberFormat("en-US");
const palette = ["#3fa9f5", "#ffd400", "#ff8000", "#7aa95c", "#ff2ea6"];

function compact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

function raceLabel(race: DashboardData["freshness"]["latestCompletedRace"]) {
  return race.round ? `R${race.round} ${race.name ?? race.id ?? "Unknown"}` : "Not available";
}

function statusClass(status: string) {
  return /passed|ready|matched/i.test(status)
    ? "border-primary/35 bg-primary/10 text-primary"
    : /missing|different|error|fail/i.test(status)
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-warning/40 bg-warning/10 text-warning";
}

function MethodDashboard() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const categories = data.categories.map((row) => row.category);
  const liveTables = useMemo(() => {
    const seen = new Set<string>();
    return data.files
      .filter((file) => file.sourceSurface)
      .flatMap((file) => {
        if (seen.has(file.table)) return [];
        seen.add(file.table);
        return [{ table: file.table, expectedRows: file.rows }];
      })
      .slice(0, 50);
  }, [data.files]);
  const liveCounts = useQuery({
    queryKey: ["method-dashboard-live-counts", liveTables],
    queryFn: () => getMethodDashboardLiveCounts({ data: { tables: liveTables } }),
    enabled: mounted && data.sourceMode === "supabase" && liveTables.length > 0,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  const liveByTable = useMemo(
    () => new Map((liveCounts.data ?? []).map((row) => [row.table, row])),
    [liveCounts.data],
  );
  const visibleFiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.files.filter((file) => {
      if (category !== "all" && file.category !== category) return false;
      if (status !== "all") {
        if (status === "validated" && !/passed|ready/i.test(file.validationStatus ?? ""))
          return false;
        if (status === "unchecked" && file.sourceSurface) return false;
      }
      if (!needle) return true;
      return `${file.path} ${file.table} ${file.header.join(" ")}`.toLowerCase().includes(needle);
    });
  }, [category, data.files, query, status]);

  const liveIssues =
    liveCounts.data?.filter((row) => row.status === "different" || row.status === "missing")
      .length ?? 0;
  const liveMatched = liveCounts.data?.filter((row) => row.status === "matched").length ?? 0;
  const issueCount = data.totals.validationIssues + liveIssues;
  const issueNote =
    data.sourceMode !== "supabase"
      ? "manifest checks"
      : liveCounts.isFetching
        ? "checking live tables"
        : liveCounts.data
          ? `${liveMatched} live tables matched`
          : "Supabase mode";

  return (
    <SiteShell fullWidth>
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            to="/method"
            className="inline-flex items-center gap-2 border border-border bg-card/70 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Method
          </Link>
          <span
            className={`border px-3 py-2 text-[10px] font-black uppercase ${statusClass(data.overallStatus)}`}
          >
            {data.overallStatus}
          </span>
          <span className="num text-[11px] text-muted-foreground">
            Snapshot {fmtDateTime(data.generatedAt)} · {data.sourceMode.toUpperCase()} mode
          </span>
        </div>

        <section className="relative overflow-hidden rounded-lg border border-border bg-card/50 p-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(28rem,1fr)]">
            <div>
              <p className="label-xs">Methods / Data trust</p>
              <h1 className="mt-2 max-w-4xl text-4xl font-black uppercase italic tracking-tight text-foreground md:text-6xl">
                Pipeline dashboard
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                A source-backed view of the committed F1 InsightX artifacts: what data exists, how
                fresh it is, which surfaces passed validation, and where proxy limits remain.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FreshnessTile
                label="Latest completed"
                value={raceLabel(data.freshness.latestCompletedRace)}
              />
              <FreshnessTile
                label="Latest analytics"
                value={raceLabel(data.freshness.latestAnalyticsRace)}
              />
              <FreshnessTile
                label="Race analysis"
                value={raceLabel(data.freshness.latestRaceAnalysisRace)}
              />
              <FreshnessTile
                label="Race week product"
                value={raceLabel(data.freshness.raceWeekProductRace)}
              />
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat
            label="Categories"
            value={nf.format(data.totals.categories)}
            icon={<Database className="size-4" />}
          />
          <Stat
            label="Files"
            value={nf.format(data.totals.files)}
            icon={<FileSpreadsheet className="size-4" />}
          />
          <Stat
            label="Rows"
            value={compact(data.totals.rows)}
            note={nf.format(data.totals.rows)}
            icon={<Table2 className="size-4" />}
          />
          <Stat
            label="Columns"
            value={nf.format(data.totals.columns)}
            icon={<BarChart3 className="size-4" />}
          />
          <Stat
            label="Validated"
            value={`${data.totals.validationPassed}/${data.surfaces.length}`}
            icon={<ShieldCheck className="size-4" />}
          />
          <Stat
            label="Issues"
            value={nf.format(issueCount)}
            note={issueNote}
            icon={<AlertTriangle className="size-4" />}
          />
        </section>

        <section className="mt-10 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)]">
          <ChartPanel
            title="Rows by data category"
            subtitle="CSV inventory excludes raw/staged dumps and schema templates."
          >
            <CategoryRowsChart data={data} />
          </ChartPanel>
          <ChartPanel
            title="Rows by published surface"
            subtitle="Product manifest row counts by validated app surface."
          >
            <SurfaceRowsChart data={data} />
          </ChartPanel>
        </section>

        <section className="mt-5">
          <SectionHeading kicker="Ranking" title="Largest datasets" />
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {data.largestFiles.map((file, index) => (
              <div key={file.id} className="border border-border bg-card/45 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="num text-[11px] font-black text-primary">
                    #{String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="num text-xs font-bold">{compact(file.rows)} rows</span>
                </div>
                <p className="mt-2 truncate text-xs font-black uppercase">{file.table}</p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{file.path}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-5 xl:grid-cols-[minmax(26rem,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <SectionHeading kicker="Freshness" title="Coverage matrix" />
            <div className="grid gap-2">
              {data.surfaces.map((surface) => (
                <div
                  key={surface.id}
                  className="grid gap-2 border border-border bg-card/40 p-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_5rem]"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase">{surface.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {surface.buildVersion ?? "No build version"}
                    </p>
                  </div>
                  <Badge>{surface.status}</Badge>
                  <p className="num text-[11px] text-muted-foreground">
                    {surface.staleAfterHours ? `${surface.staleAfterHours}h stale` : "no SLA"}
                  </p>
                  <p className="num text-right text-xs font-bold">{compact(surface.rows)}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionHeading kicker="Quality" title="Limits and confidence" />
            <div className="grid gap-3 lg:grid-cols-2">
              <QualityCard
                title="Analytics confidence"
                value={data.quality.analyticsConfidence.median}
                detail={`range ${data.quality.analyticsConfidence.min ?? "?"} to ${data.quality.analyticsConfidence.max ?? "?"}`}
              />
              <QualityCard
                title="Race analysis confidence"
                value={data.quality.raceAnalysisConfidence.mean}
                detail={`${data.quality.raceAnalysisConfidence.tier ?? "unrated"} tier`}
              />
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <ListPanel
                title="Proxy and missing-feed limits"
                rows={data.quality.dataGaps.slice(0, 8)}
              />
              <ListPanel
                title="Highest null-rate fields"
                rows={data.quality.nullRateHighlights.map((row) => ({
                  key: `${row.table}.${row.column}`,
                  value: `${Math.round(row.rate * 100)}% null`,
                }))}
              />
            </div>
          </div>
        </section>

        <section className="mt-10">
          <SectionHeading kicker="Drill-through" title="Table inventory" />
          <div className="mb-3 grid gap-2 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem]">
            <label className="flex min-h-10 items-center gap-2 border border-border bg-card/60 px-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search files, tables, columns"
                className="w-full bg-transparent text-xs font-bold outline-none placeholder:text-muted-foreground"
              />
            </label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="min-h-10 border border-border bg-card px-3 text-xs font-bold uppercase"
            >
              <option value="all">All categories</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="min-h-10 border border-border bg-card px-3 text-xs font-bold uppercase"
            >
              <option value="all">All statuses</option>
              <option value="validated">Validated surface</option>
              <option value="unchecked">Inventory only</option>
            </select>
          </div>
          <InventoryTable
            files={visibleFiles}
            liveByTable={liveByTable}
            liveLoading={liveCounts.isFetching}
            sourceMode={data.sourceMode}
          />
        </section>
      </div>
    </SiteShell>
  );
}

function FreshnessTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-background/45 p-3">
      <p className="label-xs">{label}</p>
      <p className="mt-2 text-sm font-black uppercase">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center justify-center border px-2 text-[10px] font-black uppercase ${statusClass(children)}`}
    >
      {/passed|ready|matched/i.test(children) ? <CheckCircle2 className="mr-1 size-3" /> : null}
      {children}
    </span>
  );
}

function ChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-card/45 p-4">
      <div className="mb-3">
        <p className="text-xs font-black uppercase">{title}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function CategoryRowsChart({ data }: { data: MethodDashboardData }) {
  const rows = data.categories.slice(0, 10);
  return (
    <div className="h-[370px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 28, left: 18, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
          <XAxis type="number" tickFormatter={compact} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            dataKey="category"
            type="category"
            width={118}
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 11 }}
          />
          <Tooltip formatter={(value) => nf.format(Number(value))} />
          <Bar dataKey="rows" radius={[0, 4, 4, 0]}>
            {rows.map((_, index) => (
              <Cell key={index} fill={palette[index % palette.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SurfaceRowsChart({ data }: { data: MethodDashboardData }) {
  const rows = data.surfaces.slice(0, 8);
  return (
    <div className="h-[370px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 18, left: 6, bottom: 74 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            interval={0}
            angle={-35}
            textAnchor="end"
            height={80}
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 10 }}
          />
          <YAxis tickFormatter={compact} stroke="hsl(var(--muted-foreground))" />
          <Tooltip formatter={(value) => nf.format(Number(value))} />
          <Bar dataKey="rows" fill="#3fa9f5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function QualityCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: number | null;
  detail: string;
}) {
  return (
    <div className="border border-border bg-card/50 p-4">
      <div className="flex items-center gap-2">
        <Gauge className="size-4 text-primary" />
        <p className="text-xs font-black uppercase">{title}</p>
      </div>
      <p className="num mt-3 text-3xl font-black">{value == null ? "N/A" : value.toFixed(3)}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function ListPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; value: string }>;
}) {
  return (
    <div className="border border-border bg-card/40 p-4">
      <p className="mb-2 text-xs font-black uppercase">{title}</p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={`${row.key}-${row.value}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"
          >
            <p className="truncate text-[11px] font-bold text-foreground">{row.key}</p>
            <p className="num text-[11px] text-muted-foreground">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function InventoryTable({
  files,
  liveByTable,
  liveLoading,
  sourceMode,
}: {
  files: MethodDashboardFile[];
  liveByTable: Map<string, MethodDashboardLiveCount>;
  liveLoading: boolean;
  sourceMode: MethodDashboardData["sourceMode"];
}) {
  return (
    <div className="overflow-hidden border border-border bg-card/40">
      <div className="max-h-[620px] overflow-auto">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3">Table</th>
              <th className="px-3 py-3 text-right">Rows</th>
              <th className="px-3 py-3 text-right">Columns</th>
              <th className="px-3 py-3">Surface</th>
              <th className="px-3 py-3">Runtime</th>
              <th className="px-3 py-3">Header preview</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id} className="border-b border-border/70">
                <td className="px-3 py-2 font-bold uppercase">{file.category}</td>
                <td className="px-3 py-2">
                  <p className="font-black">{file.table}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{file.path}</p>
                </td>
                <td className="num px-3 py-2 text-right">{nf.format(file.rows)}</td>
                <td className="num px-3 py-2 text-right">{nf.format(file.columns)}</td>
                <td className="px-3 py-2">
                  {file.sourceSurface ? (
                    <Badge>{file.validationStatus ?? "listed"}</Badge>
                  ) : (
                    "inventory"
                  )}
                </td>
                <td className="px-3 py-2 text-[11px] text-muted-foreground">
                  {file.sourceSurface ? (
                    sourceMode === "supabase" ? (
                      liveByTable.get(file.table) ? (
                        <Badge>{liveByTable.get(file.table)!.status}</Badge>
                      ) : liveLoading ? (
                        "checking"
                      ) : (
                        "not sampled"
                      )
                    ) : (
                      "local snapshot"
                    )
                  ) : (
                    "inventory only"
                  )}
                </td>
                <td className="max-w-[28rem] px-3 py-2 text-[11px] text-muted-foreground">
                  {file.header.slice(0, 8).join(", ")}
                  {file.header.length > 8 ? " ..." : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <Timer className="size-3.5" />
        Showing {nf.format(files.length)} files after filters.
      </div>
    </div>
  );
}
