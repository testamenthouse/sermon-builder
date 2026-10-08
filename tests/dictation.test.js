// Dictation text pass: spoken punctuation and segment joining (the DOM inserter is covered by the browser walk).
import test from 'node:test';
import assert from 'node:assert/strict';
import { dictation } from '../app/src/lib/node.js';
const { spokenPunctuation, joinText, splitCommands } = dictation;

test('spoken marks become punctuation attached to the word before', () => {
  assert.equal(spokenPunctuation('I went to the store period'), 'I went to the store.');
  assert.equal(spokenPunctuation('hello comma world'), 'hello, world');
  assert.equal(spokenPunctuation('is it done question mark'), 'is it done?');
  assert.equal(spokenPunctuation('go exclamation point'), 'go!');
  assert.equal(spokenPunctuation('three things colon faith semicolon hope'), 'three things: faith; hope');
  assert.equal(spokenPunctuation('and then ellipsis nothing'), 'and then… nothing');
});
test('the next word is capitalized after a spoken sentence end', () => {
  assert.equal(spokenPunctuation('first point period second point period'), 'first point. Second point.');
  assert.equal(spokenPunctuation('really question mark yes exclamation mark no'), 'really? Yes! No');
  assert.equal(spokenPunctuation('one comma two'), 'one, two');
});
test('a mark the recognizer already added around the command is folded in', () => {
  assert.equal(spokenPunctuation('I went to the store. Period.'), 'I went to the store.');
  assert.equal(spokenPunctuation('I went to the store, period'), 'I went to the store.');
  assert.equal(spokenPunctuation('hello, comma, world'), 'hello, world');
});
test('opening marks attach to the word after, tight marks join both sides', () => {
  assert.equal(spokenPunctuation('he said comma open quote come close quote period'), 'he said, "come".');
  assert.equal(spokenPunctuation('see open paren verse three close paren'), 'see (verse three)');
  assert.equal(spokenPunctuation('a well hyphen known man'), 'a well-known man');
  assert.equal(spokenPunctuation('grace dash unearned'), 'grace—unearned');
});
test('a lone command segment is just the mark', () => {
  assert.equal(spokenPunctuation('period'), '.');
  assert.equal(spokenPunctuation('Comma.'), ',');
  assert.equal(spokenPunctuation(''), '');
});
test('joinText spaces, capitalizes and never doubles a mark the paragraph already ends with', () => {
  assert.equal(joinText('I went home', 'period'), '.');
  assert.equal(joinText('I went home.', 'period'), '');
  assert.equal(joinText('I went home.', 'then I slept'), ' Then I slept');
  assert.equal(joinText('I went home', 'comma then slept'), ', then slept');
  assert.equal(joinText('', 'hello period'), 'Hello.');
  assert.equal(joinText('one', 'period new sentence'), '. New sentence');
});
test('paragraph commands still split before the punctuation pass', () => {
  assert.deepEqual(splitCommands('first period new paragraph second period'), ['first period', 'second period']);
  assert.deepEqual(splitCommands('first.\n\nsecond.'), ['first.', 'second.']);
});
