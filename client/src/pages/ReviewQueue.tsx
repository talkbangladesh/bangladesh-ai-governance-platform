import { ArrowLeft, ArrowUpRight, CheckCircle2, Clock3, FileCheck2, Flag, ListChecks, ShieldCheck, UsersRound, XCircle } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

export default function ReviewQueue() {
  const dashboard = trpc.review.dashboard.useQuery();
  const utils = trpc.useUtils();
  const respond = trpc.review.respond.useMutation({
    onSuccess: async () => {
      await Promise.all([dashboard.refetch(), utils.review.myAssignments.invalidate()]);
    },
  });
  const totals = dashboard.data?.totals;
  const assignments = dashboard.data?.assignments ?? [];

  return (
    <div className="assessment-shell">
      <header className="assessment-header container">
        <Link href="/" className="assessment-logo"><span className="brand-mark"><span /><span /><span /></span><strong>Bangladesh AI Readiness Assessment</strong></Link>
        <div className="assessment-header-right"><span className="assessment-version">ASSURANCE / REVIEW CONTROL PLANE</span><Link href="/workspace" className="close-link">Open workspace <ArrowUpRight size={15} /></Link></div>
      </header>
      <main className="review-main container">
        <div className="eyebrow"><span className="eyebrow-index">REVIEWER CONTROL PLANE / SCOPED ACCESS</span></div>
        <div className="review-heading"><div><h1>Make assurance <em>traceable.</em></h1><p>See assigned work, follow its declared scope, and close reviews with a visible decision trail.</p></div><span className="review-badge"><ShieldCheck size={15} /> Role-scoped access</span></div>
        {dashboard.isSuccess && <div className="review-metrics">
          <div><span>ASSIGNMENTS</span><strong>{totals?.assignments ?? 0}</strong><small>Across your review queue</small></div>
          <div><span>PENDING ITEMS</span><strong>{totals?.pending ?? 0}</strong><small>Need a reviewer decision</small></div>
          <div><span>APPROVED</span><strong>{totals?.approved ?? 0}</strong><small>Decisions recorded</small></div>
          <div className="risk"><span>CHANGES / REJECTED</span><strong>{totals?.rejected ?? 0}</strong><small>Need owner follow-up</small></div>
          <div><span>EVIDENCE WAITING</span><strong>{totals?.evidencePending ?? 0}</strong><small>Submitted for verification</small></div>
        </div>}
        <div className="review-notice"><FileCheck2 size={16} /><span>Reviewer access never grants organization ownership. Assessment details appear only after the assignment is accepted, and every action is restricted to its declared scope.</span></div>
        <section className="review-section-head"><div><span className="card-kicker">MY ASSIGNMENTS</span><h2>Work queue</h2></div>{dashboard.isSuccess && <span className="review-total">{assignments.length} record{assignments.length === 1 ? "" : "s"}</span>}</section>
        <div className="review-list">
          {dashboard.isLoading && <div className="review-empty" role="status">Loading review control plane…</div>}
          {dashboard.isError && <div className="review-empty" role="alert"><XCircle size={19} /><strong>Could not load review assignments</strong><span>{dashboard.error.message}</span><button className="review-action open" onClick={() => dashboard.refetch()}>Try again</button></div>}
          {dashboard.isSuccess && assignments.map(({ assignment, assessment, stats }) => (
            <article className="review-card review-card-rich" key={assignment.id}>
              <div className="review-card-icon">{assignment.status === "completed" ? <CheckCircle2 size={19} /> : assignment.status === "declined" || assignment.status === "revoked" ? <XCircle size={19} /> : <ListChecks size={19} />}</div>
              <div className="review-card-body">
                <span className="card-kicker">{assignment.scope.toUpperCase()} SCOPE / {assignment.status.toUpperCase()}</span>
                <h2>{assessment?.title ?? (assignment.status === "invited" ? "Assessment invitation" : "Assessment unavailable")}</h2>
                {assessment ? <p>{assessment.jurisdiction ?? "Jurisdiction not set"} · {assessment.methodologyVersion} · Assigned {new Date(assignment.assignedAt).toLocaleDateString()}</p> : <p>{assignment.status === "invited" ? "Accept or decline this assignment to continue. Assessment details are withheld until acceptance." : "The assessment record is no longer available."}</p>}
                {assessment && assignment.status !== "invited" && assignment.status !== "declined" && assignment.status !== "revoked" && <div className="review-progress"><span><b>{stats.approved}</b> approved</span><span><b>{stats.pending}</b> pending</span><span><b>{stats.rejected}</b> changes</span><i><em style={{ width: `${stats.total ? ((stats.approved + stats.rejected) / stats.total) * 100 : 0}%` }} /></i></div>}
              </div>
              <div className="review-card-actions">
                {assignment.status === "invited" ? <>
                  <button className="review-action accept" disabled={respond.isPending} onClick={() => respond.mutate({ assignmentId: assignment.id, response: "accept" })}>Accept <CheckCircle2 size={14} /></button>
                  <button className="review-action decline" disabled={respond.isPending} onClick={() => respond.mutate({ assignmentId: assignment.id, response: "decline" })}>Decline <XCircle size={14} /></button>
                </> : assignment.status === "declined" || assignment.status === "revoked" || !assessment ? <span className="muted-status">{assignment.status === "declined" || assignment.status === "revoked" ? assignment.status : "Unavailable"}</span> : <Link className="review-action open" href={`/review/${assignment.id}`}>{assignment.status === "completed" ? "View review" : "Open review"} <ArrowUpRight size={14} /></Link>}
              </div>
            </article>
          ))}
          {respond.isPending && <p role="status" className="muted-copy">Saving invitation response…</p>}
          {respond.isError && <p role="alert" className="muted-copy">Invitation response failed: {respond.error.message}</p>}
          {respond.isSuccess && <p role="status" className="muted-copy">Invitation response saved.</p>}
          {dashboard.isSuccess && !assignments.length && <div className="review-empty"><UsersRound size={19} /><strong>No reviewer assignments yet</strong><span>When an assessment owner assigns you a scope, it will appear here.</span></div>}
        </div>
        <div className="review-footer-grid"><div><Flag size={17} /><div><strong>Review standard</strong><span>Every control decision includes reviewer identity, timestamp and event history.</span></div></div><div><Clock3 size={17} /><div><strong>Complete with care</strong><span>Resolve the work covered by your assignment before closing the review.</span></div></div></div>
        <Link className="back-button" href="/"><ArrowLeft size={16} /> Back to Bangladesh AI Readiness Assessment</Link>
      </main>
    </div>
  );
}
