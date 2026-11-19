import { isIP } from "node:net";
import { ApiError } from "./errors.js";
export function bounded(value,label,max=120){
 const s=typeof value==="string"?value.trim():"";
 if(!s||s.length>max)throw new ApiError(400,"Invalid "+label);
 return s;
}
export function optionalText(value,max=2000){
 if(value==null)return "";
 if(typeof value!=="string"||value.length>max)throw new ApiError(400,"Invalid text");
 return value.trim();
}
export function safeRegistryURL(value){
 const str=bounded(value,"endpoint_url",2048);
 let url;try{url=new URL(str)}catch{throw new ApiError(400,"Invalid endpoint URL")}
 const hostname=url.hostname.toLowerCase();
 if(url.protocol!=="https:"||url.port&&url.port!=="443"||url.username||url.password||url.search||url.hash||
  isIP(hostname)||hostname==="localhost"||hostname.endsWith(".localhost")||
  hostname.endsWith(".local")||hostname.endsWith(".internal")||!hostname.includes("."))
   throw new ApiError(400,"Only HTTPS public hostnames without credentials or query strings can be registered");
 // Storing an endpoint is not permission to connect to it. Future egress requires
 // DNS resolution, IP-range validation, redirect blocking, and server allowlisting.
 return url.href;
}
export function routeKey(value){const s=bounded(value,"route_key",64);if(!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(s))throw new ApiError(400,"Invalid route key");return s}
