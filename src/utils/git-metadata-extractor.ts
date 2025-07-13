/**
 * Git Metadata Extraction Service
 * Comprehensive Git repository metadata extraction for AI-Trackdown CLI project creation
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { ProjectFrontmatter } from '../types/ai-trackdown.js';
import { GitManager } from './git.js';

export interface GitMetadata {
  // Repository information
  repository_url?: string;
  clone_url?: string;
  git_origin?: string;
  default_branch?: string;
  current_branch?: string;

  // Project analysis
  languages?: string[];
  framework?: string;
  license?: string;

  // Team information
  team_members?: string[];
  contributors?: GitContributor[];

  // Repository health
  is_git_repo: boolean;
  has_uncommitted_changes: boolean;
  commit_count: number;
  last_commit_date?: string;

  // Additional metadata
  repository_size?: string;
  total_files?: number;
  readme_exists: boolean;
  package_manager?: string;
}

export interface GitContributor {
  name: string;
  email: string;
  commits: number;
  first_commit: string;
  last_commit: string;
}

export interface LanguageStats {
  language: string;
  files: number;
  lines?: number;
  percentage?: number;
}

export interface FrameworkDetection {
  name: string;
  version?: string;
  config_files: string[];
  confidence: number;
}

export class GitMetadataExtractor {
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static cache = new Map<string, { data: GitMetadata; timestamp: number }>();

  private readonly projectPath: string;
  private readonly enableCache: boolean;

  constructor(projectPath: string = process.cwd(), enableCache: boolean = true) {
    this.projectPath = path.resolve(projectPath);
    this.enableCache = enableCache;
  }

  /**
   * Extract comprehensive Git metadata from repository
   */
  async extractMetadata(): Promise<GitMetadata> {
    const cacheKey = this.projectPath;

    // Check cache first
    if (this.enableCache && GitMetadataExtractor.cache.has(cacheKey)) {
      const cached = GitMetadataExtractor.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < GitMetadataExtractor.CACHE_TTL) {
        return cached.data;
      }
    }

    const metadata: GitMetadata = {
      is_git_repo: false,
      has_uncommitted_changes: false,
      commit_count: 0,
      readme_exists: false,
    };

    const originalCwd = process.cwd();

    try {
      // Check if this is a Git repository in the specific path
      if (fs.existsSync(this.projectPath)) {
        process.chdir(this.projectPath);
        metadata.is_git_repo = GitManager.isGitRepository();
      } else {
        metadata.is_git_repo = false;
      }

      if (!metadata.is_git_repo) {
        return metadata;
      }

      // Extract basic Git information
      await this.extractBasicGitInfo(metadata);

      // Extract repository URLs
      await this.extractRepositoryUrls(metadata);

      // Analyze programming languages
      await this.extractLanguageInfo(metadata);

      // Detect framework
      await this.extractFrameworkInfo(metadata);

      // Extract team members
      await this.extractTeamMembers(metadata);

      // Extract license information
      await this.extractLicenseInfo(metadata);

      // Extract additional repository metadata
      await this.extractAdditionalMetadata(metadata);

      // Cache the result
      if (this.enableCache) {
        GitMetadataExtractor.cache.set(cacheKey, {
          data: metadata,
          timestamp: Date.now(),
        });
      }

      return metadata;
    } catch (error) {
      console.warn(`Git metadata extraction failed: ${error}`);
      return metadata;
    } finally {
      // Restore original working directory
      try {
        process.chdir(originalCwd);
      } catch {
        // Ignore restore errors
      }
    }
  }

  /**
   * Extract basic Git repository information
   */
  private async extractBasicGitInfo(metadata: GitMetadata): Promise<void> {
    try {
      // Current branch
      metadata.current_branch = GitManager.getCurrentBranch();

      // Default branch (try multiple methods)
      metadata.default_branch = await this.getDefaultBranch();

      // Uncommitted changes
      metadata.has_uncommitted_changes = GitManager.hasUncommittedChanges();

      // Commit count
      metadata.commit_count = await this.getCommitCount();

      // Last commit date
      metadata.last_commit_date = await this.getLastCommitDate();
    } catch (error) {
      console.warn(`Basic Git info extraction failed: ${error}`);
    }
  }

  /**
   * Extract repository URLs and clone information
   */
  private async extractRepositoryUrls(metadata: GitMetadata): Promise<void> {
    try {
      // Origin URL
      metadata.git_origin = GitManager.getRepositoryUrl();

      if (metadata.git_origin) {
        // Convert to standardized formats
        metadata.repository_url = this.normalizeRepositoryUrl(metadata.git_origin);
        metadata.clone_url = this.getCloneUrl(metadata.git_origin);
      }
    } catch (error) {
      console.warn(`Repository URL extraction failed: ${error}`);
    }
  }

  /**
   * Analyze programming languages in the repository
   */
  private async extractLanguageInfo(metadata: GitMetadata): Promise<void> {
    try {
      const languageStats = await this.analyzeLanguages();
      metadata.languages = languageStats
        .sort((a, b) => b.files - a.files)
        .slice(0, 5) // Top 5 languages
        .map((stat) => stat.language);
    } catch (error) {
      console.warn(`Language analysis failed: ${error}`);
    }
  }

  /**
   * Detect framework and package manager
   */
  private async extractFrameworkInfo(metadata: GitMetadata): Promise<void> {
    try {
      const frameworks = await this.detectFrameworks();
      if (frameworks.length > 0) {
        // Get highest confidence framework
        const topFramework = frameworks.sort((a, b) => b.confidence - a.confidence)[0];
        metadata.framework = topFramework.name;
        if (topFramework.version) {
          metadata.framework += ` ${topFramework.version}`;
        }
      }

      // Detect package manager
      metadata.package_manager = await this.detectPackageManager();
    } catch (error) {
      console.warn(`Framework detection failed: ${error}`);
    }
  }

  /**
   * Extract team members from Git contributors
   */
  private async extractTeamMembers(metadata: GitMetadata): Promise<void> {
    try {
      metadata.contributors = await this.getContributors();
      metadata.team_members = metadata.contributors
        .slice(0, 10) // Top 10 contributors
        .map((contributor) => contributor.name);
    } catch (error) {
      console.warn(`Team member extraction failed: ${error}`);
    }
  }

  /**
   * Extract license information
   */
  private async extractLicenseInfo(metadata: GitMetadata): Promise<void> {
    try {
      metadata.license = await this.detectLicense();
    } catch (error) {
      console.warn(`License detection failed: ${error}`);
    }
  }

  /**
   * Extract additional repository metadata
   */
  private async extractAdditionalMetadata(metadata: GitMetadata): Promise<void> {
    try {
      // README existence
      metadata.readme_exists = await this.hasReadme();

      // Repository size
      metadata.repository_size = await this.getRepositorySize();

      // Total files
      metadata.total_files = await this.getTotalFiles();
    } catch (error) {
      console.warn(`Additional metadata extraction failed: ${error}`);
    }
  }

  /**
   * Get default branch name
   */
  private async getDefaultBranch(): Promise<string> {
    try {
      // Try remote HEAD
      const remoteHead = execSync(
        'git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || echo ""',
        { encoding: 'utf8', cwd: this.projectPath }
      ).trim();

      if (remoteHead) {
        return remoteHead.replace('refs/remotes/origin/', '');
      }

      // Try common default branches
      const commonBranches = ['main', 'master', 'develop'];
      for (const branch of commonBranches) {
        try {
          execSync(`git show-ref --verify refs/heads/${branch}`, {
            stdio: 'ignore',
            cwd: this.projectPath,
          });
          return branch;
        } catch {}
      }

      // Fallback to current branch
      return GitManager.getCurrentBranch();
    } catch {
      return 'main'; // Default fallback
    }
  }

  /**
   * Get total commit count
   */
  private async getCommitCount(): Promise<number> {
    try {
      const count = execSync('git rev-list --count HEAD', {
        encoding: 'utf8',
        cwd: this.projectPath,
      }).trim();
      return parseInt(count, 10) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get last commit date
   */
  private async getLastCommitDate(): Promise<string | undefined> {
    try {
      const date = execSync('git log -1 --format=%ci', {
        encoding: 'utf8',
        cwd: this.projectPath,
      }).trim();
      return date || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Normalize repository URL to HTTPS format
   */
  private normalizeRepositoryUrl(url: string): string {
    if (url.startsWith('git@')) {
      // Convert SSH to HTTPS
      // git@github.com:user/repo.git -> https://github.com/user/repo
      const parts = url.split(':');
      if (parts.length >= 2) {
        const host = parts[0].replace('git@', '');
        const path = parts[1].replace(/\.git$/, '');
        return `https://${host}/${path}`;
      }
    }

    return url.replace(/\.git$/, '');
  }

  /**
   * Get clone URL (prefer HTTPS)
   */
  private getCloneUrl(originUrl: string): string {
    if (originUrl.startsWith('https://')) {
      return originUrl;
    }

    return `${this.normalizeRepositoryUrl(originUrl)}.git`;
  }

  /**
   * Analyze programming languages in the repository
   */
  private async analyzeLanguages(): Promise<LanguageStats[]> {
    const languageMap = new Map<string, number>();

    // Language extension mappings
    const extensionMap: Record<string, string> = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.jsx': 'JavaScript',
      '.tsx': 'TypeScript',
      '.py': 'Python',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.go': 'Go',
      '.rs': 'Rust',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.clj': 'Clojure',
      '.hs': 'Haskell',
      '.elm': 'Elm',
      '.dart': 'Dart',
      '.vue': 'Vue',
      '.svelte': 'Svelte',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.sass': 'Sass',
      '.less': 'Less',
      '.json': 'JSON',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.xml': 'XML',
      '.md': 'Markdown',
      '.sh': 'Shell',
      '.bash': 'Shell',
      '.zsh': 'Shell',
      '.fish': 'Shell',
      '.sql': 'SQL',
      '.r': 'R',
      '.R': 'R',
      '.m': 'Objective-C',
      '.mm': 'Objective-C++',
      '.pl': 'Perl',
      '.lua': 'Lua',
      '.vim': 'Vim script',
      '.dockerfile': 'Dockerfile',
      '.tf': 'Terraform',
    };

    try {
      // Get all tracked files
      const files = execSync('git ls-files', { encoding: 'utf8', cwd: this.projectPath })
        .split('\n')
        .filter((file) => file.trim());

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        const language = extensionMap[ext];

        if (language) {
          languageMap.set(language, (languageMap.get(language) || 0) + 1);
        }
      }

      return Array.from(languageMap.entries())
        .map(([language, files]) => ({ language, files }))
        .sort((a, b) => b.files - a.files);
    } catch {
      return [];
    }
  }

  /**
   * Detect frameworks based on configuration files
   */
  private async detectFrameworks(): Promise<FrameworkDetection[]> {
    const frameworks: FrameworkDetection[] = [];

    const detectors = [
      this.detectNodeJsFramework.bind(this),
      this.detectPythonFramework.bind(this),
      this.detectJavaFramework.bind(this),
      this.detectRustFramework.bind(this),
      this.detectGoFramework.bind(this),
      this.detectPhpFramework.bind(this),
      this.detectRubyFramework.bind(this),
    ];

    for (const detector of detectors) {
      try {
        const detected = await detector();
        if (detected) {
          frameworks.push(detected);
        }
      } catch (_error) {
        // Continue with other detectors
      }
    }

    return frameworks;
  }

  /**
   * Detect Node.js frameworks
   */
  private async detectNodeJsFramework(): Promise<FrameworkDetection | null> {
    const packageJsonPath = path.join(this.projectPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return null;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Framework detection patterns
      const patterns = [
        { name: 'Next.js', packages: ['next'], confidence: 0.9 },
        { name: 'React', packages: ['react'], confidence: 0.8 },
        { name: 'Vue.js', packages: ['vue'], confidence: 0.8 },
        { name: 'Angular', packages: ['@angular/core'], confidence: 0.9 },
        { name: 'Svelte', packages: ['svelte'], confidence: 0.8 },
        { name: 'Express', packages: ['express'], confidence: 0.7 },
        { name: 'Fastify', packages: ['fastify'], confidence: 0.8 },
        { name: 'NestJS', packages: ['@nestjs/core'], confidence: 0.9 },
        { name: 'Nuxt.js', packages: ['nuxt'], confidence: 0.9 },
        { name: 'Gatsby', packages: ['gatsby'], confidence: 0.9 },
        { name: 'Electron', packages: ['electron'], confidence: 0.8 },
      ];

      for (const pattern of patterns) {
        const hasFramework = pattern.packages.some((pkg) => deps[pkg]);
        if (hasFramework) {
          const version = deps[pattern.packages[0]];
          return {
            name: pattern.name,
            version: version?.replace(/^[\^~]/, ''),
            config_files: [packageJsonPath],
            confidence: pattern.confidence,
          };
        }
      }
    } catch {
      // Continue
    }

    return null;
  }

  /**
   * Detect Python frameworks
   */
  private async detectPythonFramework(): Promise<FrameworkDetection | null> {
    const configFiles = [
      'requirements.txt',
      'Pipfile',
      'pyproject.toml',
      'setup.py',
      'poetry.lock',
    ];

    const foundConfigs = configFiles.filter((file) =>
      fs.existsSync(path.join(this.projectPath, file))
    );

    if (foundConfigs.length === 0) {
      return null;
    }

    // Check for Django
    if (fs.existsSync(path.join(this.projectPath, 'manage.py'))) {
      return {
        name: 'Django',
        config_files: foundConfigs,
        confidence: 0.9,
      };
    }

    // Check for Flask (look in requirements.txt)
    try {
      const requirementsPath = path.join(this.projectPath, 'requirements.txt');
      if (fs.existsSync(requirementsPath)) {
        const requirements = fs.readFileSync(requirementsPath, 'utf8');
        if (requirements.includes('Flask')) {
          return {
            name: 'Flask',
            config_files: foundConfigs,
            confidence: 0.8,
          };
        }
      }
    } catch {
      // Continue
    }

    return {
      name: 'Python',
      config_files: foundConfigs,
      confidence: 0.6,
    };
  }

  /**
   * Detect Java frameworks
   */
  private async detectJavaFramework(): Promise<FrameworkDetection | null> {
    const configFiles = ['pom.xml', 'build.gradle', 'build.gradle.kts'];
    const foundConfigs = configFiles.filter((file) =>
      fs.existsSync(path.join(this.projectPath, file))
    );

    if (foundConfigs.length === 0) {
      return null;
    }

    // Check for Spring Boot
    try {
      const pomPath = path.join(this.projectPath, 'pom.xml');
      if (fs.existsSync(pomPath)) {
        const pom = fs.readFileSync(pomPath, 'utf8');
        if (pom.includes('spring-boot')) {
          return {
            name: 'Spring Boot',
            config_files: foundConfigs,
            confidence: 0.9,
          };
        }
      }
    } catch {
      // Continue
    }

    return {
      name: 'Java',
      config_files: foundConfigs,
      confidence: 0.6,
    };
  }

  /**
   * Detect Rust frameworks
   */
  private async detectRustFramework(): Promise<FrameworkDetection | null> {
    const cargoPath = path.join(this.projectPath, 'Cargo.toml');

    if (!fs.existsSync(cargoPath)) {
      return null;
    }

    try {
      const cargo = fs.readFileSync(cargoPath, 'utf8');

      if (cargo.includes('actix-web')) {
        return {
          name: 'Actix Web',
          config_files: ['Cargo.toml'],
          confidence: 0.9,
        };
      }

      if (cargo.includes('rocket')) {
        return {
          name: 'Rocket',
          config_files: ['Cargo.toml'],
          confidence: 0.9,
        };
      }

      if (cargo.includes('warp')) {
        return {
          name: 'Warp',
          config_files: ['Cargo.toml'],
          confidence: 0.8,
        };
      }
    } catch {
      // Continue
    }

    return {
      name: 'Rust',
      config_files: ['Cargo.toml'],
      confidence: 0.7,
    };
  }

  /**
   * Detect Go frameworks
   */
  private async detectGoFramework(): Promise<FrameworkDetection | null> {
    const goModPath = path.join(this.projectPath, 'go.mod');

    if (!fs.existsSync(goModPath)) {
      return null;
    }

    try {
      const goMod = fs.readFileSync(goModPath, 'utf8');

      if (goMod.includes('gin-gonic/gin')) {
        return {
          name: 'Gin',
          config_files: ['go.mod'],
          confidence: 0.9,
        };
      }

      if (goMod.includes('echo')) {
        return {
          name: 'Echo',
          config_files: ['go.mod'],
          confidence: 0.9,
        };
      }

      if (goMod.includes('fiber')) {
        return {
          name: 'Fiber',
          config_files: ['go.mod'],
          confidence: 0.9,
        };
      }
    } catch {
      // Continue
    }

    return {
      name: 'Go',
      config_files: ['go.mod'],
      confidence: 0.7,
    };
  }

  /**
   * Detect PHP frameworks
   */
  private async detectPhpFramework(): Promise<FrameworkDetection | null> {
    const composerPath = path.join(this.projectPath, 'composer.json');

    if (!fs.existsSync(composerPath)) {
      return null;
    }

    try {
      const composer = JSON.parse(fs.readFileSync(composerPath, 'utf8'));
      const deps = { ...composer.require, ...composer['require-dev'] };

      if (deps['laravel/framework']) {
        return {
          name: 'Laravel',
          config_files: ['composer.json'],
          confidence: 0.9,
        };
      }

      if (deps['symfony/framework-bundle']) {
        return {
          name: 'Symfony',
          config_files: ['composer.json'],
          confidence: 0.9,
        };
      }
    } catch {
      // Continue
    }

    return {
      name: 'PHP',
      config_files: ['composer.json'],
      confidence: 0.6,
    };
  }

  /**
   * Detect Ruby frameworks
   */
  private async detectRubyFramework(): Promise<FrameworkDetection | null> {
    const gemfilePath = path.join(this.projectPath, 'Gemfile');

    if (!fs.existsSync(gemfilePath)) {
      return null;
    }

    try {
      const gemfile = fs.readFileSync(gemfilePath, 'utf8');

      if (gemfile.includes('rails')) {
        return {
          name: 'Ruby on Rails',
          config_files: ['Gemfile'],
          confidence: 0.9,
        };
      }

      if (gemfile.includes('sinatra')) {
        return {
          name: 'Sinatra',
          config_files: ['Gemfile'],
          confidence: 0.8,
        };
      }
    } catch {
      // Continue
    }

    return {
      name: 'Ruby',
      config_files: ['Gemfile'],
      confidence: 0.6,
    };
  }

  /**
   * Detect package manager
   */
  private async detectPackageManager(): Promise<string | undefined> {
    const packageManagers = [
      { name: 'npm', files: ['package-lock.json', 'package.json'] },
      { name: 'yarn', files: ['yarn.lock'] },
      { name: 'pnpm', files: ['pnpm-lock.yaml'] },
      { name: 'bun', files: ['bun.lockb'] },
      { name: 'pip', files: ['requirements.txt'] },
      { name: 'pipenv', files: ['Pipfile'] },
      { name: 'poetry', files: ['poetry.lock'] },
      { name: 'composer', files: ['composer.json'] },
      { name: 'cargo', files: ['Cargo.toml'] },
      { name: 'go mod', files: ['go.mod'] },
      { name: 'maven', files: ['pom.xml'] },
      { name: 'gradle', files: ['build.gradle'] },
      { name: 'bundler', files: ['Gemfile'] },
    ];

    // Check for lockfiles first (more specific)
    for (const pm of packageManagers) {
      if (pm.name === 'npm') continue; // Handle npm last
      const hasFiles = pm.files.some((file) => fs.existsSync(path.join(this.projectPath, file)));
      if (hasFiles) {
        return pm.name;
      }
    }

    // Check for npm (package.json exists)
    if (fs.existsSync(path.join(this.projectPath, 'package.json'))) {
      return 'npm';
    }

    return undefined;
  }

  /**
   * Get Git contributors
   */
  private async getContributors(): Promise<GitContributor[]> {
    try {
      const output = execSync('git log --format="%an|%ae|%ci" --no-merges', {
        encoding: 'utf8',
        cwd: this.projectPath,
      });

      const contributorMap = new Map<string, GitContributor>();

      for (const line of output.split('\n')) {
        if (!line.trim()) continue;

        const [name, email, date] = line.split('|');
        if (!name || !email || !date) continue;

        const key = `${name}|${email}`;

        if (contributorMap.has(key)) {
          const contributor = contributorMap.get(key)!;
          contributor.commits++;
          contributor.last_commit = date;
        } else {
          contributorMap.set(key, {
            name,
            email,
            commits: 1,
            first_commit: date,
            last_commit: date,
          });
        }
      }

      return Array.from(contributorMap.values()).sort((a, b) => b.commits - a.commits);
    } catch {
      return [];
    }
  }

  /**
   * Detect license
   */
  private async detectLicense(): Promise<string | undefined> {
    const licenseFiles = [
      'LICENSE',
      'LICENSE.txt',
      'LICENSE.md',
      'LICENCE',
      'LICENCE.txt',
      'LICENCE.md',
    ];

    for (const file of licenseFiles) {
      const licensePath = path.join(this.projectPath, file);
      if (fs.existsSync(licensePath)) {
        try {
          const content = fs.readFileSync(licensePath, 'utf8');
          return this.parseLicense(content);
        } catch {}
      }
    }

    // Check package.json
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.license) {
          return packageJson.license;
        }
      } catch {
        // Continue
      }
    }

    return undefined;
  }

  /**
   * Parse license type from content
   */
  private parseLicense(content: string): string {
    const upperContent = content.toUpperCase();

    const licenses = [
      { name: 'MIT', keywords: ['MIT LICENSE', 'MIT'] },
      { name: 'Apache 2.0', keywords: ['APACHE LICENSE', 'APACHE 2.0'] },
      { name: 'GPL-3.0', keywords: ['GNU GENERAL PUBLIC LICENSE', 'GPL-3.0'] },
      { name: 'GPL-2.0', keywords: ['GNU GENERAL PUBLIC LICENSE', 'GPL-2.0'] },
      { name: 'BSD-3-Clause', keywords: ['BSD 3-CLAUSE', 'BSD-3-CLAUSE'] },
      { name: 'BSD-2-Clause', keywords: ['BSD 2-CLAUSE', 'BSD-2-CLAUSE'] },
      { name: 'ISC', keywords: ['ISC LICENSE', 'ISC'] },
      { name: 'LGPL-3.0', keywords: ['LESSER GENERAL PUBLIC LICENSE', 'LGPL-3.0'] },
      { name: 'LGPL-2.1', keywords: ['LESSER GENERAL PUBLIC LICENSE', 'LGPL-2.1'] },
      { name: 'MPL-2.0', keywords: ['MOZILLA PUBLIC LICENSE', 'MPL-2.0'] },
      { name: 'CC0-1.0', keywords: ['CREATIVE COMMONS', 'CC0'] },
      { name: 'Unlicense', keywords: ['UNLICENSE'] },
    ];

    for (const license of licenses) {
      const hasKeywords = license.keywords.some((keyword) => upperContent.includes(keyword));
      if (hasKeywords) {
        return license.name;
      }
    }

    return 'Custom';
  }

  /**
   * Check if README exists
   */
  private async hasReadme(): Promise<boolean> {
    const readmeFiles = [
      'README.md',
      'README.txt',
      'README.rst',
      'README',
      'readme.md',
      'readme.txt',
      'readme',
    ];

    return readmeFiles.some((file) => fs.existsSync(path.join(this.projectPath, file)));
  }

  /**
   * Get repository size
   */
  private async getRepositorySize(): Promise<string | undefined> {
    try {
      const output = execSync('git count-objects -vH', { encoding: 'utf8', cwd: this.projectPath });

      const sizeMatch = output.match(/size-pack:\s*(\S+)/);
      if (sizeMatch) {
        return sizeMatch[1];
      }
    } catch {
      // Fallback to directory size
      try {
        const output = execSync(`du -sh "${this.projectPath}" 2>/dev/null || echo "Unknown"`, {
          encoding: 'utf8',
        });
        return output.split('\t')[0];
      } catch {
        return undefined;
      }
    }
  }

  /**
   * Get total file count
   */
  private async getTotalFiles(): Promise<number | undefined> {
    try {
      const output = execSync('git ls-files | wc -l', { encoding: 'utf8', cwd: this.projectPath });
      return parseInt(output.trim(), 10);
    } catch {
      return undefined;
    }
  }

  /**
   * Populate ProjectFrontmatter with Git metadata
   */
  async populateProjectFrontmatter(
    frontmatter: Partial<ProjectFrontmatter>
  ): Promise<ProjectFrontmatter> {
    const metadata = await this.extractMetadata();

    return {
      // Required fields with defaults
      title: frontmatter.title || 'Untitled Project',
      description: frontmatter.description || 'Project description',
      status: frontmatter.status || 'planning',
      priority: frontmatter.priority || 'medium',
      assignee: frontmatter.assignee || 'unassigned',
      created_date: frontmatter.created_date || new Date().toISOString(),
      updated_date: frontmatter.updated_date || new Date().toISOString(),
      estimated_tokens: frontmatter.estimated_tokens || 0,
      actual_tokens: frontmatter.actual_tokens || 0,
      ai_context: frontmatter.ai_context || [],
      sync_status: frontmatter.sync_status || 'local',
      project_id: frontmatter.project_id || 'PROJECT-001',
      type: 'project' as const,
      name: frontmatter.name || frontmatter.title || 'Untitled Project',

      // Git metadata
      git_origin: metadata.git_origin,
      git_branch: metadata.current_branch,
      repository_url: metadata.repository_url,
      clone_url: metadata.clone_url,
      default_branch: metadata.default_branch,
      languages: metadata.languages,
      framework: metadata.framework,
      team_members: metadata.team_members,
      license: metadata.license,

      // Optional fields
      deployment_url: frontmatter.deployment_url,
      documentation_url: frontmatter.documentation_url,
      completion_percentage: frontmatter.completion_percentage,
      related_projects: frontmatter.related_projects,
      tags: frontmatter.tags,
      dependencies: frontmatter.dependencies,
      milestone: frontmatter.milestone,

      // GitHub sync metadata
      github_id: frontmatter.github_id,
      github_number: frontmatter.github_number,
      github_url: frontmatter.github_url,
      github_updated_at: frontmatter.github_updated_at,
      github_labels: frontmatter.github_labels,
      github_milestone: frontmatter.github_milestone,
      github_assignee: frontmatter.github_assignee,
    };
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    GitMetadataExtractor.cache.clear();
  }

  /**
   * Get cache stats
   */
  static getCacheStats(): { size: number; entries: string[] } {
    return {
      size: GitMetadataExtractor.cache.size,
      entries: Array.from(GitMetadataExtractor.cache.keys()),
    };
  }
}

/**
 * Utility function to extract Git metadata for a project
 */
export async function extractGitMetadata(
  projectPath?: string,
  enableCache: boolean = true
): Promise<GitMetadata> {
  const extractor = new GitMetadataExtractor(projectPath, enableCache);
  return await extractor.extractMetadata();
}

/**
 * Utility function to create a project with Git metadata
 */
export async function createProjectWithGitMetadata(
  projectPath: string,
  baseProject: Partial<ProjectFrontmatter>
): Promise<ProjectFrontmatter> {
  const extractor = new GitMetadataExtractor(projectPath);
  return await extractor.populateProjectFrontmatter(baseProject);
}
