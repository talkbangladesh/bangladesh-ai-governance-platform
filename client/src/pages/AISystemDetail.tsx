import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { Archive, ArrowLeft, Save } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AI_SYSTEM_DECISION_IMPACTS, AI_SYSTEM_LIFECYCLE_STATUSES, type AISystemDecisionImpact } from "@shared/aiSystems";
import "./ai-systems.css";

type RiskLevel = "low" | "moderate" | "high" | "critical";
type Lifecycle = typeof AI_SYSTEM_LIFECYCLE_STATUSES[number];
type DecisionImpact = AISystemDecisionImpact;
const risks: RiskLevel[] = ["low", "moderate", "high", "critical"];
const lifecycles = AI_SYSTEM_LIFECYCLE_STATUSES;
const impacts = AI_SYSTEM_DECISION_IMPACTS;
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());

type EditFields = { name: string; provider: string; purpose: string; decisionImpact: DecisionImpact | ""; humanOversight: string; riskLevel: RiskLevel | ""; lifecycleStatus: Lifecycle | "" };

export default function AISystemDetail() {
  const [, params] = useRoute("/observatory/systems/:id");
  const systemId = Number(params?.id ?? 0);
  const detail = trpc.agaras.aiSystems.detail.useQuery({ systemId }, { enabled: Number.isSafeInteger(systemId) && systemId > 0 });
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [notice, setNotice] = useState("");
  const [fields, setFields] = useState<EditFields | null>(null);
  const system = detail.data?.system;

  useEffect(() => {
    if (!system) return;
    setFields({ name: system.name, provider: system.provider ?? "", purpose: system.purpose ?? "", decisionImpact: AI_SYSTEM_DECISION_IMPACTS.includes(system.decisionImpact as DecisionImpact) ? system.decisionImpact as DecisionImpact : "", humanOversight: system.humanOversight ?? "", riskLevel: system.riskLevel, lifecycleStatus: system.lifecycleStatus as Lifecycle });
  }, [system]);

  const update = trpc.agaras.aiSystems.update.useMutation({
    onSuccess: async () => {
      setEditing(false);
      setNotice("AI system updated.");
      await Promise.all([utils.agaras.aiSystems.detail.invalidate({ systemId }), utils.agaras.aiSystems.list.invalidate()]);
    },
  });
  const retire = trpc.agaras.aiSystems.retire.useMutation({
    onSuccess: async () => {
      setConfirmRetire(false);
      setNotice("AI system retired. The record remains available for authorized audit history.");
      await Promise.all([utils.agaras.aiSystems.detail.invalidate({ systemId }), utils.agaras.aiSystems.list.invalidate()]);
    },
  });
  const setField = <K extends keyof EditFields>(key: K, value: EditFields[K]) => setFields(current => current ? { ...current, [key]: value } : current);
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fields || fields.name.trim().length < 2) return;
    setNotice("");
    update.mutate({ systemId, name: fields.name.trim(), provider: fields.provider.trim() || undefined, purpose: fields.purpose.trim() || undefined, decisionImpact: fields.decisionImpact || undefined, humanOversight: fields.humanOversight.trim() || undefined, riskLevel: fields.riskLevel || undefined, lifecycleStatus: fields.lifecycleStatus || undefined });
  };

  return (
    <main className="ai-registry">
      <header className="ai-registry-head"><Link href="/observatory/systems" className="ai-back"><ArrowLeft size={16} /> Back to AI systems</Link><span className="ai-kicker">PRIVATE SYSTEM RECORD</span><h1>{system?.name ?? "AI system details"}</h1><p>Private organization and assessment record; not part of the public national register.</p></header>
      {detail.isLoading ? <p role="status" className="ai-empty">Loading system details…</p> : detail.isError ? <p role="alert" className="ai-error">Could not load this system: {detail.error.message}</p> : !system ? <p role="alert" className="ai-empty">This system record is unavailable.</p> : (
        <section className="ai-panel">
          <div className="ai-panel-head"><div><span className="ai-kicker">SYSTEM PROFILE</span><h2>{editing ? "Edit record" : system.name}</h2></div><div className="ai-actions"><button type="button" onClick={() => { setNotice(""); setEditing(value => !value); if (!editing) setFields({ name: system.name, provider: system.provider ?? "", purpose: system.purpose ?? "", decisionImpact: AI_SYSTEM_DECISION_IMPACTS.includes(system.decisionImpact as DecisionImpact) ? system.decisionImpact as DecisionImpact : "", humanOversight: system.humanOversight ?? "", riskLevel: system.riskLevel, lifecycleStatus: system.lifecycleStatus as Lifecycle }); }}>{editing ? "Cancel edit" : "Edit"}</button>{system.lifecycleStatus !== "retired" && <button type="button" className="ai-danger" onClick={() => setConfirmRetire(true)}><Archive size={15} /> Retire</button>}</div></div>
          {notice && <p role="status" className="ai-success">{notice}</p>}
          {editing && fields ? (
            <form className="ai-form" onSubmit={save}>
              <label>Name<input required minLength={2} maxLength={255} value={fields.name} onChange={event => setField("name", event.target.value)} /></label>
              <label>Provider<input maxLength={255} value={fields.provider} onChange={event => setField("provider", event.target.value)} /></label>
              <label>Purpose<textarea maxLength={5000} value={fields.purpose} onChange={event => setField("purpose", event.target.value)} /></label>
              <label>Category / decision impact<select value={fields.decisionImpact} onChange={event => setField("decisionImpact", event.target.value as DecisionImpact | "")}><option value="">Unspecified</option>{impacts.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
              <label>Human oversight<input maxLength={80} value={fields.humanOversight} onChange={event => setField("humanOversight", event.target.value)} /></label>
              <label>Risk level<select value={fields.riskLevel} onChange={event => setField("riskLevel", event.target.value as RiskLevel | "")}><option value="">Unspecified</option>{risks.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
              <label>Lifecycle status<select value={fields.lifecycleStatus} onChange={event => setField("lifecycleStatus", event.target.value as Lifecycle | "")}><option value="">Unspecified</option>{lifecycles.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
              {update.error && <p role="alert" className="ai-error">{update.error.message}</p>}
              <div className="ai-actions"><button type="button" onClick={() => setEditing(false)}>Cancel</button><button className="ai-primary" disabled={update.isPending}><Save size={15} /> {update.isPending ? "Saving…" : "Save changes"}</button></div>
            </form>
          ) : (
            <dl className="ai-details">{[["Provider", system.provider], ["Purpose", system.purpose], ["Category / decision impact", system.decisionImpact ? label(system.decisionImpact) : null], ["Human oversight", system.humanOversight], ["Risk level", label(system.riskLevel)], ["Lifecycle status", label(system.lifecycleStatus)]].map(([key, value]) => <div key={String(key)}><dt>{key}</dt><dd>{value || "Not specified"}</dd></div>)}</dl>
          )}
        </section>
      )}
      {confirmRetire && <div className="ai-modal-backdrop" role="presentation"><section className="ai-modal" role="alertdialog" aria-modal="true" aria-labelledby="retire-title"><h2 id="retire-title">Retire this AI system?</h2><p>This changes its lifecycle status. It does not delete the record.</p>{retire.error && <p role="alert" className="ai-error">{retire.error.message}</p>}<div className="ai-actions"><button type="button" onClick={() => setConfirmRetire(false)}>Cancel</button><button type="button" className="ai-danger" disabled={retire.isPending} onClick={() => retire.mutate({ systemId })}>{retire.isPending ? "Retiring…" : "Confirm retirement"}</button></div></section></div>}
    </main>
  );
}
