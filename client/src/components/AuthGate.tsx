import { ArrowLeft, LogIn, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { startLogin } from "../const";

export default function AuthGate({ children, label = "this workspace" }: { children: React.ReactNode; label?: string }) {
  const me = trpc.auth.me.useQuery();
  if (me.isLoading) return <div className="assessment-shell"><main className="auth-gate-main container"><div className="auth-gate-card"><div className="auth-gate-spinner" /><span>Checking your secure session…</span></div></main></div>;
  if (!me.data) return <div className="assessment-shell"><header className="assessment-header container"><Link href="/" className="assessment-logo"><span className="brand-mark"><span /><span /><span /></span><strong>Bangladesh AI Readiness Assessment</strong></Link></header><main className="auth-gate-main container"><div className="auth-gate-card"><div className="auth-gate-icon"><ShieldCheck size={24} /></div><span className="card-kicker">AUTHENTICATION REQUIRED</span><h1>Sign in to access <em>{label}.</em></h1><p>Your assessment data, evidence and reviewer decisions are private to your account. Continue with secure Bangladesh AI Readiness Assessment login to proceed.</p><button className="button button-dark" onClick={startLogin}>Sign in securely <LogIn size={16} /></button><Link className="back-button" href="/"><ArrowLeft size={15} /> Back to Bangladesh AI Readiness Assessment</Link></div></main></div>;
  return <>{children}</>;
}
