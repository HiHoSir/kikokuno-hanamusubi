import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateInventory } from '../tools/check-repository.mjs';

const base = [
  'AGENTS.md', 'README.md', '.gitignore', 'package.json',
  'docs/REPOSITORY_POLICY.md', 'assets/manifest.json',
  '.agents/skills/asset-design/SKILL.md',
  '.agents/skills/create-grid-map-art/SKILL.md',
  'tools/check-repository.mjs',
];
const empty = { schemaVersion: 1, assets: [] };
const entry = (id, path) => ({ id, type: 'character', path, status: 'approved' });

test('空の採用台帳と必要なファイルは合格', () => {
  assert.deepEqual(validateInventory(base, empty), []);
});
test('旧版フォルダ・名前違いコピーは禁止', () => {
  const errors = validateInventory([...base, 'old/x.png', 'assets/hizuki-final2.png'], empty);
  assert.ok(errors.some(x => x.includes('旧版・一時')));
  assert.ok(errors.some(x => x.includes('複製・旧版風')));
});
test('台帳にないアセットは拒否', () => {
  const errors = validateInventory([...base, 'assets/characters/hizuki/idle.png'], empty);
  assert.ok(errors.some(x => x.includes('台帳未登録')));
});
test('台帳の重複IDと実ファイル不足を拒否', () => {
  const manifest = { schemaVersion: 1, assets: [
    entry('hizuki-idle', 'assets/characters/hizuki/idle.png'),
    entry('hizuki-idle', 'assets/characters/hizuki/idle-other.png'),
  ] };
  const errors = validateInventory(base, manifest);
  assert.ok(errors.some(x => x.includes('素材IDが重複')));
  assert.ok(errors.some(x => x.includes('実ファイルが存在しません')));
});
test('完全一致するバイナリを拒否', () => {
  const paths = ['assets/characters/hizuki/a.png', 'assets/characters/hizuki/b.png'];
  const manifest = { schemaVersion: 1, assets: [entry('hizuki-a', paths[0]), entry('hizuki-b', paths[1])] };
  const errors = validateInventory([...base, ...paths], manifest, () => Buffer.from('same image'));
  assert.ok(errors.some(x => x.includes('完全一致')));
});
test('紐付かない原本を拒否', () => {
  const errors = validateInventory([...base, 'source-assets/hizuki/source.png'], empty);
  assert.ok(errors.some(x => x.includes('紐づかない原本')));
});
test('壊れた素材パスを拒否', () => {
  const manifest = { schemaVersion: 1, assets: [entry('bad-path', 'assets/../secret.png')] };
  const errors = validateInventory(base, manifest);
  assert.ok(errors.some(x => x.includes('素材パスが不正')));
});

test('採用素材にnew-の暫定ファイル名を残さない', () => {
  const p = 'assets/field/objects/new-village.png';
  const errors = validateInventory([...base, p], { schemaVersion: 1, assets: [entry('field-new-village', p)] });
  assert.ok(errors.some(x => x.includes('new-接頭辞')));
});

test('デザイン正本は一般の採用スプライトとは別に登録して保全する', () => {
  const path = 'source-assets/characters/hizuki/character-design.jpg';
  const bytes = Buffer.from('test JPEG bytes');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const m = { schemaVersion: 1, assets: [],
    designReferences: [{ id: 'hizuki-character-design', path, status: 'approved', sha256 }] };
  assert.deepEqual(validateInventory([...base, path], m, () => bytes), []);
  assert.ok(validateInventory([...base, path], empty, () => bytes).some(x => x.includes('紐づかない原本')));
  const bad = {...m, designReferences: [{...m.designReferences[0], sha256: '0'.repeat(64)}]};
  assert.ok(validateInventory([...base, path], bad, () => bytes).some(x => x.includes('SHA-256が不一致')));
});
