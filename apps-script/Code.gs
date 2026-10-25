// Code.gs

// ============================================
// FORM SUBMIT TRIGGER (installable, not simple)
// ============================================

function onFormSubmit(e) {
  // This is an installable trigger — set it up via
  // Triggers → Add Trigger → onFormSubmit → From spreadsheet → On form submit

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.get('SHEET_NAME'));
  const row = e.range.getRow();
  const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Column mapping — adjust indices based on your form field order
  // Expected form fields: Timestamp(0), Full Name(1), College ID(2), College Email(3),
  //                        Department & Year(4), Consent(5)
  const timestamp = data[0];
  const fullName = data[1].toString().trim();
  const collegeId = data[2].toString().trim().toUpperCase();
  const email = data[3].toString().trim().toLowerCase();
  const deptYear = data[4].toString().trim();
  const consent = data[5];

  const joinCodeCol = CONFIG.get('JOIN_CODE_COL');
  const statusCol = CONFIG.get('STATUS_COL');
  const emailSentCol = CONFIG.get('EMAIL_SENT_COL');

  const joinCodeColIndex = joinCodeCol.charCodeAt(0) - 64;
  const statusColIndex = statusCol.charCodeAt(0) - 64;
  const emailSentColIndex = emailSentCol.charCodeAt(0) - 64;

  // --- Validation ---

  // Check consent
  if (!consent || consent.toString().toLowerCase().indexOf('agree') === -1) {
    sheet.getRange(row, statusColIndex).setValue('REJECTED: No consent');
    Logger.log(`Row ${row}: Rejected — no consent`);
    return;
  }

  // Check duplicate college ID
  const dupCheck = checkDuplicate(collegeId, sheet);
  if (dupCheck.isDuplicate && dupCheck.existingRow !== row) {
    sheet.getRange(row, statusColIndex).setValue(`DUPLICATE: See row ${dupCheck.existingRow}`);
    Logger.log(`Row ${row}: Duplicate college ID ${collegeId}, original at row ${dupCheck.existingRow}`);

    // Optionally notify the student
    try {
      MailApp.sendEmail({
        to: email,
        subject: 'SmartLink Git Quiz — Already Registered',
        body: `Hi ${fullName},\n\nYou've already registered with college ID ${collegeId}. ` +
              `If you lost your join code, contact the organizers.\n\nSmartLink Quiz Team`,
        name: CONFIG.get('SENDER_NAME'),
        noReply: true
      });
    } catch (ignored) {}

    return;
  }

  // --- Generate join code ---
  const joinCode = generateUniqueJoinCode(sheet);
  sheet.getRange(row, joinCodeColIndex).setValue(joinCode);

  // --- Send confirmation email ---
  const result = sendConfirmationEmail(email, fullName, joinCode);

  if (result.sent) {
    sheet.getRange(row, statusColIndex).setValue('CONFIRMED');
    sheet.getRange(row, emailSentColIndex).setValue(new Date());
    Logger.log(`Row ${row}: ${fullName} (${collegeId}) → code ${joinCode}, email sent. Quota: ${result.remaining}`);
  } else {
    sheet.getRange(row, statusColIndex).setValue(`CODE_ASSIGNED_EMAIL_PENDING: ${result.reason}`);
    sheet.getRange(row, emailSentColIndex).setValue('FAILED');
    Logger.log(`Row ${row}: Code assigned but email failed: ${result.reason}`);
  }
}

// ============================================
// BATCH FUNCTIONS (run manually or by trigger)
// ============================================

function sendPendingEmails() {
  // Retries emails that failed during form submit
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.get('SHEET_NAME'));
  const data = sheet.getDataRange().getValues();

  const joinCodeColIndex = CONFIG.get('JOIN_CODE_COL').charCodeAt(0) - 64;
  const statusColIndex = CONFIG.get('STATUS_COL').charCodeAt(0) - 64;
  const emailSentColIndex = CONFIG.get('EMAIL_SENT_COL').charCodeAt(0) - 64;

  let sent = 0;
  let failed = 0;

  for (let row = 1; row < data.length; row++) {
    const status = data[row][statusColIndex - 1].toString();
    if (!status.startsWith('CODE_ASSIGNED_EMAIL_PENDING')) continue;

    const email = data[row][3].toString().trim().toLowerCase(); // col D = index 3
    const name = data[row][1].toString().trim();                // col B = index 1
    const code = data[row][joinCodeColIndex - 1].toString();

    if (!code) continue;

    const remaining = MailApp.getRemainingDailyQuota();
    if (remaining < 1) {
      Logger.log(`Quota exhausted after sending ${sent} pending emails. ${failed} still pending.`);
      return;
    }

    const result = sendConfirmationEmail(email, name, code);
    const sheetRow = row + 1; // 1-based

    if (result.sent) {
      sheet.getRange(sheetRow, statusColIndex).setValue('CONFIRMED');
      sheet.getRange(sheetRow, emailSentColIndex).setValue(new Date());
      sent++;
    } else {
      failed++;
    }

    // Small delay to avoid hitting rate limits
    Utilities.sleep(1000);
  }

  Logger.log(`Pending emails batch: ${sent} sent, ${failed} still failed.`);
}

function sendReminders(type) {
  // type: "1day" or "1hour"
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.get('SHEET_NAME'));
  const data = sheet.getDataRange().getValues();

  const statusColIndex = CONFIG.get('STATUS_COL').charCodeAt(0) - 64;
  const joinCodeColIndex = CONFIG.get('JOIN_CODE_COL').charCodeAt(0) - 64;

  let sent = 0;
  let skipped = 0;

  for (let row = 1; row < data.length; row++) {
    const status = data[row][statusColIndex - 1].toString();
    if (status !== 'CONFIRMED') {
      skipped++;
      continue;
    }

    const remaining = MailApp.getRemainingDailyQuota();
    if (remaining < 1) {
      Logger.log(`Reminder (${type}) quota exhausted after ${sent}. Remaining students not notified.`);
      return;
    }

    const email = data[row][3].toString().trim().toLowerCase();
    const name = data[row][1].toString().trim();
    const code = data[row][joinCodeColIndex - 1].toString();

    sendReminderEmail(email, name, code, type);
    sent++;

    Utilities.sleep(500);
  }

  Logger.log(`Reminders (${type}): ${sent} sent, ${skipped} skipped (not confirmed).`);

  // Also post to Telegram
  sendTelegramReminder(type);
}

function sendOneDayReminder() { sendReminders('1day'); }
function sendOneHourReminder() { sendReminders('1hour'); }

// ============================================
// TELEGRAM INTEGRATION
// ============================================

function sendTelegramMessage(text) {
  const token = CONFIG.get('TELEGRAM_BOT_TOKEN');
  const chatId = CONFIG.get('TELEGRAM_CHANNEL_ID');
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: false
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());

  if (!result.ok) {
    Logger.log(`Telegram send failed: ${result.description}`);
  }

  return result.ok;
}

function sendTelegramReminder(type) {
  const quizUrl = CONFIG.get('QUIZ_URL');
  const eventTime = CONFIG.get('EVENT_TIME');

  let message;
  if (type === '1day') {
    message = `📅 <b>SmartLink Git Quiz — Tomorrow!</b>\n\n` +
              `The quiz is tomorrow at <b>${eventTime} IST</b>.\n\n` +
              `✅ Have your join code ready\n` +
              `💻 Use a laptop with stable internet\n` +
              `🔗 ${quizUrl}\n\n` +
              `Good luck! 🚀`;
  } else if (type === '1hour') {
    message = `⏰ <b>SmartLink Git Quiz — Starts in 1 Hour!</b>\n\n` +
              `Get ready! The quiz begins at <b>${eventTime} IST</b>.\n\n` +
              `🔗 ${quizUrl}\n` +
              `📝 Have your College ID + Join Code ready\n\n` +
              `See you there! 🎯`;
  } else if (type === '10min') {
    message = `🚀 <b>Lobby is OPEN!</b>\n\n` +
              `The SmartLink Git Quiz starts in 10 minutes.\n` +
              `Log in now: ${quizUrl}\n\n` +
              `⚡ Don't forget your join code!`;
  }

  sendTelegramMessage(message);
}

// ============================================
// QUOTA MONITORING
// ============================================

function logQuotaStatus() {
  const remaining = MailApp.getRemainingDailyQuota();
  Logger.log(`Email quota remaining: ${remaining}`);

  if (remaining < 50) {
    sendTelegramMessage(`⚠️ <b>Email quota low:</b> ${remaining} remaining today`);
  }

  return remaining;
}

// ============================================
// STATS
// ============================================

function getRegistrationStats() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.get('SHEET_NAME'));
  const data = sheet.getDataRange().getValues();
  const statusColIndex = CONFIG.get('STATUS_COL').charCodeAt(0) - 64;

  let confirmed = 0, pending = 0, duplicate = 0, rejected = 0;
  for (let row = 1; row < data.length; row++) {
    const status = data[row][statusColIndex - 1].toString();
    if (status === 'CONFIRMED') confirmed++;
    else if (status.startsWith('CODE_ASSIGNED')) pending++;
    else if (status.startsWith('DUPLICATE')) duplicate++;
    else if (status.startsWith('REJECTED')) rejected++;
  }

  const stats = `📊 Registration Stats:\n✅ Confirmed: ${confirmed}\n⏳ Pending: ${pending}\n🔁 Duplicate: ${duplicate}\n❌ Rejected: ${rejected}\nTotal rows: ${data.length - 1}`;
  Logger.log(stats);
  return stats;
}
