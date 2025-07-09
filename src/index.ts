import chalk from 'chalk';
import { Command } from 'commander';
import { createExportCommand } from './commands/export.js';
import { createInitCommand } from './commands/init.js';
import { createStatusCommand } from './commands/status.js';
import { createStatusEnhancedCommand } from './commands/status-enhanced.js';
import { createBacklogCommand } from './commands/backlog.js';
import { createBacklogEnhancedCommand } from './commands/backlog-enhanced.js';
import { createPortfolioCommand } from './commands/portfolio.js';
import { createTrackCommand } from './commands/track.js';
import { createVersionCommand } from './commands/version.js';
import { createEpicCommand } from './commands/epic.js';
import { createIssueCommand } from './commands/issue.js';
import { createTaskCommand } from './commands/task.js';
import { createPRCommand } from './commands/pr.js';
import { createProjectCommand } from './commands/project.js';
import { createAiCommand } from './commands/ai.js';
import { createSyncCommand } from './commands/sync.js';
import { createMigrateCommand } from './commands/migrate.js';
import { createMigrateStructureCommand } from './commands/migrate-structure.js';
import { VersionManager } from './utils/version.js';
import { Formatter } from './utils/formatter.js';

// Get version from VERSION file
function getVersion(): string {
  try {
    return VersionManager.getVersion().version;
  } catch (error) {
    console.warn('Warning: Could not read VERSION file, using fallback version');
    return '1.0.1'; // fallback that matches package.json
  }
}

// Package info
const packageInfo = {
  name: 'ai-trackdown-tools',
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
    .option('--no-color', 'disable colored output')
    .option('--root-dir <path>', 'root directory for trackdown files (default: tasks/)')
    .option('--tasks-dir <path>', 'alias for --root-dir')
    .option('--project-dir <path>', 'target project directory for anywhere-submit functionality');

  // Handle global options
  program.hook('preAction', (thisCommand) => {
    const opts = program.opts();
    
    // Handle no-color option
    if (opts.noColor) {
      process.env.FORCE_COLOR = '0';
    }

    // Handle project directory option (--project-dir)
    if (opts.projectDir) {
      process.env.CLI_PROJECT_DIR = opts.projectDir;
      // Change working directory to target project
      try {
        process.chdir(opts.projectDir);
      } catch (error) {
        console.error(Formatter.error(`Failed to change to project directory: ${opts.projectDir}`));
        console.error(Formatter.error(error instanceof Error ? error.message : 'Unknown error'));
        process.exit(1);
      }
    }

    // Handle tasks directory options (--root-dir or --tasks-dir)
    const tasksDir = opts.tasksDir || opts.rootDir;
    if (tasksDir) {
      process.env.CLI_TASKS_DIR = tasksDir;
    }

    // Handle verbose option
    if (opts.verbose) {
      console.log(Formatter.debug(`Running command: ${thisCommand.name()}`));
      console.log(Formatter.debug(`Arguments: ${JSON.stringify(thisCommand.args)}`));
      console.log(Formatter.debug(`Options: ${JSON.stringify(thisCommand.opts())}`));
      if (opts.projectDir) {
        console.log(Formatter.debug(`Project directory: ${opts.projectDir}`));
      }
      if (tasksDir) {
        console.log(Formatter.debug(`Tasks directory override: ${tasksDir}`));
      }
    }
  });

  // Add core commands
  program.addCommand(createInitCommand());
  program.addCommand(createTrackCommand());
  program.addCommand(createStatusCommand());
  program.addCommand(createStatusEnhancedCommand());
  program.addCommand(createBacklogCommand());
  program.addCommand(createBacklogEnhancedCommand());
  program.addCommand(createPortfolioCommand());
  program.addCommand(createExportCommand());
  program.addCommand(createVersionCommand());
  
  // AI-Trackdown hierarchical commands
  program.addCommand(createProjectCommand());
  program.addCommand(createEpicCommand());
  program.addCommand(createIssueCommand());
  program.addCommand(createTaskCommand());
  program.addCommand(createPRCommand());
  program.addCommand(createAiCommand());
  program.addCommand(createSyncCommand());
  
  // Migration commands
  program.addCommand(createMigrateCommand());
  program.addCommand(createMigrateStructureCommand());

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
    console.log(chalk.bold.cyan('🚀 AI-Trackdown CLI - Comprehensive Project Management Tool'));
    console.log('');
    console.log(chalk.bold.yellow('📋 HIERARCHICAL STRUCTURE:'));
    console.log('  Epics → Issues → Tasks → PRs (Pull Requests)');
    console.log('  Each level tracks tokens, progress, and relationships');
    console.log('');
    console.log(chalk.bold.cyan('🏗️ HIERARCHICAL COMMANDS:'));
    console.log('  Epic Management:');
    console.log('    $ aitrackdown epic create "User Authentication System"');
    console.log('    $ aitrackdown epic list --status active --show-progress');
    console.log('    $ aitrackdown epic show EP-0001 --with-issues');
    console.log('    $ aitrackdown epic complete EP-0001 --actual-tokens 1500');
    console.log('');
    console.log('  Issue Management:');
    console.log('    $ aitrackdown issue create "Implement login form" --epic EP-0001');
    console.log('    $ aitrackdown issue list --epic EP-0001 --status active');
    console.log('    $ aitrackdown issue complete ISS-0001 --actual-tokens 500');
    console.log('    $ aitrackdown issue assign ISS-0001 --assignee john');
    console.log('');
    console.log('  Task Management:');
    console.log('    $ aitrackdown task create "Create login UI" --issue ISS-0001');
    console.log('    $ aitrackdown task list --issue ISS-0001 --assignee john');
    console.log('    $ aitrackdown task complete TSK-0001 --time-spent 2h');
    console.log('    $ aitrackdown task update TSK-0001 --status active');
    console.log('');
    console.log('  PR Management:');
    console.log('    $ aitrackdown pr create "Add login functionality" --issue ISS-0001');
    console.log('    $ aitrackdown pr list --status open --assignee john');
    console.log('    $ aitrackdown pr merge PR-0001 --delete-branch');
    console.log('    $ aitrackdown pr review PR-0001 --approve --comment "LGTM"');
    console.log('');
    console.log('  GitHub Sync:');
    console.log('    $ aitrackdown sync setup --repository owner/repo --token ghp_xxx');
    console.log('    $ aitrackdown sync push --verbose');
    console.log('    $ aitrackdown sync pull --dry-run');
    console.log('    $ aitrackdown sync bidirectional');
    console.log('    $ aitrackdown sync status --verbose');
    console.log('    $ aitrackdown sync auto --enable');
    console.log('');
    console.log(chalk.bold.cyan('🤖 AI-SPECIFIC COMMANDS:'));
    console.log('  Token Tracking:');
    console.log('    $ aitrackdown ai track-tokens --report');
    console.log('    $ aitrackdown ai generate-llms-txt --format detailed');
    console.log('    $ aitrackdown ai context --item-id EP-0001 --add "context/requirements"');
    console.log('');
    console.log(chalk.bold.cyan('🎯 ANYWHERE-SUBMIT FUNCTIONALITY:'));
    console.log('  Work with any project from anywhere:');
    console.log('    $ aitrackdown issue create "Fix bug" --project-dir ~/Projects/my-app');
    console.log('    $ aitrackdown task list --project-dir ~/Projects/managed/ai-power-rankings');
    console.log('    $ aitrackdown status --project-dir ~/Projects/another-project');
    console.log('');
    console.log(chalk.bold.cyan('⚙️ CORE PROJECT COMMANDS:'));
    console.log('  Project Setup:');
    console.log('    $ aitrackdown init my-project');
    console.log('    $ aitrackdown status --verbose');
    console.log('    $ aitrackdown status --full');
    console.log('');
    console.log('  Data Management:');
    console.log('    $ aitrackdown backlog --with-issues');
    console.log('    $ aitrackdown portfolio --health');
    console.log('    $ aitrackdown export --format json');
    console.log('');
    console.log(chalk.bold.cyan('🔄 MIGRATION COMMANDS:'));
    console.log('  Legacy to Modern Structure:');
    console.log('    $ aitrackdown migrate --dry-run --verbose');
    console.log('    $ aitrackdown migrate --backup');
    console.log('    $ aitrackdown migrate-structure --dry-run');
    console.log('    $ aitrackdown migrate-structure --tasks-dir work');
    console.log('');
    console.log(chalk.bold.cyan('⚡ ALIASES & SHORTCUTS:'));
    console.log('  atd = aitrackdown (shorter command)');
    console.log('  issue = issues, task = tasks, pr = prs');
    console.log('');
    console.log(chalk.bold.cyan('🔧 GLOBAL OPTIONS:'));
    console.log('  --project-dir <path>    Target project directory (anywhere-submit)');
    console.log('  --root-dir <path>       Root directory for trackdown files');
    console.log('  --tasks-dir <path>      Alias for --root-dir');
    console.log('  --verbose               Enable verbose output');
    console.log('  --no-color              Disable colored output');
    console.log('  --config <path>         Path to config file');
    console.log('');
    console.log(chalk.bold.cyan('📖 LEARN MORE:'));
    console.log('  Documentation: https://github.com/bobmatnyc/ai-trackdown-tools');
    console.log('  Issues: https://github.com/bobmatnyc/ai-trackdown-tools/issues');
    console.log('  Version: ' + packageInfo.version);
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

// Export main function for CLI entry point
export { main };
