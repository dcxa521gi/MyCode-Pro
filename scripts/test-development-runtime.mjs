import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { WebSocketServer } from "ws";
const require=createRequire(import.meta.url);
const {batchLine,connectRpc}=require("../src-tauri/runtime/development-test.cjs");
assert.equal(batchLine("F:/Tool folder/cli.bat",["auto","--project","F:/Project folder"]),'""F:/Tool folder/cli.bat" "auto" "--project" "F:/Project folder""');
for(const value of ['bad&command','bad"argument','bad\nargument'])assert.throws(()=>batchLine("cli.bat",[value]));
const server=new WebSocketServer({host:"127.0.0.1",port:0});
await new Promise(resolve=>server.once("listening",resolve));
server.on("connection",socket=>socket.on("message",data=>{const value=JSON.parse(data);if(value.method==="fail")socket.send(JSON.stringify({id:value.id,error:{message:"Permission denied"}}));else if(value.method==="close")socket.close();else{socket.send(JSON.stringify({method:"App.exceptionThrown",params:{message:"sample"}}));socket.send(JSON.stringify({id:value.id,result:{path:"pages/index/index"}}));}}));
try{const rpc=await connectRpc(server.address().port);assert.deepEqual(await rpc.call("App.getCurrentPage"),{path:"pages/index/index"});assert.equal(rpc.exceptions.length,1);await assert.rejects(rpc.call("fail"),/Permission denied/);await assert.rejects(rpc.call("close"),/connection closed/);rpc.close();console.log("Developer automation transport: response, rejection, runtime exception and teardown checks passed.");}finally{await new Promise(resolve=>server.close(resolve));}
