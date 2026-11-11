import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, formatDuration, formatRelativeDate, formatNumberCompact } from './format.ts';
import { createId, truncateMiddle } from './ids.ts';
import { parseSkillFrontmatter, parseMarkdownBlocks } from './markdown.ts';

test('formatBytes formats binary sizes correctly', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1024 * 1024 * 2.5), '2.5 MB');
});

test('formatDuration formats milliseconds and seconds', () => {
  assert.equal(formatDuration(350), '350ms');
  assert.equal(formatDuration(1500), '1.5s');
});

test('formatNumberCompact formats k and M counts', () => {
  assert.equal(formatNumberCompact(42), '42');
  assert.equal(formatNumberCompact(1200), '1.2k');
  assert.equal(formatNumberCompact(1500000), '1.5M');
});

test('createId creates prefixed unique strings', () => {
  const id1 = createId('sess');
  const id2 = createId('sess');
  assert.ok(id1.startsWith('sess_'));
  assert.notEqual(id1, id2);
});

test('truncateMiddle handles long and short texts', () => {
  assert.equal(truncateMiddle('short', 10), 'short');
  assert.equal(truncateMiddle('abcdefghijklmnopqrstuvwxyz', 12), 'abcd...wxyz');
});

test('parseSkillFrontmatter parses yaml header and markdown body', () => {
  const sample = `---
name: code-reviewer
description: Reviews pull requests
triggers: [review, pr, lint]
---
# Instructions
Review the diff carefully.`;

  const { frontmatter, body } = parseSkillFrontmatter(sample);
  assert.equal(frontmatter.name, 'code-reviewer');
  assert.equal(frontmatter.description, 'Reviews pull requests');
  assert.deepEqual(frontmatter.triggers, ['review', 'pr', 'lint']);
  assert.ok(body.includes('# Instructions'));
});

test('parseMarkdownBlocks extracts code blocks and headings', () => {
  const text = `# Title
Here is some text.

\`\`\`typescript
const x = 1;
\`\`\``;

  const blocks = parseMarkdownBlocks(text);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, 'heading');
  assert.equal(blocks[1].type, 'paragraph');
  assert.equal(blocks[2].type, 'code');
  assert.equal(blocks[2].lang, 'typescript');
});
