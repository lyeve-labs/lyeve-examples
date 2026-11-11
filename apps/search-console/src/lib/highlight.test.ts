import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decodeEntities, segments } from './highlight.ts';

test('escaped markup around a match reads as text', () => {
	assert.deepEqual(segments('&lt;img src=x onerror=alert(1)&gt; <mark>Lamp</mark> &amp; desk'), [
		{ text: '<img src=x onerror=alert(1)> ', mark: false },
		{ text: 'Lamp', mark: true },
		{ text: ' & desk', mark: false }
	]);
});

test('an escaped mark tag in the text stays text', () => {
	assert.deepEqual(segments('&lt;mark&gt;not a match&lt;/mark&gt; <mark>match</mark>'), [
		{ text: '<mark>not a match</mark> ', mark: false },
		{ text: 'match', mark: true }
	]);
});

test('quotes and numeric references decode', () => {
	assert.equal(decodeEntities('&#34;a&#39; &quot;b&apos; &#x41;&#65;'), '"a\' "b\' AA');
});

test('an escaped ampersand decodes once', () => {
	assert.equal(decodeEntities('&amp;lt;'), '&lt;');
});

test('an unknown or invalid reference is left as written', () => {
	assert.equal(decodeEntities('&nbsp; &#0; &#x110000; & alone'), '&nbsp; &#0; &#x110000; & alone');
});

test('an unclosed mark marks the rest', () => {
	assert.deepEqual(segments('a <mark>b &lt;'), [
		{ text: 'a ', mark: false },
		{ text: 'b <', mark: true }
	]);
});

test('a name an object inherits is not an entity', () => {
	assert.equal(decodeEntities('&constructor; &toString; &valueOf; &hasOwnProperty;'), '&constructor; &toString; &valueOf; &hasOwnProperty;');
});
