// EmailSender.gs

function sendConfirmationEmail(recipientEmail, studentName, joinCode) {
  const quizUrl = CONFIG.get('QUIZ_URL');
  const eventDate = CONFIG.get('EVENT_DATE');
  const eventTime = CONFIG.get('EVENT_TIME');
  const senderName = CONFIG.get('SENDER_NAME');
  const rulesUrl = CONFIG.getOptional('RULES_DOC_URL', '');

  // Check quota first
  const remaining = MailApp.getRemainingDailyQuota();
  if (remaining < 1) {
    Logger.log(`EMAIL QUOTA EXHAUSTED. Cannot send to ${recipientEmail}. Remaining: ${remaining}`);
    return { sent: false, reason: 'quota_exhausted', remaining: remaining };
  }

  const calendarBlob = createCalendarInvite();

  const subject = `Your SmartLink Git Quiz Join Code`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Welcome to SmartLink Git Quiz! 🎯</h2>

      <p>Hi <strong>${escapeHtml(studentName)}</strong>,</p>

      <p>You're registered! Here's everything you need:</p>

      <div style="background: #f0f4ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">Your Join Code</p>
        <p style="margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #1a1a2e; font-family: monospace;">${joinCode}</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>📅 Date</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${eventDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>⏰ Time</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${eventTime} IST</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>🔗 Quiz Link</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="${quizUrl}">${quizUrl}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px;"><strong>📋 Rules</strong></td>
          <td style="padding: 8px;">${rulesUrl ? '<a href="' + rulesUrl + '">Read the rules</a>' : 'Will be shared before the event'}</td>
        </tr>
      </table>

      <div style="background: #fff3cd; padding: 12px; border-radius: 4px; margin: 16px 0;">
        <strong>⚠️ Important:</strong>
        <ul style="margin: 8px 0 0 0; padding-left: 20px;">
          <li>Keep your join code safe — you'll need it to log in</li>
          <li>Use a laptop or desktop with a modern browser</li>
          <li>Stable internet is required for the full duration</li>
          <li>We will <strong>never</strong> ask for your password via email</li>
        </ul>
      </div>

      <p style="color: #666; font-size: 12px; margin-top: 24px;">
        A calendar invite is attached. Add it so you don't miss the event!
      </p>

      <p>Good luck! 🚀<br><strong>${senderName}</strong></p>
    </div>
  `;

  const plainBody = `SmartLink Git Quiz — Your Join Code

Hi ${studentName},

Your Join Code: ${joinCode}

Date: ${eventDate}
Time: ${eventTime} IST
Quiz Link: ${quizUrl}
${rulesUrl ? 'Rules: ' + rulesUrl : ''}

Keep your join code safe. Use a laptop with a modern browser and stable internet.
We will never ask for your password via email.

Good luck!
${senderName}`;

  try {
    MailApp.sendEmail({
      to: recipientEmail,
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody,
      name: senderName,
      attachments: [calendarBlob],
      noReply: true
    });

    Logger.log(`Confirmation sent to ${recipientEmail}. Quota remaining: ${remaining - 1}`);
    return { sent: true, remaining: remaining - 1 };
  } catch (e) {
    Logger.log(`SEND FAILED for ${recipientEmail}: ${e.message}`);
    return { sent: false, reason: e.message, remaining: remaining };
  }
}

function sendReminderEmail(recipientEmail, studentName, joinCode, reminderType) {
  // reminderType: "1day" | "1hour"
  const quizUrl = CONFIG.get('QUIZ_URL');
  const eventTime = CONFIG.get('EVENT_TIME');
  const senderName = CONFIG.get('SENDER_NAME');

  const remaining = MailApp.getRemainingDailyQuota();
  if (remaining < 1) {
    Logger.log(`REMINDER QUOTA EXHAUSTED. Type: ${reminderType}. Remaining: 0`);
    return { sent: false, reason: 'quota_exhausted' };
  }

  const isOneDay = reminderType === '1day';
  const subject = isOneDay
    ? 'SmartLink Git Quiz — Tomorrow!'
    : 'SmartLink Git Quiz — Starts in 1 Hour!';

  const urgency = isOneDay ? 'is tomorrow' : 'starts in 1 hour';

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${isOneDay ? '📅' : '⏰'} The quiz ${urgency}!</h2>
      <p>Hi <strong>${escapeHtml(studentName)}</strong>,</p>
      <p>Quick reminder — the SmartLink Git Quiz ${urgency} at <strong>${eventTime} IST</strong>.</p>
      <div style="background: #f0f4ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #666;">Your Join Code</p>
        <p style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 4px; font-family: monospace;">${joinCode}</p>
      </div>
      <p><a href="${quizUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Open Quiz →</a></p>
      <p style="color: #666; font-size: 13px;">Have your join code ready. Use a laptop with a stable connection.</p>
      <p>${senderName}</p>
    </div>
  `;

  try {
    MailApp.sendEmail({
      to: recipientEmail,
      subject: subject,
      body: `The quiz ${urgency} at ${eventTime} IST.\nYour code: ${joinCode}\nLink: ${quizUrl}`,
      htmlBody: htmlBody,
      name: senderName,
      noReply: true
    });
    return { sent: true, remaining: remaining - 1 };
  } catch (e) {
    Logger.log(`REMINDER FAILED for ${recipientEmail}: ${e.message}`);
    return { sent: false, reason: e.message };
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
