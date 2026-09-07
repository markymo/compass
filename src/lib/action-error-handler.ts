import crypto from 'crypto';

/**
 * Explicit domain error representing intentional, expected user-facing validation
 * or business rule failures (e.g. authentication required, locked fields, duplicate entries).
 */
export class ActionDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionDomainError';
  }
}

/**
 * Strictly typed diagnostic context keys permitted for server-side error logging.
 */
export interface SafeDiagnosticContext {
  clientLEId?: string;
  fieldNo?: number;
  rowId?: string;
  customFieldId?: string;
  actionName?: string;
  entityType?: 'LEGAL_ENTITY' | 'CLIENT_LE';
  collectionId?: string;
  attachmentDocumentId?: string;
  instanceId?: string;
}

/**
 * Discriminated failure union model for server action outcomes.
 */
export type ActionFailure =
  | {
      success: false;
      kind: 'domain';
      message: string;
      error?: string;
      operation: string;
      timestamp: string; // ISO 8601 UTC
    }
  | {
      success: false;
      kind: 'unexpected';
      message: string;
      error?: string;
      errorRef: string;
      operation: string;
      timestamp: string; // ISO 8601 UTC
      technicalDetails?: string;
    };

export type ActionResult<T = void> =
  | ({ success: true } & (T extends void ? {} : T))
  | ActionFailure;

/**
 * Strict server-only check for localhost environment.
 * Fails closed for any missing, undefined, or non-"localhost" value.
 */
export function isLocalhostServerEnvironment(): boolean {
  return process.env.APP_ENV === 'localhost';
}

/**
 * Generates a 12-character high-entropy cryptographic opaque reference ID using Node.js crypto.
 * Example: ERR-3FA91C72B8E4
 */
export function generateHighEntropyErrorRef(): string {
  const hex = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `ERR-${hex}`;
}

/**
 * Runtime whitelist sanitizer ensuring only explicitly whitelisted safe diagnostic keys are logged.
 */
export function sanitizeDiagnosticContext(context?: SafeDiagnosticContext): SafeDiagnosticContext | undefined {
  if (!context) return undefined;
  return {
    clientLEId: typeof context.clientLEId === 'string' ? context.clientLEId : undefined,
    fieldNo: typeof context.fieldNo === 'number' ? context.fieldNo : undefined,
    rowId: typeof context.rowId === 'string' ? context.rowId : undefined,
    customFieldId: typeof context.customFieldId === 'string' ? context.customFieldId : undefined,
    actionName: typeof context.actionName === 'string' ? context.actionName : undefined,
    entityType:
      context.entityType === 'LEGAL_ENTITY' || context.entityType === 'CLIENT_LE'
        ? context.entityType
        : undefined,
    collectionId: typeof context.collectionId === 'string' ? context.collectionId : undefined,
    attachmentDocumentId: typeof context.attachmentDocumentId === 'string' ? context.attachmentDocumentId : undefined,
    instanceId: typeof context.instanceId === 'string' ? context.instanceId : undefined,
  };
}

/**
 * Central error boundary for server actions.
 * Converts thrown or caught exceptions into a standardized ActionFailure response.
 */
export function handleActionError(
  error: unknown,
  options: {
    operation: string;
    fallbackMessage: string;
    context?: SafeDiagnosticContext;
  }
): ActionFailure {
  const timestamp = new Date().toISOString();

  // 1. Explicit Domain Failures
  if (error instanceof ActionDomainError) {
    return {
      success: false,
      kind: 'domain',
      message: error.message,
      error: error.message,
      operation: options.operation,
      timestamp,
    };
  }

  // 2. Unexpected Technical Failures
  const errorRef = generateHighEntropyErrorRef();
  const sanitizedContext = sanitizeDiagnosticContext(options.context);

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[ACTION_ERROR] [${errorRef}] ${options.operation}: ${errorMessage}`, {
    errorRef,
    operation: options.operation,
    message: errorMessage,
    stack: errorStack,
    timestamp,
    context: sanitizedContext,
  });

  const technicalDetails = isLocalhostServerEnvironment()
    ? error instanceof Error
      ? `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`
      : String(error)
    : undefined;

  return {
    success: false,
    kind: 'unexpected',
    message: options.fallbackMessage,
    error: options.fallbackMessage,
    errorRef,
    operation: options.operation,
    timestamp,
    ...(technicalDetails ? { technicalDetails } : {}),
  };
}
