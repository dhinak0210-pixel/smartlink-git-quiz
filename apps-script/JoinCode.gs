// JoinCode.gs
// Generates 6-character codes from a safe alphabet (no look-alikes: 0/O, 1/I/l, 5/S, 8/B)

const SAFE_CHARS = 'ACDEFGHJKMNPQRTUVWXYZ234679';  // 27 characters

function generateJoinCode() {
  // 27^6 ≈ 387 million possible codes — collision negligible for 200 students
  let code = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * SAFE_CHARS.length);
    code += SAFE_CHARS[randomIndex];
  }
  return code;
}

function isCodeUnique(code, sheet) {
  const codeCol = CONFIG.get('JOIN_CODE_COL');
  const colIndex = codeCol.charCodeAt(0) - 64; // A=1, B=2, etc.
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return true;
  const existingCodes = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues().flat();
  return !existingCodes.includes(code);
}

function generateUniqueJoinCode(sheet) {
  let attempts = 0;
  let code;
  do {
    code = generateJoinCode();
    attempts++;
    if (attempts > 100) throw new Error('Failed to generate unique code after 100 attempts');
  } while (!isCodeUnique(code, sheet));
  return code;
}
