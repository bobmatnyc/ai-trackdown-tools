/**
 * Comment data types for AI Trackdown Tools
 */

/**
 * Represents a comment on an issue
 */
export interface Comment {
  id: string;              // Format: COMMENT-XXXX (e.g., COMMENT-0001)
  issueId: string;         // The issue this comment belongs to
  body: string;            // Comment content (supports markdown)
  author: string;          // Username or identifier
  createdAt: string;       // ISO 8601 date
  updatedAt: string;       // ISO 8601 date
  editedAt?: string;       // ISO 8601 date (when last edited)
  metadata?: CommentMetadata;
}

/**
 * Additional metadata for comments
 */
export interface CommentMetadata {
  edited?: boolean;        // True if comment has been edited
  editorUsed?: 'cli' | 'editor' | 'api'; // How the comment was created/edited
  attachments?: string[];  // File paths or URLs
  reactions?: CommentReactions;
}

/**
 * Reactions on a comment
 */
export interface CommentReactions {
  [reaction: string]: string[]; // e.g., { "+1": ["user1", "user2"], "heart": ["user3"] }
}

/**
 * Valid reaction types
 */
export type ReactionType = '+1' | '-1' | 'laugh' | 'hooray' | 'confused' | 'heart' | 'rocket' | 'eyes';

/**
 * Comment creation input
 */
export interface CommentInput {
  issueId: string;
  body: string;
  author?: string;         // Optional, can be inferred from environment
  editorUsed?: 'cli' | 'editor' | 'api';
}

/**
 * Comment update input
 */
export interface CommentUpdate {
  body?: string;
  metadata?: Partial<CommentMetadata>;
}

/**
 * Comment filter options
 */
export interface CommentFilter {
  issueId?: string;
  author?: string;
  since?: string;          // ISO 8601 date
  until?: string;          // ISO 8601 date
  hasReactions?: boolean;
  hasAttachments?: boolean;
}

/**
 * Comment sort options
 */
export type CommentSortField = 'created' | 'updated';
export type CommentSortDirection = 'asc' | 'desc';

export interface CommentSortOptions {
  field: CommentSortField;
  direction: CommentSortDirection;
}

/**
 * Comment move operation
 */
export interface CommentMoveOptions {
  commentId: string;
  fromIssueId: string;
  toIssueId: string;
  preserveMetadata?: boolean; // Whether to keep reactions, etc.
}

/**
 * Paginated comment response
 */
export interface CommentPage {
  comments: Comment[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}