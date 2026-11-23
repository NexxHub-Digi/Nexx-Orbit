import {createHash,randomBytes} from "node:crypto";
export const INVITE_ROLES=["admin","builder","operator","viewer"];
export const normalizedEmail=v=>{
 const s=typeof v==="string"?v.trim().toLowerCase():"";
 return s.length<=254&&/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(s)?s:null;
};
export const validRole=v=>INVITE_ROLES.includes(v);
export const validToken=v=>typeof v==="string"&&/^[A-Za-z0-9_-]{43}$/.test(v);
export function digestToken(token){
 if(!validToken(token))throw new Error("Invalid invitation token");
 return createHash("sha256").update(token).digest("hex");
}
export function newInvitationToken(){
 const token=randomBytes(32).toString("base64url");
 return {token,hash:digestToken(token)};
}
export function joinUrl(origin,token){
 if(!validToken(token))throw new Error("Invalid invitation token");
 return new URL("/join#invite="+token,origin).toString();
}
