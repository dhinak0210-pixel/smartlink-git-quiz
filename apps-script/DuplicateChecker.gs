// DuplicateChecker.gs

function checkDuplicate(collegeId, sheet) {
  // Returns { isDuplicate: boolean, existingRow: number | null }
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { isDuplicate: false, existingRow: null };
  }
  const headers = data[0];

  // Find college ID column (look for header containing "college" and "id")
  let collegeIdColIndex = -1;
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toString().toLowerCase();
    if (h.includes('college') && h.includes('id')) {
      collegeIdColIndex = i;
      break;
    }
  }
  if (collegeIdColIndex === -1) throw new Error('College ID column not found');

  const normalizedInput = collegeId.toString().trim().toUpperCase();

  for (let row = 1; row < data.length; row++) {
    const existing = data[row][collegeIdColIndex].toString().trim().toUpperCase();
    if (existing === normalizedInput) {
      return { isDuplicate: true, existingRow: row + 1 }; // +1 for 1-based row
    }
  }
  return { isDuplicate: false, existingRow: null };
}
