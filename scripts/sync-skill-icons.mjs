/* Fetch the public skill metadata for this site's exact student/costume IDs.
   Generated snapshots and downloaded images are outputs, never source edits. */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.join(root,'assets/ui/skill-icons');
const html=await fs.readFile(path.join(root,'index.html'),'utf8');
const roster=vm.runInNewContext(html.slice(html.indexOf('const translations ='),html.indexOf('const announceArea ='))+'\ncharacters.map(c=>({id:c.id,kivoId:c.kivoId,name:c.name,skills:c.skills}));',{}, {timeout:3000});
const selectedId=process.argv.find(arg=>arg.startsWith('--student='))?.split('=')[1];
const selected=selectedId===undefined?roster:roster.filter(s=>String(s.id)===selectedId);
if(!selected.length)throw new Error('Unknown student ID: '+selectedId);
async function request(url) {
  for(let attempt=0;attempt<3;attempt++) {
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw new Error(`HTTP ${response.status}: ${url}`);
      return response;
    } catch(error) { if(attempt===2)throw error; }
  }
}
if(process.argv.includes('--index-only')) {
  const prior=selectedId?JSON.parse(await fs.readFile(path.join(directory,'kivo-skills.json'),'utf8')):null;
  const students={...prior?.students};let cursor=0;
  await Promise.all(Array.from({length:2},async()=>{
    while(cursor<selected.length) {
      const student=selected[cursor++],url=`https://api.kivo.wiki/api/v1/data/students/${student.kivoId}`;
      const result=await (await request(url)).json();
      if(!result.success||result.data.id!==student.kivoId)throw new Error('Student mismatch: '+student.id);
      const data=result.data,variants=Array.isArray(data.character_datas)?data.character_datas:[data.character_datas].filter(Boolean);
      const record={id:student.id,kivoId:student.kivoId,name:student.name,source:`https://kivo.wiki/data/character/${student.kivoId}`,api:url,sourceName:[data.family_name,data.given_name,data.skin].filter(Boolean).join(' '),variants:[]};
      for(const [variantIndex,variant] of variants.entries()) {
        const skills=[];
        function append(group,items) {
          for(const [index,skill] of (items||[]).entries()) {
            skills.push({key:`${variantIndex}/${group}/${index}`,title:skill.title,titleCn:skill.title_cn||'',icon:skill.icon||null,effect:skill.info?.at(-1)?.describe||''});
            if(skill.derived_skills?.length)append(group+'/'+index+'/derived',skill.derived_skills);
          }
        }
        for(const [group,items] of Object.entries(variant.skill||{}))append(group,items);
        record.variants.push({style:variant.combat_style,skills});
      }
      students[student.id]=record;
      console.log(student.id,record.sourceName,record.variants.map(v=>v.skills.map(s=>s.key+':'+s.title+(s.titleCn?' / '+s.titleCn:'')).join(' | ')).join(' || ')||'NO SKILL DATA');
    }
  }));
  await fs.mkdir(directory,{recursive:true});
  await fs.writeFile(path.join(directory,'kivo-skills.json'),JSON.stringify({fetchedAt:new Date().toISOString(),students},null,2)+'\n');
} else {
  const source=JSON.parse(await fs.readFile(path.join(directory,'kivo-skills.json'),'utf8'));
  const mapping=JSON.parse(await fs.readFile(path.join(root,'scripts/skill-icon-map.json'),'utf8'));
  const prior=selectedId?JSON.parse(await fs.readFile(path.join(directory,'catalog.json'),'utf8')):null;
  const catalog={schemaVersion:1,updatedAt:new Date().toISOString(),sourceFetchedAt:source.fetchedAt,students:{...prior?.students},files:[]};
  const tasks=new Map();
  for(const student of selected) {
    const record=source.students[student.id],rules=mapping.students[student.id];
    if(!record||record.kivoId!==student.kivoId||rules?.length!==student.skills.length)throw new Error('Incomplete mapping: '+student.id);
    const available=record.variants.flatMap(v=>v.skills);
    catalog.students[student.id]=rules.map(([key,match,note],index)=>{
      const skill=available.find(s=>s.key===key);
      if(!skill?.icon||/废案/.test(skill.title)||!['name','composite','reference'].includes(match))throw new Error('Invalid skill mapping: '+student.id+'/'+key);
      const url=new URL(skill.icon.startsWith('//')?'https:'+skill.icon:skill.icon);
      if(url.protocol!=='https:'||url.hostname!=='static.kivo.wiki')throw new Error('Unexpected icon host');
      const file='assets/ui/skill-icons/'+createHash('sha256').update(url.href).digest('hex').slice(0,20)+'.png';
      if(!tasks.has(file))tasks.set(file,{file,url:url.href});
      return {name:student.skills[index].name,kivoId:student.kivoId,key,match,note:note||'',sourceTitle:skill.title.trim(),sourceTitleCn:skill.titleCn.trim(),source:record.source,file};
    });
  }
  const entries=[...tasks.values()];let cursor=0;
  await Promise.all(Array.from({length:3},async()=>{
    while(cursor<entries.length) {
      const entry=entries[cursor++],bytes=Buffer.from(await (await request(entry.url)).arrayBuffer());
      if(bytes.length>2*1024*1024||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('Expected a small PNG: '+entry.url);
      entry.width=bytes.readUInt32BE(16);entry.height=bytes.readUInt32BE(20);
      entry.bytes=bytes.length;entry.sha256=createHash('sha256').update(bytes).digest('hex');
      const target=path.join(root,entry.file);
      try { const prior=await fs.readFile(target);if(!prior.equals(bytes))throw new Error('Refusing to overwrite changed icon: '+entry.file); }
      catch(error) { if(error.code!=='ENOENT')throw error;await fs.writeFile(target,bytes); }
      console.log('ICON',entry.file,`${entry.width}x${entry.height}`);
    }
  }));
  catalog.files=[...new Map([...(prior?.files||[]),...entries].map(file=>[file.file,file])).values()];
  await fs.writeFile(path.join(directory,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
  const runtime={};for(const [id,skills] of Object.entries(catalog.students))runtime[id]=skills.map(({file,match,key,source,sourceTitle,sourceTitleCn})=>({file,match,key,source,sourceTitle,sourceTitleCn}));
  await fs.writeFile(path.join(directory,'catalog.js'),'/* Generated by sync-skill-icons.mjs. Public Kivo skill artwork, local paths only. */\nwindow.PA_SKILL_ICONS='+JSON.stringify(runtime)+';\n');
  const matches={};for(const skill of Object.values(catalog.students).flat())matches[skill.match]=(matches[skill.match]||0)+1;
  console.log('COMPLETE',roster.length,'students,',Object.values(catalog.students).flat().length,'slots,',catalog.files.length,'PNG files',matches);
}
