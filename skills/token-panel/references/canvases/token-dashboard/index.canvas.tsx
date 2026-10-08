import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type LocalizedTextBundle,
  BarChart,
  Banner,
  Button,
  Callout,
  ChartComparisonGrid,
  ChartContainer,
  H1,
  MetricsGrid,
  PieChart,
  ReportSection,
  ReportShell,
  Row,
  Stack,
  Table,
  Text,
  useCanvasAction,
  useCanvasState,
  useLocalizedText,
} from "qoder/canvas";

// ---- Data contract (written by scripts/index.mjs) ----

interface PanelKpi {
  creditsToday: number;
  creditsTotal: number;
  requests: number;
  sessions: number;
  projects: number;
  tokensInEst: number;
  tokensOutEst: number;
  hasRecordedTokens: boolean;
  tokensInRecorded: number;
  tokensOutRecorded: number;
  lastTs: string | null;
}

interface DayRow {
  date: string;
  credits: number;
  requests: number;
  sessions: number;
}

interface GroupRow {
  project?: string;
  model?: string;
  credits: number;
  requests: number;
  sessions: number;
  tokensInEst: number;
  tokensOutEst: number;
}

interface SessionRow {
  sessionId: string;
  project: string;
  credits: number;
  requests: number;
  tokensInEst: number;
  tokensOutEst: number;
  models: string[];
  firstTs: string | null;
  lastTs: string | null;
  promptPreview: string | null;
}

interface RequestRow {
  ts: string | null;
  model: string;
  credits: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  tokensInEst: number;
  tokensOutEst: number;
  ctxRatio: number | null;
  stopReason: string | null;
}

interface PanelData {
  schemaVersion: number;
  generatedAt?: string;
  range?: string;
  error?: string;
  kpi?: PanelKpi;
  days?: DayRow[];
  projects?: GroupRow[];
  models?: GroupRow[];
  sessions?: SessionRow[];
  details?: Record<string, RequestRow[]>;
}

const PANEL_KEY = "tokenmeter.panel.v1";

const EMPTY_KPI: PanelKpi = {
  creditsToday: 0,
  creditsTotal: 0,
  requests: 0,
  sessions: 0,
  projects: 0,
  tokensInEst: 0,
  tokensOutEst: 0,
  hasRecordedTokens: false,
  tokensInRecorded: 0,
  tokensOutRecorded: 0,
  lastTs: null,
};

const EMPTY_PANEL: PanelData = { schemaVersion: 1 };

// ---- Formatting ----

function fmtCredits(value: number | null | undefined): string {
  const num = Number(value) || 0;
  return num >= 1 ? num.toFixed(3) : num.toFixed(4);
}

function fmtTokens(value: number | null | undefined): string {
  const num = Number(value) || 0;
  if (num >= 1e8) return `${(num / 1e8).toFixed(2)}亿`;
  if (num >= 1e4) {
    const wan = num / 1e4;
    return `${wan >= 100 ? wan.toFixed(0) : wan.toFixed(1)}万`;
  }
  return String(Math.round(num));
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function shortProject(slug: string): string {
  if (!slug) return "-";
  const parts = slug.split("-");
  return parts[parts.length - 1] || slug;
}

// ---- Localized copy ----

interface PanelText {
  title: string;
  subtitle: (range: string, generatedAt: string) => string;
  refresh: string;
  refreshing: string;
  refreshHint: string;
  creditsToday: string;
  creditsRange: string;
  sessions: string;
  tokenEstimate: string;
  tokenRecorded: string;
  requestsSuffix: (n: number) => string;
  projectsSuffix: (n: number) => string;
  estimateNote: string;
  trendTitle: string;
  trendDescription: string;
  trendEmpty: string;
  creditsSeries: string;
  byProject: string;
  byModel: string;
  distributionEmpty: string;
  sessionsTitle: string;
  sessionsEmpty: string;
  colTime: string;
  colProject: string;
  colModel: string;
  colRequests: string;
  colCredits: string;
  colTokens: string;
  colPrompt: string;
  colDetail: string;
  detailButton: string;
  detailCollapse: string;
  detailTitle: (sessionId: string) => string;
  detailEmpty: string;
  detailColIn: string;
  detailColOut: string;
  detailColCtx: string;
  detailColStop: string;
  methodTitle: string;
  methodBody: string;
  errorTitle: string;
  noData: string;
  noDataHint: string;
}

const TEXT: LocalizedTextBundle<PanelText> = {
  default: {
    title: "Token Usage Panel",
    subtitle: (range: string, generatedAt: string) =>
      `Range ${range} · generated ${generatedAt} · data stays on this machine`,
    refresh: "Refresh",
    refreshing: "Refreshing...",
    refreshHint: "Refresh re-scans local session transcripts (incremental)",
    creditsToday: "Credits today",
    creditsRange: "Credits (30d)",
    sessions: "Sessions",
    tokenEstimate: "Tokens (≈ est.)",
    tokenRecorded: "Tokens (recorded)",
    requestsSuffix: (n: number) => `${n} requests`,
    projectsSuffix: (n: number) => `${n} projects`,
    estimateNote: "estimated locally, not the billing measure",
    trendTitle: "Daily trend (30d)",
    trendDescription: "Credits per day from recorded usage",
    trendEmpty: "No usage in the last 30 days yet.",
    creditsSeries: "Credits",
    byProject: "By project",
    byModel: "By model",
    distributionEmpty: "No distribution data yet.",
    sessionsTitle: "Sessions",
    sessionsEmpty: "No sessions recorded yet.",
    colTime: "Last activity",
    colProject: "Project",
    colModel: "Model",
    colRequests: "Reqs",
    colCredits: "Credits",
    colTokens: "Tokens ≈",
    colPrompt: "Prompt",
    colDetail: "",
    detailButton: "Detail",
    detailCollapse: "Collapse",
    detailTitle: (sessionId: string) => `Session detail · ${sessionId}`,
    detailEmpty: "No per-request detail captured for this session.",
    detailColIn: "In ≈",
    detailColOut: "Out ≈",
    detailColCtx: "Ctx used",
    detailColStop: "Stop",
    methodTitle: "Measurement notes",
    methodBody:
      "Credits are recorded values from local session transcripts (~/.qoder-cn/projects). Tokens are estimated locally (ASCII ÷4, CJK ÷1.6) and auto-calibrated per model when recorded token values exist; estimates never touch the network.",
    errorTitle: "Panel data error",
    noData: "No panel data yet.",
    noDataHint:
      "Run /token-panel in the chat (or ask the agent to refresh the token panel) and reopen this canvas.",
  },
  "zh-cn": {
    title: "Token 消耗面板",
    subtitle: (range: string, generatedAt: string) =>
      `范围 ${range} · 生成于 ${generatedAt} · 数据仅在本机处理`,
    refresh: "刷新",
    refreshing: "刷新中...",
    refreshHint: "刷新将重新扫描本机会话记录（增量）",
    creditsToday: "今日积分",
    creditsRange: "积分（30 天）",
    sessions: "会话",
    tokenEstimate: "Token（≈ 估算）",
    tokenRecorded: "Token（记录值）",
    requestsSuffix: (n: number) => `${n} 次请求`,
    projectsSuffix: (n: number) => `${n} 个项目`,
    estimateNote: "本地估算，非计费口径",
    trendTitle: "近 30 天趋势",
    trendDescription: "按天统计的积分消耗（记录值）",
    trendEmpty: "最近 30 天暂无消耗记录。",
    creditsSeries: "积分",
    byProject: "按项目分布",
    byModel: "按模型分布",
    distributionEmpty: "暂无分布数据。",
    sessionsTitle: "会话列表",
    sessionsEmpty: "暂无会话记录。",
    colTime: "最近活动",
    colProject: "项目",
    colModel: "模型",
    colRequests: "请求",
    colCredits: "积分",
    colTokens: "Token≈",
    colPrompt: "提问",
    colDetail: "",
    detailButton: "详情",
    detailCollapse: "收起",
    detailTitle: (sessionId: string) => `会话详情 · ${sessionId}`,
    detailEmpty: "该会话暂无可用的逐请求明细。",
    detailColIn: "输入≈",
    detailColOut: "输出≈",
    detailColCtx: "上下文",
    detailColStop: "结束",
    methodTitle: "统计口径说明",
    methodBody:
      "积分来自本机会话记录（~/.qoder-cn/projects），为记录值；token 为本地估算（ASCII÷4、中文÷1.6），当记录值可用时按模型自动校准。全程不联网。",
    errorTitle: "面板数据出错",
    noData: "暂无面板数据。",
    noDataHint: "在对话框运行 /token-panel（或让 Agent 刷新 token 面板）后重新打开本面板。",
  },
};

export default function TokenUsagePanel() {
  const text = useLocalizedText(TEXT);
  const dispatch = useCanvasAction();
  const [panel] = useCanvasState<PanelData>(PANEL_KEY, EMPTY_PANEL);
  const [selected, setSelected] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const autoRanRef = useRef(false);

  const runScript = useCallback(() => {
    dispatch({ type: "qoder.canvas.runScript", script: "scripts/index.mjs" });
  }, [dispatch]);

  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;
    const generatedAt = panel.generatedAt ? Date.parse(panel.generatedAt) : 0;
    const stale = !panel.kpi || !Number.isFinite(generatedAt) || Date.now() - generatedAt > 3 * 60 * 1000;
    if (stale) runScript();
  }, [panel, runScript]);

  const kpi = panel.kpi ?? EMPTY_KPI;
  const days = panel.days ?? [];
  const projects = panel.projects ?? [];
  const models = panel.models ?? [];
  const sessions = panel.sessions ?? [];
  const details = panel.details ?? {};

  const hasData = Boolean(panel.kpi);

  const metricItems = useMemo(
    () => [
      {
        label: text.creditsToday,
        value: fmtCredits(kpi.creditsToday),
        description: text.requestsSuffix(kpi.requests),
      },
      {
        label: text.creditsRange,
        value: fmtCredits(kpi.creditsTotal),
        description: text.requestsSuffix(kpi.requests),
      },
      {
        label: text.sessions,
        value: String(kpi.sessions),
        description: text.projectsSuffix(kpi.projects),
      },
      kpi.hasRecordedTokens
        ? {
            label: text.tokenRecorded,
            value: fmtTokens((kpi.tokensInRecorded ?? 0) + (kpi.tokensOutRecorded ?? 0)),
            description: text.estimateNote,
          }
        : {
            label: text.tokenEstimate,
            value: `≈${fmtTokens(kpi.tokensInEst + kpi.tokensOutEst)}`,
            description: text.estimateNote,
          },
    ],
    [kpi, text],
  );

  const trendCategories = useMemo(() => days.map((d) => d.date.slice(5)), [days]);
  const trendSeries = useMemo(
    () => [{ key: "credits", name: text.creditsSeries, data: days.map((d) => d.credits) }],
    [days, text],
  );

  const projectSlices = useMemo(
    () =>
      projects
        .filter((p) => p.credits > 0)
        .map((p) => ({ label: shortProject(p.project ?? "unknown"), value: p.credits })),
    [projects],
  );

  const modelCategories = useMemo(() => models.map((m) => m.model ?? "unknown"), [models]);
  const modelSeries = useMemo(
    () => [{ key: "credits", name: text.creditsSeries, data: models.map((m) => m.credits) }],
    [models, text],
  );

  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    runScript();
    window.setTimeout(() => setRefreshing(false), 1500);
  }, [refreshing, runScript]);

  const sessionColumns = useMemo(
    () => [
      { key: "lastTs", title: text.colTime, width: "120px", render: (row: SessionRow) => fmtDateTime(row.lastTs) },
      { key: "project", title: text.colProject, width: "110px", truncate: true, render: (row: SessionRow) => shortProject(row.project) },
      { key: "models", title: text.colModel, width: "90px", truncate: true, render: (row: SessionRow) => row.models.join(", ") },
      { key: "requests", title: text.colRequests, width: "70px", align: "right" as const, render: (row: SessionRow) => String(row.requests) },
      { key: "credits", title: text.colCredits, width: "90px", align: "right" as const, render: (row: SessionRow) => fmtCredits(row.credits) },
      {
        key: "tokens",
        title: text.colTokens,
        width: "90px",
        align: "right" as const,
        render: (row: SessionRow) => `≈${fmtTokens(row.tokensInEst + row.tokensOutEst)}`,
      },
      { key: "prompt", title: text.colPrompt, truncate: true, render: (row: SessionRow) => row.promptPreview ?? "-" },
      {
        key: "detail",
        title: text.colDetail,
        width: "84px",
        align: "right" as const,
        render: (row: SessionRow) => (
          <Button
            size="sm"
            variant="secondary"
            textButton
            onClick={() => setSelected((current) => (current === row.sessionId ? null : row.sessionId))}
          >
            {text.detailButton}
          </Button>
        ),
      },
    ],
    [text],
  );

  const detailColumns = useMemo(
    () => [
      { key: "ts", title: text.colTime, width: "120px", render: (row: RequestRow) => fmtDateTime(row.ts) },
      { key: "model", title: text.colModel, width: "90px", render: (row: RequestRow) => row.model },
      { key: "credits", title: text.colCredits, width: "90px", align: "right" as const, render: (row: RequestRow) => (row.credits === null ? "-" : fmtCredits(row.credits)) },
      {
        key: "tokensIn",
        title: text.detailColIn,
        width: "90px",
        align: "right" as const,
        render: (row: RequestRow) => (row.tokensIn !== null ? fmtTokens(row.tokensIn) : `≈${fmtTokens(row.tokensInEst)}`),
      },
      {
        key: "tokensOut",
        title: text.detailColOut,
        width: "90px",
        align: "right" as const,
        render: (row: RequestRow) => (row.tokensOut !== null ? fmtTokens(row.tokensOut) : `≈${fmtTokens(row.tokensOutEst)}`),
      },
      {
        key: "ctx",
        title: text.detailColCtx,
        width: "90px",
        align: "right" as const,
        render: (row: RequestRow) => (row.ctxRatio === null ? "-" : `${(row.ctxRatio * 100).toFixed(1)}%`),
      },
      { key: "stop", title: text.detailColStop, render: (row: RequestRow) => row.stopReason ?? "-" },
    ],
    [text],
  );

  const detailRows = selected ? details[selected] ?? [] : [];

  return (
    <ReportShell width="wide" ariaLabel={text.title}>
      <Stack gap="section">
        <Stack gap="component">
          <Row justify="space-between" align="start" wrap>
            <Stack gap="inline">
              <H1>{text.title}</H1>
              <Text tone="secondary" size="small">
                {text.subtitle(panel.range ?? "30d", fmtDateTime(panel.generatedAt))}
              </Text>
            </Stack>
            <Stack gap="inline" align="end">
              <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? text.refreshing : text.refresh}
              </Button>
              <Text tone="tertiary" size="small">
                {text.refreshHint}
              </Text>
            </Stack>
          </Row>

          {panel.error ? (
            <Banner tone="warning" title={text.errorTitle}>
              {panel.error}
            </Banner>
          ) : null}

          {hasData ? (
            <MetricsGrid variant="header" columns={4} items={metricItems} />
          ) : (
            <Callout title={text.noData}>{text.noDataHint}</Callout>
          )}
        </Stack>

        {hasData ? (
          <ReportSection title={text.trendTitle} description={text.trendDescription} divided>
            {days.length > 0 ? (
              <ChartContainer ariaLabel={text.trendTitle} caption={text.trendDescription}>
                <BarChart
                  categories={trendCategories}
                  series={trendSeries}
                  height={220}
                  valueFormatter={(value: number) => fmtCredits(value)}
                  legendPosition="none"
                  ariaLabel={text.trendTitle}
                />
              </ChartContainer>
            ) : (
              <Text tone="secondary">{text.trendEmpty}</Text>
            )}
          </ReportSection>
        ) : null}

        {hasData ? (
          <ReportSection title={text.byProject} divided>
            <ChartComparisonGrid>
              <ChartContainer title={text.byProject} ariaLabel={text.byProject}>
                {projectSlices.length > 0 ? (
                  <PieChart
                    donut
                    data={projectSlices}
                    centerLabel={text.creditsSeries}
                    valueFormatter={(value: number) => fmtCredits(value)}
                    ariaLabel={text.byProject}
                  />
                ) : (
                  <Text tone="secondary">{text.distributionEmpty}</Text>
                )}
              </ChartContainer>
              <ChartContainer title={text.byModel} ariaLabel={text.byModel}>
                {modelCategories.length > 0 ? (
                  <BarChart
                    horizontal
                    categories={modelCategories}
                    series={modelSeries}
                    height={180}
                    valueFormatter={(value: number) => fmtCredits(value)}
                    legendPosition="none"
                    ariaLabel={text.byModel}
                  />
                ) : (
                  <Text tone="secondary">{text.distributionEmpty}</Text>
                )}
              </ChartContainer>
            </ChartComparisonGrid>
          </ReportSection>
        ) : null}

        {hasData ? (
          <ReportSection title={text.sessionsTitle} divided>
            <Table
              columns={sessionColumns}
              rows={sessions}
              rowKey="sessionId"
              density="compact"
              maxHeight={420}
              stickyHeader
              emptyText={text.sessionsEmpty}
            />
          </ReportSection>
        ) : null}

        {hasData && selected ? (
          <ReportSection
            title={text.detailTitle(selected)}
            divided
          >
            <Stack gap="component">
              <Row justify="end">
                <Button size="sm" variant="secondary" textButton onClick={() => setSelected(null)}>
                  {text.detailCollapse}
                </Button>
              </Row>
              {detailRows.length > 0 ? (
                <Table
                  columns={detailColumns}
                  rows={detailRows}
                  density="compact"
                  maxHeight={420}
                  stickyHeader
                  rowKey={(row: RequestRow) => `${row.ts ?? ""}:${row.model}`}
                  emptyText={text.detailEmpty}
                />
              ) : (
                <Text tone="secondary">{text.detailEmpty}</Text>
              )}
            </Stack>
          </ReportSection>
        ) : null}

        <Callout title={text.methodTitle}>{text.methodBody}</Callout>
      </Stack>
    </ReportShell>
  );
}
