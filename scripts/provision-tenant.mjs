/**
 * CLI-only tenant provisioning; deliberately NOT available as a public endpoint.
 * Use a privileged migration connection in a secure operator environment.
 * Example:
 *   ADMIN_DATABASE_URL=... npm run tenant:provision -- --slug acme --name "Acme" --subject "idp|subject"
 */
import postgres from "postgres";
const args=process.argv.slice(2);
const get=k=>{const i=args.indexOf("--"+k);return i<0?null:args[i+1]};
const slug=get("slug"),name=get("name"),subject=get("subject");
if(!slug||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)||slug.length>70||
 !name||name.length>120||!subject||subject.length>250){
 console.error("Use --slug lowercase-slug --name Organization --subject Verified-OIDC-subject");
 process.exitCode=1;
}else{
 const url=process.env.ADMIN_DATABASE_URL;
 let parsed;
 try{parsed=new URL(url)}catch{}
 if(!parsed||parsed.username!=="orbit_owner"){
  console.error("A separate orbit_owner ADMIN_DATABASE_URL is required; never place it on a public web deployment");
  process.exitCode=1;
 }else{
  const sql=postgres(url,{max:1,ssl:"require"});
  try{
   const record=await sql.begin(async tx=>{
    const rows=await tx.unsafe("INSERT INTO tenants(name,slug) VALUES($1,$2) ON CONFLICT(slug) DO NOTHING RETURNING id,slug",[name,slug]);
    if(!rows.length)throw new Error("Tenant slug already exists; refusing to change existing ownership");
    await tx.unsafe("INSERT INTO tenant_memberships(tenant_id,subject_id,role,status) VALUES($1,$2,'owner','active')",[rows[0].id,subject]);
    return rows[0];
   });
   console.log(JSON.stringify({tenant_id:record.id,slug:record.slug,status:"provisioned"}));
  }catch(e){console.error("Provisioning failed:",e.message);process.exitCode=1}
  finally{await sql.end()}
 }
}
