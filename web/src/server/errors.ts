/** A rule or lookup failure to show the user, e.g. "Not found" or a duplicate name. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: 'NOT_FOUND' | 'CONFLICT' | 'INVALID' = 'INVALID',
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function notFound(what: string): DomainError {
  return new DomainError(`${what} not found`, 'NOT_FOUND');
}
