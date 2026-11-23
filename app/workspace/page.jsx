"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
const tabs=[
 ["overview","Overview","◈"],["workflows","Workflows","◇"],["runs","Executions","◎"],
 ["agents","Agents","✳"],["mcp","MCP Tools","⊞"],["models","Model Routes","⌘"],["settings","Organization","⚙"]
];
const api=async(path,init={})=>{
 const response=await fetch(path,{credentials:"same-origin",cache:"no-store",...init,
  headers:{"Content-Type":"application/json",...(init.headers||{})}});
 let body={};try{body=await response.json()}catch{}
 if(!response.ok)throw new Error(body.error||"Request failed ("+response.status+")");
 return body;
};
function Pill({value}){return <span className={"orbitStatus orbitStatus-"+String(value||"draft").replace(/[^a-z_]/g,"")}>{value||"draft"}</span>}
function Empty({title,description}){return <div className="orbitEmpty"><div>✦</div><strong>{title}</strong><p>{description}</p></div>}
function SectionTitle({title,subtitle,action}){return <div className="orbitSectionTitle"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>}
function formatDate(v){return v?new Date(v).toLocaleString():"—"}
const canWrite=r=>["owner","admin","builder"].includes(r);
const canRun=r=>["owner","admin","builder","operator"].includes(r);
export default function Workspace(){
 const [session,setSession]=useState(null),[tenants,setTenants]=useState([]),[tenantId,setTenantId]=useState("");
 const [tab,setTab]=useState("overview"),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(null);
 const [data,setData]=useState({workflows:[],runs:[],agents:[],connections:[],routes:[]}),[approvals,setApprovals]=useState([]);
 const [org,setOrg]=useState({name:"",slug:""}),[workflow,setWorkflow]=useState({name:"",description:"",template:"deterministic"});
 const [agent,setAgent]=useState({name:"",description:"",instructions:""}),[conn,setConn]=useState({name:"",endpoint_url:""});
 const [model,setModel]=useState({route_key:"primary",provider:"groq",model_id:""});
 const [inviteEmail,setInviteEmail]=useState(""),[inviteRole,setInviteRole]=useState("viewer");
 const [invites,setInvites]=useState([]),[lastInvite,setLastInvite]=useState("");
 const tenant=useMemo(()=>tenants.find(x=>x.id===tenantId),[tenantId,tenants]);
 const role=tenant?.role||"viewer";
 const notify=(text,type="success")=>setMessage({text,type});
 const loadTenants=useCallback(async()=>{
  const result=await api("/api/v1/tenants");
  setTenants(result.tenants||[]);
  setTenantId(old=>(result.tenants||[]).some(t=>t.id===old)?old:result.tenants?.[0]?.id||"");
 },[]);
 useEffect(()=>{
  let active=true;
  api("/api/auth/session").then(async result=>{
   if(!active)return;
   if(!result.authenticated){window.location.replace("/login");return}
   setSession(result.user);
   await loadTenants();
  }).catch(e=>{if(active)notify(e.message,"error")}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false}
 },[loadTenants]);
 const reload=useCallback(async(id=tenantId)=>{
  if(!id){setData({workflows:[],runs:[],agents:[],connections:[],routes:[]});setApprovals([]);return}
  try{
   const params="?tenant_id="+encodeURIComponent(id);
   const paths=["workflows","runs","agents","mcp-connections","model-routes"];
   const responses=await Promise.all(paths.map(p=>api("/api/v1/"+p+params)));
   const all={workflows:responses[0].workflows||[],runs:responses[1].runs||[],agents:responses[2].agents||[],connections:responses[3].connections||[],routes:responses[4].routes||[]};
   setData(all);
   const pending=all.runs.filter(x=>x.status==="waiting_approval").slice(0,20);
   const statuses=await Promise.all(pending.map(async r=>{
    try{const result=await api("/api/v1/runs/"+r.id+"/steps"+params);
      return (result.steps||[]).filter(x=>x.status==="pending_approval").map(x=>({...x,run_id:r.id}));}
    catch{return []}
   }));
   setApprovals(statuses.flat());
  }catch(e){notify(e.message,"error")}
 },[tenantId]);
 useEffect(()=>{if(tenantId)reload(tenantId)},[tenantId,reload]);
 useEffect(()=>{if(!tenantId)return;const id=setInterval(()=>reload(tenantId),15000);return()=>clearInterval(id)},[tenantId,reload]);
 const submit=async(work)=>{
  setBusy(true);setMessage(null);
  try{const result=await work();await reload();return result}
  catch(e){notify(e.message,"error");return null}
  finally{setBusy(false)}
 };
 const createTenant=async(e)=>{
  e.preventDefault();setBusy(true);setMessage(null);
  try{
   const result=await api("/api/v1/tenants",{method:"POST",body:JSON.stringify(org)});
   setOrg({name:"",slug:""});await loadTenants();setTenantId(result.tenant.tenant_id);
   notify("Organization created. Its data is isolated from other tenants.");setTab("overview");
  }catch(e){notify(e.message,"error")}finally{setBusy(false)}
 };
 const createWorkflow=e=>{e.preventDefault();submit(async()=>{
  const middle=workflow.template==="approval"?{id:"review",type:"approval"}:{id:"work",type:"noop"};
  const graph={nodes:[{id:"start",type:"start"},middle,{id:"finish",type:"end"}],
   edges:[{source:"start",target:middle.id},{source:middle.id,target:"finish"}]};
  await api("/api/v1/workflows",{method:"POST",body:JSON.stringify({tenant_id:tenantId,name:workflow.name,description:workflow.description,graph})});
  setWorkflow({name:"",description:"",template:"deterministic"});
  notify("Draft saved to this organization. Publish it before running.");
 })};
 const publish=workflowId=>submit(async()=>{
  await api("/api/v1/workflows/"+workflowId+"/publish?tenant_id="+encodeURIComponent(tenantId),{method:"POST"});
  notify("Workflow published and ready for execution.");
 });
 const startRun=workflowId=>submit(async()=>{
  const key="orbit-"+crypto.randomUUID();
  await api("/api/v1/runs",{method:"POST",headers:{"Idempotency-Key":key},body:JSON.stringify({tenant_id:tenantId,workflow_id:workflowId})});
  notify("Run queued. A connected worker must process it.");
 });
 const decide=(runId,stepId,decision)=>submit(async()=>{
  await api("/api/v1/runs/"+runId+"/approvals/"+encodeURIComponent(stepId),{method:"POST",body:JSON.stringify({tenant_id:tenantId,decision})});
  notify("Decision recorded; the worker will resume this run.");
 });
 const createAgent=e=>{e.preventDefault();submit(async()=>{
  await api("/api/v1/agents",{method:"POST",body:JSON.stringify({tenant_id:tenantId,...agent})});
  setAgent({name:"",description:"",instructions:""});notify("Agent definition saved as draft.");
 })};
 const createConnection=e=>{e.preventDefault();submit(async()=>{
  await api("/api/v1/mcp-connections",{method:"POST",body:JSON.stringify({tenant_id:tenantId,...conn})});
  setConn({name:"",endpoint_url:""});notify("MCP endpoint registered but disabled until reviewed.");
 })};
 const createRoute=e=>{e.preventDefault();submit(async()=>{
  await api("/api/v1/model-routes",{method:"POST",body:JSON.stringify({tenant_id:tenantId,...model})});
  setModel({route_key:"primary",provider:"groq",model_id:""});notify("Model route registered but disabled pending credentials.");
 })};
 const loadInvites=async(id=tenantId)=>{
  if(!id||!["owner","admin"].includes(tenant?.role)){setInvites([]);return}
  try{
   const res=await api("/api/v1/tenants/"+id+"/invitations");
   setInvites(res.invitations||[]);
  }catch(e){notify(e.message,"error")}
 };
 const createInvite=async(e)=>{
  e.preventDefault();setBusy(true);setMessage(null);
  try{
   const result=await api("/api/v1/tenants/"+tenantId+"/invitations",{method:"POST",body:JSON.stringify({email:inviteEmail,role:inviteRole})});
   setLastInvite(result.join_url);setInviteEmail("");
   await loadInvites(tenantId);
   notify("Invitation created. Copy the one-time link now; it will not be displayed again.");
  }catch(e){notify(e.message,"error")}finally{setBusy(false)}
 };
 const revokeInvite=async(id)=>{
  setBusy(true);setMessage(null);
  try{
   await api("/api/v1/tenants/"+tenantId+"/invitations/"+id,{method:"DELETE"});
   await loadInvites(tenantId);notify("Invitation revoked");
  }catch(e){notify(e.message,"error")}finally{setBusy(false)}
 };
 const copyInvite=async()=>{
  try{await navigator.clipboard.writeText(lastInvite);notify("Private link copied")}
  catch{notify("Select the invitation URL and copy it manually","error")}
 };
 useEffect(()=>{setLastInvite("");setInvites([])},[tenantId]);
 useEffect(()=>{
  if(tab==="settings"&&tenantId&&["owner","admin"].includes(tenant?.role))loadInvites(tenantId);
 },[tab,tenantId,tenant?.role]);
 const logout=async()=>{try{await api("/api/auth/logout",{method:"POST"});window.location.replace("/login")}catch(e){notify(e.message,"error")}};
 if(loading)return <main className="orbitLoading">✦ <span>Loading Nexx Orbit…</span></main>;
 if(!session)return <main className="orbitLoading">Authentication required. <Link href="/login">Sign in</Link></main>;
 return <div className="orbitApp">
  <aside className="orbitSidebar">
   <Link href="/" className="orbitBrand"><span>✦</span><div><strong>NEXX ORBIT</strong><small>INTELLIGENCE CONTROL</small></div></Link>
   <div className="orbitSideLabel">ORGANIZATION</div>
   <select aria-label="Current organization" className="orbitTenantSelect" value={tenantId} onChange={e=>setTenantId(e.target.value)}>
    {!tenantId&&<option value="">No organization</option>}
    {tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
   </select>
   <nav aria-label="Workspace navigation">{tabs.map(([key,label,icon])=><button key={key} type="button" className={tab===key?"orbitNav active":"orbitNav"} onClick={()=>setTab(key)}><span>{icon}</span>{label}</button>)}</nav>
   <div className="orbitSideBottom"><a href="/demo.html">↗ Explore UI demo</a><div className="orbitAccount"><span className="orbitAvatar">{(session.name||session.email||"U").slice(0,1).toUpperCase()}</span><div><strong>{session.name||"Google account"}</strong><small>{session.email||"Verified account"}</small></div></div><button type="button" onClick={logout} className="orbitLogout">Sign out ↗</button></div>
  </aside>
  <main className="orbitContent">
   <header className="orbitTop"><div><small>ORGANIZATION WORKSPACE</small><h1>{tenant?.name||"Set up your organization"}</h1></div><div className="orbitTopActions"><span className="orbitRole">{tenant?role:"No membership"}</span><button type="button" className="orbitSoftButton" disabled={!tenantId||busy} onClick={()=>reload()}>↻ Refresh</button></div></header>
   {message&&<div role="status" className={"orbitNotice "+(message.type==="error"?"err":"")}><span>{message.text}</span><button onClick={()=>setMessage(null)} type="button" aria-label="Dismiss notification">×</button></div>}
   {!tenant&&<section className="orbitIntro"><h2>Create your first organization</h2><p>A tenant is a private operational boundary for members, agents, workflows, integrations and usage. You become its initial owner.</p><form onSubmit={createTenant} className="orbitForm"><label>Organization name<input required minLength={2} maxLength={120} value={org.name} onChange={e=>setOrg({...org,name:e.target.value})} placeholder="e.g. Nexx Innovation Lab"/></label><label>Workspace URL slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={org.slug} onChange={e=>setOrg({...org,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")})} placeholder="nexx-innovation-lab"/></label><button disabled={busy} className="orbitPrimary">Create organization</button></form></section>}
   {tenant&&<>
    {tab==="overview"&&<>
     <div className="orbitHeading"><div><span className="orbitEyebrow">MISSION CONTROL</span><h2>Operational overview</h2><p>Live records scoped to <b>{tenant.name}</b>. Changes are stored in your organization database.</p></div><span className="orbitLive">● API CONNECTED</span></div>
     <div className="orbitStats">
      {[["Workflows",data.workflows.length,"◇"],["Active runs",data.runs.filter(x=>["queued","running","waiting_approval"].includes(x.status)).length,"◎"],["Agents",data.agents.length,"✳"],["Pending approvals",approvals.length,"⧗"]].map(([label,value,icon])=><article key={label}><div>{icon}</div><strong>{value}</strong><span>{label}</span></article>)}
     </div>
     <div className="orbitTwo"><section className="orbitPanel"><SectionTitle title="Recent executions" subtitle="Refreshes automatically every 15 seconds" action={<button className="orbitTextButton" onClick={()=>setTab("runs")}>View all</button>}/>{data.runs.length?data.runs.slice(0,5).map(r=><div className="orbitListRow" key={r.id}><span className="orbitDot">◎</span><div><strong>{data.workflows.find(w=>w.id===r.workflow_id)?.name||"Workflow execution"}</strong><small>{formatDate(r.created_at)}</small></div><Pill value={r.status}/></div>):<Empty title="No runs yet" description="Create and publish a workflow, then start an execution."/>}</section>
     <section className="orbitPanel"><SectionTitle title="Infrastructure readiness" subtitle="Connected foundation and intentionally gated capabilities"/><div className="orbitCheck"><span>✓</span><div>Tenant data access<small>Verified through database memberships and row security</small></div></div><div className="orbitCheck"><span>✓</span><div>Workflow API<small>Drafts, publishing, run queue and approvals</small></div></div><div className="orbitCheck pending"><span>○</span><div>External AI & MCP execution<small>Disabled until approved adapters and secrets are configured</small></div></div><div className="orbitCheck pending"><span>○</span><div>Automated worker hosting<small>Requires a continuously running external worker service</small></div></div></section></div>
    </>}
    {tab==="workflows"&&<><SectionTitle title="Workflow Studio" subtitle="Create governed workflow drafts, publish immutable execution plans, and queue runs."/><div className="orbitTwo"><section className="orbitPanel"><h3>New workflow</h3><p className="orbitSub">Start with a deterministic or human-approval template.</p>{canWrite(role)?<form className="orbitForm" onSubmit={createWorkflow}><label>Workflow name<input required maxLength={120} value={workflow.name} onChange={e=>setWorkflow({...workflow,name:e.target.value})} placeholder="Daily insight pipeline"/></label><label>Description<input value={workflow.description} onChange={e=>setWorkflow({...workflow,description:e.target.value})} placeholder="What should this automation do?"/></label><label>Graph template<select value={workflow.template} onChange={e=>setWorkflow({...workflow,template:e.target.value})}><option value="deterministic">Start → No-op → End</option><option value="approval">Start → Human Approval → End</option></select></label><button className="orbitPrimary" disabled={busy}>Create draft</button></form>:<p className="orbitSub">Your role cannot create workflows.</p>}</section><section className="orbitPanel"><h3>Workflow lifecycle</h3><div className="orbitTimeline"><p><b>1.</b> Create a draft with versioned graph definition</p><p><b>2.</b> Publish after graph validation</p><p><b>3.</b> Queue a run with an idempotency key</p><p><b>4.</b> Worker checkpoints each step and pauses for approvals</p></div><div className="orbitHint">Full visual graph editing is still in the standalone UI prototype. These actions connect to the real backend.</div></section></div><section className="orbitPanel orbitListPanel"><h3>Organization workflows</h3>{data.workflows.length?data.workflows.map(w=><div key={w.id} className="orbitResource"><div><strong>{w.name}</strong><p>{w.description||"No description"} · v{w.version}</p><small>Created {formatDate(w.created_at)}</small></div><div className="orbitResourceActions"><Pill value={w.status}/>{w.status==="draft"&&canWrite(role)&&<button disabled={busy} className="orbitSoftButton" onClick={()=>publish(w.id)}>Publish</button>}{w.status==="published"&&canRun(role)&&<button disabled={busy} className="orbitPrimary small" onClick={()=>startRun(w.id)}>Run now</button>}</div></div>):<Empty title="No workflow definitions" description="Create the first graph for this organization."/>}</section></>}
    {tab==="runs"&&<><SectionTitle title="Execution Monitor" subtitle="View queued, running, waiting and completed executions."/>{approvals.length>0&&<section className="orbitPanel orbitApprovalPanel"><h3>Action needed · Human approval</h3>{approvals.map(s=><div className="orbitResource" key={s.run_id+":"+s.step_id}><div><strong>Approval requested: {s.step_id}</strong><p>Run {s.run_id.slice(0,8)} · tenant-scoped decision</p></div><div className="orbitResourceActions">{["approved","rejected"].map(d=><button key={d} disabled={busy||!["owner","admin"].includes(role)} onClick={()=>decide(s.run_id,s.step_id,d)} className={d==="approved"?"orbitPrimary small":"orbitSoftButton"}>{d==="approved"?"Approve":"Reject"}</button>)}</div></div>)}</section>}<section className="orbitPanel">{data.runs.length?data.runs.map(r=><div className="orbitResource" key={r.id}><div><strong>{data.workflows.find(w=>w.id===r.workflow_id)?.name||"Workflow run"}</strong><p>Run ID: {r.id} · revision {r.workflow_version}</p><small>{formatDate(r.created_at)}</small></div><Pill value={r.status}/></div>):<Empty title="No execution history" description="Published workflows can be queued from Workflow Studio."/>}</section></>}
    {tab==="agents"&&<><SectionTitle title="Agent Studio" subtitle="Define tenant-owned agents and their default model routes."/>{canWrite(role)&&<section className="orbitPanel"><form className="orbitForm orbitFormColumns" onSubmit={createAgent}><label>Agent name<input required maxLength={120} value={agent.name} onChange={e=>setAgent({...agent,name:e.target.value})} placeholder="Research strategist"/></label><label>Purpose<input value={agent.description} onChange={e=>setAgent({...agent,description:e.target.value})} placeholder="Research planning and synthesis"/></label><label className="spanFull">Instructions<textarea rows={3} value={agent.instructions} onChange={e=>setAgent({...agent,instructions:e.target.value})} placeholder="Describe scope, safety, reasoning and allowed tools."/></label><button className="orbitPrimary" disabled={busy}>Save draft agent</button></form></section>}<section className="orbitPanel">{data.agents.length?data.agents.map(a=><div className="orbitResource" key={a.id}><div><strong>{a.name}</strong><p>{a.description||"Agent definition"} · model: {a.model_route}</p></div><Pill value={a.status}/></div>):<Empty title="No AI agents registered" description="Agent definitions start in draft and do not make external model calls."/>}</section></>}
    {tab==="mcp"&&<><SectionTitle title="MCP Integration Hub" subtitle="Register remote tool endpoints. Execution remains disabled until reviewed."/><div className="orbitTwo"><section className="orbitPanel"><h3>Register MCP endpoint</h3>{canWrite(role)?<form className="orbitForm" onSubmit={createConnection}><label>Connection name<input value={conn.name} required onChange={e=>setConn({...conn,name:e.target.value})} placeholder="Research tool server"/></label><label>HTTPS endpoint<input value={conn.endpoint_url} required type="url" onChange={e=>setConn({...conn,endpoint_url:e.target.value})} placeholder="https://mcp.example.com/mcp"/></label><button className="orbitPrimary" disabled={busy}>Register disabled connection</button></form>:<p className="orbitSub">Read-only access</p>}</section><section className="orbitPanel"><h3>Secure integration policy</h3><p className="orbitSub">Endpoints are stored without executing requests or injecting API keys. Outbound MCP calls require credential vault, explicit tool grants, SSRF protection and operational approval.</p><span className="orbitMutedFlag">Execution locked by design</span></section></div><section className="orbitPanel">{data.connections.length?data.connections.map(c=><div className="orbitResource" key={c.id}><div><strong>{c.name}</strong><p>{c.endpoint_url}</p></div><Pill value={c.status}/></div>):<Empty title="No MCP connections" description="Register tools for this tenant when ready."/>}</section></>}
    {tab==="models"&&<><SectionTitle title="AI Model Gateway" subtitle="Prepare provider and model routes. No secrets are stored in this form."/>{["owner","admin"].includes(role)&&<section className="orbitPanel"><form className="orbitForm orbitFormColumns" onSubmit={createRoute}><label>Route key<input required value={model.route_key} onChange={e=>setModel({...model,route_key:e.target.value})} placeholder="primary"/></label><label>Provider<select value={model.provider} onChange={e=>setModel({...model,provider:e.target.value})}>{["openai","anthropic","gemini","groq","deepseek","qwen","huggingface","custom"].map(x=><option key={x} value={x}>{x}</option>)}</select></label><label className="spanFull">Model ID<input required value={model.model_id} onChange={e=>setModel({...model,model_id:e.target.value})} placeholder="Provider-specific model ID"/></label><button className="orbitPrimary" disabled={busy}>Register model route</button></form></section>}<section className="orbitPanel">{data.routes.length?data.routes.map(m=><div className="orbitResource" key={m.id}><div><strong>{m.route_key}</strong><p>{m.provider} / {m.model_id}</p></div><Pill value={m.status}/></div>):<Empty title="No model routes" description="Register your first provider route. All routes remain disabled until configured."/>}</section></>}
    {tab==="settings"&&<><SectionTitle title="Organization settings" subtitle="Membership is enforced server-side; switching organizations never grants permissions."/><section className="orbitPanel"><h3>Current tenant</h3><div className="orbitSettingsGrid"><div><small>Organization</small><strong>{tenant.name}</strong></div><div><small>Slug</small><strong>{tenant.slug}</strong></div><div><small>Your role</small><strong>{tenant.role}</strong></div><div><small>Plan</small><strong>{tenant.plan}</strong></div></div></section>{["owner","admin"].includes(role)&&<section className="orbitPanel">
  <h3>Team invitations</h3>
  <p className="orbitSub">Invite a verified Google account into this organization. The private link expires after 72 hours and can only be used once.</p>
  <form className="orbitForm orbitFormColumns" onSubmit={createInvite}>
   <label>Invitee email<input required type="email" maxLength={254} value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="colleague@example.com"/></label>
   <label>Assigned role<select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>
    <option value="viewer">Viewer — read only</option>
    <option value="operator">Operator — execute workflows</option>
    <option value="builder">Builder — create workflows</option>
    <option value="admin">Admin — manage members and settings</option>
   </select></label>
   <button type="submit" className="orbitPrimary" disabled={busy}>Create invitation</button>
  </form>
  {lastInvite&&<div className="orbitInviteBox"><label>Copy the private invitation link now<input aria-label="Invitation URL" readOnly value={lastInvite} onFocus={e=>e.target.select()}/></label><button type="button" className="orbitSoftButton" onClick={copyInvite}>Copy link</button><button type="button" className="orbitSoftButton" onClick={()=>setLastInvite("")}>Dismiss</button></div>}
  <h3 className="orbitInviteHeading">Invitation history</h3>
  {invites.length?invites.map(i=><div className="orbitResource" key={i.invitation_id}><div><strong>{i.invited_email}</strong><p>{i.invited_role} · expires {formatDate(i.expires_on)}</p></div><div className="orbitResourceActions"><Pill value={i.invite_status}/>{i.invite_status==="pending"&&<button disabled={busy} className="orbitSoftButton" type="button" onClick={()=>revokeInvite(i.invitation_id)}>Revoke</button>}</div></div>):<p className="orbitSub">No invitations for this organization.</p>}
 </section>}
 <section className="orbitPanel"><h3>Create an additional organization</h3><p className="orbitSub">Your Google identity can own up to three organizations.</p><form className="orbitForm orbitFormColumns" onSubmit={createTenant}><label>Name<input required value={org.name} onChange={e=>setOrg({...org,name:e.target.value})} placeholder="New company name"/></label><label>Slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={org.slug} onChange={e=>setOrg({...org,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")})} placeholder="new-company"/></label><button className="orbitPrimary" disabled={busy}>Create new tenant</button></form></section></>}
   </>}
  </main>
 </div>
}
