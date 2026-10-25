// src/lib/certificates/generator.ts
// Professional PDF certificate generator with mathematically centered alignments using pdf-lib.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface CertificateData {
  student_id: string;
  name: string;
  college_id: string; // Register Number
  rank: number;
  total_score: number;
  tier: 'winner' | 'participant';
  cert_title: string;
  badge: string;
  citation: string;
  cert_id: string;
  date_str: string;
  download_url: string;
}

export function getCertificateInfo(student: {
  id?: string;
  name: string;
  college_id: string;
  rank?: number;
  total_score?: number;
}): CertificateData {
  const rank = student.rank && student.rank > 0 ? student.rank : 4;
  const isWinner = rank <= 3;
  const year = new Date().getFullYear();
  const cleanId = (student.college_id || 'PARTICIPANT').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const certId = `SLGQ-${year}-${cleanId}`;
  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  if (isWinner) {
    const winnerPlace =
      rank === 1
        ? '1st Place Winner (Champion)'
        : rank === 2
        ? '2nd Place Winner (1st Runner-Up)'
        : '3rd Place Winner (2nd Runner-Up)';

    return {
      student_id: student.id || student.college_id,
      name: student.name || 'Contestant',
      college_id: student.college_id,
      rank,
      total_score: student.total_score || 0,
      tier: 'winner',
      cert_title: 'WINNER CERTIFICATE',
      badge: winnerPlace,
      citation: 'Awarded for exceptional Git technical mastery as a Top 3 Tournament Winner.',
      cert_id: certId,
      date_str: dateStr,
      download_url: `/api/certificates/view?college_id=${encodeURIComponent(student.college_id)}`,
    };
  }

  return {
    student_id: student.id || student.college_id,
    name: student.name || 'Participant',
    college_id: student.college_id,
    rank,
    total_score: student.total_score || 0,
    tier: 'participant',
    cert_title: 'CERTIFICATE OF PARTICIPATION',
    badge: 'Certificate of Participation',
    citation: 'Awarded for active and successful participation in the SmartLink Git Tournament.',
    cert_id: certId,
    date_str: dateStr,
    download_url: `/api/certificates/view?college_id=${encodeURIComponent(student.college_id)}`,
  };
}

export async function generatePdfBuffer(cert: CertificateData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  
  // Set document metadata
  pdfDoc.setTitle(`${cert.cert_title} - ${cert.name}`);
  pdfDoc.setAuthor('SmartLink Git Tournament');
  pdfDoc.setSubject('Official Tournament Certificate');
  pdfDoc.setCreationDate(new Date());

  // Landscape US Letter: 792 pt wide by 612 pt high
  const pageWidth = 792;
  const pageHeight = 612;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const isWinner = cert.tier === 'winner';

  // Palette definition
  let primaryColor = rgb(0.15, 0.72, 0.92); // Default Cyan for participants
  let badgeBgColor = rgb(0.04, 0.18, 0.25);
  let badgeBorderColor = rgb(0.18, 0.55, 0.75);

  if (isWinner) {
    if (cert.rank === 1) {
      // 1st Place - Rich Gold
      primaryColor = rgb(0.98, 0.78, 0.15);
      badgeBgColor = rgb(0.24, 0.18, 0.03);
      badgeBorderColor = rgb(0.85, 0.65, 0.1);
    } else if (cert.rank === 2) {
      // 2nd Place - Silver / Platinum
      primaryColor = rgb(0.84, 0.88, 0.95);
      badgeBgColor = rgb(0.15, 0.17, 0.22);
      badgeBorderColor = rgb(0.7, 0.75, 0.82);
    } else {
      // 3rd Place - Warm Bronze
      primaryColor = rgb(0.92, 0.58, 0.24);
      badgeBgColor = rgb(0.22, 0.12, 0.04);
      badgeBorderColor = rgb(0.8, 0.48, 0.18);
    }
  }

  // Helper for centered text
  const drawCentered = (
    text: string,
    y: number,
    size: number,
    font: typeof fontBold,
    color: ReturnType<typeof rgb>
  ) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    const x = (pageWidth - textWidth) / 2;
    page.drawText(text, { x, y, size, font, color });
    return { x, width: textWidth };
  };

  // 1. Dark Luxury Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: rgb(0.04, 0.05, 0.07),
  });

  // 2. Outer Border (Heavy accent line)
  page.drawRectangle({
    x: 22,
    y: 22,
    width: pageWidth - 44,
    height: pageHeight - 44,
    borderColor: primaryColor,
    borderWidth: 2.5,
  });

  // 3. Inner Border (Subtle border line)
  page.drawRectangle({
    x: 30,
    y: 30,
    width: pageWidth - 60,
    height: pageHeight - 60,
    borderColor: rgb(0.2, 0.24, 0.3),
    borderWidth: 1,
  });

  // 4. Corner Ornaments (4 decorative brackets)
  const cornerLength = 22;
  const cornerOffset = 30;
  const leftX = cornerOffset;
  const rightX = pageWidth - cornerOffset;
  const bottomY = cornerOffset;
  const topY = pageHeight - cornerOffset;

  // Top-Left
  page.drawLine({ start: { x: leftX, y: topY }, end: { x: leftX + cornerLength, y: topY }, thickness: 2.5, color: primaryColor });
  page.drawLine({ start: { x: leftX, y: topY }, end: { x: leftX, y: topY - cornerLength }, thickness: 2.5, color: primaryColor });
  // Top-Right
  page.drawLine({ start: { x: rightX, y: topY }, end: { x: rightX - cornerLength, y: topY }, thickness: 2.5, color: primaryColor });
  page.drawLine({ start: { x: rightX, y: topY }, end: { x: rightX, y: topY - cornerLength }, thickness: 2.5, color: primaryColor });
  // Bottom-Left
  page.drawLine({ start: { x: leftX, y: bottomY }, end: { x: leftX + cornerLength, y: bottomY }, thickness: 2.5, color: primaryColor });
  page.drawLine({ start: { x: leftX, y: bottomY }, end: { x: leftX, y: bottomY + cornerLength }, thickness: 2.5, color: primaryColor });
  // Bottom-Right
  page.drawLine({ start: { x: rightX, y: bottomY }, end: { x: rightX - cornerLength, y: bottomY }, thickness: 2.5, color: primaryColor });
  page.drawLine({ start: { x: rightX, y: bottomY }, end: { x: rightX, y: bottomY + cornerLength }, thickness: 2.5, color: primaryColor });

  // 5. Tournament Brand Header
  drawCentered('SMARTLINK GIT CHAMPIONSHIP 2026', 530, 11, fontBold, primaryColor);

  // 6. Main Certificate Title
  const titleSize = isWinner ? 30 : 26;
  drawCentered(cert.cert_title, 484, titleSize, fontBold, isWinner ? primaryColor : rgb(1, 1, 1));

  // 7. Badge Pill Container
  const badgeSize = 11;
  const badgeTextWidth = fontBold.widthOfTextAtSize(cert.badge, badgeSize);
  const pillPaddingX = 24;
  const pillWidth = badgeTextWidth + pillPaddingX * 2;
  const pillHeight = 24;
  const pillY = 442;
  page.drawRectangle({
    x: (pageWidth - pillWidth) / 2,
    y: pillY,
    width: pillWidth,
    height: pillHeight,
    color: badgeBgColor,
    borderColor: badgeBorderColor,
    borderWidth: 1,
  });
  drawCentered(cert.badge, pillY + 7, badgeSize, fontBold, primaryColor);

  // 8. Presentation Lead-in
  drawCentered('This certificate is proudly awarded to', 404, 11.5, fontOblique, rgb(0.65, 0.7, 0.76));

  // 9. Recipient Name (Auto-scale font size if name is long)
  let nameSize = 28;
  const maxAllowedNameWidth = 580;
  let testWidth = fontBold.widthOfTextAtSize(cert.name, nameSize);
  while (testWidth > maxAllowedNameWidth && nameSize > 18) {
    nameSize -= 2;
    testWidth = fontBold.widthOfTextAtSize(cert.name, nameSize);
  }
  drawCentered(cert.name, 356, nameSize, fontBold, rgb(1, 1, 1));

  // Decorative Underline under recipient name
  const underlineHalfWidth = Math.min(220, Math.max(120, (testWidth + 50) / 2));
  page.drawLine({
    start: { x: pageWidth / 2 - underlineHalfWidth, y: 346 },
    end: { x: pageWidth / 2 + underlineHalfWidth, y: 346 },
    thickness: 1.5,
    color: primaryColor,
  });

  // 10. Register Number (College ID)
  const regNoText = `Register No: ${cert.college_id}`;
  drawCentered(regNoText, 320, 12, fontBold, primaryColor);

  // 11. Citation Statement
  drawCentered(cert.citation, 282, 11, fontRegular, rgb(0.8, 0.84, 0.9));

  // 12. Rank and Score Stats Line
  const rankLabel = isWinner ? `Official Winner Rank: #${cert.rank}` : `Participant Rank: #${cert.rank}`;
  const statsText = `${rankLabel}    |    Total Score: ${cert.total_score} pts`;
  drawCentered(statsText, 248, 12, fontBold, rgb(0.95, 0.96, 0.98));

  // 13. Bottom Signature and Verification Rows
  const footerLineY = 130;
  const colWidth = 200;
  const leftColX = 64;
  const rightColX = pageWidth - 64 - colWidth;

  // Left Column: System Verification
  page.drawLine({
    start: { x: leftColX, y: footerLineY },
    end: { x: leftColX + colWidth, y: footerLineY },
    thickness: 1,
    color: rgb(0.28, 0.32, 0.38),
  });
  page.drawText('SmartLink Real-Time Engine', {
    x: leftColX,
    y: footerLineY - 16,
    size: 10,
    font: fontBold,
    color: rgb(0.85, 0.88, 0.92),
  });
  page.drawText(`ID: ${cert.cert_id}`, {
    x: leftColX,
    y: footerLineY - 30,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.5, 0.55, 0.62),
  });

  // Center: Official Digital Seal
  const sealRadius = 24;
  const sealCenterX = pageWidth / 2;
  const sealCenterY = 114;
  page.drawCircle({
    x: sealCenterX,
    y: sealCenterY,
    size: sealRadius,
    borderColor: primaryColor,
    borderWidth: 1.5,
    color: badgeBgColor,
  });
  page.drawCircle({
    x: sealCenterX,
    y: sealCenterY,
    size: sealRadius - 4,
    borderColor: rgb(0.3, 0.35, 0.42),
    borderWidth: 0.75,
  });
  drawCentered('* OFFICIAL *', sealCenterY + 4, 6.5, fontBold, primaryColor);
  drawCentered('GIT 2026', sealCenterY - 6, 6.5, fontBold, primaryColor);

  // Right Column: Tournament Authority & Date
  page.drawLine({
    start: { x: rightColX, y: footerLineY },
    end: { x: rightColX + colWidth, y: footerLineY },
    thickness: 1,
    color: rgb(0.28, 0.32, 0.38),
  });
  const rightTitle = 'SmartLink Tournament Board';
  const rightTitleWidth = fontBold.widthOfTextAtSize(rightTitle, 10);
  page.drawText(rightTitle, {
    x: rightColX + colWidth - rightTitleWidth,
    y: footerLineY - 16,
    size: 10,
    font: fontBold,
    color: rgb(0.85, 0.88, 0.92),
  });
  const dateText = `Date: ${cert.date_str}`;
  const dateWidth = fontRegular.widthOfTextAtSize(dateText, 8.5);
  page.drawText(dateText, {
    x: rightColX + colWidth - dateWidth,
    y: footerLineY - 30,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.5, 0.55, 0.62),
  });

  // Final Output Buffer
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
