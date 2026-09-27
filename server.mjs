import http from 'node:http';
import { handler } from './server-core.mjs';
const port = Number(process.env.PORT || process.env.MEDIA_AI_PORT || 3777);
http.createServer((req,res)=>handler(req,res)).listen(port,'0.0.0.0',()=>console.log(`Media AI Independent running at http://127.0.0.1:${port}`));
