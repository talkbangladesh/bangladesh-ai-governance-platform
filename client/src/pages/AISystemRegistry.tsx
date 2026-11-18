import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Activity, ArrowLeft, Plus, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AI_SYSTEM_DECISION_IMPACTS, AI_SYSTEM_LIFECYCLE_STATUSES, type AISystemDecisionImpact } from "@shared/aiSystems";
import "./ai-systems.css";

type RiskLevel = "low" | "moderate" | "high" | "critical";
type Lifecycle = typeof AI_SYSTEM_LIFECYCLE_STATUSES[number];
type DecisionImpact = AISystemDecisionImpact;
const risks: RiskLevel[] = ["low", "moderate", "high", "critical"];
const lifecycles = AI_SYSTEM_LIFECYCLE_STATUSES;
const impacts = AI_SYSTEM_DECISION_IMPACTS;
const emptyForm = { name: "", provider: "", purpose: "", decisionImpact: "" as DecisionImpact | "", humanOversight: "", riskLevel: "" as RiskLevel | "", lifecycleStatus: "" as Lifecycle | "" };
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());

export default function AISystemRegistry() {
  const params = new URLSearchParams(window.location.search);
  const [assessmentId, setAssessmentId] = useState(params.get("assessmentId") ?? "");
  const [organizationId, setOrganizationId] = useState(params.get("organizationId") ?? "");
  const [search, setSearch] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel | "">("");
  const [decisionImpact, setDecisionImpact] = useState<DecisionImpact | "">("");
  const [lifecycleStatus, setLifecycleStatus] = useState<Lifecycle | "">("");
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");

  const contexts = trpc.agaras.aiSystems.contextOptions.useQuery();
  const input = useMemo(() => ({
    assessmentId: assessmentId ? Number(assessmentId) : undefined,
    organizationId: organizationId ? Number(organizationId) : undefined,
    search: search.trim() || undefined,
    riskLevel: riskLevel || undefined,
    decisionImpact: decisionImpact || undefined,
    lifecycleStatus: lifecycleStatus || undefined,
  }), [assessmentId, organizationId, search, riskLevel, decisionImpact, lifecycleStatus]);
  const list = trpc.agaras.aiSystems.list.useQuery(input);
  const utils = trpc.useUtils();
  const create = trpc.agaras.aiSystems.create.useMutation({
    onSuccess: async () => {
      setForm(emptyForm);
      setShowForm(false);
      setNotice("AI system record saved. It remains private to authorized users.");
      await utils.agaras.aiSystems.list.invalidate();
    },
  });
  const systems = list.data?.systems ?? [];
  const selectedAssessment = contexts.data?.assessments.find(item => String(item.id) === assessmentId);
  const parentSelected = Boolean(assessmentId || organizationId);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!parentSelected) {
      setNotice("Select an assessment or organization before saving a system.");
      return;
    }
    if (form.name.trim().length < 2) {
      setNotice("Enter a system name of at least 2 characters.");
      return;
    }
    create.mutate({
      assessmentId: assessmentId ? Number(assessmentId) : undefined,
      organizationId: organizationId ? Number(organizationId) : undefined,
      name: form.name.trim(),
      provider: form.provider.trim() || undefined,
      purpose: form.purpose.trim() || undefined,
      decisionImpact: form.decisionImpact || undefined,
      humanOversight: form.humanOversight.trim() || undefined,
      riskLevel: form.riskLevel || undefined,
      lifecycleStatus: form.lifecycleStatus || undefined,
    });
  };

  return (
    <main className="ai-registry">
      <header className="ai-registry-head">
        <Link href="/observatory" className="ai-back"><ArrowLeft size={16} /> Public Observatory</Link>
        <span className="ai-kicker">PRIVATE ORGANIZATION REGISTER</span>
        <h1>AI system inventory</h1>
        <p>Organization and assessment records are private to authorized users. These records are not published in the national Observatory.</p>
      </header>

      {contexts.isLoading ? <p role="status">Loading assessment and organization choices…</p> : contexts.isError ? <p role="alert" className="ai-error">Could not load context options: {contexts.error.message}</p> : (
        <div className="ai-context">
          <label>Assessment context
            <select value={assessmentId} onChange={event => { setAssessmentId(event.target.value); setOrganizationId(""); }}>
              <option value="">All / none selected</option>
              {contexts.data?.assessments.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <label>Organization context
            <select value={organizationId} onChange={event => { setOrganizationId(event.target.value); setAssessmentId(""); }}>
              <option value="">All / none selected</option>
              {contexts.data?.organizations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          {selectedAssessment?.organizationId && <p className="ai-context-note">This assessment is already linked to its organization; the server checks that relationship.</p>}
        </div>
      )}

      <section className="ai-stats" aria-label="Private inventory statistics">
        <article><span>Accessible records</span><strong>{list.isLoading ? "…" : list.data?.stats.total ?? "—"}</strong></article>
        <article><span>By risk level</span><div>{list.data && Object.entries(list.data.stats.byRisk).map(([key, count]) => <small key={key}>{label(key)} <b>{count}</b></small>)}</div></article>
        <article><span>By lifecycle</span><div>{list.data && Object.entries(list.data.stats.byLifecycle).map(([key, count]) => <small key={key}>{label(key)} <b>{count}</b></small>)}</div></article>
      </section>

      <section className="ai-panel">
        <div className="ai-panel-head"><div><span className="ai-kicker">REGISTER</span><h2>Organization AI systems</h2></div><button className="ai-primary" onClick={() => { setNotice(""); setShowForm(value => !value); }}><Plus size={16} /> Add system</button></div>
        <div className="ai-filters">
          <label className="ai-search"><span>Search systems</span><div><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, provider, or purpose" /></div></label>
          <label>Risk<select value={riskLevel} onChange={event => setRiskLevel(event.target.value as RiskLevel | "")}><option value="">All risks</option>{risks.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
          <label>Category / decision impact<select value={decisionImpact} onChange={event => setDecisionImpact(event.target.value as DecisionImpact | "")}><option value="">All categories</option>{impacts.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
          <label>Lifecycle<select value={lifecycleStatus} onChange={event => setLifecycleStatus(event.target.value as Lifecycle | "")}><option value="">All stages</option>{lifecycles.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        </div>

        {showForm && <form className="ai-form" onSubmit={submit}>
          <h3>Register an AI system</h3>
          <p className="ai-form-note">Choose one parent context above before saving. System records remain private.</p>
          <label>System name<input required minLength={2} maxLength={255} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></label>
          <label>Provider<input maxLength={255} value={form.provider} onChange={event => setForm(current => ({ ...current, provider: event.target.value }))} /></label>
          <label>Purpose<textarea maxLength={5000} value={form.purpose} onChange={event => setForm(current => ({ ...current, purpose: event.target.value }))} /></label>
          <label>Category / decision impact<select value={form.decisionImpact} onChange={event => setForm(current => ({ ...current, decisionImpact: event.target.value as DecisionImpact | "" }))}><option value="">Select…</option>{impacts.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
          <label>Human oversight<input maxLength={80} value={form.humanOversight} onChange={event => setForm(current => ({ ...current, humanOversight: event.target.value }))} /></label>
          <label>Risk level<select value={form.riskLevel} onChange={event => setForm(current => ({ ...current, riskLevel: event.target.value as RiskLevel | "" }))}><option value="">Select…</option>{risks.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
          <label>Lifecycle status<select value={form.lifecycleStatus} onChange={event => setForm(current => ({ ...current, lifecycleStatus: event.target.value as Lifecycle | "" }))}><option value="">Select…</option>{lifecycles.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
          {create.error && <p role="alert" className="ai-error">{create.error.message}</p>}
          {notice && <p role="status" className="ai-success">{notice}</p>}
          <div className="ai-actions"><button type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="ai-primary" disabled={create.isPending || !parentSelected}>{create.isPending ? "Saving…" : "Save system"}</button></div>
        </form>}

        {!showForm && notice && <p role="status" className="ai-success">{notice}</p>}
        {list.isLoading ? <p role="status" className="ai-empty">Loading AI systems…</p> : list.isError ? <p role="alert" className="ai-error">Could not load AI systems: {list.error.message}</p> : systems.length === 0 ? (
          <div className="ai-empty"><Activity /><h3>No system records match</h3><p>{search || riskLevel || decisionImpact || lifecycleStatus ? "Adjust or clear filters to see matching records." : "No private AI-system records are available for this context yet."}</p></div>
        ) : (
          <div className="ai-table">{systems.map(system => <Link key={system.id} href={`/observatory/systems/${system.id}`} className="ai-row"><div><strong>{system.name}</strong><span>{system.provider || "Provider not specified"}</span></div><span className="ai-pill">{label(system.riskLevel || "unrated")}</span><span>{label(system.decisionImpact || "unspecified")}</span><span>{label(system.lifecycleStatus || "unspecified")}</span></Link>)}</div>
        )}
      </section>
    </main>
  );
}
