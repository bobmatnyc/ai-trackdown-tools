# Pre-Publish Checklist for AI-Trackdown Tools

This checklist should be followed before publishing a new version of the ai-trackdown-tools package.

## Version Management
- [ ] Version number updated in `package.json`
- [ ] Version number synchronized across all files using `npm run version:sync`
- [ ] CHANGELOG.md updated with new version details

## Code Quality
- [ ] All TypeScript code compiles without errors: `npm run typecheck`
- [ ] Linting passes without errors: `npm run lint`
- [ ] Code formatting is correct: `npm run format`

## Testing
- [ ] Unit tests pass: `npm test`
- [ ] Coverage thresholds met (90%): `npm run test:coverage`
- [ ] E2E workflow test passes: `npm test tests/e2e-integration/complete-workflow-with-notes.test.ts`
  - Epic creation
  - Issue creation (with and without epic)
  - Task creation
  - Comment management
  - State changes with reasons
  - Notes functionality
  - Completion workflows
- [ ] Integration tests pass for:
  - Multi-project support
  - CLI option validation
  - Backward compatibility
  - Project switching
  - Index system health

## Manual Testing
- [ ] Build succeeds: `npm run build`
- [ ] Local installation works: `npm link`
- [ ] Basic commands work after local install:
  - `aitrackdown --version`
  - `aitrackdown init test-project`
  - `aitrackdown status`
  - `aitrackdown index-health`

## Feature-Specific Tests
- [ ] Test new `--notes` option:
  ```bash
  aitrackdown issue update ISS-XXXX --notes "Test note"
  ```
- [ ] Test new `--reason` option with state changes:
  ```bash
  aitrackdown issue update ISS-XXXX --status active --reason "Starting development"
  ```
- [ ] Test combined notes and reasons:
  ```bash
  aitrackdown issue update ISS-XXXX --status completed --reason "All tests pass" --notes "Performance optimized"
  ```
- [ ] Verify notes and reasons are properly appended to issue/task content files

## Documentation
- [ ] README.md reflects current version and features
- [ ] New features documented with examples
- [ ] CLAUDE.md updated if AI instructions changed
- [ ] SCHEMA.md reflects current data structures

## Performance
- [ ] Run benchmark: `npm run benchmark`
- [ ] Verify CLI response times < 50ms for basic operations
- [ ] Check memory usage stays within acceptable limits

## GitHub Sync (if applicable)
- [ ] Sync parser handles all file formats correctly
- [ ] Ticket compliance validation works
- [ ] Relationship management preserved

## Final Steps
- [ ] Git commit all changes
- [ ] Git tag with version number: `git tag v1.x.x`
- [ ] Push to GitHub with tags: `git push origin main --tags`
- [ ] Run npm publish: `npm publish`
- [ ] Verify npm package published correctly
- [ ] Create GitHub release with changelog

## Post-Publish
- [ ] Test global installation: `npm install -g @bobmatnyc/ai-trackdown-tools`
- [ ] Verify installed version matches published version
- [ ] Run smoke tests on globally installed package
- [ ] Update any dependent projects