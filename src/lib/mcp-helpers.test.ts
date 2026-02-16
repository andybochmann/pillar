import { describe, it, expect } from "vitest";
import { serializeDate, errorResponse, mcpTextResponse } from "./mcp-helpers";

describe("serializeDate", () => {
  it("serializes Date objects to ISO string", () => {
    const date = new Date("2024-01-15T10:30:00.000Z");
    const result = serializeDate(date);
    expect(result).toBe("2024-01-15T10:30:00.000Z");
  });

  it("returns the string unchanged when given a date string", () => {
    const dateString = "2024-01-15";
    const result = serializeDate(dateString);
    expect(result).toBe("2024-01-15");
  });

  it("returns null when given null", () => {
    const result = serializeDate(null);
    expect(result).toBeNull();
  });

  it("returns null when given undefined", () => {
    const result = serializeDate(undefined);
    expect(result).toBeNull();
  });

  it("converts non-date truthy values to strings", () => {
    const result = serializeDate(12345);
    expect(result).toBe("12345");
  });

  it("returns null for empty string", () => {
    const result = serializeDate("");
    expect(result).toBeNull();
  });

  it("returns null for zero", () => {
    const result = serializeDate(0);
    expect(result).toBeNull();
  });

  it("handles Date with millisecond precision", () => {
    const date = new Date("2024-01-15T10:30:00.123Z");
    const result = serializeDate(date);
    expect(result).toBe("2024-01-15T10:30:00.123Z");
  });
});

describe("errorResponse", () => {
  it("returns an MCP-formatted error response object", () => {
    const result = errorResponse("Task not found");
    expect(result).toEqual({
      content: [{ type: "text", text: "Task not found" }],
      isError: true,
    });
  });

  it("includes the isError flag set to true", () => {
    const result = errorResponse("Something went wrong");
    expect(result.isError).toBe(true);
  });

  it("wraps message in content array with text type", () => {
    const result = errorResponse("Validation failed");
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toBe("Validation failed");
  });

  it("handles empty error message", () => {
    const result = errorResponse("");
    expect(result.content[0].text).toBe("");
    expect(result.isError).toBe(true);
  });

  it("handles multi-line error messages", () => {
    const multiLineMessage = "Error on line 1\nError on line 2";
    const result = errorResponse(multiLineMessage);
    expect(result.content[0].text).toBe(multiLineMessage);
  });

  it("handles error messages with special characters", () => {
    const specialMessage = 'Error: "invalid" value for <field>';
    const result = errorResponse(specialMessage);
    expect(result.content[0].text).toBe(specialMessage);
  });
});

describe("mcpTextResponse", () => {
  it("returns an MCP-formatted success response with JSON data", () => {
    const data = { id: "123", name: "Task 1" };
    const result = mcpTextResponse(data);
    expect(result).toEqual({
      content: [{ type: "text", text: '{"id":"123","name":"Task 1"}' }],
    });
  });

  it("serializes complex objects to JSON", () => {
    const data = {
      id: "456",
      tasks: [
        { name: "Task 1", completed: true },
        { name: "Task 2", completed: false },
      ],
    };
    const result = mcpTextResponse(data);
    const parsedText = JSON.parse(result.content[0].text);
    expect(parsedText).toEqual(data);
  });

  it("handles arrays as data", () => {
    const data = [1, 2, 3, 4, 5];
    const result = mcpTextResponse(data);
    expect(result.content[0].text).toBe("[1,2,3,4,5]");
  });

  it("handles primitive values", () => {
    const result = mcpTextResponse("simple string");
    expect(result.content[0].text).toBe('"simple string"');
  });

  it("handles null value", () => {
    const result = mcpTextResponse(null);
    expect(result.content[0].text).toBe("null");
  });

  it("handles boolean values", () => {
    const resultTrue = mcpTextResponse(true);
    expect(resultTrue.content[0].text).toBe("true");

    const resultFalse = mcpTextResponse(false);
    expect(resultFalse.content[0].text).toBe("false");
  });

  it("handles numbers", () => {
    const result = mcpTextResponse(42);
    expect(result.content[0].text).toBe("42");
  });

  it("does not include isError flag", () => {
    const data = { success: true };
    const result = mcpTextResponse(data);
    expect(result).not.toHaveProperty("isError");
  });

  it("wraps data in content array with text type", () => {
    const data = { test: "value" };
    const result = mcpTextResponse(data);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
  });

  it("handles nested objects with dates", () => {
    const data = {
      task: { id: "1", createdAt: "2024-01-15T00:00:00.000Z" },
    };
    const result = mcpTextResponse(data);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.task.createdAt).toBe("2024-01-15T00:00:00.000Z");
  });

  it("handles empty objects", () => {
    const result = mcpTextResponse({});
    expect(result.content[0].text).toBe("{}");
  });

  it("handles empty arrays", () => {
    const result = mcpTextResponse([]);
    expect(result.content[0].text).toBe("[]");
  });
});
