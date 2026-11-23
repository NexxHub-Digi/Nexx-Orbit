import Link from "next/link";
import {authOrigin} from "../../lib/server/session.js";
export const metadata={title:"Sign in | Nexx Orbit"};
export const dynamic="force-dynamic";
export default async function Login({searchParams}){
 const q=await searchParams;
 const error=q?.error;
 let oauthConfigured=false;
 try{authOrigin();oauthConfigured=!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.AUTH_SESSION_SECRET&&Buffer.byteLength(process.env.AUTH_SESSION_SECRET)>=32)}catch{}
 return <main className="loginScreen">
  <div className="loginPanel">
   <Link className="brand" href="/"><span className="brandIcon">✦</span><strong>NEXX ORBIT</strong></Link>
   <div className="loginSymbol">✳</div>
   <div className="eyebrow">WELCOME TO YOUR CONTROL PLANE</div>
   <h1>Intelligent operations.<br/><span>Under your control.</span></h1>
   <p>Sign in securely to provision your organization, manage AI agents, build workflows and supervise executions.</p>
   {error&&<div className="authError" role="alert">Google sign-in could not be completed ({String(error).slice(0,50)}). Check OAuth setup or try again.</div>}
   {oauthConfigured?<a className="googleSignIn" href="/api/auth/google">
    <span className="googleMark">G</span><span>Continue with Google</span><span aria-hidden="true">→</span>
   </a>:<div className="authSetupPending" role="status"><strong>Google sign-in is awaiting configuration.</strong><p>OAuth credentials and the authorized application origin must be set before real accounts can sign in. Explore the interactive demo in the meantime.</p></div>}
   <div className="loginFoot">Google OpenID Connect · Secure HttpOnly session · Tenant-scoped access</div>
   <Link href="/demo.html" className="demoLink">Explore the sandbox prototype instead</Link>
  </div>
  <div className="loginAside"><div className="stars">✦ ✳ ⟡</div><h2>From intent<br/>to execution.</h2><p>One workspace for the people, agents, tools, decisions and workflows powering your organization.</p><div className="asideCard"><div>CONTROL SYSTEMS</div><strong>AI Agents · Model Routing · MCP Tools</strong><small>Governed by organization-level permissions and audit-ready execution states.</small></div></div>
 </main>
}
