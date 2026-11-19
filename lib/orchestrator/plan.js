import { validateGraph } from "../policy.js";
const supported=new Set(["start","end","agent","tool","approval","condition","parallel","manual","delay","noop"]);
export class GraphError extends Error {constructor(message){super(message);this.name="GraphError";this.status=400}}
/**
 * Compile a workflow to a deterministic topological plan. This is a pure
 * validation/compilation stage, NOT an AI or tool execution engine.
 */
export function compilePlan(graph){
 if(!validateGraph(graph))throw new GraphError("Workflow graph must reference distinct, existing node IDs");
 if(graph.nodes.length<2)throw new GraphError("Workflow needs at least a start and end node");
 const map=new Map(),incoming=new Map(),outgoing=new Map();
 for(const node of graph.nodes){
   if(!node||!supported.has(node.type)||node.id.length>128||!/^[A-Za-z0-9_-]+$/.test(node.id))
     throw new GraphError("Unsupported node type or invalid node ID");
   if(node.config!==undefined && (!node.config||Array.isArray(node.config)||typeof node.config!=="object"))
     throw new GraphError("Node config must be an object");
   map.set(node.id,node);incoming.set(node.id,[]);outgoing.set(node.id,[]);
 }
 for(const edge of graph.edges){
   if(edge.source===edge.target)throw new GraphError("Workflow contains a self-loop");
   incoming.get(edge.target).push(edge.source);
   outgoing.get(edge.source).push(edge.target);
 }
 const starts=graph.nodes.filter(n=>n.type==="start"),ends=graph.nodes.filter(n=>n.type==="end");
 if(starts.length!==1||ends.length<1)throw new GraphError("Exactly one start and at least one end required");
 if(incoming.get(starts[0].id).length)throw new GraphError("Start node cannot have incoming edges");
 for(const end of ends) if(outgoing.get(end.id).length)throw new GraphError("End node cannot have outgoing edges");
 const visited=[],ready=[...map.keys()].filter(id=>!incoming.get(id).length).sort(),counts=new Map([...incoming.entries()].map(([id,a])=>[id,a.length]));
 while(ready.length){
   const id=ready.shift();visited.push(id);
   for(const target of [...outgoing.get(id)].sort()){
     const count=counts.get(target)-1;counts.set(target,count);
     if(count===0){ready.push(target);ready.sort()}
   }
 }
 if(visited.length!==graph.nodes.length)throw new GraphError("Workflow must be acyclic");
 if(visited[0]!==starts[0].id)throw new GraphError("All nodes must be reachable from the start");
 const reachable=new Set([starts[0].id]);
 for(const id of visited){if(!reachable.has(id))continue;for(const next of outgoing.get(id))reachable.add(next)}
 if(reachable.size!==map.size)throw new GraphError("Disconnected nodes are not allowed");
 return {schemaVersion:1,steps:visited.map(id=>({
   id,type:map.get(id).type,dependsOn:[...new Set(incoming.get(id))].sort(),config:map.get(id).config||{}
 }))};
}
