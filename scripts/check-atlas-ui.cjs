/* Deterministic source/rectangle checks. Visual clipping is also browser-reviewed. */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file));
const manifest=JSON.parse(read('assets/ui/reference-atlas/frames.json'));
const hashes={Common:'8688cb8f708fd9d6d000515b9977647f6e184d5a57e49a1979175640b830809e',Combat:'03b156bedc045510aa4eb957109c9f265365acc3b7ed4008d30edea13d85e10e'};
const css=read('styles/atlas-frames.css').toString();
for(const [name,sheet] of Object.entries(manifest.sheets)) {
  const bytes=read(sheet.file);
  assert.equal(bytes.subarray(1,4).toString(),'PNG');
  assert.equal(bytes.readUInt32BE(16),sheet.width);
  assert.equal(bytes.readUInt32BE(20),sheet.height);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hashes[name],name+' source changed');
}
for(const [name,frame] of Object.entries(manifest.frames)) {
  const sheet=manifest.sheets[frame.sheet];
  assert.ok(sheet,name);
  for(const n of ['x','y','w','h'])assert.ok(Number.isInteger(frame[n]),name);
  assert.ok(frame.x>=0&&frame.y>=0&&frame.w>0&&frame.h>0,name);
  assert.ok(frame.x+frame.w<=sheet.width&&frame.y+frame.h<=sheet.height,name);
  const expected=`--ref-${name}:url('../${sheet.file}') ${(100*frame.x/(sheet.width-frame.w)).toFixed(5)}% ${(100*frame.y/(sheet.height-frame.h)).toFixed(5)}% / ${(100*sheet.width/frame.w).toFixed(5)}% ${(100*sheet.height/frame.h).toFixed(5)}% no-repeat;`;
  assert.ok(css.includes(expected),name+' CSS and frame manifest must agree');
}
const skin=read('styles/atlas-ui.css').toString();
assert.ok(!skin.includes('generated-buttons/'),'Current skin should not add generated bitmap references');
assert.ok(!skin.includes('controls.svg#'),'Standalone views are needed for reliable background rendering');
for(const name of ['play','pause','expand','moon','sun','close','reset']) {
  assert.ok(skin.includes(`control-${name}.svg`));
  assert.match(read(`assets/ui/reference-atlas/control-${name}.svg`).toString(),/width="32" height="32" viewBox=/);
}
assert.match(skin,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(skin,/@media\(forced-colors:active\)/);
console.log(`PASS Two source PNG hashes and dimensions, ${Object.keys(manifest.frames).length} atlas rectangles, seven native controls, and accessible-style fallbacks`);
