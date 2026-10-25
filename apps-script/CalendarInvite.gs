// CalendarInvite.gs
// Creates an ICS file as a Blob to attach to the confirmation email

function createCalendarInvite() {
  const eventDate = CONFIG.get('EVENT_DATE');      // "2025-07-15"
  const eventTime = CONFIG.get('EVENT_TIME');       // "14:00"
  const duration = parseInt(CONFIG.get('EVENT_DURATION_MIN')); // 30
  const timezone = CONFIG.get('TIMEZONE');           // "Asia/Kolkata"
  const quizUrl = CONFIG.get('QUIZ_URL');

  // Parse start
  const startDt = new Date(`${eventDate}T${eventTime}:00`);
  const endDt = new Date(startDt.getTime() + duration * 60000);

  // Format to ICS datetime (UTC)
  function toICS(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  const uid = Utilities.getUuid();

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SmartLink//Quiz//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${toICS(startDt)}`,
    `DTEND:${toICS(endDt)}`,
    `SUMMARY:SmartLink Git Quiz`,
    `DESCRIPTION:Join the quiz at ${quizUrl}\\nBring your join code!`,
    `URL:${quizUrl}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return Utilities.newBlob(ics, 'text/calendar', 'smartlink-quiz.ics');
}
