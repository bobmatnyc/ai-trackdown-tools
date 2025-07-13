/**
 * PR Dependencies Management Command
 * Handles PR blocking relationships and dependency management
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import type { PRData } from '../../types/ai-trackdown.js';
import { colors } from '../../utils/colors.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { PRStatusManager } from '../../utils/pr-status-manager.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';

export type DependencyType = 'blocks' | 'blocked_by' | 'depends_on' | 'required_by';

export interface DependencyRelation {
  prId: string;
  dependentPrId: string;
  type: DependencyType;
  reason?: string;
  created: string;
  createdBy: string;
  resolved?: string;
  resolvedBy?: string;
}

export interface DependencyGraph {
  prId: string;
  blocks: string[];
  blockedBy: string[];
  dependsOn: string[];
  requiredBy: string[];
  canMerge: boolean;
  blockingReasons: string[];
}

export interface DependencyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  circularDependencies: string[][];
  unresolvedDependencies: string[];
}

export function createPRDependenciesCommand(): Command {
  const cmd = new Command('deps');

  cmd.description('Manage PR dependencies and blocking relationships');

  // Add dependency
  cmd
    .command('add')
    .description('Add a dependency relationship between PRs')
    .argument('<pr-id>', 'PR ID that has the dependency')
    .argument('<dependent-pr-id>', 'PR ID that this PR depends on')
    .option(
      '-t, --type <type>',
      'Dependency type (blocks|blocked_by|depends_on|required_by)',
      'depends_on'
    )
    .option('-r, --reason <reason>', 'Reason for the dependency')
    .action(async (prId: string, dependentPrId: string, options: any) => {
      const configManager = new ConfigManager();
      const statusManager = new PRStatusManager(configManager);
      const relationshipManager = new RelationshipManager(configManager);

      try {
        const result = await addDependency(
          prId,
          dependentPrId,
          options.type as DependencyType,
          options.reason,
          statusManager,
          relationshipManager,
          configManager
        );

        if (result.success) {
          console.log(
            colors.green(`✅ Added dependency: ${prId} ${options.type} ${dependentPrId}`)
          );
          if (options.reason) {
            console.log(`📝 Reason: ${options.reason}`);
          }
          if (result.warnings.length > 0) {
            console.log(colors.yellow('⚠️  Warnings:'));
            result.warnings.forEach((warning) => console.log(colors.yellow(`  - ${warning}`)));
          }
        } else {
          console.error(colors.red(`❌ Failed to add dependency`));
          result.errors.forEach((error) => console.error(colors.red(`  • ${error}`)));
          process.exit(1);
        }
      } catch (error) {
        console.error(
          colors.red(
            `❌ Error adding dependency: ${error instanceof Error ? error.message : String(error)}`
          )
        );
        process.exit(1);
      }
    });

  // Remove dependency
  cmd
    .command('remove')
    .description('Remove a dependency relationship between PRs')
    .argument('<pr-id>', 'PR ID')
    .argument('<dependent-pr-id>', 'Dependent PR ID')
    .option(
      '-t, --type <type>',
      'Dependency type to remove (blocks|blocked_by|depends_on|required_by)'
    )
    .action(async (prId: string, dependentPrId: string, options: any) => {
      const configManager = new ConfigManager();
      const statusManager = new PRStatusManager(configManager);
      const relationshipManager = new RelationshipManager(configManager);

      try {
        const result = await removeDependency(
          prId,
          dependentPrId,
          options.type as DependencyType,
          statusManager,
          relationshipManager,
          configManager
        );

        if (result.success) {
          console.log(
            colors.green(`✅ Removed dependency: ${prId} ${options.type || 'all'} ${dependentPrId}`)
          );
        } else {
          console.error(colors.red(`❌ Failed to remove dependency`));
          result.errors.forEach((error) => console.error(colors.red(`  • ${error}`)));
          process.exit(1);
        }
      } catch (error) {
        console.error(
          colors.red(
            `❌ Error removing dependency: ${error instanceof Error ? error.message : String(error)}`
          )
        );
        process.exit(1);
      }
    });

  // List dependencies
  cmd
    .command('list')
    .description('List PR dependencies')
    .argument('<pr-id>', 'PR ID to show dependencies for')
    .option('-a, --all', 'Show all dependencies in the project', false)
    .option('-f, --format <format>', 'Output format (table|json|graph)', 'table')
    .action(async (prId: string, options: any) => {
      const configManager = new ConfigManager();
      const statusManager = new PRStatusManager(configManager);
      const relationshipManager = new RelationshipManager(configManager);
      const formatter = new Formatter();

      try {
        if (options.all) {
          const allDependencies = await getAllDependencies(
            statusManager,
            relationshipManager,
            configManager
          );
          displayDependencies(allDependencies, options.format, formatter);
        } else {
          const dependencies = await getPRDependencies(
            prId,
            statusManager,
            relationshipManager,
            configManager
          );
          displayPRDependencies(dependencies, options.format, formatter);
        }
      } catch (error) {
        console.error(
          colors.red(
            `❌ Error listing dependencies: ${error instanceof Error ? error.message : String(error)}`
          )
        );
        process.exit(1);
      }
    });

  // Validate dependencies
  cmd
    .command('validate')
    .description('Validate PR dependencies for circular references and conflicts')
    .option('-f, --fix', 'Attempt to fix validation issues', false)
    .action(async (options: any) => {
      const configManager = new ConfigManager();
      const statusManager = new PRStatusManager(configManager);
      const relationshipManager = new RelationshipManager(configManager);

      try {
        const result = await validateDependencies(
          statusManager,
          relationshipManager,
          configManager
        );

        if (result.valid) {
          console.log(colors.green('✅ All PR dependencies are valid'));
        } else {
          console.log(colors.red('❌ PR dependency validation failed'));

          if (result.errors.length > 0) {
            console.log(colors.red('\nErrors:'));
            result.errors.forEach((error) => console.log(colors.red(`  • ${error}`)));
          }

          if (result.circularDependencies.length > 0) {
            console.log(colors.red('\nCircular Dependencies:'));
            result.circularDependencies.forEach((cycle) => {
              console.log(colors.red(`  • ${cycle.join(' → ')}`));
            });
          }

          if (result.unresolvedDependencies.length > 0) {
            console.log(colors.yellow('\nUnresolved Dependencies:'));
            result.unresolvedDependencies.forEach((dep) => {
              console.log(colors.yellow(`  • ${dep}`));
            });
          }

          if (result.warnings.length > 0) {
            console.log(colors.yellow('\nWarnings:'));
            result.warnings.forEach((warning) => console.log(colors.yellow(`  • ${warning}`)));
          }

          if (options.fix) {
            console.log(colors.blue('\n🔧 Attempting to fix issues...'));
            const fixResult = await fixDependencyIssues(
              result,
              statusManager,
              relationshipManager,
              configManager
            );
            if (fixResult.success) {
              console.log(colors.green('✅ Issues fixed successfully'));
            } else {
              console.log(colors.red('❌ Failed to fix some issues'));
              fixResult.errors.forEach((error) => console.log(colors.red(`  • ${error}`)));
            }
          }
        }
      } catch (error) {
        console.error(
          colors.red(
            `❌ Error validating dependencies: ${error instanceof Error ? error.message : String(error)}`
          )
        );
        process.exit(1);
      }
    });

  // Check if PR can be merged
  cmd
    .command('check-merge')
    .description('Check if a PR can be merged based on dependencies')
    .argument('<pr-id>', 'PR ID to check')
    .action(async (prId: string) => {
      const configManager = new ConfigManager();
      const statusManager = new PRStatusManager(configManager);
      const relationshipManager = new RelationshipManager(configManager);

      try {
        const result = await checkMergeability(
          prId,
          statusManager,
          relationshipManager,
          configManager
        );

        if (result.canMerge) {
          console.log(colors.green(`✅ PR ${prId} can be merged`));
        } else {
          console.log(colors.red(`❌ PR ${prId} cannot be merged`));
          console.log(colors.red('Blocking reasons:'));
          result.blockingReasons.forEach((reason) => {
            console.log(colors.red(`  • ${reason}`));
          });
        }

        if (result.blocks.length > 0) {
          console.log(colors.blue(`\n🔒 This PR blocks: ${result.blocks.join(', ')}`));
        }

        if (result.blockedBy.length > 0) {
          console.log(colors.yellow(`\n⏳ This PR is blocked by: ${result.blockedBy.join(', ')}`));
        }
      } catch (error) {
        console.error(
          colors.red(
            `❌ Error checking merge status: ${error instanceof Error ? error.message : String(error)}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function addDependency(
  prId: string,
  dependentPrId: string,
  type: DependencyType,
  reason: string | undefined,
  statusManager: PRStatusManager,
  relationshipManager: RelationshipManager,
  configManager: ConfigManager
): Promise<{ success: boolean; errors: string[]; warnings: string[] }> {
  const result = {
    success: false,
    errors: [] as string[],
    warnings: [] as string[],
  };

  try {
    // Validate both PRs exist
    const pr1 = await statusManager.loadPRData(prId);
    const pr2 = await statusManager.loadPRData(dependentPrId);

    if (!pr1) {
      result.errors.push(`PR ${prId} not found`);
      return result;
    }

    if (!pr2) {
      result.errors.push(`PR ${dependentPrId} not found`);
      return result;
    }

    // Check for circular dependencies
    const wouldCreateCircle = await wouldCreateCircularDependency(
      prId,
      dependentPrId,
      type,
      statusManager,
      relationshipManager,
      configManager
    );

    if (wouldCreateCircle) {
      result.errors.push(`Adding this dependency would create a circular dependency`);
      return result;
    }

    // Add the dependency
    const dependency: DependencyRelation = {
      prId,
      dependentPrId,
      type,
      reason,
      created: new Date().toISOString(),
      createdBy: 'system', // This would be the current user
    };

    await saveDependency(dependency, configManager);

    // Update PR files with dependency information
    await updatePRWithDependency(pr1, dependency, 'outgoing', configManager);
    await updatePRWithDependency(pr2, dependency, 'incoming', configManager);

    result.success = true;

    // Add warnings for potential issues
    if (pr1.pr_status === 'merged' || pr2.pr_status === 'merged') {
      result.warnings.push('One or both PRs are already merged - this dependency may be obsolete');
    }

    return result;
  } catch (error) {
    result.errors.push(
      `Failed to add dependency: ${error instanceof Error ? error.message : String(error)}`
    );
    return result;
  }
}

async function removeDependency(
  prId: string,
  dependentPrId: string,
  type: DependencyType | undefined,
  _statusManager: PRStatusManager,
  _relationshipManager: RelationshipManager,
  configManager: ConfigManager
): Promise<{ success: boolean; errors: string[] }> {
  const result = {
    success: false,
    errors: [] as string[],
  };

  try {
    const dependencies = await loadDependencies(configManager);
    const toRemove = dependencies.filter(
      (dep) =>
        dep.prId === prId && dep.dependentPrId === dependentPrId && (!type || dep.type === type)
    );

    if (toRemove.length === 0) {
      result.errors.push('No matching dependency found');
      return result;
    }

    const remaining = dependencies.filter((dep) => !toRemove.includes(dep));
    await saveDependencies(remaining, configManager);

    result.success = true;
    return result;
  } catch (error) {
    result.errors.push(
      `Failed to remove dependency: ${error instanceof Error ? error.message : String(error)}`
    );
    return result;
  }
}

async function getPRDependencies(
  prId: string,
  _statusManager: PRStatusManager,
  _relationshipManager: RelationshipManager,
  configManager: ConfigManager
): Promise<DependencyGraph> {
  const dependencies = await loadDependencies(configManager);

  const graph: DependencyGraph = {
    prId,
    blocks: [],
    blockedBy: [],
    dependsOn: [],
    requiredBy: [],
    canMerge: true,
    blockingReasons: [],
  };

  dependencies.forEach((dep) => {
    if (dep.prId === prId) {
      switch (dep.type) {
        case 'blocks':
          graph.blocks.push(dep.dependentPrId);
          break;
        case 'depends_on':
          graph.dependsOn.push(dep.dependentPrId);
          break;
        case 'required_by':
          graph.requiredBy.push(dep.dependentPrId);
          break;
      }
    }

    if (dep.dependentPrId === prId) {
      switch (dep.type) {
        case 'blocked_by':
          graph.blockedBy.push(dep.prId);
          break;
        case 'depends_on':
          graph.blockedBy.push(dep.prId);
          break;
        case 'required_by':
          graph.blocks.push(dep.prId);
          break;
      }
    }
  });

  // Check if PR can be merged
  if (graph.blockedBy.length > 0) {
    graph.canMerge = false;
    graph.blockingReasons.push(`Blocked by PRs: ${graph.blockedBy.join(', ')}`);
  }

  return graph;
}

async function getAllDependencies(
  _statusManager: PRStatusManager,
  _relationshipManager: RelationshipManager,
  configManager: ConfigManager
): Promise<DependencyRelation[]> {
  return await loadDependencies(configManager);
}

async function validateDependencies(
  statusManager: PRStatusManager,
  _relationshipManager: RelationshipManager,
  configManager: ConfigManager
): Promise<DependencyValidationResult> {
  const result: DependencyValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    circularDependencies: [],
    unresolvedDependencies: [],
  };

  try {
    const dependencies = await loadDependencies(configManager);

    // Check for circular dependencies
    const cycles = findCircularDependencies(dependencies);
    if (cycles.length > 0) {
      result.valid = false;
      result.circularDependencies = cycles;
      result.errors.push(`Found ${cycles.length} circular dependencies`);
    }

    // Check for unresolved dependencies (PRs that don't exist)
    const allPRs = await statusManager.listPRs();
    const prIds = new Set(allPRs.map((pr) => pr.pr_id));

    dependencies.forEach((dep) => {
      if (!prIds.has(dep.prId)) {
        result.unresolvedDependencies.push(`${dep.prId} (referenced in dependency)`);
      }
      if (!prIds.has(dep.dependentPrId)) {
        result.unresolvedDependencies.push(`${dep.dependentPrId} (referenced in dependency)`);
      }
    });

    if (result.unresolvedDependencies.length > 0) {
      result.valid = false;
      result.errors.push(`Found ${result.unresolvedDependencies.length} unresolved dependencies`);
    }

    return result;
  } catch (error) {
    result.valid = false;
    result.errors.push(
      `Validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return result;
  }
}

async function checkMergeability(
  prId: string,
  statusManager: PRStatusManager,
  relationshipManager: RelationshipManager,
  configManager: ConfigManager
): Promise<DependencyGraph> {
  return await getPRDependencies(prId, statusManager, relationshipManager, configManager);
}

async function wouldCreateCircularDependency(
  prId: string,
  dependentPrId: string,
  type: DependencyType,
  _statusManager: PRStatusManager,
  _relationshipManager: RelationshipManager,
  configManager: ConfigManager
): Promise<boolean> {
  const dependencies = await loadDependencies(configManager);

  // Add the proposed dependency temporarily
  const proposedDep: DependencyRelation = {
    prId,
    dependentPrId,
    type,
    created: new Date().toISOString(),
    createdBy: 'system',
  };

  const allDeps = [...dependencies, proposedDep];
  const cycles = findCircularDependencies(allDeps);

  return cycles.length > 0;
}

function findCircularDependencies(dependencies: DependencyRelation[]): string[][] {
  const graph = new Map<string, Set<string>>();

  // Build dependency graph
  dependencies.forEach((dep) => {
    if (!graph.has(dep.prId)) {
      graph.set(dep.prId, new Set());
    }
    graph.get(dep.prId)?.add(dep.dependentPrId);
  });

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (recursionStack.has(node)) {
      // Found a cycle
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push([...path.slice(cycleStart), node]);
      }
      return;
    }

    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graph.get(node);
    if (neighbors) {
      for (const neighbor of neighbors) {
        dfs(neighbor, path);
      }
    }

    path.pop();
    recursionStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

async function loadDependencies(configManager: ConfigManager): Promise<DependencyRelation[]> {
  const depsPath = path.join(configManager.getPRsDirectory(), 'dependencies.json');

  if (!fs.existsSync(depsPath)) {
    return [];
  }

  const content = fs.readFileSync(depsPath, 'utf8');
  return JSON.parse(content);
}

async function saveDependencies(
  dependencies: DependencyRelation[],
  configManager: ConfigManager
): Promise<void> {
  const depsPath = path.join(configManager.getPRsDirectory(), 'dependencies.json');
  fs.writeFileSync(depsPath, JSON.stringify(dependencies, null, 2), 'utf8');
}

async function saveDependency(
  dependency: DependencyRelation,
  configManager: ConfigManager
): Promise<void> {
  const dependencies = await loadDependencies(configManager);
  dependencies.push(dependency);
  await saveDependencies(dependencies, configManager);
}

async function updatePRWithDependency(
  pr: PRData,
  dependency: DependencyRelation,
  direction: 'incoming' | 'outgoing',
  _configManager: ConfigManager
): Promise<void> {
  try {
    const prContent = fs.readFileSync(pr.file_path, 'utf8');

    // Update PR frontmatter with dependency information
    const dependencyNote =
      direction === 'outgoing'
        ? `${dependency.type} ${dependency.dependentPrId}`
        : `${dependency.type} ${dependency.prId}`;

    const updatedContent = prContent.replace(
      /updated_date:\s*[^\n]+/,
      `updated_date: ${new Date().toISOString()}`
    );

    // Add dependency section
    const dependencySection = `\n\n## Dependencies\n\n- ${dependencyNote}${dependency.reason ? ` (${dependency.reason})` : ''}\n`;
    const finalContent = updatedContent + dependencySection;

    fs.writeFileSync(pr.file_path, finalContent, 'utf8');
  } catch (error) {
    console.error(`Failed to update PR ${pr.pr_id} with dependency info: ${error}`);
  }
}

async function fixDependencyIssues(
  validationResult: DependencyValidationResult,
  statusManager: PRStatusManager,
  _relationshipManager: RelationshipManager,
  configManager: ConfigManager
): Promise<{ success: boolean; errors: string[] }> {
  const result = {
    success: false,
    errors: [] as string[],
  };

  try {
    const dependencies = await loadDependencies(configManager);
    let fixedDependencies = [...dependencies];

    // Remove unresolved dependencies
    if (validationResult.unresolvedDependencies.length > 0) {
      const allPRs = await statusManager.listPRs();
      const prIds = new Set(allPRs.map((pr) => pr.pr_id));

      fixedDependencies = fixedDependencies.filter(
        (dep) => prIds.has(dep.prId) && prIds.has(dep.dependentPrId)
      );
    }

    // Handle circular dependencies by removing them
    if (validationResult.circularDependencies.length > 0) {
      // This is a simplified approach - in practice, you'd want more sophisticated resolution
      for (const cycle of validationResult.circularDependencies) {
        // Remove the last dependency in the cycle
        if (cycle.length > 1) {
          const lastPr = cycle[cycle.length - 1];
          const firstPr = cycle[0];

          fixedDependencies = fixedDependencies.filter(
            (dep) => !(dep.prId === lastPr && dep.dependentPrId === firstPr)
          );
        }
      }
    }

    await saveDependencies(fixedDependencies, configManager);
    result.success = true;

    return result;
  } catch (error) {
    result.errors.push(
      `Failed to fix dependency issues: ${error instanceof Error ? error.message : String(error)}`
    );
    return result;
  }
}

function displayDependencies(
  dependencies: DependencyRelation[],
  format: string,
  _formatter: Formatter
): void {
  if (format === 'json') {
    console.log(JSON.stringify(dependencies, null, 2));
  } else if (format === 'table') {
    console.table(
      dependencies.map((dep) => ({
        'PR ID': dep.prId,
        'Dependent PR': dep.dependentPrId,
        Type: dep.type,
        Reason: dep.reason || 'N/A',
        Created: dep.created.split('T')[0],
      }))
    );
  } else {
    // Graph format - simplified representation
    console.log(colors.blue('PR Dependency Graph:'));
    dependencies.forEach((dep) => {
      console.log(`${dep.prId} --${dep.type}--> ${dep.dependentPrId}`);
    });
  }
}

function displayPRDependencies(
  dependencies: DependencyGraph,
  format: string,
  _formatter: Formatter
): void {
  if (format === 'json') {
    console.log(JSON.stringify(dependencies, null, 2));
  } else {
    console.log(colors.blue(`Dependencies for PR ${dependencies.prId}:`));

    if (dependencies.blocks.length > 0) {
      console.log(colors.red(`🔒 Blocks: ${dependencies.blocks.join(', ')}`));
    }

    if (dependencies.blockedBy.length > 0) {
      console.log(colors.yellow(`⏳ Blocked by: ${dependencies.blockedBy.join(', ')}`));
    }

    if (dependencies.dependsOn.length > 0) {
      console.log(colors.cyan(`📎 Depends on: ${dependencies.dependsOn.join(', ')}`));
    }

    if (dependencies.requiredBy.length > 0) {
      console.log(colors.green(`🔗 Required by: ${dependencies.requiredBy.join(', ')}`));
    }

    const canMergeColor = dependencies.canMerge ? colors.green : colors.red;
    const canMergeIcon = dependencies.canMerge ? '✅' : '❌';
    console.log(canMergeColor(`${canMergeIcon} Can merge: ${dependencies.canMerge}`));

    if (dependencies.blockingReasons.length > 0) {
      console.log(colors.red('Blocking reasons:'));
      dependencies.blockingReasons.forEach((reason) => {
        console.log(colors.red(`  • ${reason}`));
      });
    }
  }
}

export type { DependencyRelation, DependencyGraph, DependencyValidationResult };
