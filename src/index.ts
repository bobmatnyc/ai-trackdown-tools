import chalk from 'chalk';
import { Command } from 'commander';
import { createExportCommand } from './commands/export.js';
import { createInitCommand } from './commands/init.js';
import { createStatusCommand } from './commands/status.js';
import { createTrackCommand } from './commands/track.js';
import { createVersionCommand } from './commands/version.js';
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
    .name('trackdown')
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

  // Add helpful aliases
  program
    .command('td')
    .alias('trackdown')
    .description('alias for trackdown command')
    .action(() => {
      console.log(Formatter.info('Use "trackdown --help" to see available commands'));
    });

  // Handle unknown commands
  program.on('command:*', (operands) => {
    console.error(Formatter.error(`Unknown command: ${operands[0]}`));
    console.log(Formatter.info('Run "trackdown --help" to see available commands'));
    process.exit(1);
  });

  // Custom help
  program.on('--help', () => {
    console.log('');
    console.log(chalk.bold.cyan('Examples:'));
    console.log('  $ trackdown init my-project');
    console.log('  $ trackdown track "Implement user login"');
    console.log('  $ trackdown status --verbose');
    console.log('  $ trackdown export --format json');
    console.log('');
    console.log(chalk.bold.cyan('Aliases:'));
    console.log('  td = trackdown (shorter command)');
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
