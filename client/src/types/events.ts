/** All event types flowing through the system. */
export type EventType =
  // Teacher -> TA
  | "teacher.generate_content"
  | "teacher.fill_template"
  | "teacher.tool_call"
  // TA -> Frontend
  | "ta.content_ready"
  | "ta.tool_response"
  | "ta.error"
  // Room events
  | "room.user_joined"
  | "room.user_left"
  | "room.state_updated"
  | "room.annotation_added"
  | "room.page_changed";

/** Base shape for all events. */
export interface BaseEvent {
  type: EventType;
  timestamp: number;
  sourceId: string;
}

// --- Teacher -> TA events ---

export interface GenerateContentEvent extends BaseEvent {
  type: "teacher.generate_content";
  payload: {
    prompt: string;
    templateId?: string;
    context?: Record<string, unknown>;
  };
}

export interface FillTemplateEvent extends BaseEvent {
  type: "teacher.fill_template";
  payload: {
    templateId: string;
    slots: Record<string, string>;
  };
}

export interface ToolCallEvent extends BaseEvent {
  type: "teacher.tool_call";
  payload: {
    callId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  };
}

export type TeacherToTAEvent =
  | GenerateContentEvent
  | FillTemplateEvent
  | ToolCallEvent;

// --- TA -> Frontend events ---

export interface ContentReadyEvent extends BaseEvent {
  type: "ta.content_ready";
  payload: {
    contentId: string;
    metadata?: Record<string, unknown>;
  };
}

export interface ToolResponseEvent extends BaseEvent {
  type: "ta.tool_response";
  payload: {
    callId: string;
    success: boolean;
    result?: unknown;
    error?: string;
  };
}

export interface TAErrorEvent extends BaseEvent {
  type: "ta.error";
  payload: {
    message: string;
    code?: string;
  };
}

export type TAToFrontendEvent =
  | ContentReadyEvent
  | ToolResponseEvent
  | TAErrorEvent;

// --- Room events ---

export interface UserJoinedEvent extends BaseEvent {
  type: "room.user_joined";
  payload: { userId: string; name: string };
}

export interface UserLeftEvent extends BaseEvent {
  type: "room.user_left";
  payload: { userId: string };
}

export interface StateUpdatedEvent extends BaseEvent {
  type: "room.state_updated";
  payload: { diff: Record<string, unknown> };
}

export interface AnnotationAddedEvent extends BaseEvent {
  type: "room.annotation_added";
  payload: { annotationId: string; userId: string; data: string };
}

export interface PageChangedEvent extends BaseEvent {
  type: "room.page_changed";
  payload: { page: number };
}

export type RoomEvent =
  | UserJoinedEvent
  | UserLeftEvent
  | StateUpdatedEvent
  | AnnotationAddedEvent
  | PageChangedEvent;
