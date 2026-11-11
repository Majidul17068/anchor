export interface MarkdownBlock {
  type: 'paragraph' | 'code' | 'heading' | 'list' | 'quote' | 'diff';
  content: string;
  lang?: string;
  level?: number;
}

export function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  if (!text) return [];
  const lines = text.split('\n');
  const blocks: MarkdownBlock[] = [];

  let inCodeBlock = false;
  let codeLang = '';
  let codeBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({
          type: codeLang === 'diff' ? 'diff' : 'code',
          content: codeBuffer.join('\n'),
          lang: codeLang || 'text',
        });
        inCodeBlock = false;
        codeLang = '';
        codeBuffer = [];
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Check headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      continue;
    }

    // Check blockquote
    if (line.startsWith('>')) {
      blocks.push({
        type: 'quote',
        content: line.replace(/^>\s?/, ''),
      });
      continue;
    }

    // Check list item
    if (line.match(/^(\*|-|\d+\.)\s+/)) {
      blocks.push({
        type: 'list',
        content: line.replace(/^(\*|-|\d+\.)\s+/, ''),
      });
      continue;
    }

    // Blank line
    if (!line.trim()) {
      continue;
    }

    // Normal paragraph
    blocks.push({
      type: 'paragraph',
      content: line,
    });
  }

  if (inCodeBlock) {
    blocks.push({
      type: codeLang === 'diff' ? 'diff' : 'code',
      content: codeBuffer.join('\n'),
      lang: codeLang || 'text',
    });
  }

  return blocks;
}

export function parseSkillFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const rawYaml = match[1];
  const body = match[2];
  const frontmatter: Record<string, unknown> = {};

  for (const line of rawYaml.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > -1) {
      const key = line.slice(0, colonIdx).trim();
      let value: unknown = line.slice(colonIdx + 1).trim();
      if (typeof value === 'string') {
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value
            .slice(1, -1)
            .split(',')
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean);
        } else {
          value = value.replace(/^['"]|['"]$/g, '');
        }
      }
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}
