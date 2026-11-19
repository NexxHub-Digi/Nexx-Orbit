import Link from "next/link";
const modules=[
  ["01","Organizations","Provision organizations and assign scoped memberships.","Tenant directory"],
  ["02","Workflow Studio","Compose and publish versioned execution graphs.","Visual builder"],
  ["03","Agent Operations","Supervise model calls, tools and human decisions.","Execution engine planned"],
  ["04","Governance","RLS-backed resource boundaries and action-level policy.","Tenant isolation"]
];
export default function Home(){
  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="brandIcon">✦</span><strong>NEXX ORBIT</strong><span className="brandMeta">CONTROL PLANE</span></div><span className="chip">Foundation v0.2</span></header>
    <section className="hero"><div className="eyebrow">HYBRID AI · MULTI-TENANT SAAS</div><h1>One control plane.<br/><span>Unlimited intelligent operations.</span></h1><p>Build governed AI workflows for every organization, while keeping tenant data, identities, agents, executions and budgets separated.</p>
    <div className="actions"><Link className="btn" href="/demo.html">Open interactive workspace <span aria-hidden="true">↗</span></Link><a className="secondary" href="https://github.com/NexxHub-Digi/Nexx-Orbit" rel="noopener noreferrer" target="_blank">View GitHub repository</a></div>
    <div className="notice"><b>Demo notice:</b> Workspace interactions in the original prototype use synthetic data. Real APIs require a trusted OIDC token and active database membership. They are not connected to this demo yet.</div></section>
    <section className="modules"><div className="sectionLead"><span>PLATFORM SYSTEMS</span><p>Foundation areas</p></div><div className="grid">{modules.map(([n,h,d,s])=><article className="module" key={n}><div className="moduleTop"><span>{n}</span><span>↗</span></div><h2>{h}</h2><p>{d}</p><div className="moduleFooter">{s}</div></article>)}</div></section>
    <footer>© {new Date().getFullYear()} Nexx Orbit · Multi-tenant AI orchestration foundation</footer>
  </main>;
}
