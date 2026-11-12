import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('opening links the approved movie and supports inline Safari playback', () => {
  const page = readFileSync('src/opening/index.html', 'utf8');
  const player = readFileSync('src/opening/opening.js', 'utf8');
  assert.match(page, /src="\.\.\/\.\.\/assets\/prologue\/opening\.mp4"/);
  assert.match(page, /playsinline/);
  assert.match(page, /id="play-opening"/);
  assert.match(player, /video\.addEventListener\('ended', enterVillage\)/);
  assert.match(player, /previews\/village-walk\//);
  assert.ok(existsSync('assets/prologue/opening.mp4'));
});

test('opening movie is recorded once in the asset manifest', () => {
  const manifest = JSON.parse(readFileSync('assets/manifest.json', 'utf8'));
  const matching = manifest.assets.filter(item => item.path === 'assets/prologue/opening.mp4');
  assert.equal(matching.length, 1);
  assert.equal(matching[0].status, 'approved');
});
