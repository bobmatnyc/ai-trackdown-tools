import { describe, expect, it } from 'vitest';
import {
  ValidationError,
  validatePriority,
  validateProjectName,
  validateRequired,
} from '../src/utils/validation.js';

describe('CLI Foundation Tests', () => {
  describe('validateRequired', () => {
    it('should return trimmed value for valid input', () => {
      expect(validateRequired('  test  ', 'Test Field')).toBe('test');
    });

    it('should throw ValidationError for empty string', () => {
      expect(() => validateRequired('', 'Test Field')).toThrow(ValidationError);
    });

    it('should throw ValidationError for whitespace only', () => {
      expect(() => validateRequired('   ', 'Test Field')).toThrow(ValidationError);
    });

    it('should throw ValidationError for undefined', () => {
      expect(() => validateRequired(undefined, 'Test Field')).toThrow(ValidationError);
    });
  });

  describe('validateProjectName', () => {
    it('should accept valid project names', () => {
      expect(validateProjectName('my-project')).toBe('my-project');
      expect(validateProjectName('project_123')).toBe('project_123');
      expect(validateProjectName('MyProject')).toBe('MyProject');
    });

    it('should reject names with invalid characters', () => {
      expect(() => validateProjectName('my project')).toThrow(ValidationError);
      expect(() => validateProjectName('my@project')).toThrow(ValidationError);
      expect(() => validateProjectName('my.project')).toThrow(ValidationError);
    });

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(51);
      expect(() => validateProjectName(longName)).toThrow(ValidationError);
    });

    it('should reject empty names', () => {
      expect(() => validateProjectName('')).toThrow(ValidationError);
    });
  });

  describe('validatePriority', () => {
    it('should accept valid priorities', () => {
      expect(validatePriority('low')).toBe('low');
      expect(validatePriority('Medium')).toBe('medium');
      expect(validatePriority('HIGH')).toBe('high');
      expect(validatePriority('  critical  ')).toBe('critical');
    });

    it('should reject invalid priorities', () => {
      expect(() => validatePriority('urgent')).toThrow(ValidationError);
      expect(() => validatePriority('normal')).toThrow(ValidationError);
      expect(() => validatePriority('')).toThrow(ValidationError);
    });
  });
});

describe('CLI Package Structure', () => {
  it('should have proper package.json structure', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');

    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));

    expect(packageJson.name).toBe('ai-trackdown-tooling');
    expect(packageJson.type).toBe('module');
    expect(packageJson.bin).toHaveProperty('trackdown');
    expect(packageJson.bin).toHaveProperty('td');
    expect(packageJson.main).toBe('./dist/index.js');
    expect(packageJson.exports).toHaveProperty('.');
  });

  it('should have TypeScript configuration', async () => {
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');

    expect(existsSync(join(process.cwd(), 'tsconfig.json'))).toBe(true);
  });

  it('should have Biome configuration', async () => {
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');

    expect(existsSync(join(process.cwd(), 'biome.json'))).toBe(true);
  });

  it('should have Vitest configuration', async () => {
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');

    expect(existsSync(join(process.cwd(), 'vitest.config.ts'))).toBe(true);
  });

  it('should have tsup configuration', async () => {
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');

    expect(existsSync(join(process.cwd(), 'tsup.config.ts'))).toBe(true);
  });
});
