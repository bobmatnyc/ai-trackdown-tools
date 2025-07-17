import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { Comment } from '../../types/comment.js';
import { getProjectRoot, loadIndex, saveIndex } from '../../utils/index.js';
import { parseYamlFrontmatter, stringifyYamlFrontmatter } from '../../utils/yaml.js';

interface UpdateCommentOptions {
  body?: string;
  editor?: boolean;
  project?: string;
}

export async function updateComment(
  issueId: string,
  commentId: string,
  options: UpdateCommentOptions
): Promise<void> {
  try {
    const projectRoot = await getProjectRoot(options.project);
    const index = await loadIndex(projectRoot);

    // Verify issue exists
    if (!index.issues[issueId]) {
      console.error(chalk.red(`❌ Issue ${issueId} not found`));
      process.exit(1);
    }

    // Verify comment exists
    const issueComments = index.comments?.[issueId] || {};
    if (!issueComments[commentId]) {
      console.error(chalk.red(`❌ Comment ${commentId} not found in issue ${issueId}`));
      process.exit(1);
    }

    // Load existing comment
    const commentPath = path.join(projectRoot, issueComments[commentId].path);
    const content = await fs.readFile(commentPath, 'utf-8');
    const { frontmatter, content: existingBody } = parseYamlFrontmatter(content);

    // Get new body
    let body = options.body;
    if (!body || options.editor) {
      // Use environment editor
      const tempDir = path.join(projectRoot, '.ai-trackdown');
      await fs.mkdir(tempDir, { recursive: true });
      const tempFile = path.join(tempDir, `comment-edit-${Date.now()}.md`);
      await fs.writeFile(tempFile, body || existingBody);
      
      const editor = process.env.EDITOR || 'nano';
      await new Promise((resolve, reject) => {
        const child = spawn(editor, [tempFile], { stdio: 'inherit' });
        child.on('exit', (code) => {
          if (code === 0) resolve(undefined);
          else reject(new Error(`Editor exited with code ${code}`));
        });
      });
      
      body = await fs.readFile(tempFile, 'utf-8');
      await fs.unlink(tempFile);
    }

    if (!body?.trim()) {
      console.error(chalk.red('❌ Comment body cannot be empty'));
      process.exit(1);
    }

    // Update comment
    const now = new Date().toISOString();
    const updatedComment = {
      ...frontmatter,
      updatedAt: now,
      editedAt: now,
      metadata: {
        ...frontmatter.metadata,
        edited: true,
        editorUsed: options.editor ? 'editor' : 'cli',
      },
    };

    // Write updated comment
    const updatedContent = stringifyYamlFrontmatter(updatedComment, body.trim());
    await fs.writeFile(commentPath, updatedContent);

    // Update index
    issueComments[commentId].lastModified = now;
    await saveIndex(projectRoot, index);

    // Display success message
    console.log(chalk.green(`✅ Comment updated successfully!`));
    console.log(chalk.blue(`ℹ️  Comment ID: ${commentId}`));
    console.log(chalk.blue(`ℹ️  Issue ID: ${issueId}`));
    console.log(chalk.blue(`ℹ️  Updated: ${new Date(now).toLocaleString()}`));

  } catch (error) {
    console.error(chalk.red('❌ Failed to update comment:'), error);
    process.exit(1);
  }
}