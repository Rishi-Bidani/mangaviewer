// errors the routes turn into a response; anything else is unexpected and answers with a 500

/**
 * @brief answered with a 404
 */
export class NotFoundError extends Error {}

/**
 * @brief answered with a 400, its message says what's wrong with the request
 */
export class BadRequestError extends Error {}
