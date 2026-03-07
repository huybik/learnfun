/** Known tool names — must match TOOL_NAMES in modules/tools/tool-types.ts */
export type ToolName =
  | "request_ta_action"
  | "query_content"
  | "execute_filled_bundle"
  | "light_control"
  | "signal_feedback"
  | "update_profile"
  | "load_content"
  | "get_room_state";

/** Definition of a tool. */
export interface ToolDefinition {
  name: ToolName;
  description: string;
  /** JSON Schema for parameters */
  inputSchema: Record<string, unknown>;
}

/** An invocation of a tool. */
export interface ToolCall {
  id: string;
  name: ToolName;
  arguments: Record<string, unknown>;
}

/** Response from a tool execution. */
export interface ToolResponse {
  callId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}
