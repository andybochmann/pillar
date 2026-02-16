/**
 * Shared helper utilities for MCP (Model Context Protocol) tools.
 * These helpers standardize response formatting and data serialization across all MCP tool implementations.
 */

/**
 * Serialize a date value to ISO string format.
 * Handles Date objects, string dates, null, and undefined gracefully.
 *
 * @param date - The date value to serialize (Date object, string, null, or undefined)
 * @returns ISO string representation of the date, or null if the input is falsy
 *
 * @example
 * serializeDate(new Date('2024-01-15')) // '2024-01-15T00:00:00.000Z'
 * serializeDate('2024-01-15') // '2024-01-15'
 * serializeDate(null) // null
 * serializeDate(undefined) // null
 */
export function serializeDate(date: unknown): string | null {
  if (date instanceof Date) return date.toISOString();
  return date ? String(date) : null;
}

/**
 * Create a standardized error response for MCP tools.
 * All error responses include the isError flag for consistent error handling.
 *
 * @param message - The error message to return to the client
 * @returns MCP-formatted error response object
 *
 * @example
 * errorResponse('Task not found')
 * // Returns: { content: [{ type: 'text', text: 'Task not found' }], isError: true }
 */
export function errorResponse(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

/**
 * Create a standardized success response for MCP tools.
 * Wraps data in the required MCP text response format.
 *
 * @param data - The data to serialize and return (will be JSON.stringify'd)
 * @returns MCP-formatted success response object
 *
 * @example
 * mcpTextResponse({ id: '123', name: 'Task 1' })
 * // Returns: { content: [{ type: 'text', text: '{"id":"123","name":"Task 1"}' }] }
 */
export function mcpTextResponse(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
}
