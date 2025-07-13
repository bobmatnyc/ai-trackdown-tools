import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChangelogManager } from '../src/utils/changelog.js';
import { VersionManager } from '../src/utils/version.js';

describe('Version Management System', () => {
  const testDir = path.join(process.cwd(), 'test-temp');
  const versionFile = path.join(testDir, 'VERSION');
  const packageJsonFile = path.join(testDir, 'package.json');

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create test VERSION file
    fs.writeFileSync(versionFile, '0.1.0');

    // Create test package.json
    const packageJson = {
      name: 'test-package',
      version: '0.1.0',
      description: 'Test package',
    };
    fs.writeFileSync(packageJsonFile, JSON.stringify(packageJson, null, 2));

    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(() => {
    // Change back to original directory
    process.chdir(path.dirname(testDir));

    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('VersionManager', () => {
    it('should read version from VERSION file', () => {
      const versionInfo = VersionManager.getVersion();

      expect(versionInfo.version).toBe('0.1.0');
      expect(versionInfo.major).toBe(0);
      expect(versionInfo.minor).toBe(1);
      expect(versionInfo.patch).toBe(0);
    });

    it('should set version in VERSION file', () => {
      VersionManager.setVersion('0.2.0');

      const content = fs.readFileSync(versionFile, 'utf8').trim();
      expect(content).toBe('0.2.0');
    });

    it('should bump patch version', () => {
      const newVersion = VersionManager.bumpVersion('patch');

      expect(newVersion.version).toBe('0.1.1');
      expect(newVersion.major).toBe(0);
      expect(newVersion.minor).toBe(1);
      expect(newVersion.patch).toBe(1);
    });

    it('should bump minor version', () => {
      const newVersion = VersionManager.bumpVersion('minor');

      expect(newVersion.version).toBe('0.2.0');
      expect(newVersion.major).toBe(0);
      expect(newVersion.minor).toBe(2);
      expect(newVersion.patch).toBe(0);
    });

    it('should bump major version', () => {
      const newVersion = VersionManager.bumpVersion('major');

      expect(newVersion.version).toBe('1.0.0');
      expect(newVersion.major).toBe(1);
      expect(newVersion.minor).toBe(0);
      expect(newVersion.patch).toBe(0);
    });

    it('should validate version consistency', () => {
      const consistency = VersionManager.validateVersionConsistency();

      expect(consistency.consistent).toBe(true);
      expect(consistency.versions.VERSION).toBe('0.1.0');
      expect(consistency.versions['package.json']).toBe('0.1.0');
    });

    it('should detect version inconsistency', () => {
      // Make package.json inconsistent
      const packageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
      packageJson.version = '0.2.0';
      fs.writeFileSync(packageJsonFile, JSON.stringify(packageJson, null, 2));

      const consistency = VersionManager.validateVersionConsistency();

      expect(consistency.consistent).toBe(false);
      expect(consistency.versions.VERSION).toBe('0.1.0');
      expect(consistency.versions['package.json']).toBe('0.2.0');
    });

    it('should sync version across files', () => {
      // Make package.json inconsistent
      const packageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
      packageJson.version = '0.2.0';
      fs.writeFileSync(packageJsonFile, JSON.stringify(packageJson, null, 2));

      // Sync versions
      VersionManager.syncVersion();

      // Check that package.json is now consistent
      const consistency = VersionManager.validateVersionConsistency();
      expect(consistency.consistent).toBe(true);
      expect(consistency.versions['package.json']).toBe('0.1.0');
    });

    it('should throw error for invalid version format', () => {
      expect(() => {
        VersionManager.setVersion('invalid-version');
      }).toThrow('Invalid version format: invalid-version');
    });

    it('should throw error when VERSION file is missing', () => {
      fs.unlinkSync(versionFile);

      expect(() => {
        VersionManager.getVersion();
      }).toThrow('VERSION file not found');
    });
  });

  describe('ChangelogManager', () => {
    it('should parse conventional commits', () => {
      const commits = [
        {
          type: 'feat',
          description: 'add new feature',
          body: '',
          breaking: false,
          hash: 'abc123',
        },
        {
          type: 'fix',
          description: 'fix bug',
          body: '',
          breaking: false,
          hash: 'def456',
        },
      ];

      const sections = ChangelogManager.categorizeCommits(commits);

      expect(sections.added).toHaveLength(1);
      expect(sections.added[0]).toContain('add new feature');
      expect(sections.fixed).toHaveLength(1);
      expect(sections.fixed[0]).toContain('fix bug');
    });

    it('should handle breaking changes', () => {
      const commits = [
        {
          type: 'feat',
          description: 'breaking change',
          body: 'BREAKING CHANGE: this breaks existing API',
          breaking: true,
          hash: 'abc123',
        },
      ];

      const sections = ChangelogManager.categorizeCommits(commits);

      expect(sections.changed).toHaveLength(1);
      expect(sections.changed[0]).toContain('BREAKING');
    });

    it('should format changelog entry correctly', () => {
      const entry = {
        version: '0.1.0',
        date: '2025-07-07',
        sections: {
          added: ['New feature'],
          changed: [],
          deprecated: [],
          removed: [],
          fixed: ['Bug fix'],
          security: [],
        },
      };

      const markdown = ChangelogManager.formatChangelogEntry(entry);

      expect(markdown).toContain('## [0.1.0] - 2025-07-07');
      expect(markdown).toContain('### Added');
      expect(markdown).toContain('- New feature');
      expect(markdown).toContain('### Fixed');
      expect(markdown).toContain('- Bug fix');
      expect(markdown).not.toContain('### Changed');
    });

    it('should create changelog header', () => {
      // Test that generateChangelog creates the proper header for new files
      const changelogPath = path.join(testDir, 'CHANGELOG.md');

      // Ensure file doesn't exist
      if (fs.existsSync(changelogPath)) {
        fs.unlinkSync(changelogPath);
      }

      ChangelogManager.generateChangelog('0.1.0');

      const content = fs.readFileSync(changelogPath, 'utf8');
      expect(content).toContain('# Changelog');
      expect(content).toContain('Keep a Changelog');
      expect(content).toContain('Semantic Versioning');
      expect(content).toContain('## [0.1.0] - 2025-07-07');
    });
  });

  describe('Semver Validation', () => {
    it('should validate semver versions', () => {
      expect(() => VersionManager.setVersion('1.0.0')).not.toThrow();
      expect(() => VersionManager.setVersion('0.1.0-alpha')).not.toThrow();
      expect(() => VersionManager.setVersion('1.0.0-alpha.1')).not.toThrow();
      expect(() => VersionManager.setVersion('1.0.0+build.1')).not.toThrow();
    });

    it('should reject invalid semver versions', () => {
      expect(() => VersionManager.setVersion('1.0')).toThrow();
      expect(() => VersionManager.setVersion('1.0.0.0')).toThrow();
      expect(() => VersionManager.setVersion('not-a-version')).toThrow();
      expect(() => VersionManager.setVersion('1.0.0-')).toThrow();
    });
  });
});
