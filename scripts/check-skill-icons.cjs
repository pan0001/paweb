/* Offline source-to-icon checks. No browser or network; original PNG hashes kept. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file));
const catalog=JSON.parse(read('assets/ui/skill-icons/catalog.json'));
const snapshot=JSON.parse(read('assets/ui/skill-icons/kivo-skills.json'));
const mapping=JSON.parse(read('scripts/skill-icon-map.json'));
const html=read('index.html').toString();
const roster=vm.runInNewContext(html.slice(html.indexOf('const translations ='),html.indexOf('const announceArea ='))+'\ncharacters;',{}, {timeout:3000});
const context={window:{}};vm.runInNewContext(read('assets/ui/skill-icons/catalog.js').toString(),context);
const runtime=context.window.PA_SKILL_ICONS;
let count=0;const matches={};
assert.equal(Object.keys(catalog.students).length,roster.length);
const files=new Map(catalog.files.map(file=>[file.file,file]));
for(const student of roster) {
  const record=snapshot.students[student.id],icons=catalog.students[student.id];
  assert.equal(record.kivoId,student.kivoId);assert.equal(icons.length,student.skills.length);
  const skills=record.variants.flatMap(v=>v.skills);
  icons.forEach((icon,i)=>{
    const original=skills.find(skill=>skill.key===icon.key),rule=mapping.students[student.id][i];
    assert.ok(original);assert.doesNotMatch(original.title,/废案/);
    assert.equal(icon.kivoId,student.kivoId);assert.equal(icon.name,student.skills[i].name);
    assert.equal(icon.source,`https://kivo.wiki/data/character/${student.kivoId}`);
    assert.equal(icon.key,rule[0]);assert.equal(icon.match,rule[1]);
    if(icon.match!=='name')assert.ok(icon.note.length>10,'Adaptations must be documented');
    assert.equal(icon.sourceTitle,original.title.trim());
    assert.match(icon.file,/^assets\/ui\/skill-icons\/[0-9a-f]{20}\.png$/);
    const file=files.get(icon.file);assert.ok(file);
    assert.equal(file.url,new URL(original.icon.startsWith('//')?'https:'+original.icon:original.icon).href);
    assert.equal(new URL(file.url).hostname,'static.kivo.wiki');
    for(const key of ['file','match','key','source','sourceTitle','sourceTitleCn'])assert.equal(runtime[student.id][i][key],icon[key]);
    matches[icon.match]=(matches[icon.match]||0)+1;count++;
  });
}
for(const file of files.values()) {
  const bytes=read(file.file);assert.equal(bytes.length,file.bytes);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256);
  assert.equal(bytes.readUInt32BE(16),file.width);assert.equal(bytes.readUInt32BE(20),file.height);
  assert.ok(file.width>=100&&file.height>=100);
}
for(const [id,expected] of Object.entries({2:['0/passive_skill/0','0/ex_skill/0/derived/1','0/passive_skill/2'],6:['0/passive_skill/2','0/ex_skill/0','0/passive_skill/0'],10:['0/passive_skill/2','0/ex_skill/0','0/passive_skill/1'],11:['0/passive_skill/0','0/ex_skill/0','0/passive_skill/1'],16:['0/ex_skill/0','0/passive_skill/0','0/passive_skill/2'],29:['0/ex_skill/1','0/passive_skill/0','0/passive_skill/0']}))assert.deepEqual(catalog.students[id].map(icon=>icon.key),expected,id+' exact skill order');
assert.ok(catalog.students[12].every(icon=>icon.key.startsWith('0/')),'Shield Hoshino only');
assert.equal(catalog.students[13][1].key,'0/ex_skill/0','Do not use Ibuki riding Toramaru');
assert.equal(count,111);
console.log(`PASS ${roster.length} exact student/costume IDs, ${count} reviewed skill mappings, ${files.size} original PNG hashes and dimensions`,matches);
