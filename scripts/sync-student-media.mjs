/* Download only the public media explicitly linked by this wiki's Kivo IDs.
   Usage: node scripts/sync-student-media.mjs [--index-only] [--student=38] [--reuse-local]
   Raw game files and generated manifests are output, not edited source files. */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'https://api.kivo.wiki/api/v1/data/';
const manifestPath = path.join(root, 'assets/media/catalog.json');
const errors = [];
const tasks = new Map();
const source = await fs.readFile(path.join(root, 'index.html'), 'utf8');
const roster = vm.runInNewContext(source.slice(source.indexOf('const translations ='), source.indexOf('const announceArea =')) + '\ncharacters.map(c=>({id:c.id,name:c.name,kivoId:c.kivoId}));', {}, {timeout:3000});
const selectedId = process.argv.find(arg=>arg.startsWith('--student='))?.split('=')[1];
const selected = selectedId === undefined ? roster : roster.filter(s=>String(s.id)===selectedId);
if(!selected.length) throw new Error('Unknown student ID: '+selectedId);
// Explicit recovery for files downloaded successfully before a failed catalog write.
// Never silently adopt unindexed files during a normal sync.
const reuseLocal = process.argv.includes('--reuse-local');
if(reuseLocal && !selectedId) throw new Error('--reuse-local requires an explicit --student ID');
let previous = {};
try { previous = JSON.parse(await fs.readFile(manifestPath, 'utf8')); } catch {}

function safeURL(input, api = false) {
  const url = new URL(input.startsWith('//') ? 'https:' + input : input);
  if(url.protocol !== 'https:' || url.hostname !== (api ? 'api.kivo.wiki' : 'static.kivo.wiki')) throw new Error('Unexpected public resource host: ' + url.hostname);
  return url.href;
}
async function request(url, options = {}) {
  for(let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {...options, signal:AbortSignal.timeout(180000)});
      if(!response.ok) throw new Error('HTTP ' + response.status + ': ' + url);
      return response;
    } catch(error) {
      if(attempt === 2) throw error;
      await new Promise(resolve=>setTimeout(resolve, 700 * (attempt + 1)));
    }
  }
}
async function api(type, id) {
  const response = await request(safeURL(base + type + '/' + id, true));
  const result = await response.json();
  if(!result.success || !result.data) throw new Error('No public data for ' + type + '/' + id);
  return result.data;
}
function resource(url, folder) {
  if(!url) return null;
  const normalized = safeURL(url);
  const filename = decodeURIComponent(new URL(normalized).pathname.split('/').pop());
  if(!filename || /[\\/:*?"<>|]/.test(filename) || filename === '.' || filename === '..') throw new Error('Unsafe resource filename');
  const local = 'assets/media/' + folder + '/' + filename;
  const absolute = path.resolve(root, local);
  if(!absolute.startsWith(path.join(root, 'assets', 'media') + path.sep)) throw new Error('Resource escaped target');
  const known = tasks.get(local);
  if(known && known.url !== normalized) throw new Error('Resource filename conflict');
  tasks.set(local, known || {url:normalized,path:local,bytes:0,sha256:null,downloaded:false});
  return local;
}
async function mapLimit(items, limit, fn) {
  let cursor = 0;
  await Promise.all(Array.from({length:limit}, async()=>{
    while(cursor < items.length) { const i = cursor++; await fn(items[i], i); }
  }));
}
const spines = new Map(), models = new Map();
const catalog = {schemaVersion:1,updatedAt:new Date().toISOString(),source:'https://kivo.wiki/',students:selectedId ? {...previous.students} : {},files:[],errors};
for(const student of selected) {
  try {
    const data = await api('students', student.kivoId);
    const record = {id:student.id,kivoId:student.kivoId,name:student.name,source:'https://kivo.wiki/student/' + student.kivoId,sourceName:[data.family_name,data.given_name,data.skin ? '('+data.skin+')' : ''].join(' '),portrait:null,lobbyImage:null,spines:[],models:[]};
    record.avatar = resource(data.avatar, 'avatars/' + student.id);
    const portraits = (data.gallery || []).find(group=>/初始立绘/.test(group.title));
    if(portraits?.images?.length) record.portrait = resource(portraits.images.find(url=>/_spr_00\.png$/i.test(url)) || portraits.images[0], 'portraits/' + student.id);
    record.lobbyImage = resource(data.recollection_lobby_image, 'lobbies/' + student.id);
    for(const id of data.spine || []) {
      if(!spines.has(id)) spines.set(id, await api('spines',id));
      const item = spines.get(id);
      if(item.type !== 'home') continue;
      const folder = 'spines/' + id;
      const skel = resource(item.skel_file,folder), atlas = resource(item.atlas_file,folder);
      const images = (item.images || []).map(url=>resource(url,folder));
      record.spines.push({id,name:item.name,type:item.type,remark:item.remark,version:null,skel,atlas,images,files:[skel,atlas,...images].filter(Boolean)});
    }
    for(const id of data.model || []) {
      if(!models.has(id)) models.set(id,await api('models',id));
      const item = models.get(id), folder = 'models/' + id;
      const file = resource(item.model_file,folder), mtl = resource(item.mtl_file,folder);
      const textures = (item.texture || []).map(url=>resource(url,folder));
      record.models.push({id,name:item.name,type:item.type,file,mtl,textures,files:[file,mtl,...textures].filter(Boolean)});
    }
    catalog.students[student.id] = record;
    console.log('INDEX', student.id, student.name, 'models='+record.models.length, 'lobbies='+record.spines.length);
  } catch(error) { errors.push({student:student.id,message:error.message}); console.error(error.message); }
}
const list = [...tasks.values()];
await mapLimit(list, 3, async item=>{
  try {
    const old = previous.files?.find(file=>file.path === item.path && file.url === item.url);
    if(old?.downloaded) {
      const buffer = await fs.readFile(path.join(root,item.path));
      const hash = createHash('sha256').update(buffer).digest('hex');
      if(buffer.length === old.bytes && hash === old.sha256) Object.assign(item,old);
    }
    if(!item.downloaded && !old && reuseLocal) {
      try {
        const buffer=await fs.readFile(path.join(root,item.path));
        if(!buffer.length) throw new Error('Empty local resource');
        if(item.path.endsWith('.glb') && (buffer.toString('ascii',0,4)!=='glTF' || buffer.readUInt32LE(8)!==buffer.length)) throw new Error('Incomplete local GLB');
        Object.assign(item,{bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex'),downloaded:true});
      } catch(error) { if(error.code!=='ENOENT') throw error; }
    }
    if(!item.downloaded) {
      const response = await request(item.url, {method:'HEAD'});
      item.bytes = Number(response.headers.get('content-length')) || 0;
    }
  } catch(error) { errors.push({path:item.path,message:error.message}); }
});
console.log('TOTAL', list.length, 'files;', (list.reduce((sum,f)=>sum+f.bytes,0)/1024/1024).toFixed(1), 'MiB');

if(!process.argv.includes('--index-only')) {
  await mapLimit(list, 2, async(item,index)=>{
    if(item.downloaded) return;
    try {
      const response = await request(item.url);
      const buffer = Buffer.from(await response.arrayBuffer());
      if(!buffer.length) throw new Error('Empty resource');
      const absolute = path.join(root,item.path);
      await fs.mkdir(path.dirname(absolute),{recursive:true});
      await fs.writeFile(absolute,buffer);
      Object.assign(item,{bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex'),downloaded:true});
      // A successful GET supersedes an earlier optional HEAD failure.
      for(let i=errors.length-1;i>=0;i--) if(errors[i].path===item.path) errors.splice(i,1);
      console.log('SAVED',index+1+'/'+list.length,item.path,(buffer.length/1024/1024).toFixed(2)+' MiB');
    } catch(error) { errors.push({path:item.path,message:error.message}); console.error('FAILED',error.message); }
  });
  for(const record of selected.map(s=>catalog.students[s.id]).filter(Boolean)) {
    for(const spine of record.spines) {
      try {
        const bytes = await fs.readFile(path.join(root,spine.skel));
        spine.version = bytes.subarray(0,100).toString('latin1').match(/\b[34]\.\d+\.\d+(?:-beta)?/)?.[0] || null;
      } catch {}
      spine.ready = spine.files.every(file=>tasks.get(file)?.downloaded);
    }
    for(const model of record.models) model.ready = model.files.every(file=>tasks.get(file)?.downloaded);
  }
}
if(errors.length) throw new Error('Download incomplete; previous catalog preserved. '+JSON.stringify(errors));
catalog.files = selectedId ? [...new Map([...(previous.files || []),...list].map(file=>[file.path,file])).values()] : list;
catalog.totalBytes = catalog.files.reduce((sum,file)=>sum+file.bytes,0);
await fs.mkdir(path.dirname(manifestPath),{recursive:true});
await fs.writeFile(manifestPath,JSON.stringify(catalog,null,2)+'\n');
await fs.writeFile(path.join(root,'assets/media/catalog.js'),'// Generated by scripts/sync-student-media.mjs; public resource index.\nwindow.PA_MEDIA_CATALOG = '+JSON.stringify(catalog)+';\n');
console.log('DONE',Object.keys(catalog.students).length,'students;',list.filter(f=>f.downloaded).length,'downloaded;',errors.length,'errors');
if(errors.length) process.exitCode = 1;
