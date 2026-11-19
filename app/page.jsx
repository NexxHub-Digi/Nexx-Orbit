import Link from "next/link";
const modules=[
 ["01","Organizations","Provision organizations and manage memberships.","Tenant directory"],
 ["02","Workflow Studio","Create, publish and queue deterministic workflow graphs.","API-connected workspace"],
 ["03","Agent Operations","Define AI agents and govern tool execution.","Execution services"],
 ["04","Governance","Isolated tenants, roles and auditable runs.","Tenant isolation"]
];
export default function Home(){
 return <main className="shell">
 <header className="topbar"><div className="brand"><span className="brandIcon">✦</span><strong>NEXX ORBIT</strong><span className="brandMeta">CONTROL PLANE</span></div><Link className="chip" href="/login">Google sign-in</Link></header>
 <section className="hero"><div className="eyebrow">HYBRID AI · MULTI-TENANT SAAS</div><h1>One control plane.<br/><span>Unlimited intelligent operations.</span></h1><p>Build governed AI workflows for every organization, keeping tenant data, identities, agents, executions and budgets separated.</p>
 <div className="actions"><Link className="btn" href="/workspace">Open real workspace ↗</Link><Link className="secondary" href="/demo.html">Explore interactive demo</Link></div>
 <div className="notice"><b>Workspace access requires Google sign-in.</b> The production-style workspace connects to authenticated APIs; external model execution and remote MCP tool calling remain disabled. The standalone prototype uses synthetic demo data.</div></section>
 <section className="modules"><div className="sectionLead"><span>PLATFORM SYSTEMS</span><p>Connected foundations</p></div><div className="grid">{modules.map(([n,h,d,s])=><article className="module" key={n}><div className="moduleTop"><span>{n}</span><span>↗</span></div><h2>{h}</h2><p>{d}</p><div className="moduleFooter">{s}</div></article>)}</div></section>
 <footer>© {new Date().getFullYear()} Nexx Orbit · Governed multi-tenant AI orchestration</footer>
 </main>
}
