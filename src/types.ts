export interface Contact {
  mode: "email" | "sms" | "call";
  address: string;
  isDefault?: boolean;
}

export interface Reminder {
  id?: number;
  title: string;
  date: string;
  location?: any;
  description: string;
  reminders: Contact[];
  alerts: number[];
  is_recurring: boolean;
  recurrence?: string;
  start_date?: string;
  end_date?: string;
  last_alert_time?: Date | null;
  is_active?: boolean;
}

// ICS Calendar Event Types
export interface ICSEventData {
  reminder: Reminder;
  alertName?: string;
  alertMs?: number;
}

