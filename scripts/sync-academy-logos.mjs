// Small, explicit set of public Kivo school emblems used by the academy selector.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder=path.join(root,'assets/ui/academies');
await fs.mkdir(folder,{recursive:true});
const ids=[1,2,3,4,5,6,7,8,9,10,11,14,24];
const sources=[];
for(const id of ids){
  const endpoint='https://api.kivo.wiki/api/v1/data/schools/'+id;
  const response=await fetch(endpoint,{signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error('School '+id+': HTTP '+response.status);
  const {data}=await response.json();
  const url=new URL(data.logo.startsWith('//')?'https:'+data.logo:data.logo);
  if(url.protocol!=='https:' || url.hostname!=='static.kivo.wiki') throw new Error('Unexpected image host');
  const image=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!image.ok) throw new Error('Emblem '+id+': HTTP '+image.status);
  const bytes=Buffer.from(await image.arrayBuffer());
  if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a') throw new Error('Not a PNG: '+id);
  await fs.writeFile(path.join(folder,id+'.png'),bytes);
  sources.push({id,name:data.name_cn||data.name,source:endpoint,image:url.href,file:id+'.png',bytes:bytes.length});
  console.log('Saved',id,data.name,bytes.length);
}
await fs.writeFile(path.join(folder,'sources.json'),JSON.stringify(sources,null,2)+'\n');
