import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = p => readFileSync(resolve(root, p));
const textFile = p => data(p).toString('utf8');
const spec = JSON.parse(textFile('data/characters/hizuki-walk.json'));
const assets = JSON.parse(textFile('assets/manifest.json')).assets;
const gitBlobSHA = b => createHash('sha1').update('blob ' + b.length + '\0').update(b).digest('hex');

test('AGENTS and character production skill lead to a single current design canon', () => {
  const agents = textFile('AGENTS.md');
  const grid = textFile('.agents/skills/create-grid-map-art/SKILL.md');
  const skill = textFile('.agents/skills/hizuki-character/SKILL.md');
  const canon = textFile('docs/characters/HIZUKI_CANON.md');
  assert.ok(agents.includes('.agents/skills/hizuki-character/SKILL.md'));
  assert.ok(agents.includes('docs/characters/HIZUKI_CANON.md'));
  assert.ok(grid.includes('../hizuki-character/SKILL.md'));
  assert.ok(skill.includes('../asset-design/SKILL.md'));
  assert.ok(skill.includes('../create-grid-map-art/SKILL.md'));
  assert.ok(canon.includes('未移行'));
  assert.ok(canon.includes('1086×1448'));
});

test('design references are the actual registered contemporary game images, not older artwork', () => {
  for (const variant of Object.values(spec.variants)) {
    assert.ok(existsSync(resolve(root, variant.path)), variant.path);
    const registered = assets.find(a => a.id === variant.assetId);
    assert.ok(registered, variant.assetId);
    assert.equal(registered.path, variant.path);
    assert.equal(gitBlobSHA(data(variant.path)), variant.gitBlobSha);
    assert.ok(textFile('docs/characters/HIZUKI_CANON.md').includes(variant.path));
  }
  assert.deepEqual(spec.defaultForArea, {field:'sd', village:'4dir-80x112'});
});

test('design rules preserve distinct cell metrics and no false game integration', () => {
  const canon = textFile('docs/characters/HIZUKI_CANON.md');
  const skill = textFile('.agents/skills/hizuki-character/SKILL.md');
  assert.equal(spec.movementGridPx, 32);
  assert.deepEqual(spec.variants['4dir-80x112'].footAnchorPx, [40,106]);
  assert.equal(spec.runtimeIntegration, 'NOT_YET_MIGRATED');
  assert.ok(canon.includes('意図的'));
  assert.ok(skill.includes('ユーザーの意図した歩行上下動'));
  assert.ok(skill.includes('刀なし・両腕を開く'));
  assert.ok(canon.includes('この高解像度PNG自体は本GitHubリポジトリに転送できていない'));
});
