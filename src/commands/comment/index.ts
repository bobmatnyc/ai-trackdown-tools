import { Command } from 'commander';
import { addComment } from './add.js';
import { listComments } from './list.js';
import { updateComment } from './update.js';
import { deleteComment } from './delete.js';
import { moveComment } from './move.js';

export function createCommentCommand(): Command {
  const comment = new Command('comment')
    .description('Manage issue comments');

  comment
    .command('add <issueId>')
    .description('Add a comment to an issue')
    .option('-b, --body <text>', 'Comment body text')
    .option('-e, --editor', 'Open editor for comment body')
    .option('-p, --project <path>', 'Path to project (defaults to current directory)')
    .action(addComment);

  comment
    .command('list <issueId>')
    .description('List comments for an issue')
    .option('-s, --sort <field>', 'Sort by field (created|updated)', 'created')
    .option('-d, --direction <dir>', 'Sort direction (asc|desc)', 'asc')
    .option('--since <date>', 'Show comments since date')
    .option('--limit <number>', 'Limit number of results', '50')
    .option('--page <number>', 'Page number for pagination', '1')
    .option('-p, --project <path>', 'Path to project (defaults to current directory)')
    .action(listComments);

  comment
    .command('update <issueId> <commentId>')
    .description('Update a comment')
    .option('-b, --body <text>', 'New comment body text')
    .option('-e, --editor', 'Open editor for comment body')
    .option('-p, --project <path>', 'Path to project (defaults to current directory)')
    .action(updateComment);

  comment
    .command('delete <issueId> <commentId>')
    .description('Delete a comment')
    .option('-c, --confirm', 'Skip confirmation prompt')
    .option('-f, --force', 'Force delete without confirmation')
    .option('-p, --project <path>', 'Path to project (defaults to current directory)')
    .action(deleteComment);

  comment
    .command('move <issueId> <commentId>')
    .description('Move a comment to another issue')
    .option('-t, --to <issueId>', 'Target issue ID', '')
    .option('--preserve-metadata', 'Preserve reactions and other metadata')
    .option('-p, --project <path>', 'Path to project (defaults to current directory)')
    .action(moveComment);

  return comment;
}