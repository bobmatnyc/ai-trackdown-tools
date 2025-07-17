import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Comment, CommentSortField, CommentSortDirection } from '../../types/comment.js';
import { getProjectRoot, loadIndex } from '../../utils/index.js';
import { formatComment } from '../../utils/formatters.js';
import { parseYamlFrontmatter } from '../../utils/yaml.js';

interface ListCommentsOptions {
  sort?: CommentSortField;
  direction?: CommentSortDirection;
  since?: string;
  limit?: string;
  page?: string;
  project?: string;
}

export async function listComments(issueId: string, options: ListCommentsOptions): Promise<void> {
  try {
    const projectRoot = await getProjectRoot(options.project);
    const index = await loadIndex(projectRoot);

    // Verify issue exists
    if (!index.issues[issueId]) {
      console.error(chalk.red(`❌ Issue ${issueId} not found`));
      process.exit(1);
    }

    // Get comments for the issue
    const issueComments = index.comments?.[issueId] || {};
    const commentIds = Object.keys(issueComments);

    if (commentIds.length === 0) {
      console.log(chalk.yellow(`No comments found for issue ${issueId}`));
      return;
    }

    // Load all comments
    const comments: Comment[] = [];
    for (const commentId of commentIds) {
      const commentPath = path.join(projectRoot, issueComments[commentId].path);
      try {
        const content = await fs.readFile(commentPath, 'utf-8');
        const { frontmatter, content: body } = parseYamlFrontmatter(content);
        
        const comment: Comment = {
          id: frontmatter.id,
          issueId: frontmatter.issueId,
          body: body.trim(),
          author: frontmatter.author,
          createdAt: frontmatter.createdAt,
          updatedAt: frontmatter.updatedAt,
          editedAt: frontmatter.editedAt,
          metadata: frontmatter.metadata,
        };

        // Apply since filter
        if (options.since) {
          const sinceDate = new Date(options.since);
          const commentDate = new Date(comment.createdAt);
          if (commentDate < sinceDate) {
            continue;
          }
        }

        comments.push(comment);
      } catch (error) {
        console.warn(chalk.yellow(`⚠️  Failed to load comment ${commentId}: ${error}`));
      }
    }

    // Sort comments
    const sortField = options.sort || 'created';
    const sortDirection = options.direction || 'asc';
    comments.sort((a, b) => {
      const aValue = sortField === 'created' ? a.createdAt : a.updatedAt;
      const bValue = sortField === 'created' ? b.createdAt : b.updatedAt;
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const limit = parseInt(options.limit || '50', 10);
    const page = parseInt(options.page || '1', 10);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedComments = comments.slice(startIndex, endIndex);

    // Display results
    console.log(chalk.blue(`📝 Comments for issue ${issueId}`));
    console.log(chalk.gray(`─`.repeat(50)));
    
    if (comments.length > limit) {
      console.log(chalk.gray(`Showing ${startIndex + 1}-${Math.min(endIndex, comments.length)} of ${comments.length} comments`));
      console.log(chalk.gray(`─`.repeat(50)));
    }

    for (const comment of paginatedComments) {
      console.log(chalk.cyan(`${comment.id}`), chalk.gray(`by ${comment.author}`));
      console.log(chalk.gray(`Created: ${new Date(comment.createdAt).toLocaleDateString()}`));
      
      if (comment.editedAt) {
        console.log(chalk.gray(`Edited: ${new Date(comment.editedAt).toLocaleDateString()}`));
      }
      
      console.log();
      console.log(formatComment(comment));
      console.log(chalk.gray(`─`.repeat(50)));
    }

    // Show pagination info
    if (comments.length > limit) {
      const totalPages = Math.ceil(comments.length / limit);
      console.log();
      console.log(chalk.gray(`Page ${page} of ${totalPages}`));
      
      if (page < totalPages) {
        console.log(chalk.gray(`Use --page ${page + 1} to see more comments`));
      }
    }

  } catch (error) {
    console.error(chalk.red('❌ Failed to list comments:'), error);
    process.exit(1);
  }
}