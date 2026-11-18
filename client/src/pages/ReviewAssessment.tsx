import { ArrowLeft, Check, CheckCircle2, ChevronRight, FileCheck2, MessageSquareText, ShieldAlert, ShieldCheck, X, XCircle } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

const decisionEvents = new Set(["approve", "reject", "request_changes"]);

export default function ReviewAssessment() {
  const [, params] = useRoute("/review/:id");
  const assignmentId = Number(params?.id ?? 0);
  const assignments = trpc.review.myAssignments.useQuery();
  const assignmentRow = assignments.data?.find(item => item.assignment.id === assignmentId);
  const assessmentId = assignmentRow?.assessment?.id ?? 0;
  const scope = assignmentRow?.assignment.scope;
  const status = assignmentRow?.assignment.status;
  const isFindingScope = scope === "findings";

  const controls = trpc.agaras.controls.useQuery({ assessmentId }, { enabled: assessmentId > 0 && !isFindingScope && status === "active" });
  const findings = trpc.agaras.findings.useQuery({ assessmentId }, { enabled: assessmentId > 0 && isFindingScope && status === "active" });
  const events = trpc.review.events.useQuery({ assessmentId }, { enabled: assessmentId > 0 && status !== "invited" });
  const evidence = trpc.review.evidence.useQuery({ assessmentId }, { enabled: assessmentId > 0 && status === "active" && ["full", "domain", "evidence"].includes(scope ?? "") });
  const review = trpc.review.control.useMutation();
  const reviewFinding = trpc.review.finding.useMutation();
  const complete = trpc.review.complete.useMutation({ onSuccess: async () => { await Promise.all([assignments.refetch(), events.refetch()]); } });
  const [message, setMessage] = useState("");
  const [activeControl, setActiveControl] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  const rows = controls.data ?? [];
  const visibleEvidence = evidence.data ?? [];
  const findingRows = findings.data ?? [];
  const findingDecisions = useMemo(() => {
    const decisions = new Map<number, string>();
    for (const event of events.data ?? []) {
      if (event.entityType === "finding" && typeof event.entityId === "number" && decisionEvents.has(event.eventType) && !decisions.has(event.entityId)) decisions.set(event.entityId, event.eventType);
    }
    return decisions;
  }, [events.data]);
  const pending = isFindingScope
    ? findingRows.filter(item => !findingDecisions.has(item.id)).length
    : scope === "evidence"
      ? rows.filter(row => row.assignment.evidenceStatus === "submitted").length
      : rows.filter(row => row.assignment.reviewDecision === "pending").length;
  const workLoading = isFindingScope
    ? findings.isLoading || events.isLoading
    : controls.isLoading || (scope === "evidence" && evidence.isLoading);
  const workError = isFindingScope ? findings.error?.message : controls.error?.message;
  const canReview = status === "active";

  const decideControl = (controlId: number, eventType: "approve" | "reject" | "request_changes" | "status_change" | "comment", evidenceStatus?: "verified" | "rejected", note?: string) => {
    setActionError("");
    review.mutate({ assessmentId, controlId, eventType, evidenceStatus, message: note }, {
      onSuccess: async () => {
        setNotice(eventType === "status_change" ? `Evidence marked ${evidenceStatus}.` : "Control decision saved.");
        setMessage("");
        setActiveControl(null);
        await Promise.all([controls.refetch(), events.refetch(), evidence.refetch(), assignments.refetch()]);
      },
      onError: error => setActionError(error.message),
    });
  };
  const decideFinding = (findingId: number, eventType: "approve" | "reject" | "request_changes") => {
    setActionError("");
    reviewFinding.mutate({ assessmentId, findingId, eventType, message: message.trim() || undefined }, {
      onSuccess: async () => {
        setNotice("Finding decision saved to the review trail.");
        setMessage("");
        await Promise.all([findings.refetch(), events.refetch(), assignments.refetch()]);
      },
      onError: error => setActionError(error.message),
    });
  };
  const completeAssignment = () => {
    setActionError("");
    complete.mutate({ assignmentId }, {
      onSuccess: () => setNotice("Review completed."),
      onError: error => setActionError(error.message),
    });
  };

  if (assignments.isLoading) return <div className="assessment-shell"><main className="review-detail-main container"><div className="review-empty" role="status">Loading review assignment…</div></main></div>;
  if (assignments.isError) return <div className="assessment-shell"><main className="review-detail-main container"><div className="review-empty" role="alert"><XCircle size={20} /><strong>Could not load review assignment</strong><span>{assignments.error.message}</span><button className="review-action open" onClick={() => assignments.refetch()}>Try again</button></div></main></div>;
  if (!assignmentRow) return <div className="assessment-shell"><main className="review-detail-main container"><div className="review-empty"><XCircle size={20} /><strong>Review assignment not found</strong><Link href="/review" className="back-button">Back to queue</Link></div></main></div>;
  if (!assignmentRow.assessment) {
    const invitation = assignmentRow.assignment.status === "invited";
    const title = invitation ? "Invitation awaiting response" : assignmentRow.assignment.status === "declined" ? "Invitation declined" : "Assignment access ended";
    const description = invitation ? "Assessment information stays hidden until this invitation is accepted. Accept or decline it from your review queue." : "Assessment information remains hidden because this assignment is no longer active.";
    return <div className="assessment-shell"><header className="assessment-header container"><Link href="/review" className="assessment-logo"><span className="brand-mark"><span /><span /><span /></span><strong>Bangladesh AI Readiness Assessment</strong></Link></header><main className="review-detail-main container"><div className="review-empty"><ShieldCheck size={20} /><strong>{title}</strong><span>{description}</span><Link href="/review" className="review-action open">Open review queue <ArrowLeft size={15} /></Link></div></main></div>;
  }

  const assessment = assignmentRow.assessment;
  const isReadOnly = status !== "active";
  const readyToComplete = !workLoading && !workError && pending === 0;

  return (
    <div className="assessment-shell">
      <header className="assessment-header container"><Link href="/review" className="assessment-logo"><span className="brand-mark"><span /><span /><span /></span><strong>Bangladesh AI Readiness Assessment</strong></Link><div className="assessment-header-right"><span className="assessment-version">CONTROL REVIEW / {scope?.toUpperCase()}</span><Link href="/review" className="close-link">Exit review <ArrowLeft size={15} /></Link></div></header>
      <main className="review-detail-main container">
        <div className="review-detail-top"><div><div className="eyebrow"><span className="eyebrow-index">ASSIGNMENT {assignmentId}</span> / {status?.toUpperCase()}</div><h1>{assessment.title}</h1><p>{assessment.jurisdiction ?? "Jurisdiction not set"} · {assessment.methodologyVersion} · {scope === "findings" ? "Findings scope" : `${rows.length} controls in scope`}</p></div><div className="review-detail-actions">{status === "active" && <button className="button button-lime" disabled={complete.isPending || !readyToComplete} title={pending ? `Resolve ${pending} pending item${pending === 1 ? "" : "s"} before completing.` : undefined} onClick={completeAssignment}>{complete.isPending ? "Closing review…" : "Complete review"} <CheckCircle2 size={16} /></button>}{status === "completed" && <span className="verified-pill"><ShieldCheck size={15} /> Review closed</span>}{status === "invited" && <span className="muted-status">Invitation pending acceptance</span>}{(status === "declined" || status === "revoked") && <span className="muted-status">{status}</span>}</div></div>
        {notice && <p role="status" className="muted-copy">{notice}</p>}{actionError && <p role="alert" className="muted-copy">{actionError}</p>}{(review.isPending || reviewFinding.isPending || complete.isPending) && <p role="status" className="muted-copy">Saving review update…</p>}
        {workLoading && <div className="review-empty" role="status">Loading assigned work and scope…</div>}
        {workError && <div className="review-empty" role="alert"><strong>Could not load assigned work</strong><span>{workError}</span><button className="review-action open" onClick={() => { void (isFindingScope ? findings.refetch() : controls.refetch()); }}>Try again</button></div>}
        {status === "active" && !workLoading && !workError && <p className="review-notice" role="status">{pending ? `${pending} assigned item${pending === 1 ? " remains" : "s remain"} before this review can be completed.` : "All work currently visible in this assignment is resolved."}</p>}
        {status === "invited" ? <div className="review-empty">Accept this assignment from the review queue before viewing review work.</div> : (
          <div className="review-detail-layout">
            <section>
              <div className="review-detail-banner"><ShieldCheck size={17} /><span>Decision standard: review only the evidence and records in the assigned scope. Every decision is written to the review event trail.</span></div>
              {status === "completed" ? <div className="review-empty" role="status">This assignment is closed and read-only. Its permitted audit events remain available.</div> : isFindingScope ? <div className="control-review-list">
                {findings.isSuccess && !findingRows.length && <div className="review-empty">No findings are available in this assignment scope.</div>}
                {findingRows.map(item => {
                  const decision = findingDecisions.get(item.id);
                  return <article className="control-review-card" key={item.id}><span className="control-review-code">{item.severity ?? "Finding"} · {decision ? decision.replaceAll("_", " ") : "decision pending"}</span><h2>{item.title}</h2><p>{item.description ?? "No description provided."}</p>{item.recommendation && <p><strong>Recommendation:</strong> {item.recommendation}</p>}{canReview && <><label>Reviewer note (optional)<textarea aria-label={`Reviewer note for ${item.title}`} value={message} onChange={event => setMessage(event.target.value)} maxLength={5000} rows={2} /></label><div className="control-review-actions"><button disabled={reviewFinding.isPending} onClick={() => decideFinding(item.id, "approve")} className="review-action accept"><Check size={14} /> Approve</button><button disabled={reviewFinding.isPending} onClick={() => decideFinding(item.id, "request_changes")} className="review-action changes"><ChevronRight size={14} /> Request changes</button><button disabled={reviewFinding.isPending} onClick={() => decideFinding(item.id, "reject")} className="review-action decline"><X size={14} /> Reject</button></div></>}</article>;
                })}
              </div> : <div className="control-review-list">
                {controls.isSuccess && !rows.length && <div className="review-empty">No controls are available in this assignment scope.</div>}
                {rows.map(({ assignment, control, domain }) => {
                  const attachments = visibleEvidence.filter(item => item.evidence.controlId === control.id);
                  const canVerifyEvidence = canReview && assignment.evidenceStatus === "submitted" && attachments.length > 0 && ["full", "domain", "evidence"].includes(scope ?? "");
                  return <article className={`control-review-card ${assignment.reviewDecision}`} key={assignment.id}>
                    <div className="control-review-head"><span className="domain-chip">{domain.code}</span><span className={`criticality-chip ${control.criticality}`}>{control.criticality}</span><span className="control-review-code">{control.code}</span>{scope !== "evidence" && <span className="control-review-decision">{assignment.reviewDecision.replace("_", " ")}</span>}</div>
                    <h2>{control.title}</h2><p>{control.objective}</p><div className="control-evidence-line"><FileCheck2 size={15} /><span>{control.evidenceRequirement}</span><b className={`evidence-state ${assignment.evidenceStatus}`}>{assignment.evidenceStatus.replaceAll("_", " ")}</b></div>
                    {scope === "evidence" && <p className="muted-copy">Answer scores, response notes, and control decisions are withheld from evidence-only assignments.</p>}
                    {evidence.isError && <p role="alert" className="muted-copy">Evidence links unavailable: {evidence.error.message}</p>}
                    {attachments.length > 0 && <ul className="review-evidence-files">{attachments.map(item => <li key={item.evidence.id}><a href={item.downloadUrl} target="_blank" rel="noreferrer">{item.evidence.fileName}</a><small>{item.control?.code ?? "Control attachment"} · {item.evidence.mimeType ?? "Unknown type"} · {item.evidence.fileSize ?? 0} bytes</small></li>)}</ul>}
                    {activeControl === control.id && canReview && scope !== "evidence" && <div className="review-comment-box"><MessageSquareText size={15} /><textarea aria-label="Reviewer note" value={message} onChange={event => setMessage(event.target.value)} placeholder="Add a reviewer note or evidence rationale…" rows={3} maxLength={5000} /><button className="text-button" onClick={() => { setActiveControl(null); setMessage(""); }}>Cancel</button><button className="text-button" disabled={review.isPending || !message.trim()} onClick={() => decideControl(control.id, "comment", undefined, message.trim())}>Save note</button></div>}
                    {canReview && <div className="control-review-actions">{scope !== "evidence" && <><button disabled={review.isPending} onClick={() => decideControl(control.id, "approve")} className="review-action accept"><Check size={14} /> Approve</button><button disabled={review.isPending} onClick={() => decideControl(control.id, "request_changes")} className="review-action changes"><ChevronRight size={14} /> Request changes</button><button disabled={review.isPending} onClick={() => decideControl(control.id, "reject")} className="review-action decline"><X size={14} /> Reject</button><button disabled={review.isPending} onClick={() => { setActiveControl(activeControl === control.id ? null : control.id); setMessage(""); }} className="review-action comment"><MessageSquareText size={14} /> Note</button></>}{canVerifyEvidence && <><button disabled={review.isPending} onClick={() => decideControl(control.id, "status_change", "verified")} className="review-action evidence"><FileCheck2 size={14} /> Verify evidence</button><button disabled={review.isPending} onClick={() => decideControl(control.id, "status_change", "rejected")} className="review-action decline"><XCircle size={14} /> Reject evidence</button></>}</div>}
                  </article>;
                })}
              </div>}
            </section>
            <aside className="review-event-panel"><div className="panel-header"><div><span className="card-kicker">AUDIT TRAIL</span><h2>Review events</h2></div><ShieldAlert size={18} /></div><div className="review-event-list">{events.isLoading && <p role="status" className="muted-copy">Loading events…</p>}{events.isError && <p role="alert" className="muted-copy">Could not load events: {events.error.message} <button className="text-button" onClick={() => events.refetch()}>Retry</button></p>}{events.data?.slice(0, 12).map(event => <div className="review-event" key={event.id}><span /><div><strong>{event.eventType.replace("_", " ")}</strong><p>{event.message ?? "Review decision recorded"}</p><small>{new Date(event.createdAt).toLocaleString()}</small></div></div>)}{events.isSuccess && !events.data?.length && <p className="muted-copy">Events will appear as you review assigned work.</p>}</div></aside>
          </div>
        )}
        {isReadOnly && status === "completed" && <p className="workspace-footnote"><ShieldCheck size={15} /><span>This review is closed and read-only. Its permitted audit events remain available.</span></p>}
        <Link href="/review" className="back-button"><ArrowLeft size={16} /> Back to review queue</Link>
      </main>
    </div>
  );
}
