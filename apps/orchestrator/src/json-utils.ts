/**
 * Robust JSON extraction and parsing for LLM synthesis responses.
 *
 * GPT-4o with response_format: json_object should always return valid JSON,
 * but this utility adds belt-and-suspenders cleaning for edge cases:
 *   - Markdown code fences (```json ... ```)
 *   - Leading/trailing prose outside the JSON object
 *   - Unescaped control characters inside string values
 *   - Trailing commas before } or ]
 */

/**
 * Attempts to extract and parse a JSON object from an LLM response string.
 * Returns the parsed object, or throws with a descriptive message on failure.
 */
export function extractAndParseJSON<T>(raw: string): T {
  let text = raw.trim();

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Find the outermost JSON object (greedy — handles nested objects correctly)
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`No JSON object found in LLM output: ${text.slice(0, 300)}`);
  }
  text = match[0];

  // First attempt: parse as-is
  try {
    return JSON.parse(text) as T;
  } catch {
    // Fall through to repair attempts
  }

  // Repair pass 1: remove trailing commas before } or ]
  const noTrailingCommas = text.replace(/,(\s*[}\]])/g, "$1");
  try {
    return JSON.parse(noTrailingCommas) as T;
  } catch {
    // Fall through
  }

  // Repair pass 2: replace unescaped control characters inside strings
  const cleanedControls = noTrailingCommas.replace(
    /"(?:[^"\\]|\\.)*"/g,
    (str) => str.replace(/[\u0000-\u001f]/g, (c) => {
      const escapes: Record<string, string> = { "\n": "\\n", "\r": "\\r", "\t": "\\t" };
      return escapes[c] ?? `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`;
    })
  );
  try {
    return JSON.parse(cleanedControls) as T;
  } catch (finalErr) {
    throw new Error(
      `Failed to parse LLM JSON after repair attempts: ${(finalErr as Error).message}. ` +
      `Raw output (first 400 chars): ${raw.slice(0, 400)}`
    );
  }
}
