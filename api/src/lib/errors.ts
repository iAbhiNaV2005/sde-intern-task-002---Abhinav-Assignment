export type StatusCode = 400 | 404 | 409 | 422 | 500

export class AppError extends Error {
  constructor(
    public readonly status: StatusCode,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

