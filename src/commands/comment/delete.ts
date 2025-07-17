import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { getProjectRoot, loadIndex, saveIndex } from '../../utils/index.js';

interface DeleteCommentOptions {
  confirm?: boolean;
  force?: boolean;
  project?: string;
}

export async function deleteComment(
  issueId: string,
  commentId: string,
  options: DeleteCommentOptions
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

    // Confirm deletion
    if (!options.force && !options.confirm) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: `Are you sure you want to delete comment ${commentId}?`,
          default: false,
        },
      ]);

      if (!confirmed) {
        console.log(chalk.yellow('Deletion cancelled'));
        return;
      }
    }

    // Delete comment file
    const commentPath = path.join(projectRoot, issueComments[commentId].path);
    await fs.unlink(commentPath);

    // Update index
    delete issueComments[commentId];
    
    // Clean up empty comment entries
    if (Object.keys(issueComments).length === 0) {
      delete index.comments![issueId];
    }

    await saveIndex(projectRoot, index);

    // Try to remove empty comment directory
    const commentDir = path.dirname(commentPath);
    try {
      await fs.rmdir(commentDir);
    } catch {
      // Directory not empty, ignore
    }

    // Display success message
    console.log(chalk.green(`✅ Comment ${commentId} deleted successfully!`));

  } catch (error) {
    console.error(chalk.red('❌ Failed to delete comment:'), error);
    process.exit(1);
  }
}