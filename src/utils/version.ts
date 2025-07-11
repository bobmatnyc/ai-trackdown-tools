import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import semver from 'semver';

export interface VersionInfo {
  version: string;
  major: number;
  minor: number;
  patch: number;
}

export class VersionManager {
  private static readonly VERSION_FILE = 'VERSION';
  private static readonly PACKAGE_JSON = 'package.json';

  /**
   * Get the project root directory
   */
  private static getProjectRoot(): string {
    // Get the current file's directory using ES module approach
    const currentFile = fileURLToPath(import.meta.url);
    const currentDir = path.dirname(currentFile);
    
    // First try to find the CLI package root from current file location
    let cliRoot = currentDir;
    while (cliRoot !== path.dirname(cliRoot)) {
      const packageJsonPath = path.join(cliRoot, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          if (packageJson.name === '@bobmatnyc/ai-trackdown-tools') {
            return cliRoot;
          }
        } catch (error) {
          // Continue searching
        }
      }
      cliRoot = path.dirname(cliRoot);
    }
    
    // Fallback to current working directory search
    let current = process.cwd();
    while (current !== path.dirname(current)) {
      if (fs.existsSync(path.join(current, 'package.json'))) {
        return current;
      }
      current = path.dirname(current);
    }
    throw new Error('Could not find project root (no package.json found)');
  }

  /**
   * Read version from VERSION file, with package.json fallback
   */
  static getVersion(): VersionInfo {
    const projectRoot = this.getProjectRoot();
    const versionFile = path.join(projectRoot, this.VERSION_FILE);

    let versionString: string;

    if (fs.existsSync(versionFile)) {
      versionString = fs.readFileSync(versionFile, 'utf8').trim();
    } else {
      // Fallback to package.json
      const packageJsonPath = path.join(projectRoot, this.PACKAGE_JSON);
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        versionString = packageJson.version;
      } else {
        throw new Error('Neither VERSION file nor package.json found');
      }
    }

    if (!semver.valid(versionString)) {
      throw new Error(`Invalid version format: ${versionString}`);
    }

    const parsed = semver.parse(versionString);
    if (!parsed) {
      throw new Error(`Could not parse version: ${versionString}`);
    }

    return {
      version: versionString,
      major: parsed.major,
      minor: parsed.minor,
      patch: parsed.patch,
    };
  }

  /**
   * Set version in VERSION file
   */
  static setVersion(version: string): void {
    if (!semver.valid(version)) {
      throw new Error(`Invalid version format: ${version}`);
    }

    const projectRoot = this.getProjectRoot();
    const versionFile = path.join(projectRoot, this.VERSION_FILE);

    fs.writeFileSync(versionFile, version);
  }

  /**
   * Bump version according to semver rules
   */
  static bumpVersion(type: 'major' | 'minor' | 'patch'): VersionInfo {
    const currentVersion = this.getVersion();
    const newVersion = semver.inc(currentVersion.version, type);

    if (!newVersion) {
      throw new Error(`Could not increment version: ${currentVersion.version}`);
    }

    this.setVersion(newVersion);
    return this.getVersion();
  }

  /**
   * Sync version across all files
   */
  static syncVersion(): void {
    const versionInfo = this.getVersion();
    const projectRoot = this.getProjectRoot();

    // Update package.json
    this.updatePackageJsonVersion(projectRoot, versionInfo.version);
  }

  /**
   * Update package.json version
   */
  private static updatePackageJsonVersion(projectRoot: string, version: string): void {
    const packageJsonPath = path.join(projectRoot, this.PACKAGE_JSON);

    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found');
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.version = version;

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  /**
   * Validate version consistency across files
   */
  static validateVersionConsistency(): { consistent: boolean; versions: Record<string, string> } {
    const projectRoot = this.getProjectRoot();
    const versionInfo = this.getVersion();
    const versions: Record<string, string> = {
      VERSION: versionInfo.version,
    };

    // Check package.json
    const packageJsonPath = path.join(projectRoot, this.PACKAGE_JSON);
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      versions['package.json'] = packageJson.version;
    }

    // Check if all versions match
    const allVersions = Object.values(versions);
    const consistent = allVersions.every((v) => v === versionInfo.version);

    return { consistent, versions };
  }
}
