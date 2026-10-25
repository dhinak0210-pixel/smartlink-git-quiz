// Config.gs
// All secrets stored in Script Properties (File → Project Properties → Script Properties)
// Required properties:
//   QUIZ_URL           - e.g., "https://smartlink-quiz.vercel.app"
//   EVENT_DATE          - e.g., "2025-07-15"
//   EVENT_TIME          - e.g., "14:00"
//   EVENT_DURATION_MIN  - e.g., "30"
//   TIMEZONE            - e.g., "Asia/Kolkata"
//   SENDER_NAME         - e.g., "SmartLink Quiz Team"
//   RULES_DOC_URL       - link to rules document
//   TELEGRAM_BOT_TOKEN  - Bot API token
//   TELEGRAM_CHANNEL_ID - e.g., "@smartlink_quiz" or numeric chat ID
//   SHEET_NAME          - e.g., "Form Responses 1"
//   JOIN_CODE_COL       - column letter for join code, e.g., "F"
//   STATUS_COL          - column letter for status, e.g., "G"
//   EMAIL_SENT_COL      - column letter for email sent flag, e.g., "H"

const CONFIG = {
  get: function(key) {
    const val = PropertiesService.getScriptProperties().getProperty(key);
    if (!val) throw new Error(`Missing Script Property: ${key}`);
    return val;
  },
  getOptional: function(key, fallback) {
    return PropertiesService.getScriptProperties().getProperty(key) || fallback;
  }
};
