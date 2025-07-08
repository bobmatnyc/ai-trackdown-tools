/**
 * AI Command Group for AI-Trackdown
 * AI-specific functionality for token tracking and context management
 */

import { Command } from 'commander';
import { createAiGenerateLlmsCommand } from './ai/generate-llms-txt.js';
import { createAiTrackTokensCommand } from './ai/track-tokens.js';
import { createAiContextCommand } from './ai/context.js';

export function createAiCommand(): Command {
  const cmd = new Command('ai');
  
  cmd
    .description('AI-specific functionality for token tracking and context management')
    .addCommand(createAiGenerateLlmsCommand())
    .addCommand(createAiTrackTokensCommand())
    .addCommand(createAiContextCommand());

  return cmd;
}