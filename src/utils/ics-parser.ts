/**
 * Simple ICS (iCalendar) parser for VEVENT extraction
 * Parses .ics files and extracts event data for reminder creation
 */

export interface ParsedIcsEvent {
  title: string;
  date: string; // ISO format UTC
  endDate?: string; // ISO format UTC
  location: string | null;
  description: string;
  uid?: string;
}

/**
 * Parse a DTSTART/DTEND value to ISO string
 * Handles formats like: 20260319T164500Z or 20260319T164500
 */
function parseIcsDateTime(value: string): string {
  // Remove any trailing Z for consistent parsing
  const cleanValue = value.replace(/Z$/, "");

  // Format: YYYYMMDDTHHMMSS
  if (cleanValue.length >= 15 && cleanValue.includes("T")) {
    const year = cleanValue.slice(0, 4);
    const month = cleanValue.slice(4, 6);
    const day = cleanValue.slice(6, 8);
    const hour = cleanValue.slice(9, 11);
    const minute = cleanValue.slice(11, 13);
    const second = cleanValue.slice(13, 15);

    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }

  // Format: YYYYMMDD (all-day event)
  if (cleanValue.length === 8) {
    const year = cleanValue.slice(0, 4);
    const month = cleanValue.slice(4, 6);
    const day = cleanValue.slice(6, 8);

    return `${year}-${month}-${day}T09:00:00Z`; // Default to 9 AM for all-day events
  }

  throw new Error(`Unable to parse ICS date: ${value}`);
}

/**
 * Decode ICS text content (handle escaped characters and line folding)
 */
function decodeIcsText(value: string): string {
  return value
    .replace(/\\n/g, "\n") // Escaped newlines
    .replace(/\\,/g, ",") // Escaped commas
    .replace(/\\;/g, ";") // Escaped semicolons
    .replace(/\\\\/g, "\\"); // Escaped backslashes
}

/**
 * Parse a raw ICS file content and extract event data
 */
export function parseIcsFile(content: string): ParsedIcsEvent {
  // Unfold lines (ICS spec allows line continuation with leading space/tab)
  const unfoldedContent = content.replace(/\r?\n[ \t]/g, "");

  // Split into lines
  const lines = unfoldedContent.split(/\r?\n/);

  let inEvent = false;
  let title = "";
  let date = "";
  let endDate: string | undefined;
  let location: string | null = null;
  let description = "";
  let uid: string | undefined;

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      inEvent = true;
      continue;
    }

    if (line.startsWith("END:VEVENT")) {
      inEvent = false;
      break; // Only process first event
    }

    if (!inEvent) continue;

    // Parse property:value pairs
    // Handle properties with parameters like SUMMARY;LANGUAGE=en-US:value
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const propertyPart = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);

    // Extract property name (before any semicolon parameters)
    const propertyName = propertyPart.split(";")[0].toUpperCase();

    switch (propertyName) {
      case "SUMMARY":
        title = decodeIcsText(value);
        break;

      case "DTSTART":
        date = parseIcsDateTime(value);
        break;

      case "DTEND":
        endDate = parseIcsDateTime(value);
        break;

      case "LOCATION":
        location = decodeIcsText(value) || null;
        break;

      case "DESCRIPTION":
        description = decodeIcsText(value);
        break;

      case "UID":
        uid = value;
        break;
    }
  }

  if (!title) {
    throw new Error("ICS file missing required SUMMARY (title) field");
  }

  if (!date) {
    throw new Error("ICS file missing required DTSTART (date) field");
  }

  return {
    title,
    date,
    endDate,
    location,
    description,
    uid,
  };
}
