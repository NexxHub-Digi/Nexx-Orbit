"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
export default function Join(){
 const [token,setToken]=useState(""),[user,setUser]=useState(null),[busy,setBusy]=useState(false);
 const [checking,setChecking]=useState(true),[error,setError]=useState(""),[membership,setMembership]=useState(null);
 const checkSession=async()=>{
  try{
   const response=await fetch("/api/auth/session",{cache:"no-store",credentials:"same-origin"});
   const data=await response.json();setUser(data.authenticated?data.user:null);
  }catch{setError("Unable to check your Google session")}finally{setChecking(false)}
 };
 useEffect(()=>{
  const hash=new URLSearchParams(window.location.hash.replace(/^#/,""));
  setToken(hash.get("invite")||"");
  if(window.location.hash)window.history.replaceState(null,"",window.location.pathname);
  checkSession();
 },[]);
 const accept=async()=>{
  setError("");setBusy(true);
  try{
   const response=await fetch("/api/v1/invitations/accept",{method:"POST",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({token}),
    cache:"no-store",credentials:"same-origin"});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Unable to accept invitation");
   setMembership(result.membership);setToken("");
  }catch(e){setError(e.message)}finally{setBusy(false)}
 };
 return <main className="orbitJoinScreen"><section className="orbitJoinPanel">
  <Link href="/" className="orbitBrand"><span>✦</span><div><strong>NEXX ORBIT</strong><small>VERIFIED TEAM ONBOARDING</small></div></Link>
  <div className="eyebrow">PRIVATE ORGANIZATION INVITATION</div><h1>Join your team.</h1>
  {checking?<p>Verifying session…</p>:membership?
   <><p>You joined <strong>{membership.organization}</strong> as <strong>{membership.joined_role}</strong>.</p><Link className="orbitPrimary" href="/workspace">Open your workspace</Link></>
   :!token?<><p>There is no valid invitation token in this link. Request a fresh private link from an organization administrator.</p><Link href="/workspace">Open workspace</Link></>
   :!user?<><p>Sign in as the exact Google email address the invitation was sent to. Open login in a new tab and return here.</p><a href="/login" target="_blank" rel="noopener noreferrer" className="orbitPrimary">Sign in with Google</a><button type="button" className="orbitSoftButton" onClick={checkSession}>I've signed in</button></>
   :<><p>Signed in as <strong>{user.email}</strong>. Only the invited verified account can accept.</p><button className="orbitPrimary" disabled={busy} onClick={accept}>{busy?"Verifying invitation…":"Accept invitation"}</button></>}
  {error&&<div role="alert" className="authError">{error}</div>}
  <p className="orbitJoinNote">Single-use invitation · 72-hour expiration · No phone number required</p>
 </section></main>
}
