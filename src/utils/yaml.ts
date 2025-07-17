/**
 * YAML frontmatter utilities
 */

import yaml from 'js-yaml';

export interface ParsedFrontmatter {
  frontmatter: any;
  content: string;
}

/**
 * Parse YAML frontmatter from markdown content
 */
export function parseYamlFrontmatter(content: string): ParsedFrontmatter {
  const lines = content.split('\n');
  
  // Check if content starts with frontmatter delimiter
  if (lines[0] !== '---') {
    return {
      frontmatter: {},
      content: content,
    };
  }
  
  // Find the end of frontmatter
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }
  
  if (endIndex === -1) {
    // No closing delimiter found
    return {
      frontmatter: {},
      content: content,
    };
  }
  
  // Extract frontmatter and content
  const frontmatterText = lines.slice(1, endIndex).join('\n');
  const contentText = lines.slice(endIndex + 1).join('\n');
  
  try {
    const frontmatter = yaml.load(frontmatterText) || {};
    return {
      frontmatter,
      content: contentText,
    };
  } catch (error) {
    console.error('Failed to parse YAML frontmatter:', error);
    return {
      frontmatter: {},
      content: content,
    };
  }
}

/**
 * Stringify frontmatter and content back to markdown
 */
export function stringifyYamlFrontmatter(frontmatter: any, content: string): string {
  const yamlText = yaml.dump(frontmatter, { 
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
  
  return `---\n${yamlText}---\n\n${content}`;
}