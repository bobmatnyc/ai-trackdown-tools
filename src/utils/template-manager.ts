/**
 * Template Manager for AI-Trackdown
 * Handles bundled template deployment and management
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as YAML from 'yaml';
import type { ItemTemplate } from '../types/ai-trackdown.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Template Manager class for handling bundled templates
 */
export class TemplateManager {
  private bundledTemplatesDir: string;

  constructor() {
    // Path to bundled templates in the package
    // Try multiple possible locations for bundled templates
    const possiblePaths = [
      path.join(__dirname, '../../templates'), // Development: src/utils -> templates
      path.join(__dirname, '../templates'), // Compiled: dist/utils -> dist/templates
      path.join(__dirname, 'templates'), // Compiled: dist -> dist/templates
      path.resolve(__dirname, '..', 'templates'), // Alternative dist structure
    ];

    // Find the first path that exists
    this.bundledTemplatesDir =
      possiblePaths.find((dir) => {
        try {
          return fs.existsSync(dir);
        } catch {
          return false;
        }
      }) || path.join(__dirname, '../../templates'); // fallback to original
  }

  /**
   * Get the path to bundled templates
   */
  public getBundledTemplatesDir(): string {
    return this.bundledTemplatesDir;
  }

  /**
   * Check if bundled templates exist
   */
  public hasBundledTemplates(): boolean {
    return fs.existsSync(this.bundledTemplatesDir);
  }

  /**
   * List all bundled template files
   */
  public listBundledTemplates(): string[] {
    if (!this.hasBundledTemplates()) {
      return [];
    }

    try {
      return fs
        .readdirSync(this.bundledTemplatesDir)
        .filter((file) => file.endsWith('.yaml'))
        .sort();
    } catch (error) {
      console.warn(
        `Failed to list bundled templates: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return [];
    }
  }

  /**
   * Deploy bundled templates to project's templates directory
   */
  public deployTemplates(projectTemplatesDir: string, force: boolean = false): void {
    if (!this.hasBundledTemplates()) {
      console.warn('No bundled templates found. Creating default templates programmatically.');
      this.createDefaultTemplates(projectTemplatesDir, force);
      return;
    }

    // Ensure project templates directory exists
    if (!fs.existsSync(projectTemplatesDir)) {
      fs.mkdirSync(projectTemplatesDir, { recursive: true });
    }

    const bundledFiles = this.listBundledTemplates();
    let deployedCount = 0;

    for (const templateFile of bundledFiles) {
      const sourcePath = path.join(this.bundledTemplatesDir, templateFile);
      const destPath = path.join(projectTemplatesDir, templateFile);

      try {
        // Check if file exists and force flag
        if (fs.existsSync(destPath) && !force) {
          console.log(`⏭️  Skipping ${templateFile} (already exists)`);
          continue;
        }

        // Copy template file
        fs.copyFileSync(sourcePath, destPath);
        console.log(`✅ Deployed ${templateFile}`);
        deployedCount++;
      } catch (error) {
        console.error(
          `❌ Failed to deploy ${templateFile}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    console.log(`📦 Deployed ${deployedCount} template(s) to ${projectTemplatesDir}`);
  }

  /**
   * Create default templates programmatically if bundled templates are not available
   */
  private createDefaultTemplates(projectTemplatesDir: string, force: boolean = false): void {
    if (!fs.existsSync(projectTemplatesDir)) {
      fs.mkdirSync(projectTemplatesDir, { recursive: true });
    }

    const defaultTemplates: ItemTemplate[] = [
      {
        type: 'epic',
        name: 'default',
        description: 'Default epic template',
        frontmatter_template: {
          title: 'Epic Title',
          description: 'Epic description',
          status: 'planning',
          priority: 'medium',
          assignee: 'unassigned',
          created_date: '',
          updated_date: '',
          estimated_tokens: 0,
          actual_tokens: 0,
          ai_context: [
            'context/requirements',
            'context/constraints',
            'context/assumptions',
            'context/dependencies',
          ],
          sync_status: 'local',
        },
        content_template: `# Epic: {{title}}

## Overview
{{description}}

## Objectives
- [ ] Objective 1
- [ ] Objective 2
- [ ] Objective 3

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2

## Related Issues
{{#related_issues}}
- {{.}}
{{/related_issues}}

## Notes
Add any additional notes here.`,
      },
      {
        type: 'issue',
        name: 'default',
        description: 'Default issue template',
        frontmatter_template: {
          title: 'Issue Title',
          description: 'Issue description',
          status: 'planning',
          priority: 'medium',
          assignee: 'unassigned',
          created_date: '',
          updated_date: '',
          estimated_tokens: 0,
          actual_tokens: 0,
          ai_context: [
            'context/requirements',
            'context/constraints',
            'context/assumptions',
            'context/dependencies',
          ],
          sync_status: 'local',
        },
        content_template: `# Issue: {{title}}

## Description
{{description}}

## Tasks
{{#related_tasks}}
- [ ] {{.}}
{{/related_tasks}}

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2

## Notes
Add any additional notes here.`,
      },
      {
        type: 'task',
        name: 'default',
        description: 'Default task template',
        frontmatter_template: {
          title: 'Task Title',
          description: 'Task description',
          status: 'planning',
          priority: 'medium',
          assignee: 'unassigned',
          created_date: '',
          updated_date: '',
          estimated_tokens: 0,
          actual_tokens: 0,
          ai_context: [
            'context/requirements',
            'context/constraints',
            'context/assumptions',
            'context/dependencies',
          ],
          sync_status: 'local',
        },
        content_template: `# Task: {{title}}

## Description
{{description}}

## Steps
1. Step 1
2. Step 2
3. Step 3

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2

## Notes
Add any additional notes here.`,
      },
      {
        type: 'pr',
        name: 'default',
        description: 'Default PR template',
        frontmatter_template: {
          title: 'PR Title',
          description: 'PR description',
          status: 'planning',
          priority: 'medium',
          assignee: 'unassigned',
          created_date: '',
          updated_date: '',
          estimated_tokens: 0,
          actual_tokens: 0,
          ai_context: [
            'context/requirements',
            'context/constraints',
            'context/assumptions',
            'context/dependencies',
          ],
          sync_status: 'local',
        },
        content_template: `# PR: {{title}}

## Description
{{description}}

## Changes
- Change 1
- Change 2
- Change 3

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated

## Related
- Issue: {{issue_id}}
- Branch: {{branch_name}}
- Target: {{target_branch}}

## Notes
Add any additional notes here.`,
      },
    ];

    let deployedCount = 0;

    for (const template of defaultTemplates) {
      const templatePath = path.join(projectTemplatesDir, `${template.type}-${template.name}.yaml`);

      try {
        // Check if file exists and force flag
        if (fs.existsSync(templatePath) && !force) {
          console.log(`⏭️  Skipping ${template.type}-${template.name}.yaml (already exists)`);
          continue;
        }

        const templateContent = YAML.stringify(template, {
          indent: 2,
          lineWidth: 120,
        });

        fs.writeFileSync(templatePath, templateContent, 'utf8');
        console.log(`✅ Created ${template.type}-${template.name}.yaml`);
        deployedCount++;
      } catch (error) {
        console.error(
          `❌ Failed to create ${template.type}-${template.name}.yaml: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    console.log(`📦 Created ${deployedCount} default template(s) in ${projectTemplatesDir}`);
  }

  /**
   * Get template by type and name, with fallback to bundled templates
   */
  public getTemplate(
    projectTemplatesDir: string,
    type: 'epic' | 'issue' | 'task' | 'pr',
    name: string = 'default'
  ): ItemTemplate | null {
    const templateFileName = `${type}-${name}.yaml`;

    // First, try to load from project templates directory
    const projectTemplatePath = path.join(projectTemplatesDir, templateFileName);
    if (fs.existsSync(projectTemplatePath)) {
      try {
        const templateContent = fs.readFileSync(projectTemplatePath, 'utf8');
        return YAML.parse(templateContent) as ItemTemplate;
      } catch (error) {
        console.warn(
          `Failed to load project template ${projectTemplatePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Fallback to bundled templates
    if (this.hasBundledTemplates()) {
      const bundledTemplatePath = path.join(this.bundledTemplatesDir, templateFileName);
      if (fs.existsSync(bundledTemplatePath)) {
        try {
          const templateContent = fs.readFileSync(bundledTemplatePath, 'utf8');
          return YAML.parse(templateContent) as ItemTemplate;
        } catch (error) {
          console.warn(
            `Failed to load bundled template ${bundledTemplatePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    }

    return null;
  }

  /**
   * Validate template file structure
   */
  public validateTemplate(templatePath: string): boolean {
    try {
      const content = fs.readFileSync(templatePath, 'utf8');
      const template = YAML.parse(content) as ItemTemplate;

      // Check required fields
      const requiredFields = [
        'type',
        'name',
        'description',
        'frontmatter_template',
        'content_template',
      ];
      for (const field of requiredFields) {
        if (!template[field as keyof ItemTemplate]) {
          console.error(`Template ${templatePath} missing required field: ${field}`);
          return false;
        }
      }

      // Check valid type
      const validTypes = ['epic', 'issue', 'task', 'pr'];
      if (!validTypes.includes(template.type)) {
        console.error(`Template ${templatePath} has invalid type: ${template.type}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(
        `Failed to validate template ${templatePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }
  }
}
