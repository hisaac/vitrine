import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Playlist, readSettings } from '../src/playback.ts';

test('orders filenames naturally and wraps in both directions', () => {
  const list = new Playlist(['photo10.jpg', 'photo2.jpg', 'photo1.jpg'], false);
  assert.equal(list.current, 'photo1.jpg');
  assert.equal(list.move(1), 'photo2.jpg');
  assert.equal(list.move(1), 'photo10.jpg');
  assert.equal(list.move(1), 'photo1.jpg');
  assert.equal(list.move(-1), 'photo10.jpg');
});
test('shuffle visits every image once and avoids an immediate cycle repeat', () => {
  const list = new Playlist(['a', 'b', 'c', 'd'], true, () => 0);
  const cycle = [list.current, list.move(1), list.move(1), list.move(1)];
  assert.equal(new Set(cycle).size, 4);
  assert.notEqual(list.move(1), cycle[3]);
  const current = list.current;
  list.move(-1);
  assert.equal(list.move(1), current);
});
test('empty and single-image albums have bounded navigation', () => {
  assert.equal(new Playlist([], true).move(1), undefined);
  const single = new Playlist(['a'], true);
  assert.equal(single.move(1), 'a');
  assert.equal(single.move(-1), 'a');
});
test('invalid persisted settings recover safe defaults', () => {
  assert.deepEqual(readSettings('{broken'), { folder: '', seconds: 30, shuffle: false });
  assert.deepEqual(readSettings('{"folder":42,"seconds":0,"shuffle":"yes"}'), { folder: '', seconds: 30, shuffle: false });
  assert.deepEqual(readSettings('{"folder":"/art","seconds":15,"shuffle":true}'), { folder: '/art', seconds: 15, shuffle: true });
});
