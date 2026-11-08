import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const allowedRoots = new Set([
  'AGENTS.md', 'README.md', '.gitignore', '.gitattributes', 'package.json',
  '.github', '.agents', 'docs', 'src', 'data', 'assets',
  'source-assets', 'tools', 'tests',
]);
const forbiddenDirectories = new Set([
  'old', 'archive', 'archives', 'backup', 'backups', 'experimental',
  'experiments', 'scratch', 'temp', 'tmp', 'work', 'output', 'outputs',
]);
const required = [
  'AGENTS.md', 'README.md', '.gitignore', 'package.json',
  'docs/REPOSITORY_POLICY.md', 'assets/manifest.json',
  '.agents/skills/asset-design/SKILL.md',
  '.agents/skills/create-grid-map-art/SKILL.md',
  'tools/check-repository.mjs',
];
const allowedTypes = new Set(['character', 'map', 'object', 'ui', 'audio', 'effect', 'other']);
const duplicateName = /(?:[-_](?:copy[0-9]*|final[0-9]*|old)|[.]bak|[.]tmp|[.]orig|~)(?:[.]|$)/i;

function validRelativePath(p) {
  return typeof p === 'string' && !p.startsWith('/') && !p.includes('\\') &&
    p.split('/').every(x => x && x !== '.' && x !== '..');
}

/** Pure inventory check. readBytes(path) is injectable for automated tests. */
export function validateInventory(files, manifest, readBytes = () => Buffer.from('dummy')) {
  const errors = [];
  const tracked = new Set(files);
  for (const p of required) if (!tracked.has(p)) errors.push(`必須ファイルがありません: ${p}`);
  for (const p of files) {
    if (!validRelativePath(p)) {
      errors.push(`不正なパス: ${p}`);
      continue;
    }
    const parts = p.split('/');
    if (!allowedRoots.has(parts[0])) errors.push(`不許可の保存先: ${p}`);
    if (parts.some(x => forbiddenDirectories.has(x.toLowerCase()))) errors.push(`旧版・一時ディレクトリは禁止: ${p}`);
    if (duplicateName.test(parts.at(-1))) errors.push(`複製・旧版風のファイル名は禁止: ${p}`);
    if (p.startsWith('assets/') && /^new[-_]/i.test(parts.at(-1))) errors.push(`採用素材にnew-接頭辞は禁止: ${p}`);
    if (p.endsWith('/AGENTS.md')) errors.push(`重複AGENTS.mdは禁止: ${p}`);
  }
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets)) {
    errors.push('assets/manifest.json のschemaVersion/assetsが不正です');
    return errors;
  }

  const ids = new Set();
  const assetPaths = new Set();
  const sourcePaths = new Set();
  for (const a of manifest.assets) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) {
      errors.push('台帳の素材エントリが不正です');
      continue;
    }
    if (typeof a.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.id)) {
      errors.push(`素材IDは小文字kebab-case必須: ${String(a.id)}`);
    }
    if (ids.has(a.id)) errors.push(`素材IDが重複: ${a.id}`);
    ids.add(a.id);
    if (!validRelativePath(a.path) || !a.path.startsWith('assets/') || a.path === 'assets/manifest.json') {
      errors.push(`素材パスが不正: ${String(a.path)}`);
      continue;
    }
    if (assetPaths.has(a.path)) errors.push(`素材パスが重複: ${a.path}`);
    assetPaths.add(a.path);
    if (!tracked.has(a.path)) errors.push(`台帳にある実ファイルが存在しません: ${a.path}`);
    if (!allowedTypes.has(a.type)) errors.push(`素材種別が不正: ${String(a.type)}`);
    if (a.status !== 'approved') errors.push(`未承認の素材を台帳に登録不可: ${String(a.id)}`);
    if (a.sourcePath !== undefined) {
      if (!validRelativePath(a.sourcePath) || !a.sourcePath.startsWith('source-assets/')) {
        errors.push(`原本パスが不正: ${String(a.sourcePath)}`);
      } else {
        if (!tracked.has(a.sourcePath)) errors.push(`台帳の原本が存在しません: ${a.sourcePath}`);
        sourcePaths.add(a.sourcePath);
      }
    }
  }
  for (const p of files) {
    if (p.startsWith('assets/') && p !== 'assets/manifest.json' && !assetPaths.has(p)) {
      errors.push(`台帳未登録の採用素材: ${p}`);
    }
    if (p.startsWith('source-assets/') && !sourcePaths.has(p)) {
      errors.push(`採用素材に紐づかない原本: ${p}`);
    }
  }

  const hashes = new Map();
  for (const p of files.filter(x => (x.startsWith('assets/') && x !== 'assets/manifest.json') || x.startsWith('source-assets/'))) {
    try {
      const bytes = readBytes(p);
      if (!bytes.length) {
        errors.push(`空ファイルを素材として保存不可: ${p}`);
        continue;
      }
      const sha = createHash('sha256').update(bytes).digest('hex');
      if (hashes.has(sha)) errors.push(`内容が完全一致する素材の重複: ${hashes.get(sha)} / ${p}`);
      else hashes.set(sha, p);
    } catch (e) {
      errors.push(`素材の読込に失敗: ${p} (${e.message})`);
    }
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const paths = execFileSync('git', ['ls-files', '--cached', '-z'], { cwd: root })
      .toString('utf8').split('\0').filter(Boolean);
    const manifest = JSON.parse(readFileSync(resolve(root, 'assets/manifest.json'), 'utf8'));
    const errors = validateInventory(paths, manifest, p => readFileSync(resolve(root, p)));
    if (errors.length) {
      for (const e of errors) console.error('FAIL: ' + e);
      process.exitCode = 1;
    } else {
      console.log(`PASS: ${paths.length} tracked files / ${manifest.assets.length} adopted assets. Structure, manifest and exact duplicates checked.`);
    }
  } catch (e) {
    console.error('FAIL: 検査実行エラー: ' + e.message);
    process.exitCode = 1;
  }
}
