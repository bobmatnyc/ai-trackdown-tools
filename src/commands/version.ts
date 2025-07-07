import { Command } from 'commander';
import { createShowCommand } from './version/show.js';
import { createBumpCommand } from './version/bump.js';
import { createChangelogCommand } from './version/changelog.js';
import { createTagCommand } from './version/tag.js';
import { createSyncCommand } from './version/sync.js';
import { createReleaseCommand } from './version/release.js';

export function createVersionCommand(): Command {
  const command = new Command('version');

  command
    .description('Version management commands')
    .addHelpText('after', `
Examples:
  $ trackdown version show                    # Display current version
  $ trackdown version bump patch             # Bump patch version (0.1.0 → 0.1.1)
  $ trackdown version bump minor             # Bump minor version (0.1.0 → 0.2.0)
  $ trackdown version bump major             # Bump major version (0.1.0 → 1.0.0)
  $ trackdown version changelog generate     # Generate/update CHANGELOG.md
  $ trackdown version tag --push             # Create and push git tag
  $ trackdown version sync                   # Sync version across all files
  $ trackdown version release minor --push   # Complete release process

Version Management:
  This tool follows semantic versioning (semver.org) and conventional commits.
  The VERSION file is the source of truth for the project version.
    `);

  // Add subcommands
  command.addCommand(createShowCommand());
  command.addCommand(createBumpCommand());
  command.addCommand(createChangelogCommand());
  command.addCommand(createTagCommand());
  command.addCommand(createSyncCommand());
  command.addCommand(createReleaseCommand());

  return command;
}