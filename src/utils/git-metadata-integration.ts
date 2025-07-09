/**
 * Git Metadata Integration Utilities
 * Integration helpers for using Git metadata extractor with existing commands
 */

import { GitMetadataExtractor, extractGitMetadata } from './git-metadata-extractor.js';
import type { ProjectFrontmatter } from '../types/ai-trackdown.js';

/**
 * Enhanced project creation with automatic Git metadata population
 */
export async function createProjectWithGitIntegration(
  projectPath: string,
  baseProject: Partial<ProjectFrontmatter>,
  options: {
    enableCache?: boolean;
    autoDetectLanguages?: boolean;
    autoDetectFramework?: boolean;
    autoDetectTeam?: boolean;
    autoDetectLicense?: boolean;
  } = {}
): Promise<ProjectFrontmatter> {
  const {
    enableCache = true,
    autoDetectLanguages = true,
    autoDetectFramework = true,
    autoDetectTeam = true,
    autoDetectLicense = true,
  } = options;

  const extractor = new GitMetadataExtractor(projectPath, enableCache);
  const metadata = await extractor.extractMetadata();

  // Build enhanced project frontmatter
  const enhancedProject: ProjectFrontmatter = {
    // Required fields with defaults
    title: baseProject.title || 'Untitled Project',
    description: baseProject.description || 'Project description',
    status: baseProject.status || 'planning',
    priority: baseProject.priority || 'medium',
    assignee: baseProject.assignee || 'unassigned',
    created_date: baseProject.created_date || new Date().toISOString(),
    updated_date: baseProject.updated_date || new Date().toISOString(),
    estimated_tokens: baseProject.estimated_tokens || 0,
    actual_tokens: baseProject.actual_tokens || 0,
    ai_context: baseProject.ai_context || [],
    sync_status: baseProject.sync_status || 'local',
    project_id: baseProject.project_id || 'PROJECT-001',
    type: 'project' as const,
    name: baseProject.name || baseProject.title || 'Untitled Project',

    // Git metadata integration (only if Git repo exists)
    git_origin: metadata.is_git_repo ? metadata.git_origin : baseProject.git_origin,
    git_branch: metadata.is_git_repo ? metadata.current_branch : baseProject.git_branch,
    repository_url: metadata.is_git_repo ? metadata.repository_url : baseProject.repository_url,
    clone_url: metadata.is_git_repo ? metadata.clone_url : baseProject.clone_url,
    default_branch: metadata.is_git_repo ? metadata.default_branch : baseProject.default_branch,

    // Optional auto-detected fields
    languages: autoDetectLanguages && metadata.languages ? metadata.languages : baseProject.languages,
    framework: autoDetectFramework && metadata.framework ? metadata.framework : baseProject.framework,
    team_members: autoDetectTeam && metadata.team_members ? metadata.team_members : baseProject.team_members,
    license: autoDetectLicense && metadata.license ? metadata.license : baseProject.license,

    // Other optional fields
    deployment_url: baseProject.deployment_url,
    documentation_url: baseProject.documentation_url,
    completion_percentage: baseProject.completion_percentage,
    related_projects: baseProject.related_projects,
    tags: baseProject.tags,
    dependencies: baseProject.dependencies,
    milestone: baseProject.milestone,

    // GitHub sync metadata
    github_id: baseProject.github_id,
    github_number: baseProject.github_number,
    github_url: baseProject.github_url,
    github_updated_at: baseProject.github_updated_at,
    github_labels: baseProject.github_labels,
    github_milestone: baseProject.github_milestone,
    github_assignee: baseProject.github_assignee,
  };

  return enhancedProject;
}

/**
 * Get Git repository summary for display
 */
export async function getGitRepositorySummary(projectPath?: string): Promise<{
  isGitRepo: boolean;
  branch?: string;
  hasChanges?: boolean;
  commitCount?: number;
  lastCommit?: string;
  repositoryUrl?: string;
  languages?: string[];
  framework?: string;
  license?: string;
  contributors?: number;
}> {
  const metadata = await extractGitMetadata(projectPath);

  return {
    isGitRepo: metadata.is_git_repo,
    branch: metadata.current_branch,
    hasChanges: metadata.has_uncommitted_changes,
    commitCount: metadata.commit_count,
    lastCommit: metadata.last_commit_date,
    repositoryUrl: metadata.repository_url,
    languages: metadata.languages,
    framework: metadata.framework,
    license: metadata.license,
    contributors: metadata.contributors?.length,
  };
}

/**
 * Enhanced project validation with Git metadata
 */
export async function validateProjectWithGit(
  projectPath: string,
  project: Partial<ProjectFrontmatter>
): Promise<{
  isValid: boolean;
  warnings: string[];
  suggestions: string[];
}> {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  const metadata = await extractGitMetadata(projectPath);

  // Check for Git repository
  if (!metadata.is_git_repo) {
    warnings.push('Project is not in a Git repository');
    suggestions.push('Consider initializing a Git repository with: git init');
  }

  // Check for uncommitted changes
  if (metadata.has_uncommitted_changes) {
    warnings.push('Repository has uncommitted changes');
    suggestions.push('Consider committing changes before creating project');
  }

  // Check for missing remote origin
  if (metadata.is_git_repo && !metadata.git_origin) {
    warnings.push('No remote origin configured');
    suggestions.push('Consider adding a remote origin with: git remote add origin <url>');
  }

  // Check for missing README
  if (!metadata.readme_exists) {
    warnings.push('No README file found');
    suggestions.push('Consider creating a README.md file');
  }

  // Check for missing license
  if (!metadata.license && !project.license) {
    warnings.push('No license information found');
    suggestions.push('Consider adding a LICENSE file or specifying license in package.json');
  }

  // Check for project metadata consistency
  if (metadata.framework && project.framework && metadata.framework !== project.framework) {
    warnings.push(`Framework mismatch: detected "${metadata.framework}" but project specifies "${project.framework}"`);
  }

  // Check for language consistency
  if (metadata.languages && project.languages) {
    const detectedLangs = new Set(metadata.languages);
    const projectLangs = new Set(project.languages);
    const missing = Array.from(detectedLangs).filter(lang => !projectLangs.has(lang));
    
    if (missing.length > 0) {
      suggestions.push(`Consider adding detected languages: ${missing.join(', ')}`);
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    suggestions,
  };
}

/**
 * Auto-update project metadata from Git
 */
export async function updateProjectFromGit(
  projectPath: string,
  existingProject: ProjectFrontmatter,
  options: {
    updateLanguages?: boolean;
    updateFramework?: boolean;
    updateTeam?: boolean;
    updateRepository?: boolean;
  } = {}
): Promise<ProjectFrontmatter> {
  const {
    updateLanguages = true,
    updateFramework = true,
    updateTeam = true,
    updateRepository = true,
  } = options;

  const metadata = await extractGitMetadata(projectPath);
  
  if (!metadata.is_git_repo) {
    return existingProject;
  }

  const updatedProject: ProjectFrontmatter = {
    ...existingProject,
    updated_date: new Date().toISOString(),
  };

  // Update repository information
  if (updateRepository) {
    if (metadata.repository_url) updatedProject.repository_url = metadata.repository_url;
    if (metadata.clone_url) updatedProject.clone_url = metadata.clone_url;
    if (metadata.git_origin) updatedProject.git_origin = metadata.git_origin;
    if (metadata.current_branch) updatedProject.git_branch = metadata.current_branch;
    if (metadata.default_branch) updatedProject.default_branch = metadata.default_branch;
  }

  // Update languages if detected
  if (updateLanguages && metadata.languages && metadata.languages.length > 0) {
    updatedProject.languages = metadata.languages;
  }

  // Update framework if detected
  if (updateFramework && metadata.framework) {
    updatedProject.framework = metadata.framework;
  }

  // Update team members if detected
  if (updateTeam && metadata.team_members && metadata.team_members.length > 0) {
    updatedProject.team_members = metadata.team_members;
  }

  // Update license if detected
  if (metadata.license) {
    updatedProject.license = metadata.license;
  }

  return updatedProject;
}

/**
 * Generate project insights from Git metadata
 */
export async function getProjectInsights(projectPath: string): Promise<{
  health: 'healthy' | 'warning' | 'critical';
  metrics: {
    codeQuality: number; // 0-100
    activityLevel: number; // 0-100
    teamCollaboration: number; // 0-100
    documentationLevel: number; // 0-100
  };
  recommendations: string[];
}> {
  const metadata = await extractGitMetadata(projectPath);
  const recommendations: string[] = [];

  let codeQuality = 50; // Base score
  let activityLevel = 50;
  let teamCollaboration = 50;
  let documentationLevel = 50;

  if (!metadata.is_git_repo) {
    return {
      health: 'critical',
      metrics: { codeQuality: 0, activityLevel: 0, teamCollaboration: 0, documentationLevel: 0 },
      recommendations: ['Initialize Git repository', 'Add project documentation', 'Set up CI/CD']
    };
  }

  // Code Quality Assessment
  if (metadata.license) codeQuality += 20;
  if (metadata.framework) codeQuality += 15;
  if (metadata.languages && metadata.languages.length > 0) codeQuality += 15;

  // Activity Level Assessment
  if (metadata.commit_count > 50) activityLevel += 30;
  else if (metadata.commit_count > 10) activityLevel += 20;
  else if (metadata.commit_count > 1) activityLevel += 10;

  if (metadata.last_commit_date) {
    const lastCommit = new Date(metadata.last_commit_date);
    const daysSinceLastCommit = (Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastCommit < 7) activityLevel += 20;
    else if (daysSinceLastCommit < 30) activityLevel += 10;
  }

  // Team Collaboration Assessment
  if (metadata.contributors && metadata.contributors.length > 1) {
    teamCollaboration += 20;
    if (metadata.contributors.length > 5) teamCollaboration += 20;
  }

  if (metadata.repository_url) teamCollaboration += 10;

  // Documentation Level Assessment
  if (metadata.readme_exists) documentationLevel += 30;
  if (metadata.license) documentationLevel += 20;

  // Generate recommendations
  if (codeQuality < 60) {
    recommendations.push('Add license information');
    recommendations.push('Implement consistent coding standards');
  }

  if (activityLevel < 60) {
    recommendations.push('Increase development activity');
    recommendations.push('Set up regular development schedule');
  }

  if (teamCollaboration < 60) {
    recommendations.push('Add more team members');
    recommendations.push('Set up remote repository');
  }

  if (documentationLevel < 60) {
    recommendations.push('Add comprehensive README');
    recommendations.push('Create project documentation');
  }

  const overallScore = (codeQuality + activityLevel + teamCollaboration + documentationLevel) / 4;
  const health = overallScore > 70 ? 'healthy' : overallScore > 50 ? 'warning' : 'critical';

  return {
    health,
    metrics: {
      codeQuality: Math.min(100, codeQuality),
      activityLevel: Math.min(100, activityLevel),
      teamCollaboration: Math.min(100, teamCollaboration),
      documentationLevel: Math.min(100, documentationLevel),
    },
    recommendations: recommendations.slice(0, 5), // Top 5 recommendations
  };
}

/**
 * Format Git metadata for display
 */
export function formatGitMetadata(metadata: Awaited<ReturnType<typeof extractGitMetadata>>): string {
  const sections: string[] = [];

  if (!metadata.is_git_repo) {
    return 'Not a Git repository';
  }

  // Basic info
  sections.push(`Branch: ${metadata.current_branch || 'unknown'}`);
  sections.push(`Commits: ${metadata.commit_count}`);
  
  if (metadata.has_uncommitted_changes) {
    sections.push('Status: Uncommitted changes');
  }

  // Repository info
  if (metadata.repository_url) {
    sections.push(`Repository: ${metadata.repository_url}`);
  }

  // Languages
  if (metadata.languages && metadata.languages.length > 0) {
    sections.push(`Languages: ${metadata.languages.join(', ')}`);
  }

  // Framework
  if (metadata.framework) {
    sections.push(`Framework: ${metadata.framework}`);
  }

  // License
  if (metadata.license) {
    sections.push(`License: ${metadata.license}`);
  }

  // Team
  if (metadata.team_members && metadata.team_members.length > 0) {
    sections.push(`Team: ${metadata.team_members.slice(0, 3).join(', ')}${metadata.team_members.length > 3 ? '...' : ''}`);
  }

  return sections.join('\n');
}