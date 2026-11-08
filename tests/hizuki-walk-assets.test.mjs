import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bytes = path => readFileSync(resolve(root, path));
const json = path => JSON.parse(bytes(path).toString('utf8'));
const spec = json('data/characters/hizuki-walk.json');
const manifest = json('assets/manifest.json');
const gitSha = data => createHash('sha1')
  .update('blob ' + data.length + String.fromCharCode(0)).update(data).digest('hex');
const imageInfo = path => {
  const data = bytes(path);
  assert.ok(data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), path + ': PNG signature');
  assert.equal(data.toString('ascii', 12, 16), 'IHDR');
  return { data, width: data.readUInt32BE(16), height: data.readUInt32BE(20), depth: data[24], colorType: data[25] };
};

test('two explicit area-default styles with the same 32px movement grid', () => {
  assert.equal(spec.characterId, 'hizuki');
  assert.equal(spec.movementGridPx, 32);
  assert.deepEqual(spec.defaultForArea, { field: 'sd', village: 'hana' });
  assert.deepEqual(Object.keys(spec.variants).sort(), ['hana', 'sd']);
  assert.equal(spec.runtimeIntegration, 'NOT_YET_MIGRATED');
});

test('manifest links both production sprites without duplicate IDs or paths', () => {
  const ids = manifest.assets.map(item => item.id);
  const paths = manifest.assets.map(item => item.path);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(paths).size, paths.length);
  for (const variant of Object.values(spec.variants)) {
    const registered = manifest.assets.find(item => item.id === variant.assetId);
    assert.ok(registered, variant.assetId);
    assert.equal(registered.path, variant.path);
    assert.equal(registered.type, 'character');
    assert.equal(registered.status, 'approved');
    assert.equal(registered.origin.path, variant.sourceOriginalPath);
    assert.equal(registered.origin.gitBlobSha, variant.gitBlobSha);
    assert.ok(!variant.path.includes('/new-'));
  }
  assert.equal(manifest.assets.find(item => item.id === spec.variants.sd.assetId).sourcePath, spec.variants.sd.editorPath);
});

test('imported RGBA atlases are unchanged bytes with exactly 3 columns and 4 rows', () => {
  for (const variant of Object.values(spec.variants)) {
    const img = imageInfo(variant.path);
    assert.deepEqual([img.width, img.height], variant.atlasPx);
    assert.equal(img.width / variant.framePx[0], 3);
    assert.equal(img.height / variant.framePx[1], 4);
    assert.equal(img.depth, 8);
    assert.equal(img.colorType, 6);
    assert.equal(gitSha(img.data), variant.gitBlobSha, variant.assetId + ': source blob SHA');
    assert.deepEqual(variant.rows, ['front', 'back', 'right', 'left']);
    assert.deepEqual(variant.columns, ['idle', 'stepA', 'stepB']);
    assert.deepEqual(variant.runtimeFrameToColumn, [1, 0, 2]);
  }
});

test('SD editor preserves all 12 original 32px RGBA frames', () => {
  const v = spec.variants.sd;
  const raw = bytes(v.editorPath);
  assert.equal(gitSha(raw), v.editorGitBlobSha);
  const editor = JSON.parse(raw.toString('utf8'));
  assert.equal(editor.format, 'yaksha-pixel-v3');
  assert.deepEqual([editor.width, editor.height], [32, 32]);
  assert.deepEqual(editor.order, v.editorRowOrder);
  assert.deepEqual(editor.poses, ['idle', 'walkA', 'walkB']);
  for (const dir of editor.order) {
    assert.equal(editor.frames[dir].length, 3);
    for (const rgba of editor.frames[dir]) assert.equal(rgba.length, 32 * 32 * 4);
  }
});

test('Hana anchor and display height remain separate from 32px collision', () => {
  const v = spec.variants.hana;
  assert.deepEqual(v.footAnchorPx, [40, 106]);
  assert.deepEqual(v.neutralVisibleHeightPxByRow, [99, 100, 97, 97]);
  assert.equal(v.nominalRenderedVisibleHeightPx, 48);
});
