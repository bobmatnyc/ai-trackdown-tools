import chalk from 'chalk';
import { Command } from 'commander';
import { createExportCommand } from './commands/export.js';
import { createInitCommand } from './commands/init.js';
import { createStatusCommand } from './commands/status.js';
import { createTrackCommand } from './commands/track.js';
import { createVersionCommand } from './commands/version.js';
import { createIssueCommand } from './commands/issue.js';
import { createLabelCommand } from './commands/label.js';
import { createMilestoneCommand } from './commands/milestone.js';
import { createProjectCommand } from './commands/project.js';
import { createBulkCommand } from './commands/bulk.js';
import { VersionManager } from './utils/version.js';
import { Formatter } from './utils/formatter.js';

// Get version from VERSION file
function getVersion(): string {
  try {
    return VersionManager.getVersion().version;
  } catch {
    return '0.1.0'; // fallback if VERSION file is not available
  }
}

// Package info
const packageInfo = {
  name: 'ai-trackdown-tooling',
  version: getVersion(),
  description: 'Professional CLI tool for ai-trackdown functionality',
};

async function main(): Promise<void> {
  const program = new Command();

  // Configure main program
  program
    .name('aitrackdown')
    .description(packageInfo.description)
    .version(packageInfo.version, '-v, --version', 'display version number')
    .helpOption('-h, --help', 'display help for command');

  // Add global options
  program
    .option('--verbose', 'enable verbose output')
    .option('--config <path>', 'path to config file')
    .option('--no-color', 'disable colored output');

  // Handle global options
  program.hook('preAction', (thisCommand) => {
    // Handle no-color option
    if (program.opts().noColor) {
      process.env.FORCE_COLOR = '0';
    }

    // Handle verbose option
    if (program.opts().verbose) {
      console.log(Formatter.debug(`Running command: ${thisCommand.name()}`));
      console.log(Formatter.debug(`Arguments: ${JSON.stringify(thisCommand.args)}`));
      console.log(Formatter.debug(`Options: ${JSON.stringify(thisCommand.opts())}`));
    }
  });

  // Add commands
  program.addCommand(createInitCommand());
  program.addCommand(createTrackCommand());
  program.addCommand(createStatusCommand());
  program.addCommand(createExportCommand());
  program.addCommand(createVersionCommand());
  
  // GitHub Issues API commands
  program.addCommand(createIssueCommand());
  program.addCommand(createLabelCommand());
  program.addCommand(createMilestoneCommand());
  program.addCommand(createProjectCommand());
  program.addCommand(createBulkCommand());

  // Add helpful aliases
  program
    .command('atd')
    .alias('aitrackdown')
    .description('alias for aitrackdown command')
    .action(() => {
      console.log(Formatter.info('Use "aitrackdown --help" to see available commands'));
    });

  // Handle unknown commands
  program.on('command:*', (operands) => {
    console.error(Formatter.error(`Unknown command: ${operands[0]}`));
    console.log(Formatter.info('Run "aitrackdown --help" to see available commands'));
    process.exit(1);
  });

  // Custom help
  program.on('--help', () => {
    console.log('');
    console.log(chalk.bold.cyan('GitHub Issues API Commands:'));
    console.log('  $ aitrackdown issue create "Bug in login flow" --labels bug,high-priority');
    console.log('  $ aitrackdown issue list --state open --assignee @me');
    console.log('  $ aitrackdown issue search "is:open label:bug created:>1w"');
    console.log('  $ aitrackdown label create "priority:high" --color ff0000');
    console.log('  $ aitrackdown label apply 123 bug enhancement');
    console.log('  $ aitrackdown milestone create "Sprint 1" --due-date "2025-01-15"');
    console.log('  $ aitrackdown milestone list --show-progress');
    console.log('  $ aitrackdown project create "Q1 Roadmap" --template "roadmap"');
    console.log('  $ aitrackdown bulk assign --issues "123-130" --assignee "johndoe"');
    console.log('');
    console.log(chalk.bold.cyan('Traditional Commands:'));
    console.log('  $ aitrackdown init my-project');
    console.log('  $ aitrackdown track "Implement user login"');
    console.log('  $ aitrackdown status --verbose');
    console.log('  $ aitrackdown export --format json');
    console.log('');
    console.log(chalk.bold.cyan('Aliases:'));
    console.log('  atd = aitrackdown (shorter command)');
    console.log('');
    console.log(chalk.bold.cyan('Learn more:'));
    console.log('  Documentation: https://github.com/your-org/ai-trackdown-tooling');
    console.log('  Issues: https://github.com/your-org/ai-trackdown-tooling/issues');
  });

  // Error handling
  process.on('uncaughtException', (error) => {
    console.error(Formatter.error(`Uncaught exception: ${error.message}`));
    if (program.opts().verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error(Formatter.error(`Unhandled rejection: ${reason}`));
    if (program.opts().verbose && reason instanceof Error) {
      console.error(reason.stack);
    }
    process.exit(1);
  });

  // Parse arguments
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(
      Formatter.error(`Command failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    );

    if (error instanceof Error) {
      // Check for common error types and provide helpful suggestions
      if (error.message.includes('EACCES')) {
        console.log(Formatter.info('Permission denied. Try running with appropriate permissions.'));
      } else if (error.message.includes('ENOENT')) {
        console.log(Formatter.info('File or directory not found. Check the path and try again.'));
      } else if (error.message.includes('EEXIST')) {
        console.log(Formatter.info('File or directory already exists. Use --force to overwrite.'));
      } else if (program.opts().verbose) {
        console.error(error.stack);
      }
    }

    process.exit(1);
  }
}

// Start the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(Formatter.error(`Fatal error: ${error.message}`));
    process.exit(1);
  });
}
