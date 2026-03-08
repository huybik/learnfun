/** A template with all slots filled, ready to render. */
export interface FilledBundle {
  templateId: string;
  sessionId: string;
  filledSlots: Record<string, string>;
  createdAt: string;
}
