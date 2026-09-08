/** HTTP/resource checks only: does not automate a browser or verify WebGL pixels. */
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { once } from 'node:events';
import { get } from 'node:http';
import { createPreviewServer } from './serve-preview.mjs';

const root = new URL('../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('assets/media/catalog.json', root), 'utf8'));
const server = await createPreviewServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const file of ['index.html','scripts/gallery.js','scripts/ui-motion.js','scripts/model-viewer.js','scripts/spine-viewer.js','assets/vendor/three/three.module.min.js','assets/vendor/three/three.core.min.js','assets/vendor/three/GLTFLoader.js','assets/vendor/three/OrbitControls.js','assets/vendor/three/BufferGeometryUtils.js','assets/vendor/three/SkeletonUtils.js','assets/vendor/spine/4.2.120/spine-player.min.mjs']) {
    const response = await fetch(`${origin}/${file}`);
    assert.equal(response.status, 200, file);
    assert.match(response.headers.get('content-type'), /html|javascript/, file);
    assert.equal((await response.arrayBuffer()).byteLength, (await stat(new URL(file, root))).size);
  }
  console.log('PASS Preview HTML and all local viewer modules return complete files with correct MIME types');
  const buttonArt=JSON.parse(await readFile(new URL('assets/ui/generated-buttons/prompts.json',root),'utf8'));
  const atlasFiles=['styles/atlas-frames.css','styles/atlas-ui.css','styles/atlas-preview.css',
    'styles/site-backgrounds.css','styles/site-motion.css','assets/ui/archive-triangles.svg',
    'assets/ui/reference-atlas/Common.png','assets/ui/reference-atlas/Combat.png',
    ...['play','pause','expand','moon','sun','close','reset'].map(name=>`assets/ui/reference-atlas/control-${name}.svg`)];
  for (const file of atlasFiles) {
    const response=await fetch(`${origin}/${file}`);
    assert.equal(response.status,200,file);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(new URL(file,root)),file);
  }
  console.log('PASS Supplied atlas sheets, skin and native fallback controls are served intact');
  for (const file of ['scripts/ba-model-materials.js','scripts/toon-renderer.js','styles/game-ui.css','styles/site-ui.css','styles/button-art.css','assets/media/expressions/Character_Mouth_High.png',...buttonArt.assets.map(asset=>asset.file)]) {
    const response=await fetch(`${origin}/${file}`);
    assert.equal(response.status,200,file);
    assert.equal((await response.arrayBuffer()).byteLength,(await stat(new URL(file,root))).size);
  }
  console.log('PASS BA material adapter and local mouth atlas are served');

  const models = new Map();
  const files = new Set();
  for (const student of Object.values(catalog.students)) {
    for (const item of [...student.models, ...student.spines]) {
      assert.equal(item.ready, true, item.name);
      item.files.forEach(file => files.add(file));
      if (item.type === 'body') models.set(item.file, item);
    }
  }
  for (const file of files) {
    const response = await fetch(`${origin}/${file}`, {method:'HEAD'});
    assert.equal(response.status, 200, file);
    assert.equal(Number(response.headers.get('content-length')), (await stat(new URL(file, root))).size);
  }
  for (const [file] of models) {
    const body = await readFile(new URL(file, root));
    assert.equal(body.toString('ascii',0,4), 'glTF', file);
    assert.equal(body.readUInt32LE(4), 2, file);
    assert.equal(body.readUInt32LE(8), body.length, file);
    assert.equal(body.readUInt32LE(16), 0x4e4f534a, file);
    const jsonLength = body.readUInt32LE(12);
    const gltf = JSON.parse(body.toString('utf8',20,20 + jsonLength));
    assert.ok(gltf.meshes?.length > 0, file);
    assert.ok(gltf.scenes?.length > 0, file);
    assert.ok(!gltf.extensionsRequired?.some(name => /draco|meshopt|basisu/.test(name)), file);
    for (const buffer of gltf.buffers) assert.ok(!buffer.uri || buffer.uri.startsWith('data:'), file);
    for (const image of gltf.images || []) assert.ok(image.bufferView !== undefined || image.uri?.startsWith('data:'), file);
    for (const view of gltf.bufferViews || []) assert.ok((view.byteOffset || 0) + view.byteLength <= gltf.buffers[view.buffer].byteLength, file);
  }
  const hina = models.get(catalog.students['11'].models.find(item => item.type === 'body').file);
  const response = await fetch(`${origin}/${hina.file}`);
  assert.equal(response.headers.get('content-type'), 'model/gltf-binary');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(new URL(hina.file, root)));
  console.log(`PASS ${files.size} model/lobby files are reachable; ${models.size} self-contained GLBs validate; Hina GET matches the original bytes`);

  // Load the actual module graph. No renderer is constructed in this test.
  const model = await import('./model-viewer.js');
  const spine = await import('./spine-viewer.js');
  assert.equal(typeof model.mount, 'function');
  assert.equal(typeof spine.mount, 'function');
  console.log('PASS Local viewer module graph imports without missing dependencies');
  for(const file of ['scripts/mika-halo.js','assets/vendor/three/OBJLoader.js','assets/vendor/three/MTLLoader.js']) {
    const response=await fetch(`${origin}/${file}`);
    assert.equal(response.status,200,file);assert.match(response.headers.get('content-type'),/javascript/);
    assert.equal((await response.arrayBuffer()).byteLength,(await stat(new URL(file,root))).size);
  }
  assert.equal(typeof (await import('./mika-halo.js')).attachMikaHalo,'function');
  console.log('PASS Optional Mika OBJ/MTL halo module and loaders are served locally');

  // CPU-side loader regression. Node has no ImageBitmap decoder; texture pixels are
  // deliberately stubbed here, so this verifies geometry/rig/animation, not appearance.
  const THREE = await import('../assets/vendor/three/three.module.min.js');
  const { GLTFLoader } = await import('../assets/vendor/three/GLTFLoader.js');
  globalThis.self = globalThis;
  globalThis.createImageBitmap = async () => ({width:1, height:1, close(){}});
  try {
    const bytes = await readFile(new URL(hina.file, root));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    let meshes = 0, skinned = 0;
    gltf.scene.traverse(object => { if(object.isMesh) meshes++; if(object.isSkinnedMesh) skinned++; });
    assert.ok(meshes > 0 && skinned > 0 && gltf.animations.length > 0);
    const mixer = new THREE.AnimationMixer(gltf.scene);
    mixer.clipAction(gltf.animations.find(clip => /_Formation_Idle$/i.test(clip.name)) || gltf.animations[0]).play();
    mixer.update(0.1);
    gltf.scene.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(gltf.scene, true).getSize(new THREE.Vector3());
    assert.ok(Number.isFinite(size.length()) && size.y > 0);
    mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
    console.log(`PASS Hina's actual GLTFLoader parse: ${meshes} meshes, ${skinned} skinned meshes, ${gltf.animations.length} animations (texture decode stubbed)`);
  } finally {
    delete globalThis.self;delete globalThis.createImageBitmap;
  }

  for (const file of ['.git/config','scripts/serve-preview.mjs','scripts/check-preview.mjs','assets/%2e%2e/.git/config','assets/%5c..%5c.git/config','assets/media/catalog.json:stream']) {
    const response = await fetch(`${origin}/${file}`);
    assert.ok([403,404].includes(response.status), file);
    await response.text();
  }
  assert.equal((await fetch(origin, {method:'POST'})).status, 405);
  assert.equal((await fetch(origin, {headers:{Origin:'https://example.com'}})).status, 403);
  const untrustedHost = await new Promise((resolve,reject) => {
    get(origin, {headers:{Host:'untrusted.example'}}, response => {response.resume();resolve(response.statusCode);}).on('error',reject);
  });
  assert.equal(untrustedHost, 403);
  console.log('PASS Private paths, write requests and untrusted origins/hosts are rejected');
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
console.log('HTTP and file checks passed. Browser/WebGL rendering still requires visual verification.');
