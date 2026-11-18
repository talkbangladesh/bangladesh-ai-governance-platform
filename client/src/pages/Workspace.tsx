import { useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, BarChart3, ChevronRight, FileCheck2, FileSpreadsheet, FileText, ShieldAlert, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import AssessmentOrganizationPanel from "@/components/AssessmentOrganizationPanel";

function downloadBlob(fileName: string, contentType: string, contents: BlobPart) {
  const url = URL.createObjectURL(new Blob([contents], { type: contentType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Workspace() {
  const queryId = Number(new URLSearchParams(window.location.search).get("assessmentId") ?? 0);
  const [selectedId, setSelectedId] = useState(Number.isSafeInteger(queryId) && queryId > 0 ? queryId : 0);
  const assessmentId = selectedId;
  const assessments = trpc.agaras.myAssessments.useQuery();
  const dashboardQuery = trpc.agaras.dashboard.useQuery({ assessmentId }, { enabled: assessmentId > 0 });
  const reportQuery = trpc.agaras.reportSnapshot.useQuery({ assessmentId }, { enabled: assessmentId > 0 });
  const pdfQuery = trpc.agaras.reportPdf.useQuery({ assessmentId }, { enabled: false });
  const excelQuery = trpc.agaras.reportExcel.useQuery({ assessmentId }, { enabled: false });
  const submitAssessment = trpc.agaras.submitAssessment.useMutation({
    onSuccess: async () => {
      setExportMessage("Assessment submitted. Responses are locked while review is pending.");
      await Promise.all([dashboardQuery.refetch(), assessments.refetch()]);
    },
    onError: error => setExportMessage(`Assessment submission failed: ${error.message}`),
  });
  const [exportMessage, setExportMessage] = useState("");
  const dashboard = dashboardQuery.data;
  const readyDashboard = dashboard?.assessment ? dashboard : undefined;
  const assessment = readyDashboard?.assessment;
  const controls = readyDashboard?.controls ?? [];
  const findings = readyDashboard?.findings ?? [];
  const systems = readyDashboard?.aiSystems ?? [];

  const groupedControls = useMemo(() => controls.reduce<Record<string, { title: string; rows: typeof controls }>>((groups, row) => {
    const code = row.domain.code;
    groups[code] ??= { title: row.domain.title, rows: [] };
    groups[code].rows.push(row);
    return groups;
  }, {}), [controls]);

  const selectAssessment = (id: number) => {
    setSelectedId(id);
    const nextUrl = new URL(window.location.href);
    if (id > 0) nextUrl.searchParams.set("assessmentId", String(id));
    else nextUrl.searchParams.delete("assessmentId");
    window.history.replaceState(null, "", nextUrl.toString());
  };

  const exportJson = async () => {
    setExportMessage("Preparing JSON report…");
    try {
      const result = await reportQuery.refetch();
      if (result.error || !result.data) {
        setExportMessage(`JSON export failed: ${result.error?.message ?? "No report data was returned."}`);
        return;
      }
      downloadBlob(`agaras-report-${assessmentId}.json`, "application/json", JSON.stringify(result.data, null, 2));
      setExportMessage("JSON download started.");
    } catch (error) {
      setExportMessage(`JSON export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const downloadBinary = (payload: { fileName: string; contentType: string; base64: string } | undefined) => {
    if (!payload) {
      setExportMessage("Export failed: no report file was returned.");
      return;
    }
    try {
      const bytes = Uint8Array.from(atob(payload.base64), character => character.charCodeAt(0));
      downloadBlob(payload.fileName, payload.contentType, bytes);
      setExportMessage(`${payload.fileName} download started.`);
    } catch (error) {
      setExportMessage(`Export failed: ${error instanceof Error ? error.message : "Invalid file data"}`);
    }
  };

  const exportFile = async (format: "pdf" | "excel") => {
    setExportMessage(`Preparing ${format.toUpperCase()} report…`);
    try {
      const result = await (format === "pdf" ? pdfQuery.refetch() : excelQuery.refetch());
      if (result.error) {
        setExportMessage(`${format.toUpperCase()} export failed: ${result.error.message}`);
        return;
      }
      downloadBinary(result.data);
    } catch (error) {
      setExportMessage(`${format.toUpperCase()} export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link href="/" className="workspace-brand">
          <span className="brand-mark"><span /><span /><span /></span>
          <span><strong>Bangladesh AI Readiness Assessment</strong><small>Assessment workspace</small></span>
        </Link>
        <div className="workspace-switcher">
          <span className="workspace-avatar">{assessment ? assessment.title.slice(0, 2).toUpperCase() : "—"}</span>
          <span><strong>{assessment?.title ?? "Select assessment"}</strong><small>{assessment ? assessment.profileType.replaceAll("_", " ") : "No assessment selected"}</small></span>
          <ChevronRight size={15} />
        </div>
        <nav className="workspace-nav" aria-label="Assessment workspace">
          <span className="workspace-nav-label">WORKSPACE</span>
          <a className="active" href="#overview"><BarChart3 size={17} /> Overview</a>
          <a href="#domains"><SlidersHorizontal size={17} /> Domains <span className="nav-count">{Object.keys(groupedControls).length}</span></a>
          <a href="#findings"><ShieldAlert size={17} /> Findings <span className="nav-count">{findings.length}</span></a>
          <span className="workspace-nav-label spaced">MANAGE</span>
          {assessment && <Link href={`/observatory/systems?assessmentId=${assessmentId}`}><FileCheck2 size={17} /> AI systems <span className="nav-count">{systems.length}</span></Link>}
          <Link href="/"><ArrowLeft size={15} /> Back to platform</Link>
        </nav>
      </aside>
      <main className="workspace-main">
        <header className="workspace-topbar">
          <div className="mobile-workspace-brand"><span className="brand-mark"><span /><span /><span /></span><strong>Bangladesh AI Readiness Assessment</strong></div>
          <div className="breadcrumbs"><span>Workspaces</span><ChevronRight size={14} /><strong>{assessment?.title ?? "Assessment"}</strong></div>
        </header>
        <div className="workspace-content" id="overview">
          {!queryId && (
            <section className="workspace-panel">
              <div className="panel-header"><div><span className="card-kicker">YOUR ASSESSMENTS</span><h2>Select an assessment</h2></div></div>
              {assessments.isLoading ? <p role="status">Loading your assessments…</p> : assessments.isError ? <p role="alert">Could not load assessments: {assessments.error.message}</p> : !assessments.data?.length ? <p>No assessments found. Create one to open a workspace.</p> : (
                <label>Assessment
                  <select aria-label="Select assessment" value={assessmentId || ""} onChange={event => selectAssessment(Number(event.target.value))}>
                    <option value="" disabled>Choose an assessment</option>
                    {assessments.data.map(item => <option key={item.id} value={item.id}>{item.title} · #{item.id}</option>)}
                  </select>
                </label>
              )}
            </section>
          )}
          {assessmentId > 0 && dashboardQuery.isLoading && <div className="empty-questionnaire" role="status">Loading assessment dashboard…</div>}
          {assessmentId > 0 && dashboardQuery.isError && <div className="empty-questionnaire" role="alert">Could not load dashboard: {dashboardQuery.error.message}</div>}
          {assessmentId > 0 && dashboardQuery.isSuccess && !readyDashboard && <div className="empty-questionnaire" role="alert">Assessment not found or you do not have access to it.</div>}
          {readyDashboard && assessment && (
            <>
              <div className="workspace-heading">
                <div>
                  <span className="card-kicker">{assessment.profileType.replaceAll("_", " ").toUpperCase()} / {assessment.posture.replaceAll("_", " ").toUpperCase()}</span>
                  <h1>{assessment.title}</h1>
                  <p>{assessment.jurisdiction ?? "Jurisdiction not specified"} · {assessment.sector ?? "Sector not specified"}</p>
                </div>
                <div className="workspace-heading-actions">
                  {assessments.data?.some(item => item.id === assessmentId) && ["draft", "in_progress", "changes_requested"].includes(assessment.status) && <button className="button button-dark" onClick={() => { if (window.confirm("Submit this assessment? You will not be able to edit responses until changes are requested.")) submitAssessment.mutate({ assessmentId }); }} disabled={submitAssessment.isPending || !controls.length || controls.some(row => row.assignment.responseScore === null)} title={controls.some(row => row.assignment.responseScore === null) ? "Answer every scoped control before submitting." : undefined}>{submitAssessment.isPending ? "Submitting…" : "Submit assessment"}</button>}
                  <button className="outline-button" onClick={exportJson} disabled={reportQuery.isFetching}>JSON</button>
                  <button className="outline-button" onClick={() => void exportFile("pdf")} disabled={pdfQuery.isFetching}><FileText size={16} /> PDF</button>
                  <button className="outline-button" onClick={() => void exportFile("excel")} disabled={excelQuery.isFetching}><FileSpreadsheet size={16} /> Excel</button>
                  <Link className="button button-dark" href={`/observatory/systems?assessmentId=${assessmentId}`}>AI systems <ArrowUpRight size={16} /></Link>
                </div>
              </div>
              <AssessmentOrganizationPanel
                assessmentId={assessmentId}
                organizationId={assessment.organizationId}
                sector={assessment.sector}
                jurisdiction={assessment.jurisdiction}
                isAssessmentOwner={Boolean(assessments.data?.some(item => item.id === assessmentId))}
              />
              {exportMessage && <p role="status">{exportMessage}</p>}
              {reportQuery.isError && <p role="alert">Report data could not be loaded: {reportQuery.error.message}</p>}
              <div className="workspace-metrics">
                <div className="workspace-metric main"><div className="metric-head"><span>READINESS SCORE · ANSWERED CONTROLS</span></div><div className="big-score">{Math.round(Number(assessment.score))}<span>/100</span></div><div className="score-progress"><i style={{ width: `${Math.max(0, Math.min(100, Number(assessment.score)))}%` }} /></div><p>{controls.filter(row => row.assignment.responseScore !== null).length} of {controls.length} controls answered · unanswered controls are excluded · {assessment.status.replaceAll("_", " ")} · {assessment.methodologyVersion}</p></div>
                <div className="workspace-metric"><div className="metric-head"><span>EVIDENCE COVERAGE</span><FileCheck2 size={16} /></div><strong className="metric-value">{Math.round(Number(assessment.evidenceCoverage))}<span>%</span></strong><p>{controls.filter(row => row.assignment.evidenceStatus === "submitted" || row.assignment.evidenceStatus === "verified").length} of {controls.length} scoped controls have submitted or verified evidence</p><div className="mini-progress lime"><i style={{ width: `${Math.max(0, Math.min(100, Number(assessment.evidenceCoverage)))}%` }} /></div></div>
                <div className="workspace-metric"><div className="metric-head"><span>OPEN FINDINGS</span><ShieldAlert size={16} /></div><strong className="metric-value">{findings.length}</strong><p>{systems.length} registered AI systems</p><div className="finding-dots" /></div>
              </div>
              <div className="workspace-two-col">
                <section className="workspace-panel" id="domains">
                  <div className="panel-header"><div><span className="card-kicker">GAAF / DOMAIN SIGNAL</span><h2>Controls by domain</h2></div></div>
                  {!Object.keys(groupedControls).length ? <p>No controls are available for this assessment.</p> : <div className="domain-table">{Object.entries(groupedControls).map(([code, domain]) => {
                    const scores = domain.rows.map(row => row.assignment.responseScore).filter((value): value is number => value !== null);
                    const score = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / (scores.length * 4) * 100) : 0;
                    const tone = score >= 70 ? "good" : score >= 40 ? "warm" : "risk";
                    return <div className="domain-row" key={code}><span className="domain-code">{code}</span><strong>{domain.title}</strong><div className="row-bar"><i className={tone} style={{ width: `${score}%` }} /></div><b>{scores.length ? score : "—"}</b><span className={`row-state ${tone}`}>{scores.length ? `${scores.length}/${domain.rows.length} scored` : "Not scored"}</span></div>;
                  })}</div>}
                </section>
                <section className="workspace-panel" id="findings">
                  <div className="panel-header"><div><span className="card-kicker">RECORDED FINDINGS</span><h2>Findings</h2></div></div>
                  {findings.length ? findings.map(finding => <article key={finding.id}><strong>{finding.title}</strong><p>{finding.description || "No description provided."}</p><small>{finding.severity} · {finding.status.replaceAll("_", " ")}</small></article>) : <p>No findings recorded for this assessment.</p>}
                  <Link className="panel-link" href={`/observatory/systems?assessmentId=${assessmentId}`}>View AI systems ({systems.length}) <ArrowUpRight size={15} /></Link>
                </section>
              </div>
              <div className="workspace-footnote"><ShieldCheck size={15} /><span>{assessment.posture === "self_assessment" ? "Self-reported · Not independently verified" : "Pending reviewer verification"}</span></div>
            </>
          )}
          {assessmentId <= 0 && !assessments.isLoading && !assessments.isError && !assessments.data?.length && <div className="empty-questionnaire">No assessments are available for this account.</div>}
        </div>
      </main>
    </div>
  );
}
