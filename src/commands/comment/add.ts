import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { Comment, CommentInput } from '../../types/comment.js';
import { generateCommentId, getProjectRoot, loadIndex, saveIndex } from '../../utils/index.js';
import { formatComment } from '../../utils/formatters.js';

interface AddCommentOptions {
  body?: string;
  editor?: boolean;
  project?: string;
}

export async function addComment(issueId: string, options: AddCommentOptions): Promise<void> {
  try {
    const projectRoot = await getProjectRoot(options.project);
    const index = await loadIndex(projectRoot);

    // Verify issue exists
    if (!index.issues[issueId]) {
      console.error(chalk.red(`❌ Issue ${issueId} not found`));
      process.exit(1);
    }

    // Get comment body
    let body = options.body;
    if (!body || options.editor) {
      // Use environment editor
      const tempDir = path.join(projectRoot, '.ai-trackdown');
      await fs.mkdir(tempDir, { recursive: true });
      const tempFile = path.join(tempDir, `comment-${Date.now()}.md`);
      await fs.writeFile(tempFile, body || '');
      
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

    // Generate comment ID
    const commentId = await generateCommentId(projectRoot);
    
    // Create comment object
    const now = new Date().toISOString();
    const comment: Comment = {
      id: commentId,
      issueId,
      body: body.trim(),
      author: process.env.USER || 'unknown',
      createdAt: now,
      updatedAt: now,
      metadata: {
        editorUsed: options.editor ? 'editor' : 'cli',
      },
    };

    // Create comment directory if it doesn't exist
    const commentDir = path.join(projectRoot, 'tasks', 'issues', 'comments', issueId);
    await fs.mkdir(commentDir, { recursive: true });

    // Write comment file
    const commentPath = path.join(commentDir, `${commentId}.md`);
    const frontmatter = `---
id: ${comment.id}
issueId: ${comment.issueId}
author: ${comment.author}
createdAt: ${comment.createdAt}
updatedAt: ${comment.updatedAt}
---

${comment.body}`;

    await fs.writeFile(commentPath, frontmatter);

    // Update index
    if (!index.comments) {
      index.comments = {};
    }
    if (!index.comments[issueId]) {
      index.comments[issueId] = {};
    }
    index.comments[issueId][commentId] = {
      path: path.relative(projectRoot, commentPath),
      lastModified: now,
    };

    await saveIndex(projectRoot, index);

    // Display success message
    console.log(chalk.green(`✅ Comment added successfully!`));
    console.log(chalk.blue(`ℹ️  Comment ID: ${commentId}`));
    console.log(chalk.blue(`ℹ️  Issue ID: ${issueId}`));
    console.log(chalk.blue(`ℹ️  Author: ${comment.author}`));
    console.log(chalk.blue(`ℹ️  Created: ${new Date(comment.createdAt).toLocaleString()}`));
    console.log();
    console.log(formatComment(comment));

  } catch (error) {
    console.error(chalk.red('❌ Failed to add comment:'), error);
    process.exit(1);
  }
}