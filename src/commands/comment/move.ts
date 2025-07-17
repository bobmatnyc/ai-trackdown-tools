import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { getProjectRoot, loadIndex, saveIndex } from '../../utils/index.js';
import { parseYamlFrontmatter, stringifyYamlFrontmatter } from '../../utils/yaml.js';

interface MoveCommentOptions {
  to: string;
  preserveMetadata?: boolean;
  project?: string;
}

export async function moveComment(
  issueId: string,
  commentId: string,
  options: MoveCommentOptions
): Promise<void> {
  try {
    const projectRoot = await getProjectRoot(options.project);
    const index = await loadIndex(projectRoot);

    // Validate inputs
    if (!options.to) {
      console.error(chalk.red('❌ Target issue ID is required (use --to <issueId>)'));
      process.exit(1);
    }

    const targetIssueId = options.to;

    // Verify source issue exists
    if (!index.issues[issueId]) {
      console.error(chalk.red(`❌ Source issue ${issueId} not found`));
      process.exit(1);
    }

    // Verify target issue exists
    if (!index.issues[targetIssueId]) {
      console.error(chalk.red(`❌ Target issue ${targetIssueId} not found`));
      process.exit(1);
    }

    // Verify comment exists
    const issueComments = index.comments?.[issueId] || {};
    if (!issueComments[commentId]) {
      console.error(chalk.red(`❌ Comment ${commentId} not found in issue ${issueId}`));
      process.exit(1);
    }

    // Don't move to same issue
    if (issueId === targetIssueId) {
      console.error(chalk.red('❌ Cannot move comment to the same issue'));
      process.exit(1);
    }

    // Load comment
    const oldCommentPath = path.join(projectRoot, issueComments[commentId].path);
    const content = await fs.readFile(oldCommentPath, 'utf-8');
    const { frontmatter, content: body } = parseYamlFrontmatter(content);

    // Update comment data
    const now = new Date().toISOString();
    const updatedComment = {
      ...frontmatter,
      issueId: targetIssueId,
      updatedAt: now,
      metadata: {
        ...frontmatter.metadata,
        movedFrom: issueId,
        movedAt: now,
      },
    };

    // Clear metadata if not preserving
    if (!options.preserveMetadata) {
      delete updatedComment.metadata.reactions;
      delete updatedComment.metadata.attachments;
    }

    // Create target directory
    const targetCommentDir = path.join(projectRoot, 'tasks', 'issues', 'comments', targetIssueId);
    await fs.mkdir(targetCommentDir, { recursive: true });

    // Write to new location
    const newCommentPath = path.join(targetCommentDir, `${commentId}.md`);
    const updatedContent = stringifyYamlFrontmatter(updatedComment, body);
    await fs.writeFile(newCommentPath, updatedContent);

    // Delete from old location
    await fs.unlink(oldCommentPath);

    // Update index
    delete issueComments[commentId];
    
    // Clean up empty source comment entries
    if (Object.keys(issueComments).length === 0) {
      delete index.comments![issueId];
    }

    // Add to target issue comments
    if (!index.comments) {
      index.comments = {};
    }
    if (!index.comments[targetIssueId]) {
      index.comments[targetIssueId] = {};
    }
    index.comments[targetIssueId][commentId] = {
      path: path.relative(projectRoot, newCommentPath),
      lastModified: now,
    };

    await saveIndex(projectRoot, index);

    // Try to remove empty source directory
    const oldCommentDir = path.dirname(oldCommentPath);
    try {
      await fs.rmdir(oldCommentDir);
    } catch {
      // Directory not empty, ignore
    }

    // Display success message
    console.log(chalk.green(`✅ Comment moved successfully!`));
    console.log(chalk.blue(`ℹ️  Comment ID: ${commentId}`));
    console.log(chalk.blue(`ℹ️  From: ${issueId}`));
    console.log(chalk.blue(`ℹ️  To: ${targetIssueId}`));
    if (options.preserveMetadata) {
      console.log(chalk.blue(`ℹ️  Metadata preserved`));
    }

  } catch (error) {
    console.error(chalk.red('❌ Failed to move comment:'), error);
    process.exit(1);
  }
}