/* CSS contracts + rasterized SVG bounds, not a substitute for browser layout QA. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {JSDOM} = require(process.env.PAWEB_TEST_MODULES ? path.join(process.env.PAWEB_TEST_MODULES,'jsdom') : 'jsdom');
const sharp = require(process.env.PAWEB_IMAGE_MODULES ? path.join(process.env.PAWEB_IMAGE_MODULES,'sharp') : 'sharp');
const root = path.resolve(__dirname,'..');
const css = fs.readFileSync(path.join(root,'styles/button-art.css'),'utf8');
const dom = new JSDOM(`<style>${css}</style>`);
const rules = [...dom.window.document.styleSheets[0].cssRules];
const declaration = (selector, list=rules) => {
  const rule = list.find(rule=>rule.selectorText===selector);
  assert.ok(rule,'Missing rule: '+selector);
  return rule.style;
};
const theme = declaration('.theme-toggle');
assert.equal(theme.getPropertyValue('padding'),'0','Remove native button padding, including narrow screens');
assert.equal(theme.getPropertyValue('position'),'relative','Contain decorative layers without changing position on click');
for (const style of [theme,
  rules.find(rule=>rule.selectorText?.startsWith('#characters :is(.strip-arrow,.showcase-prev,.showcase-next),')).style,
  declaration('.announce-meta .arrow'),declaration('.hero-scroll > span:first-child')]) {
  assert.equal(style.getPropertyValue('display'),'inline-flex');
  assert.equal(style.getPropertyValue('align-items'),'center');
  assert.equal(style.getPropertyValue('justify-content'),'center');
  assert.equal(style.getPropertyValue('gap'),'0','Hidden fallback text must not add spacing');
  assert.equal(style.getPropertyValue('line-height'),'1');
  assert.equal(style.getPropertyValue('letter-spacing'),'0','Inherited tracking must not give zero-size text a visible width');
}
const icon = declaration('#themeIcon');
assert.equal(icon.getPropertyValue('flex'),'0 0 auto','The icon must not shrink to accommodate native padding');
assert.equal(icon.getPropertyValue('place-items'),'center','Center the readable forced-color glyph too');
const mobile = [...rules.find(rule=>rule.conditionText==='(max-width:680px)').cssRules];
const atlas = fs.readFileSync(path.join(root,'styles/atlas-ui.css'),'utf8');
const skin = new JSDOM(`<style>${atlas}</style>`);
const border = parseFloat(declaration('.theme-toggle',[...skin.window.document.styleSheets[0].cssRules]).getPropertyValue('border'));
for (const [label,button,glyph] of [
  ['desktop',theme,icon],
  ['mobile',declaration('.theme-toggle',mobile),declaration('#themeIcon',mobile)]
]) {
  const width=parseFloat(button.getPropertyValue('width'));
  const height=parseFloat(button.getPropertyValue('height'));
  const glyphWidth=parseFloat(glyph.getPropertyValue('width'));
  assert.equal(width,height,'Keep the theme control square');
  assert.ok(glyphWidth <= width - 2 * border,'Icon fits the button content box');
  console.log(`PASS ${label}: ${width}px theme button, ${glyphWidth}px icon, zero padding and centered flex layout`);
}
dom.window.close();skin.window.close();

(async () => {
  for (const name of ['moon','sun']) {
    const {data,info}=await sharp(path.join(root,`assets/ui/reference-atlas/control-${name}.svg`),{density:576})
      .resize(256,256).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let minX=256,minY=256,maxX=-1,maxY=-1;
    for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
      if(data[(y*info.width+x)*4+3] <= 32) continue;
      minX=Math.min(x,minX);maxX=Math.max(x,maxX);
      minY=Math.min(y,minY);maxY=Math.max(y,maxY);
    }
    assert.ok(maxX>=minX && maxY>=minY,'The glyph is visible');
    assert.ok(minX>0 && minY>0 && maxX<255 && maxY<255,'No viewBox clipping');
    const dx=((minX+maxX+1)/2-128)/8, dy=((minY+maxY+1)/2-128)/8;
    assert.ok(Math.abs(dx)<=.125 && Math.abs(dy)<=.125,`${name} visible bounds are off-center: ${dx}, ${dy}`);
    console.log(`PASS ${name}: visible SVG bounds centered within 0.125px at native size (${dx}, ${dy})`);
  }
  console.log('Control alignment contracts passed; real-browser placement still needs visual verification.');
})().catch(error=>{console.error(error);process.exitCode=1;});
