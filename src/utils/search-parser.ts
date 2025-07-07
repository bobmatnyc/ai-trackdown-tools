/**
 * GitHub-compatible search query parser
 * Parses search queries with GitHub syntax like "is:open label:bug author:username"
 */

import type {
  ParsedSearchQuery,
  DateQuery,
  NumberQuery,
  AdvancedFilters,
  SearchSyntaxError,
  FilterValidationResult
} from '../types/filters.js';

export class SearchQueryParser {
  private static readonly QUALIFIERS = new Set([
    'is', 'in', 'author', 'assignee', 'mentions', 'commenter', 'involves',
    'team', 'label', 'milestone', 'project', 'status', 'created', 'updated',
    'closed', 'merged', 'archived', 'locked', 'no', 'language', 'comments',
    'interactions', 'reactions', 'draft', 'review', 'reviewed-by',
    'review-requested', 'user', 'org', 'repo', 'head', 'base', 'sort', 'order'
  ]);

  private static readonly DATE_OPERATORS = ['>', '<', '>=', '<=', '=', '..'];
  private static readonly NUMBER_OPERATORS = ['>', '<', '>=', '<=', '=', '..'];

  private static readonly REACTIONS = ['+1', '-1', 'laugh', 'hooray', 'confused', 'heart', 'rocket', 'eyes'];

  /**
   * Parse a GitHub-style search query into structured filters
   */
  public static parse(query: string): ParsedSearchQuery {
    const parsed: ParsedSearchQuery = {
      text: []
    };

    // Tokenize the query
    const tokens = this.tokenize(query);
    
    for (const token of tokens) {
      if (token.includes(':')) {
        const [qualifier, value] = token.split(':', 2);
        this.parseQualifier(parsed, qualifier.toLowerCase(), value);
      } else {
        // Plain text search term
        if (!parsed.text) parsed.text = [];
        parsed.text.push(token);
      }
    }

    return parsed;
  }

  /**
   * Validate a search query and return errors/warnings
   */
  public static validate(query: string): FilterValidationResult {
    const errors: SearchSyntaxError[] = [];
    const warnings: string[] = [];

    try {
      const parsed = this.parse(query);
      
      // Validate qualifiers
      const tokens = this.tokenize(query);
      for (const token of tokens) {
        if (token.includes(':')) {
          const [qualifier, value] = token.split(':', 2);
          
          if (!this.QUALIFIERS.has(qualifier.toLowerCase())) {
            errors.push({
              type: 'unknown_qualifier',
              message: `Unknown qualifier: ${qualifier}`,
              qualifier,
              suggestion: this.suggestQualifier(qualifier)
            });
          }
          
          if (!value || value.trim() === '') {
            errors.push({
              type: 'missing_value',
              message: `Missing value for qualifier: ${qualifier}`,
              qualifier
            });
          }
        }
      }

      // Validate date formats
      if (parsed.created) {
        const dateError = this.validateDate(parsed.created, 'created');
        if (dateError) errors.push(dateError);
      }
      
      if (parsed.updated) {
        const dateError = this.validateDate(parsed.updated, 'updated');
        if (dateError) errors.push(dateError);
      }
      
      if (parsed.closed) {
        const dateError = this.validateDate(parsed.closed, 'closed');
        if (dateError) errors.push(dateError);
      }

      // Validate number formats
      if (parsed.comments) {
        const numberError = this.validateNumber(parsed.comments, 'comments');
        if (numberError) errors.push(numberError);
      }
      
      if (parsed.reactions) {
        const numberError = this.validateNumber(parsed.reactions, 'reactions');
        if (numberError) errors.push(numberError);
      }
      
      if (parsed.interactions) {
        const numberError = this.validateNumber(parsed.interactions, 'interactions');
        if (numberError) errors.push(numberError);
      }

      // Add warnings for complex queries
      const qualifierCount = Object.keys(parsed).length - (parsed.text ? 1 : 0);
      if (qualifierCount > 10) {
        warnings.push('Complex query with many qualifiers may be slow');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        parsedQuery: errors.length === 0 ? parsed : undefined
      };
    } catch (error) {
      errors.push({
        type: 'invalid_operator',
        message: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      return {
        valid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Convert parsed query to GitHub search API format
   */
  public static toGitHubQuery(parsed: ParsedSearchQuery, repositoryPath?: string): string {
    const parts: string[] = [];

    // Add text search terms
    if (parsed.text && parsed.text.length > 0) {
      parts.push(parsed.text.map(term => {
        // Quote terms with spaces or special characters
        if (term.includes(' ') || /[!@#$%^&*()+=\[\]{}|\\:";'<>?,./]/.test(term)) {
          return `"${term}"`;
        }
        return term;
      }).join(' '));
    }

    // Add qualifiers
    if (parsed.is) {
      if (parsed.is.open) parts.push('is:open');
      if (parsed.is.closed) parts.push('is:closed');
      if (parsed.is.issue) parts.push('is:issue');
      if (parsed.is.pr) parts.push('is:pr');
      if (parsed.is.public) parts.push('is:public');
      if (parsed.is.private) parts.push('is:private');
      if (parsed.is.fork) parts.push('is:fork');
    }

    if (parsed.state) {
      parts.push(`is:${parsed.state}`);
    }

    if (parsed.type) {
      parts.push(`is:${parsed.type}`);
    }

    if (parsed.in && parsed.in.length > 0) {
      parts.push(`in:${parsed.in.join(',')}`);
    }

    if (parsed.author) parts.push(`author:${parsed.author}`);
    if (parsed.assignee) parts.push(`assignee:${parsed.assignee}`);
    if (parsed.mentions) parts.push(`mentions:${parsed.mentions}`);
    if (parsed.commenter) parts.push(`commenter:${parsed.commenter}`);
    if (parsed.involves) parts.push(`involves:${parsed.involves}`);
    if (parsed.team) parts.push(`team:${parsed.team}`);
    if (parsed.user) parts.push(`user:${parsed.user}`);
    if (parsed.org) parts.push(`org:${parsed.org}`);

    if (parsed.label && parsed.label.length > 0) {
      parsed.label.forEach(label => {
        if (label.includes(' ') || label.includes(':')) {
          parts.push(`label:"${label}"`);
        } else {
          parts.push(`label:${label}`);
        }
      });
    }

    if (parsed.milestone) {
      if (parsed.milestone.includes(' ')) {
        parts.push(`milestone:"${parsed.milestone}"`);
      } else {
        parts.push(`milestone:${parsed.milestone}`);
      }
    }

    if (parsed.project) parts.push(`project:${parsed.project}`);
    if (parsed.status) parts.push(`status:${parsed.status}`);

    // Date qualifiers
    if (parsed.created) parts.push(`created:${this.formatDateQuery(parsed.created)}`);
    if (parsed.updated) parts.push(`updated:${this.formatDateQuery(parsed.updated)}`);
    if (parsed.closed) parts.push(`closed:${this.formatDateQuery(parsed.closed)}`);
    if (parsed.merged) parts.push(`merged:${this.formatDateQuery(parsed.merged)}`);

    // Number qualifiers
    if (parsed.comments) parts.push(`comments:${this.formatNumberQuery(parsed.comments)}`);
    if (parsed.reactions) parts.push(`reactions:${this.formatNumberQuery(parsed.reactions)}`);
    if (parsed.interactions) parts.push(`interactions:${this.formatNumberQuery(parsed.interactions)}`);

    // Boolean qualifiers
    if (parsed.archived !== undefined) parts.push(`archived:${parsed.archived}`);
    if (parsed.locked !== undefined) parts.push(`locked:${parsed.locked}`);
    if (parsed.draft !== undefined) parts.push(`draft:${parsed.draft}`);

    // No qualifiers
    if (parsed.no && parsed.no.length > 0) {
      parsed.no.forEach(field => parts.push(`no:${field}`));
    }

    if (parsed.language) parts.push(`language:${parsed.language}`);
    if (parsed.review) parts.push(`review:${parsed.review}`);
    if (parsed.reviewed_by) parts.push(`reviewed-by:${parsed.reviewed_by}`);
    if (parsed.review_requested) parts.push(`review-requested:${parsed.review_requested}`);
    if (parsed.head) parts.push(`head:${parsed.head}`);
    if (parsed.base) parts.push(`base:${parsed.base}`);

    // Add repository if provided
    if (repositoryPath && !parsed.repo && !parsed.user && !parsed.org) {
      parts.push(`repo:${repositoryPath}`);
    } else if (parsed.repo) {
      parts.push(`repo:${parsed.repo}`);
    }

    return parts.join(' ');
  }

  /**
   * Convert parsed query to advanced filters
   */
  public static toAdvancedFilters(parsed: ParsedSearchQuery): AdvancedFilters {
    const filters: AdvancedFilters = {};

    // Text search
    if (parsed.text && parsed.text.length > 0) {
      filters.query = parsed.text.join(' ');
    }

    // State
    if (parsed.state) {
      filters.state = parsed.state;
    } else if (parsed.is) {
      if (parsed.is.open) filters.state = 'open';
      if (parsed.is.closed) filters.state = 'closed';
    }

    // Boolean filters
    if (parsed.draft !== undefined) filters.draft = parsed.draft;
    if (parsed.locked !== undefined) filters.locked = parsed.locked;
    if (parsed.archived !== undefined) filters.archived = parsed.archived;

    // User filters
    if (parsed.author) filters.author = parsed.author;
    if (parsed.assignee) filters.assignee = parsed.assignee;
    if (parsed.mentions) filters.mentions = parsed.mentions;
    if (parsed.commenter) filters.commenter = parsed.commenter;
    if (parsed.involves) filters.involves = parsed.involves;

    // Labels
    if (parsed.label && parsed.label.length > 0) {
      filters.labels = parsed.label;
    }

    // Milestone
    if (parsed.milestone) {
      filters.milestone = parsed.milestone;
    }

    // Date filters
    if (parsed.created) filters.created = parsed.created;
    if (parsed.updated) filters.updated = parsed.updated;
    if (parsed.closed) filters.closed = parsed.closed;

    // Number filters
    if (parsed.comments) filters.comments = parsed.comments;
    if (parsed.reactions) filters.reactions = parsed.reactions;
    if (parsed.interactions) filters.interactions = parsed.interactions;

    // Sorting
    if (parsed.sort) {
      filters.sort = parsed.sort as any;
    }
    if (parsed.order) {
      filters.direction = parsed.order;
    }

    // Content filters
    if (parsed.in && parsed.in.length > 0) {
      filters.in = parsed.in;
    }

    // Repository filters
    if (parsed.repo) filters.repo = parsed.repo;
    if (parsed.org) filters.org = parsed.org;
    if (parsed.user) filters.user = parsed.user;

    // Additional filters
    if (parsed.project) filters.project = parsed.project;
    if (parsed.review) filters.review = parsed.review;
    if (parsed.reviewed_by) filters.reviewed_by = parsed.reviewed_by;
    if (parsed.review_requested) filters.review_requested = parsed.review_requested;
    if (parsed.team) filters.team = parsed.team;
    if (parsed.language) filters.language = parsed.language;
    if (parsed.head) filters.head = parsed.head;
    if (parsed.base) filters.base = parsed.base;
    if (parsed.status) filters.status = parsed.status;

    return filters;
  }

  // Private helper methods
  private static tokenize(query: string): string[] {
    const tokens: string[] = [];
    let currentToken = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        if (currentToken.trim()) {
          tokens.push(currentToken.trim());
          currentToken = '';
        }
      } else {
        currentToken += char;
      }
    }
    
    if (currentToken.trim()) {
      tokens.push(currentToken.trim());
    }
    
    return tokens;
  }

  private static parseQualifier(parsed: ParsedSearchQuery, qualifier: string, value: string): void {
    switch (qualifier) {
      case 'is':
        if (!parsed.is) parsed.is = {};
        switch (value) {
          case 'open': parsed.is.open = true; break;
          case 'closed': parsed.is.closed = true; break;
          case 'issue': parsed.is.issue = true; break;
          case 'pr': parsed.is.pr = true; break;
          case 'public': parsed.is.public = true; break;
          case 'private': parsed.is.private = true; break;
          case 'fork': parsed.is.fork = true; break;
        }
        break;
      
      case 'in':
        parsed.in = value.split(',').map(v => v.trim()) as Array<'title' | 'body' | 'comments'>;
        break;
      
      case 'author': parsed.author = value; break;
      case 'assignee': parsed.assignee = value; break;
      case 'mentions': parsed.mentions = value; break;
      case 'commenter': parsed.commenter = value; break;
      case 'involves': parsed.involves = value; break;
      case 'team': parsed.team = value; break;
      case 'user': parsed.user = value; break;
      case 'org': parsed.org = value; break;
      case 'repo': parsed.repo = value; break;
      
      case 'label':
        if (!parsed.label) parsed.label = [];
        parsed.label.push(value);
        break;
      
      case 'milestone': parsed.milestone = value; break;
      case 'project': parsed.project = value; break;
      case 'status': parsed.status = value; break;
      case 'language': parsed.language = value; break;
      case 'head': parsed.head = value; break;
      case 'base': parsed.base = value; break;
      
      case 'created': parsed.created = this.parseDateQuery(value); break;
      case 'updated': parsed.updated = this.parseDateQuery(value); break;
      case 'closed': parsed.closed = this.parseDateQuery(value); break;
      case 'merged': parsed.merged = this.parseDateQuery(value); break;
      
      case 'comments': parsed.comments = this.parseNumberQuery(value); break;
      case 'reactions': parsed.reactions = this.parseNumberQuery(value); break;
      case 'interactions': parsed.interactions = this.parseNumberQuery(value); break;
      
      case 'draft': parsed.draft = value === 'true'; break;
      case 'locked': parsed.locked = value === 'true'; break;
      case 'archived': parsed.archived = value === 'true'; break;
      
      case 'no':
        if (!parsed.no) parsed.no = [];
        parsed.no.push(value as 'label' | 'milestone' | 'assignee');
        break;
      
      case 'review': parsed.review = value as 'none' | 'required' | 'approved' | 'changes_requested'; break;
      case 'reviewed-by': parsed.reviewed_by = value; break;
      case 'review-requested': parsed.review_requested = value; break;
      
      case 'sort': parsed.sort = value as any; break;
      case 'order': parsed.order = value as 'asc' | 'desc'; break;
    }
  }

  private static parseDateQuery(value: string): DateQuery {
    // Handle relative dates
    if (value.match(/^\d+[dwmy]$/)) {
      const amount = parseInt(value.slice(0, -1), 10);
      const unit = value.slice(-1);
      const date = new Date();
      
      switch (unit) {
        case 'd': date.setDate(date.getDate() - amount); break;
        case 'w': date.setDate(date.getDate() - amount * 7); break;
        case 'm': date.setMonth(date.getMonth() - amount); break;
        case 'y': date.setFullYear(date.getFullYear() - amount); break;
      }
      
      return { operator: '>', value: date.toISOString().split('T')[0] };
    }
    
    // Handle operators
    for (const op of this.DATE_OPERATORS) {
      if (value.startsWith(op)) {
        const dateValue = value.substring(op.length);
        return { operator: op as any, value: dateValue };
      }
    }
    
    // Default to equals
    return { operator: '=', value };
  }

  private static parseNumberQuery(value: string): NumberQuery {
    // Handle operators
    for (const op of this.NUMBER_OPERATORS) {
      if (value.startsWith(op)) {
        const numberValue = parseInt(value.substring(op.length), 10);
        return { operator: op as any, value: numberValue };
      }
    }
    
    // Default to equals
    const numberValue = parseInt(value, 10);
    return { operator: '=', value: numberValue };
  }

  private static formatDateQuery(dateQuery: DateQuery): string {
    const dateStr = dateQuery.value instanceof Date 
      ? dateQuery.value.toISOString().split('T')[0]
      : String(dateQuery.value);
    
    return `${dateQuery.operator}${dateStr}`;
  }

  private static formatNumberQuery(numberQuery: NumberQuery): string {
    return `${numberQuery.operator}${numberQuery.value}`;
  }

  private static validateDate(dateQuery: DateQuery, field: string): SearchSyntaxError | null {
    try {
      const dateStr = dateQuery.value instanceof Date 
        ? dateQuery.value.toISOString()
        : String(dateQuery.value);
      
      if (dateStr && !isNaN(Date.parse(dateStr))) {
        return null;
      }
      
      return {
        type: 'invalid_date',
        message: `Invalid date format for ${field}: ${dateStr}`,
        qualifier: field,
        value: dateStr
      };
    } catch {
      return {
        type: 'invalid_date',
        message: `Invalid date format for ${field}`,
        qualifier: field
      };
    }
  }

  private static validateNumber(numberQuery: NumberQuery, field: string): SearchSyntaxError | null {
    if (isNaN(numberQuery.value) || !isFinite(numberQuery.value)) {
      return {
        type: 'invalid_number',
        message: `Invalid number format for ${field}: ${numberQuery.value}`,
        qualifier: field,
        value: String(numberQuery.value)
      };
    }
    
    return null;
  }

  private static suggestQualifier(qualifier: string): string | undefined {
    const suggestions: Record<string, string> = {
      'creator': 'author',
      'assigned': 'assignee',
      'tag': 'label',
      'tags': 'label',
      'version': 'milestone',
      'owner': 'user',
      'organization': 'org',
      'repository': 'repo'
    };
    
    return suggestions[qualifier];
  }
}

// Utility functions for common search operations
export function buildSearchQuery(filters: AdvancedFilters): string {
  const parts: string[] = [];
  
  // Add text query
  if (filters.query) {
    parts.push(filters.query);
  }
  
  // Add state
  if (filters.state && filters.state !== 'all') {
    parts.push(`is:${filters.state}`);
  }
  
  // Add user filters
  if (filters.author) parts.push(`author:${filters.author}`);
  if (filters.assignee) parts.push(`assignee:${filters.assignee}`);
  if (filters.mentions) parts.push(`mentions:${filters.mentions}`);
  
  // Add labels
  if (filters.labels) {
    const labels = Array.isArray(filters.labels) ? filters.labels : [filters.labels];
    labels.forEach(label => {
      if (label.includes(' ')) {
        parts.push(`label:"${label}"`);
      } else {
        parts.push(`label:${label}`);
      }
    });
  }
  
  // Add milestone
  if (filters.milestone) {
    if (String(filters.milestone).includes(' ')) {
      parts.push(`milestone:"${filters.milestone}"`);
    } else {
      parts.push(`milestone:${filters.milestone}`);
    }
  }
  
  // Add date filters
  if (filters.created) {
    if (typeof filters.created === 'string') {
      parts.push(`created:${filters.created}`);
    }
  }
  
  if (filters.updated) {
    if (typeof filters.updated === 'string') {
      parts.push(`updated:${filters.updated}`);
    }
  }
  
  return parts.join(' ');
}

export function parseSimpleQuery(query: string): AdvancedFilters {
  const parsed = SearchQueryParser.parse(query);
  return SearchQueryParser.toAdvancedFilters(parsed);
}