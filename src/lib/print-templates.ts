/**
 * Professional A4 Print Templates for Shulea Reports
 * 
 * Key design decisions:
 * - DARK/BLACK text for photocopy machine compatibility
 * - Larger fonts for readability
 * - A4 page fills completely (no big empty space at bottom)
 * - Dual logos (uploaded logos, NOT placeholder letters)
 * - Kiswahili/English language support for ALL text including grading scale
 * - Report Card section order: Comments → Signatures → Dates → Parent/Guardian (bottom)
 * - Professional layout with clear borders and formatting
 */

// A4 dimensions: 210mm x 297mm

const A4_BASE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { 
    width: 100%;
    max-width: 100%;
    min-height: auto;
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif; 
    font-size: 10pt; 
    line-height: 1.5; 
    color: #000000; 
    background: white;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  
  /* Container for A4 content */
  .a4-content {
    width: 100%;
    max-width: 198mm;
    min-height: auto;
    margin: 0 auto;
  }
  
  /* Mobile responsive adjustments */
  @media screen and (max-width: 768px) {
    html, body {
      width: 100% !important;
      max-width: 100% !important;
      min-height: auto !important;
      font-size: 9pt;
    }
    .a4-content {
      width: 100% !important;
      max-width: 100% !important;
      min-height: auto !important;
    }
    .a4-fill {
      min-height: auto !important;
    }
    table {
      font-size: 8pt;
      width: 100% !important;
      table-layout: auto !important;
    }
    th, td {
      padding: 3px 4px;
      font-size: 8pt;
      white-space: normal !important;
    }
    .header-logo {
      width: 45px;
      height: 45px;
    }
    .school-name {
      font-size: 12pt;
    }
    .marks-table {
      width: 100% !important;
      table-layout: auto !important;
    }
    .marks-table th,
    .marks-table td {
      padding: 2px 3px !important;
      font-size: 7pt !important;
    }
    .results-summary {
      grid-template-columns: repeat(2, 1fr) !important;
    }
    .student-info-bar {
      grid-template-columns: 1fr 1fr !important;
    }
  }
  
  /* Print-specific styles - override screen styles */
  @media print {
    html, body {
      width: 210mm !important;
      max-width: 210mm !important;
      min-height: auto !important;
    }
    .a4-content {
      width: 100% !important;
      max-width: 198mm !important;
      min-height: auto !important;
      margin: 0 !important;
    }
    .a4-fill {
      min-height: auto !important;
    }
  }
  
  /* Report card page container - natural flow, no forced A4 stretch */
  .a4-fill {
    min-height: auto;
    display: flex;
    flex-direction: column;
  }
  .report-card {
    font-size: var(--report-font-size, 10pt);
    line-height: var(--report-line-height, 1.5);
    page-break-inside: avoid;
    break-inside: avoid;
    overflow: hidden;
  }
  .report-card * {
    overflow-wrap: anywhere;
  }
  
  /* Page setup - tight margins to maximize space */
  @page { 
    margin: 6mm; 
    size: A4 portrait; 
  }
  @page :first { margin-top: 5mm; }
  
  .page-break { page-break-before: always; }
  .page-break-after { page-break-after: always; break-after: page; }
  .no-break { page-break-inside: avoid; }
  
  /* Tables - DARK borders for photocopy */
  table { width: 100%; border-collapse: collapse; }
  .marks-table { margin: 0 auto; }
  th, td { border: 1.5px solid #333; padding: 4px 6px; text-align: left; font-size: 9.5pt; color: #000; }
  th { background: #e8e8e8; font-weight: 700; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.3px; color: #000; border-color: #333; }
  
  /* Header - DUAL LOGOS */
  .report-header { 
    display: flex; 
    align-items: center; 
    justify-content: space-between; 
    border-bottom: 3px solid #000; 
    padding-bottom: 8px; 
    margin-bottom: 10px; 
  }
  .header-logo { 
    width: 65px; 
    height: 65px; 
    object-fit: contain; 
    flex-shrink: 0; 
    border-radius: 4px;
  }
  .report-header-no-logos {
    justify-content: center;
  }
  .report-header-no-logos .header-center {
    padding: 0;
  }
  .header-center { 
    text-align: center; 
    flex: 1; 
    padding: 0 12px; 
  }
  .school-name { 
    font-size: 15pt; 
    font-weight: 900; 
    text-transform: uppercase; 
    letter-spacing: 0.5px; 
    color: #000; 
  }
  .school-info { 
    font-size: 8.5pt; 
    color: #333; 
    margin-top: 3px; 
    font-weight: 500;
  }
  
  /* Report Title - DARK */
  .report-title {
    text-align: center;
    margin: 8px 0;
    padding: 5px 0;
  }
  .report-title h2 {
    font-size: 13pt;
    font-weight: 900;
    text-transform: uppercase;
    color: #000;
    letter-spacing: 1.5px;
    text-decoration: underline;
  }
  .report-title .subtitle {
    font-size: 9pt;
    color: #333;
    margin-top: 3px;
    font-weight: 500;
  }
  
  /* Student Info Bar - DARK borders, no colors */
  .student-info-bar {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    border: 2px solid #333;
    overflow: hidden;
    margin-bottom: 10px;
    background: #f5f5f5;
  }
  .student-info-item {
    padding: 4px 8px;
  }
  .student-info-item:not(:last-child) {
    border-right: 1.5px solid #555;
  }
  .student-info-label {
    font-size: 7pt;
    color: #333;
    font-weight: 700;
    text-transform: uppercase;
  }
  .student-info-value {
    font-size: 10pt;
    font-weight: 700;
    color: #000;
  }
  
  /* Results Summary - DARK */
  .results-summary {
    display: grid;
    gap: 5px;
    margin-bottom: 10px;
  }
  .results-summary.cols-4 { grid-template-columns: repeat(4, 1fr); }
  .results-summary.cols-5 { grid-template-columns: repeat(5, 1fr); }
  .results-summary.cols-6 { grid-template-columns: repeat(6, 1fr); }
  .summary-item {
    border: 2px solid #333;
    padding: 6px;
    text-align: center;
    background: #f5f5f5;
  }
  .summary-label {
    font-size: 7pt;
    color: #333;
    font-weight: 700;
    text-transform: uppercase;
  }
  .summary-value {
    font-size: 14pt;
    font-weight: 900;
    color: #000;
  }
  
  /* Grade badges - BOLD dark text with light background */
  .grade-badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-weight: 800;
    font-size: 9pt;
    line-height: 1.6;
    border: 1px solid;
  }
  .grade-A { color: #000; background: #d4edda; border-color: #555; }
  .grade-B { color: #000; background: #cce5ff; border-color: #555; }
  .grade-C { color: #000; background: #fff3cd; border-color: #555; }
  .grade-D { color: #000; background: #ffe0b2; border-color: #555; }
  .grade-E, .grade-F { color: #000; background: #f8d7da; border-color: #555; }
  .grade-I { color: #000; background: #d4edda; border-color: #555; }
  .grade-II { color: #000; background: #cce5ff; border-color: #555; }
  .grade-III { color: #000; background: #fff3cd; border-color: #555; }
  .grade-IV { color: #000; background: #ffe0b2; border-color: #555; }
  .grade-0 { color: #000; background: #f8d7da; border-color: #555; }
  
  /* Character section - DARK */
  .character-section {
    border: 2px solid #333;
    overflow: hidden;
    margin-bottom: 10px;
  }
  .section-header {
    background: #444;
    color: #fff;
    font-size: 9pt;
    font-weight: 700;
    padding: 4px 10px;
    text-transform: uppercase;
  }
  .traits-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 6px;
    padding: 8px;
  }
  .trait-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px solid #555;
    border-radius: 3px;
    padding: 3px 8px;
  }
  .trait-label { font-size: 8.5pt; color: #000; font-weight: 600; }
  .trait-value { font-size: 9.5pt; font-weight: 800; color: #000; }
  
  /* Comments section - DARK */
  .comments-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 10px;
  }
  .comment-box {
    border: 2px solid #333;
    padding: 8px 10px;
  }
  .comment-label {
    font-size: 8pt;
    color: #000;
    font-weight: 700;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .comment-text {
    font-size: 9.5pt;
    color: #000;
    min-height: 24px;
    font-weight: 600;
  }
  
  /* Grading Scale section - DARK */
  .grading-scale-section {
    border: 2px solid #333;
    margin-bottom: 8px;
    overflow: hidden;
  }
  .grading-scale-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 2px;
    padding: 5px;
  }
  .grading-item {
    text-align: center;
    border: 1px solid #555;
    border-radius: 2px;
    padding: 2px 4px;
    font-size: 8pt;
  }
  .grading-letter { font-weight: 800; color: #000; font-size: 10pt; }
  .grading-desc { font-weight: 600; color: #333; font-size: 7pt; }
  
  /* Parent/Guardian section - AT THE VERY BOTTOM */
  .parent-section {
    border: 2px solid #333;
    padding: 10px;
    margin-top: 10px;
    background: #f5f5f5;
  }
  .parent-title {
    font-size: 9pt;
    color: #000;
    font-weight: 800;
    text-transform: uppercase;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 2px solid #333;
  }
  .parent-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .parent-field {
    font-size: 9pt;
  }
  .parent-field-label {
    color: #333;
    font-size: 8pt;
    font-weight: 700;
  }
  .parent-field-line {
    border-bottom: 1.5px solid #333;
    min-height: 30px;
    margin-top: 3px;
  }
  
  /* Signatures - DARK */
  .signatures-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-top: 12px;
    font-size: 9pt;
  }
  .signature-box { text-align: center; }
  .signature-line { 
    border-top: 2px solid #000; 
    padding-top: 4px; 
    font-weight: 700; 
    color: #000; 
  }
  .signature-label { 
    font-size: 8pt; 
    color: #333; 
    margin-top: 2px; 
    font-weight: 600;
  }
  
  /* Dates - DARK */
  .dates-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-top: 10px;
    font-size: 9.5pt;
    color: #000;
    text-align: center;
    font-weight: 700;
  }
  
  /* INCOMPLETE badge - DARK */
  .incomplete-badge {
    display: inline-block;
    margin-left: 4px;
    font-size: 8pt;
    padding: 1px 6px;
    border-radius: 3px;
    background: #f8d7da;
    color: #000;
    border: 1.5px solid #333;
    font-weight: 800;
  }
  .complete-badge {
    display: inline-block;
    font-size: 8pt;
    padding: 1px 6px;
    border-radius: 3px;
    background: #d4edda;
    color: #000;
    border: 1.5px solid #555;
    font-weight: 800;
  }
  
  /* Subject marks table - DARK */
  .marks-table th {
    background: #444;
    color: #fff;
    border-color: #333;
    font-weight: 700;
  }
  .marks-table .total-row {
    background: #e0e0e0;
    font-weight: 700;
    color: #000;
  }
  .marks-table .even-row { background: #f9f9f9; }
  .marks-table .odd-row { background: #ffffff; }
  .marks-table .incomplete-row { background: #f8d7da; }
  
  /* Overall table for landscape */
  @page landscape { size: A4 landscape; margin: 5mm; }
  .landscape-page { page: landscape; }
  
  /* Footer */
  .report-footer {
    text-align: center;
    font-size: 7pt;
    color: #555;
    margin-top: 10px;
    padding-top: 4px;
    border-top: 1px solid #999;
    font-weight: 500;
  }

  .report-card.report-density-compact .report-header {
    padding-bottom: var(--report-header-padding-bottom, 8px) !important;
    margin-bottom: var(--report-header-margin-bottom, 10px) !important;
  }
  .report-card.report-density-compact .header-logo,
  .report-card.report-density-compact .report-header > div > div[style*="width:65px"] {
    width: var(--report-logo-size, 65px) !important;
    height: var(--report-logo-size, 65px) !important;
    font-size: var(--report-placeholder-font-size, 9pt) !important;
  }
  .report-card.report-density-compact .school-name {
    font-size: var(--report-school-name-font-size, 15pt) !important;
    line-height: 1.12 !important;
  }
  .report-card.report-density-compact .school-info,
  .report-card.report-density-compact .report-title .subtitle {
    font-size: var(--report-small-font-size, 8.5pt) !important;
    line-height: 1.25 !important;
  }
  .report-card.report-density-compact .report-title {
    margin: var(--report-title-margin, 8px 0) !important;
    padding: var(--report-title-padding, 5px 0) !important;
  }
  .report-card.report-density-compact .report-title h2 {
    font-size: var(--report-title-font-size, 13pt) !important;
    line-height: 1.15 !important;
  }
  .report-card.report-density-compact .student-info-bar {
    margin-bottom: var(--report-section-gap, 10px) !important;
  }
  .report-card.report-density-compact .student-info-item {
    padding: var(--report-info-padding-y, 4px) var(--report-info-padding-x, 8px) !important;
  }
  .report-card.report-density-compact .student-info-label,
  .report-card.report-density-compact .summary-label,
  .report-card.report-density-compact .comment-label,
  .report-card.report-density-compact .signature-label,
  .report-card.report-density-compact .parent-field-label {
    font-size: var(--report-label-font-size, 7pt) !important;
  }
  .report-card.report-density-compact .student-info-value {
    font-size: var(--report-info-font-size, 10pt) !important;
    line-height: 1.18 !important;
  }
  .report-card.report-density-compact .marks-table {
    margin-bottom: var(--report-section-gap, 10px) !important;
    table-layout: fixed !important;
  }
  .report-card.report-density-compact .marks-table th,
  .report-card.report-density-compact .marks-table td {
    padding: var(--report-table-cell-y, 4px) var(--report-table-cell-x, 6px) !important;
    font-size: var(--report-table-font-size, 9.5pt) !important;
    line-height: var(--report-table-line-height, 1.35) !important;
  }
  .report-card.report-density-compact .marks-table th {
    font-size: var(--report-table-head-font-size, 8.5pt) !important;
    letter-spacing: 0 !important;
  }
  .report-card.report-density-compact .marks-table .subject-cell {
    font-size: var(--report-subject-font-size, 9.2pt) !important;
    line-height: var(--report-table-line-height, 1.35) !important;
  }
  .report-card.report-density-compact .marks-table .remarks-cell {
    font-size: var(--report-remarks-font-size, 8.5pt) !important;
    line-height: var(--report-table-line-height, 1.35) !important;
  }
  .report-card.report-density-compact .grade-badge {
    padding: 0 var(--report-grade-badge-x, 6px) !important;
    font-size: var(--report-grade-font-size, 9pt) !important;
    line-height: 1.35 !important;
  }
  .report-card.report-density-compact .results-summary {
    gap: var(--report-summary-gap, 5px) !important;
    margin-bottom: var(--report-section-gap, 10px) !important;
  }
  .report-card.report-density-compact .summary-item {
    padding: var(--report-summary-padding, 6px) !important;
  }
  .report-card.report-density-compact .summary-value {
    font-size: var(--report-summary-value-font-size, 14pt) !important;
    line-height: 1.1 !important;
  }
  .report-card.report-density-compact .character-section,
  .report-card.report-density-compact .comments-grid {
    margin-bottom: var(--report-section-gap, 10px) !important;
  }
  .report-card.report-density-compact .section-header {
    padding: var(--report-section-header-y, 4px) 8px !important;
    font-size: var(--report-section-header-font-size, 9pt) !important;
  }
  .report-card.report-density-compact .traits-grid {
    gap: var(--report-trait-gap, 6px) !important;
    padding: var(--report-trait-padding, 8px) !important;
  }
  .report-card.report-density-compact .trait-item {
    padding: var(--report-trait-item-y, 3px) 6px !important;
  }
  .report-card.report-density-compact .trait-label,
  .report-card.report-density-compact .trait-value {
    font-size: var(--report-trait-font-size, 8.5pt) !important;
  }
  .report-card.report-density-compact .comments-grid {
    gap: var(--report-comment-gap, 10px) !important;
  }
  .report-card.report-density-compact .comment-box {
    padding: var(--report-comment-padding-y, 8px) var(--report-comment-padding-x, 10px) !important;
  }
  .report-card.report-density-compact .comment-label {
    margin-bottom: var(--report-comment-label-gap, 4px) !important;
  }
  .report-card.report-density-compact .comment-text {
    min-height: var(--report-comment-min-height, 24px) !important;
    font-size: var(--report-comment-font-size, 9.5pt) !important;
    line-height: 1.25 !important;
  }
  .report-card.report-density-compact .signatures-grid {
    gap: var(--report-signature-gap, 40px) !important;
    margin-top: var(--report-signature-margin-top, 12px) !important;
    font-size: var(--report-signature-font-size, 9pt) !important;
  }
  .report-card.report-density-compact .dates-grid {
    gap: var(--report-signature-gap, 40px) !important;
    margin-top: var(--report-dates-margin-top, 10px) !important;
    font-size: var(--report-dates-font-size, 9.5pt) !important;
  }
  .report-card.report-density-compact .parent-section {
    padding: var(--report-parent-padding, 10px) !important;
    margin-top: var(--report-parent-margin-top, 10px) !important;
  }
  .report-card.report-density-compact .parent-title {
    font-size: var(--report-parent-title-font-size, 9pt) !important;
    margin-bottom: var(--report-parent-title-gap, 8px) !important;
    padding-bottom: var(--report-parent-title-padding, 4px) !important;
  }
  .report-card.report-density-compact .parent-fields {
    gap: var(--report-parent-gap, 8px) !important;
  }
  .report-card.report-density-compact .parent-field {
    font-size: var(--report-parent-field-font-size, 9pt) !important;
  }
  .report-card.report-density-compact .parent-field-line {
    min-height: var(--report-parent-line-height, 30px) !important;
  }
  .report-card.report-density-compact .report-footer {
    margin-top: var(--report-footer-margin-top, 10px) !important;
    padding-top: var(--report-footer-padding-top, 4px) !important;
    font-size: var(--report-footer-font-size, 7pt) !important;
  }
`

const REPORT_CARD_FIT_SCRIPT = `
<script>
(function () {
  var PRINTABLE_HEIGHT_PX = Math.round(((297 - 12) / 25.4) * 96);

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function cssNum(value, unit) {
    return Number(value.toFixed(2)) + unit;
  }

  function varsForPressure(pressure) {
    return {
      '--report-font-size': cssNum(lerp(10, 8.6, pressure), 'pt'),
      '--report-line-height': String(Number(lerp(1.5, 1.28, pressure).toFixed(2))),
      '--report-logo-size': cssNum(lerp(65, 50, pressure), 'px'),
      '--report-placeholder-font-size': cssNum(lerp(9, 7, pressure), 'pt'),
      '--report-header-padding-bottom': cssNum(lerp(8, 4, pressure), 'px'),
      '--report-header-margin-bottom': cssNum(lerp(10, 5, pressure), 'px'),
      '--report-school-name-font-size': cssNum(lerp(15, 12.4, pressure), 'pt'),
      '--report-small-font-size': cssNum(lerp(8.5, 7.2, pressure), 'pt'),
      '--report-title-margin': cssNum(lerp(8, 4, pressure), 'px') + ' 0',
      '--report-title-padding': cssNum(lerp(5, 2, pressure), 'px') + ' 0',
      '--report-title-font-size': cssNum(lerp(13, 10.8, pressure), 'pt'),
      '--report-section-gap': cssNum(lerp(10, 4, pressure), 'px'),
      '--report-info-padding-y': cssNum(lerp(4, 2, pressure), 'px'),
      '--report-info-padding-x': cssNum(lerp(8, 5, pressure), 'px'),
      '--report-label-font-size': cssNum(lerp(7, 6.2, pressure), 'pt'),
      '--report-info-font-size': cssNum(lerp(10, 8.3, pressure), 'pt'),
      '--report-table-cell-y': cssNum(lerp(4, 1.6, pressure), 'px'),
      '--report-table-cell-x': cssNum(lerp(6, 3, pressure), 'px'),
      '--report-table-font-size': cssNum(lerp(9.5, 7.8, pressure), 'pt'),
      '--report-table-head-font-size': cssNum(lerp(8.5, 7.1, pressure), 'pt'),
      '--report-subject-font-size': cssNum(lerp(9.2, 7.6, pressure), 'pt'),
      '--report-remarks-font-size': cssNum(lerp(8.5, 7.2, pressure), 'pt'),
      '--report-table-line-height': String(Number(lerp(1.35, 1.16, pressure).toFixed(2))),
      '--report-grade-badge-x': cssNum(lerp(6, 3, pressure), 'px'),
      '--report-grade-font-size': cssNum(lerp(9, 7.3, pressure), 'pt'),
      '--report-summary-gap': cssNum(lerp(5, 3, pressure), 'px'),
      '--report-summary-padding': cssNum(lerp(6, 3, pressure), 'px'),
      '--report-summary-value-font-size': cssNum(lerp(14, 10.8, pressure), 'pt'),
      '--report-section-header-y': cssNum(lerp(4, 2, pressure), 'px'),
      '--report-section-header-font-size': cssNum(lerp(9, 7.4, pressure), 'pt'),
      '--report-trait-gap': cssNum(lerp(6, 3, pressure), 'px'),
      '--report-trait-padding': cssNum(lerp(8, 4, pressure), 'px'),
      '--report-trait-item-y': cssNum(lerp(3, 1.4, pressure), 'px'),
      '--report-trait-font-size': cssNum(lerp(8.5, 7.2, pressure), 'pt'),
      '--report-comment-gap': cssNum(lerp(10, 5, pressure), 'px'),
      '--report-comment-padding-y': cssNum(lerp(8, 4, pressure), 'px'),
      '--report-comment-padding-x': cssNum(lerp(10, 6, pressure), 'px'),
      '--report-comment-label-gap': cssNum(lerp(4, 2, pressure), 'px'),
      '--report-comment-min-height': cssNum(lerp(24, 16, pressure), 'px'),
      '--report-comment-font-size': cssNum(lerp(9.5, 7.8, pressure), 'pt'),
      '--report-signature-gap': cssNum(lerp(40, 20, pressure), 'px'),
      '--report-signature-margin-top': cssNum(lerp(12, 5, pressure), 'px'),
      '--report-signature-font-size': cssNum(lerp(9, 7.5, pressure), 'pt'),
      '--report-dates-margin-top': cssNum(lerp(10, 4, pressure), 'px'),
      '--report-dates-font-size': cssNum(lerp(9.5, 7.8, pressure), 'pt'),
      '--report-parent-padding': cssNum(lerp(10, 5, pressure), 'px'),
      '--report-parent-margin-top': cssNum(lerp(10, 4, pressure), 'px'),
      '--report-parent-title-font-size': cssNum(lerp(9, 7.4, pressure), 'pt'),
      '--report-parent-title-gap': cssNum(lerp(8, 3, pressure), 'px'),
      '--report-parent-title-padding': cssNum(lerp(4, 2, pressure), 'px'),
      '--report-parent-gap': cssNum(lerp(8, 4, pressure), 'px'),
      '--report-parent-field-font-size': cssNum(lerp(9, 7.4, pressure), 'pt'),
      '--report-parent-line-height': cssNum(lerp(30, 18, pressure), 'px'),
      '--report-footer-margin-top': cssNum(lerp(10, 4, pressure), 'px'),
      '--report-footer-padding-top': cssNum(lerp(4, 2, pressure), 'px'),
      '--report-footer-font-size': cssNum(lerp(7, 6.2, pressure), 'pt')
    };
  }

  function applyPressure(card, pressure) {
    if (pressure <= 0.001) {
      card.classList.remove('report-density-compact');
      card.classList.add('report-density-normal');
      return;
    }
    var vars = varsForPressure(pressure);
    Object.keys(vars).forEach(function (key) {
      card.style.setProperty(key, vars[key]);
    });
    card.classList.remove('report-density-normal');
    card.classList.add('report-density-compact');
  }

  function fits(card) {
    return card.scrollHeight <= PRINTABLE_HEIGHT_PX;
  }

  function fitCard(card) {
    if (card.dataset.schoolType !== 'SECONDARY') return;
    applyPressure(card, 0);
    if (fits(card)) return;

    var lo = 0;
    var hi = 1;
    for (var i = 0; i < 12; i++) {
      var mid = (lo + hi) / 2;
      applyPressure(card, mid);
      if (fits(card)) hi = mid;
      else lo = mid;
    }
    applyPressure(card, hi);
  }

  function fitReports() {
    document.querySelectorAll('.report-card[data-auto-fit="true"]').forEach(fitCard);
  }

  window.__shuleaFitReports = fitReports;
  window.addEventListener('beforeprint', fitReports);
  window.addEventListener('load', function () {
    var images = Array.prototype.slice.call(document.images || []);
    Promise.all(images.map(function (img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function (resolve) {
        img.onload = resolve;
        img.onerror = resolve;
      });
    })).then(function () {
      requestAnimationFrame(fitReports);
    });
  });

  if (document.readyState !== 'loading') {
    requestAnimationFrame(fitReports);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      requestAnimationFrame(fitReports);
    });
  }
})();
</script>
`

// A4 printable height after @page margins (297mm - 12mm) at 96 DPI
const A4_PRINTABLE_HEIGHT_PX = Math.round(((297 - 12) / 25.4) * 96)

export interface ReportCardCompression {
  className: string
  styleText: string
  styleVars: Record<string, string>
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}

function cssNum(value: number, unit: 'px' | 'pt', decimals = 2): string {
  return `${Number(value.toFixed(decimals))}${unit}`
}

function buildCompressionVars(pressure: number): Record<string, string> {
  return {
    '--report-font-size': cssNum(lerp(10, 8.6, pressure), 'pt'),
    '--report-line-height': String(Number(lerp(1.5, 1.28, pressure).toFixed(2))),
    '--report-logo-size': cssNum(lerp(65, 50, pressure), 'px'),
    '--report-placeholder-font-size': cssNum(lerp(9, 7, pressure), 'pt'),
    '--report-header-padding-bottom': cssNum(lerp(8, 4, pressure), 'px'),
    '--report-header-margin-bottom': cssNum(lerp(10, 5, pressure), 'px'),
    '--report-school-name-font-size': cssNum(lerp(15, 12.4, pressure), 'pt'),
    '--report-small-font-size': cssNum(lerp(8.5, 7.2, pressure), 'pt'),
    '--report-title-margin': `${cssNum(lerp(8, 4, pressure), 'px')} 0`,
    '--report-title-padding': `${cssNum(lerp(5, 2, pressure), 'px')} 0`,
    '--report-title-font-size': cssNum(lerp(13, 10.8, pressure), 'pt'),
    '--report-section-gap': cssNum(lerp(10, 4, pressure), 'px'),
    '--report-info-padding-y': cssNum(lerp(4, 2, pressure), 'px'),
    '--report-info-padding-x': cssNum(lerp(8, 5, pressure), 'px'),
    '--report-label-font-size': cssNum(lerp(7, 6.2, pressure), 'pt'),
    '--report-info-font-size': cssNum(lerp(10, 8.3, pressure), 'pt'),
    '--report-table-cell-y': cssNum(lerp(4, 1.6, pressure), 'px'),
    '--report-table-cell-x': cssNum(lerp(6, 3, pressure), 'px'),
    '--report-table-font-size': cssNum(lerp(9.5, 7.8, pressure), 'pt'),
    '--report-table-head-font-size': cssNum(lerp(8.5, 7.1, pressure), 'pt'),
    '--report-subject-font-size': cssNum(lerp(9.2, 7.6, pressure), 'pt'),
    '--report-remarks-font-size': cssNum(lerp(8.5, 7.2, pressure), 'pt'),
    '--report-table-line-height': String(Number(lerp(1.35, 1.16, pressure).toFixed(2))),
    '--report-grade-badge-x': cssNum(lerp(6, 3, pressure), 'px'),
    '--report-grade-font-size': cssNum(lerp(9, 7.3, pressure), 'pt'),
    '--report-summary-gap': cssNum(lerp(5, 3, pressure), 'px'),
    '--report-summary-padding': cssNum(lerp(6, 3, pressure), 'px'),
    '--report-summary-value-font-size': cssNum(lerp(14, 10.8, pressure), 'pt'),
    '--report-section-header-y': cssNum(lerp(4, 2, pressure), 'px'),
    '--report-section-header-font-size': cssNum(lerp(9, 7.4, pressure), 'pt'),
    '--report-trait-gap': cssNum(lerp(6, 3, pressure), 'px'),
    '--report-trait-padding': cssNum(lerp(8, 4, pressure), 'px'),
    '--report-trait-item-y': cssNum(lerp(3, 1.4, pressure), 'px'),
    '--report-trait-font-size': cssNum(lerp(8.5, 7.2, pressure), 'pt'),
    '--report-comment-gap': cssNum(lerp(10, 5, pressure), 'px'),
    '--report-comment-padding-y': cssNum(lerp(8, 4, pressure), 'px'),
    '--report-comment-padding-x': cssNum(lerp(10, 6, pressure), 'px'),
    '--report-comment-label-gap': cssNum(lerp(4, 2, pressure), 'px'),
    '--report-comment-min-height': cssNum(lerp(24, 16, pressure), 'px'),
    '--report-comment-font-size': cssNum(lerp(9.5, 7.8, pressure), 'pt'),
    '--report-signature-gap': cssNum(lerp(40, 20, pressure), 'px'),
    '--report-signature-margin-top': cssNum(lerp(12, 5, pressure), 'px'),
    '--report-signature-font-size': cssNum(lerp(9, 7.5, pressure), 'pt'),
    '--report-dates-margin-top': cssNum(lerp(10, 4, pressure), 'px'),
    '--report-dates-font-size': cssNum(lerp(9.5, 7.8, pressure), 'pt'),
    '--report-parent-padding': cssNum(lerp(10, 5, pressure), 'px'),
    '--report-parent-margin-top': cssNum(lerp(10, 4, pressure), 'px'),
    '--report-parent-title-font-size': cssNum(lerp(9, 7.4, pressure), 'pt'),
    '--report-parent-title-gap': cssNum(lerp(8, 3, pressure), 'px'),
    '--report-parent-title-padding': cssNum(lerp(4, 2, pressure), 'px'),
    '--report-parent-gap': cssNum(lerp(8, 4, pressure), 'px'),
    '--report-parent-field-font-size': cssNum(lerp(9, 7.4, pressure), 'pt'),
    '--report-parent-line-height': cssNum(lerp(30, 18, pressure), 'px'),
    '--report-footer-margin-top': cssNum(lerp(10, 4, pressure), 'px'),
    '--report-footer-padding-top': cssNum(lerp(4, 2, pressure), 'px'),
    '--report-footer-font-size': cssNum(lerp(7, 6.2, pressure), 'pt'),
  }
}

/** Estimate rendered report height (px) at a given compression pressure. */
function estimateReportHeight(params: {
  subjectCount: number
  longestSubjectLength?: number
  commentLength?: number
  hasTabia?: boolean
  hasDates?: boolean
  isSecondary?: boolean
  pressure?: number
}): number {
  const pressure = params.pressure ?? 0
  const rowHeight = lerp(24, 18, pressure)
  const sectionGap = lerp(10, 4, pressure)
  const headerBlock = lerp(95, 72, pressure)
  const titleBlock = lerp(48, 34, pressure)
  const studentBar = lerp(40, 30, pressure)
  const tableHeader = lerp(28, 22, pressure)
  const summaryBlock = lerp(62, 48, pressure)
  const tabiaBlock = params.hasTabia ? lerp(92, 68, pressure) : 0
  const commentsBlock = lerp(56, 40, pressure)
  const signaturesBlock = lerp(52, 36, pressure)
  const datesBlock = params.hasDates ? lerp(30, 22, pressure) : 0
  const parentBlock = lerp(98, 68, pressure)
  const footerBlock = lerp(24, 18, pressure)
  const longNameWrap = Math.max(0, ((params.longestSubjectLength || 0) - 22) / 18) * rowHeight * 0.35
  const commentWrap = Math.max(0, ((params.commentLength || 0) - 120) / 80) * 8

  return (
    headerBlock +
    titleBlock +
    studentBar +
    tableHeader +
    params.subjectCount * rowHeight +
    rowHeight +
    summaryBlock +
    tabiaBlock +
    commentsBlock +
    signaturesBlock +
    datesBlock +
    parentBlock +
    footerBlock +
    sectionGap * 6 +
    longNameWrap +
    commentWrap
  )
}

function compressionFromPressure(pressure: number): ReportCardCompression {
  if (pressure <= 0.001) {
    return { className: 'report-density-normal', styleText: '', styleVars: {} }
  }
  const vars = buildCompressionVars(pressure)
  return {
    className: 'report-density-compact',
    styleText: Object.entries(vars).map(([key, value]) => `${key}:${value}`).join(';'),
    styleVars: vars,
  }
}

/** Content-aware compression: tighten spacing only until the report fits one A4 page. */
export function getReportCardCompression(params: {
  isSecondary: boolean
  subjectCount: number
  longestSubjectLength?: number
  commentLength?: number
  hasTabia?: boolean
  hasDates?: boolean
  measuredHeightPx?: number
}): ReportCardCompression {
  if (!params.isSecondary) {
    return { className: 'report-density-normal', styleText: '', styleVars: {} }
  }

  const estimateParams = {
    subjectCount: params.subjectCount,
    longestSubjectLength: params.longestSubjectLength,
    commentLength: params.commentLength,
    hasTabia: params.hasTabia,
    hasDates: params.hasDates,
    isSecondary: true,
  }

  const normalHeight = params.measuredHeightPx ?? estimateReportHeight({ ...estimateParams, pressure: 0 })
  if (normalHeight <= A4_PRINTABLE_HEIGHT_PX) {
    return { className: 'report-density-normal', styleText: '', styleVars: {} }
  }

  // Binary search: minimum pressure needed to fit one page
  let lo = 0
  let hi = 1
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2
    const height = params.measuredHeightPx
      ? normalHeight * (1 - mid * 0.22)
      : estimateReportHeight({ ...estimateParams, pressure: mid })
    if (height > A4_PRINTABLE_HEIGHT_PX) {
      lo = mid
    } else {
      hi = mid
    }
  }

  return compressionFromPressure(hi)
}

// Helper: Build school header with optional dual logos (no placeholder when absent)
export function buildSchoolHeader(params: {
  schoolName: string
  region?: string | null
  district?: string | null
  ward?: string | null
  registrationNo?: string | null
  logo?: string | null
  logo2?: string | null
  lang: 'en' | 'sw'
}): string {
  const tx = (en: string, sw: string) => params.lang === 'sw' ? sw : en

  const logoLeft = params.logo
    ? `<img src="${params.logo}" alt="School Logo" class="header-logo" />`
    : ''
  const logoRight = params.logo2
    ? `<img src="${params.logo2}" alt="Logo 2" class="header-logo" />`
    : ''
  const hasLogos = Boolean(logoLeft || logoRight)

  const infoParts: string[] = []
  if (params.region) infoParts.push(`${tx('Region', 'Mkoa')}: ${params.region}`)
  if (params.district) infoParts.push(`${tx('District', 'Wilaya')}: ${params.district}`)
  if (params.ward) infoParts.push(`${tx('Ward', 'Kata')}: ${params.ward}`)
  if (params.registrationNo) infoParts.push(`${tx('Reg. No', 'Namba ya Usajili')}: ${params.registrationNo}`)

  return `
    <div class="report-header${hasLogos ? '' : ' report-header-no-logos'}">
      ${logoLeft ? `<div style="flex-shrink:0">${logoLeft}</div>` : ''}
      <div class="header-center">
        <div class="school-name">${params.schoolName}</div>
        ${infoParts.length ? `<div class="school-info">${infoParts.join(' &middot; ')}</div>` : ''}
      </div>
      ${logoRight ? `<div style="flex-shrink:0">${logoRight}</div>` : ''}
    </div>
  `
}

// Helper: Build report footer with school name from settings
export function buildReportFooter(schoolName: string, lang: 'en' | 'sw', suffix?: string): string {
  const tx = (en: string, sw: string) => lang === 'sw' ? sw : en
  const label = tx('Prepared by', 'Imetayarishwa na')
  const name = schoolName || tx('School', 'Shule')
  const extra = suffix ? ` - ${suffix}` : ''
  return `<div class="report-footer">${label}: ${name}${extra}</div>`
}

// Helper: Build report title
export function buildReportTitle(params: {
  title: string
  subtitle?: string
  examName?: string
  term?: string
  academicYear?: string
  isIncomplete?: boolean
  lang: 'en' | 'sw'
}): string {
  const incompleteBadge = params.isIncomplete 
    ? `<span class="incomplete-badge">${params.lang === 'sw' ? 'HAIKAMILIKI' : 'INCOMPLETE'}</span>` 
    : ''
  
  const subtitleParts: string[] = []
  const tx = (en: string, sw: string) => params.lang === 'sw' ? sw : en
  if (params.examName) subtitleParts.push(`${tx('Examination', 'Mtihani')}: ${params.examName}`)
  if (params.term) subtitleParts.push(`${tx('Term', 'Muhula')}: ${params.term}`)
  if (params.academicYear) subtitleParts.push(`${tx('Academic Year', 'Mwaka wa Masomo')}: ${params.academicYear}`)
  if (params.subtitle) subtitleParts.push(params.subtitle)

  return `
    <div class="report-title">
      <h2>${params.title} ${incompleteBadge}</h2>
      ${subtitleParts.length ? `<div class="subtitle">${subtitleParts.join(' &nbsp;|&nbsp; ')}</div>` : ''}
    </div>
  `
}

// Helper: Get ordinal suffix
function getOrdinal(n: number, lang: 'en' | 'sw' = 'en'): string {
  if (lang === 'sw') return String(n)
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// Helper: Grade CSS class
function gradeClass(grade: string): string {
  const map: Record<string, string> = {
    A: 'grade-A', B: 'grade-B', C: 'grade-C', D: 'grade-D', E: 'grade-E', F: 'grade-F',
    I: 'grade-I', II: 'grade-II', III: 'grade-III', IV: 'grade-IV', '0': 'grade-0',
  }
  return map[grade] || 'grade-E'
}

// Helper: Grade color (dark for photocopy)
function gradeColor(grade: string): string {
  const map: Record<string, string> = {
    A: '#000', B: '#000', C: '#000', D: '#000', E: '#000', F: '#000',
  }
  return map[grade] || '#333'
}

// Helper: Grade description with translation
function gradeDesc(grade: string | null, lang: 'en' | 'sw' = 'en'): string {
  if (!grade) return ''
  const descriptions: Record<string, { en: string; sw: string }> = {
    A: { en: 'Excellent', sw: 'Bora Sana' },
    B: { en: 'Very Good', sw: 'Vizuri Sana' },
    C: { en: 'Good', sw: 'Vizuri' },
    D: { en: 'Satisfactory', sw: 'Inaridhisha' },
    E: { en: 'Poor', sw: 'Hairidhishi' },
    F: { en: 'Fail', sw: 'Hairishidhi' },
  }
  const desc = descriptions[grade]
  return desc ? desc[lang] : ''
}

// Helper: Translate stored remark - if it matches a known grade description, translate it
// Custom remarks from teachers stay as-is (not translated)
function translateRemark(remark: string | null | undefined, grade: string | null, lang: 'en' | 'sw'): string {
  if (!remark && !grade) return '-'
  if (!remark) return gradeDesc(grade, lang) || '-'
  
  // Known English grade descriptions that should be translated
  const enToSw: Record<string, string> = {
    'Excellent': 'Bora Sana',
    'Very Good': 'Vizuri Sana',
    'Good': 'Vizuri',
    'Satisfactory': 'Inaridhisha',
    'Poor': 'Hairidhishi',
    'Fail': 'Hairishidhi',
    'Improve': 'Kuboreshwa',
  }
  const swToEn: Record<string, string> = {
    'Bora Sana': 'Excellent',
    'Vizuri Sana': 'Very Good',
    'Vizuri': 'Good',
    'Inaridhisha': 'Satisfactory',
    'Hairidhishi': 'Poor',
    'Hairishidhi': 'Fail',
    'Hajaridhisha': 'Fail',
    'Kuboreshwa': 'Improve',
  }

  if (lang === 'sw') {
    // Translate English grade descriptions to Kiswahili
    return enToSw[remark] || remark
  } else {
    // Translate Kiswahili grade descriptions to English
    return swToEn[remark] || remark
  }
}

// Helper: Build grading scale section with translation
function buildGradingScale(schoolType: string, lang: 'en' | 'sw'): string {
  const tx = (en: string, sw: string) => lang === 'sw' ? sw : en
  
  if (schoolType === 'SECONDARY') {
    return `<div class="grading-scale-section">
      <div class="section-header">${tx('GRADING SCALE', 'KIPIMO CHA ALAMA')}</div>
      <div class="grading-scale-grid">
        <div class="grading-item"><div class="grading-letter">A</div><div class="grading-desc">75-100<br/>${tx('Excellent', 'Bora Sana')}</div></div>
        <div class="grading-item"><div class="grading-letter">B</div><div class="grading-desc">65-74<br/>${tx('Very Good', 'Vizuri Sana')}</div></div>
        <div class="grading-item"><div class="grading-letter">C</div><div class="grading-desc">45-64<br/>${tx('Good', 'Vizuri')}</div></div>
        <div class="grading-item"><div class="grading-letter">D</div><div class="grading-desc">30-44<br/>${tx('Satisfactory', 'Inaridhisha')}</div></div>
        <div class="grading-item"><div class="grading-letter">F</div><div class="grading-desc">0-29<br/>${tx('Fail', 'Hairishidhi')}</div></div>
      </div>
    </div>`
  }
  
  return `<div class="grading-scale-section">
    <div class="section-header">${tx('GRADING SCALE', 'KIPIMO CHA ALAMA')}</div>
    <div class="grading-scale-grid">
      <div class="grading-item"><div class="grading-letter">A</div><div class="grading-desc">41-50<br/>${tx('Excellent', 'Bora Sana')}</div></div>
      <div class="grading-item"><div class="grading-letter">B</div><div class="grading-desc">31-40<br/>${tx('Very Good', 'Vizuri Sana')}</div></div>
      <div class="grading-item"><div class="grading-letter">C</div><div class="grading-desc">21-30<br/>${tx('Good', 'Vizuri')}</div></div>
      <div class="grading-item"><div class="grading-letter">D</div><div class="grading-desc">11-20<br/>${tx('Satisfactory', 'Inaridhisha')}</div></div>
      <div class="grading-item"><div class="grading-letter">E</div><div class="grading-desc">0-10<br/>${tx('Poor', 'Hairidhishi')}</div></div>
    </div>
  </div>`
}

// Generate full HTML document wrapper
function wrapHtmlDocument(title: string, body: string, orientation: 'portrait' | 'landscape' = 'portrait'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    ${A4_BASE_STYLES}
    ${orientation === 'landscape' ? `
      @page { size: A4 landscape; margin: 4mm; }
      html, body { width: 297mm; min-height: 210mm; }
    ` : ''}
  </style>
</head>
<body>
  ${body}
  ${REPORT_CARD_FIT_SCRIPT}
</body>
</html>`
}

// ========== REPORT CARD TEMPLATE ==========
export function getLocalizedReportComments(
  school: Record<string, unknown> | null | undefined,
  result: { grade?: string | null; classTeacherComment?: string | null; headTeacherComment?: string | null } | null | undefined,
  lang: 'en' | 'sw'
) {
  const source = school || {}
  const grade = result?.grade === 'F' ? 'E' : result?.grade
  const suffix = lang === 'sw' ? '_sw' : '_en'
  const classGradeComment = grade ? source[`ctGrade${grade}${suffix}`] : undefined
  const headGradeComment = grade ? source[`htGrade${grade}${suffix}`] : undefined
  const classGeneral = lang === 'sw' ? source.classTeacherComments : source.classTeacherCommentsEn
  const headGeneral = lang === 'sw' ? source.headTeacherComments : source.headTeacherCommentsEn

  return {
    classTeacherComment: (typeof classGradeComment === 'string' && classGradeComment) ||
      (typeof classGeneral === 'string' && classGeneral) || result?.classTeacherComment || '',
    headTeacherComment: (typeof headGradeComment === 'string' && headGradeComment) ||
      (typeof headGeneral === 'string' && headGeneral) || result?.headTeacherComment || '',
  }
}

export function generateReportCardHtml(params: {
  school: {
    name: string; schoolType: string; registrationNo?: string | null; region?: string | null;
    district?: string | null; ward?: string | null; logo?: string | null; logo2?: string | null;
    headTeacherName?: string | null; headTeacherSign?: string | null;
    classTeacherName?: string | null; classTeacherShortName?: string | null;
  }
  student: { fullName: string; gender: string; admissionNo?: string | null; dob?: string | null }
  class: { name: string; fullName: string; schoolType: string; academicYear?: string | null; term?: string | null }
  exam: { name: string; examType: string; term: string; academicYear: string; examDate?: string | null }
  marks: Array<{ subjectName: string; shortName?: string | null; marks: number | null; grade: string | null; remarks?: string | null; teacherName?: string }>
  result: {
    totalMarks?: number | null; averageMarks?: number | null; grade?: string | null;
    division?: string | null; points?: number | null; rank?: number | null;
    status?: string; subjectCount?: number; classTeacherComment?: string | null;
    headTeacherComment?: string | null; closingDate?: string | null; openingDate?: string | null;
  } | null
  tabia: { discipline?: string | null; hygiene?: string | null; hardWorking?: string | null; cooperation?: string | null; honesty?: string | null; leadership?: string | null; sports?: string | null } | null
  classTeacher: { name: string; shortName?: string | null; sign?: string | null } | null
  totalStudents: number
  lang: 'en' | 'sw'
}): string {
  const { school, student, class: cls, exam, marks, result, tabia, classTeacher, totalStudents, lang } = params
  const isSec = cls.schoolType === 'SECONDARY'
  const maxMarks = isSec ? 100 : 50
  const isIncomplete = result?.status === 'INCOMPLETE'
  const dash = '\u2014'
  const compression = getReportCardCompression({
    isSecondary: isSec,
    subjectCount: marks.length,
    longestSubjectLength: Math.max(0, ...marks.map(mark => (mark.subjectName || mark.shortName || '').length)),
    commentLength: `${result?.classTeacherComment || ''} ${result?.headTeacherComment || ''}`.length,
    hasTabia: Boolean(tabia),
    hasDates: Boolean(result?.closingDate || result?.openingDate),
  })
  
  const tx = (en: string, sw: string) => lang === 'sw' ? sw : en
  
  const autoSig = (name: string | null | undefined, shortName: string | null | undefined, sign: string | null | undefined) => {
    if (sign) return sign
    if (shortName) return shortName
    if (!name) return '________________'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return parts[0].charAt(0).toUpperCase() + '.' + parts[parts.length - 1]
    return name
  }

  let html = ''
  
  // A4 content wrapper for proper sizing
  html += `<div class="a4-content report-card ${compression.className}" data-auto-fit="true" data-school-type="${cls.schoolType}"${compression.styleText ? ` style="${compression.styleText}"` : ''}>`
  
  // A4 fill wrapper - ensures page fills completely, parent section at bottom
  html += `<div class="a4-fill">`
  
  // School Header with Dual Logos
  html += buildSchoolHeader({
    schoolName: school.name,
    region: school.region,
    district: school.district,
    ward: school.ward,
    registrationNo: school.registrationNo,
    logo: school.logo,
    logo2: school.logo2,
    lang,
  })
  
  // Report Title
  html += buildReportTitle({
    title: tx('EXAMINATION REPORT CARD', 'RIPOTI YA MTIHANI'),
    examName: exam.name,
    term: exam.term,
    academicYear: exam.academicYear,
    isIncomplete,
    lang,
  })
  
  // Student Info Bar
  html += `<div class="student-info-bar">`
  html += `<div class="student-info-item"><div class="student-info-label">${tx('Name', 'Jina')}</div><div class="student-info-value">${student.fullName}</div></div>`
  html += `<div class="student-info-item"><div class="student-info-label">${isSec ? tx('Form', 'Kidato') : tx('Class', 'Darasa')}</div><div class="student-info-value">${cls.fullName}</div></div>`
  html += `<div class="student-info-item"><div class="student-info-label">${tx('Adm No', 'Namba ya Adm')}</div><div class="student-info-value">${student.admissionNo || '-'}</div></div>`
  html += `<div class="student-info-item"><div class="student-info-label">${tx('Gender', 'Jinsia')}</div><div class="student-info-value">${student.gender === 'M' ? tx('Male', 'Me') : tx('Female', 'Ke')}</div></div>`
  html += `</div>`
  
  // Subject Marks Table
  html += `<table class="marks-table" style="margin-bottom:10px">`
  html += `<thead><tr>`
  html += `<th style="width:28px;text-align:center">${tx('S/N', 'Namba')}</th>`
  html += `<th>${tx('Subject', 'Somo')}</th>`
  html += `<th style="width:55px;text-align:center">${tx('Marks', 'Alama')} (/${maxMarks})</th>`
  html += `<th style="width:45px;text-align:center">${tx('Grade', 'Gredi')}</th>`
  if (isSec) html += `<th style="width:35px;text-align:center">Pts</th>`
  html += `<th>${tx('Remarks', 'Maoni')}</th>`
  html += `</tr></thead><tbody>`
  
  for (let j = 0; j < marks.length; j++) {
    const m = marks[j]
    const rowClass = j % 2 === 0 ? 'odd-row' : 'even-row'
    html += `<tr class="${rowClass}">`
    html += `<td style="text-align:center;color:#333;font-weight:600">${j + 1}</td>`
    html += `<td class="subject-cell" style="font-weight:600">${m.subjectName}</td>`
    html += `<td style="text-align:center;font-weight:700">${m.marks ?? '-'}</td>`
    html += `<td style="text-align:center">${m.grade ? `<span class="grade-badge ${gradeClass(m.grade)}">${m.grade}</span>` : '-'}</td>`
    if (isSec) {
      const pts = m.grade ? (m.grade === 'A' ? '1' : m.grade === 'B' ? '2' : m.grade === 'C' ? '3' : m.grade === 'D' ? '4' : '5') : '-'
      html += `<td style="text-align:center;font-weight:700">${pts}</td>`
    }
    html += `<td class="remarks-cell" style="font-size:8.5pt;color:#000;font-weight:600">${translateRemark(m.remarks, m.grade, lang)}</td>`
    html += `</tr>`
  }
  
  // Total Row
  const totalGradeClass = result?.grade && !isIncomplete ? gradeClass(result.grade) : ''
  html += `<tr class="total-row">`
  html += `<td style="text-align:center" colspan="2">${tx('Total', 'Jumla')}</td>`
  html += `<td style="text-align:center;font-weight:900">${isIncomplete ? dash : (result?.totalMarks ?? dash)}</td>`
  html += `<td style="text-align:center">${isIncomplete ? dash : (result?.grade ? `<span class="grade-badge ${totalGradeClass}">${result.grade}</span>` : dash)}</td>`
  if (isSec) html += `<td style="text-align:center;font-weight:900">${isIncomplete ? dash : (result?.points ?? dash)}</td>`
  html += `<td></td>`
  html += `</tr></tbody></table>`
  
  // Results Summary
  if (result) {
    const cols = isSec ? 6 : 4
    html += `<div class="results-summary cols-${cols}">`
    const summaryItems = [
      { label: tx('Total', 'Jumla'), value: isIncomplete ? dash : (result.totalMarks ?? dash) },
      { label: tx('Average', 'Wastani'), value: isIncomplete ? dash : (result.averageMarks != null ? Math.round(result.averageMarks * 100) / 100 : dash) },
      { label: tx('Grade', 'Gredi'), value: isIncomplete ? dash : (result.grade || dash), isGrade: true, gradeVal: result.grade },
    ]
    if (isSec) {
      summaryItems.push({ label: tx('Points', 'Pointi'), value: isIncomplete ? dash : (result.points ?? dash) })
      summaryItems.push({ label: tx('Division', 'Daraja'), value: isIncomplete ? dash : (result.division || dash) })
    }
    summaryItems.push({ label: tx('Position', 'Nafasi'), value: `${isIncomplete ? dash : (result.rank ? getOrdinal(result.rank, lang) : dash)} ${tx('out of', 'kati ya')} ${totalStudents}` })
    
    for (const item of summaryItems) {
      html += `<div class="summary-item">`
      html += `<div class="summary-label">${item.label}</div>`
      html += `<div class="summary-value">${item.value}</div>`
      html += `</div>`
    }
    html += `</div>`
  }
  
  // Character/Conduct (Tabia)
  if (tabia) {
    const traits = [
      { label: tx('Discipline', 'Nidhamu'), value: tabia.discipline },
      { label: tx('Hygiene', 'Usafi'), value: tabia.hygiene },
      { label: tx('Hard Working', 'Bidii'), value: tabia.hardWorking },
      { label: tx('Cooperation', 'Ushirikiano'), value: tabia.cooperation },
      { label: tx('Honesty', 'Uaminifu'), value: tabia.honesty },
      { label: tx('Leadership', 'Uongozi'), value: tabia.leadership },
      { label: tx('Sports', 'Michezo'), value: tabia.sports },
    ]
    html += `<div class="character-section">`
    html += `<div class="section-header">${tx('CHARACTER & CONDUCT (TABIA)', 'TABIA NA MAADILI')}</div>`
    html += `<div class="traits-grid">`
    for (const tr of traits) {
      html += `<div class="trait-item"><span class="trait-label">${tr.label}</span><span class="trait-value">${tr.value || '-'}</span></div>`
    }
    html += `</div></div>`
  }
  
  // Comments (Class Teacher + Head Teacher)
  html += `<div class="comments-grid">`
  html += `<div class="comment-box"><div class="comment-label">${tx('Class Teacher Comment', 'Maoni ya Mwalimu wa Darasa')}</div><div class="comment-text">${result?.classTeacherComment || '____________________'}</div></div>`
  html += `<div class="comment-box"><div class="comment-label">${tx('Head Teacher Comment', 'Maoni ya Mkuu wa Shule')}</div><div class="comment-text">${result?.headTeacherComment || '____________________'}</div></div>`
  html += `</div>`
  
  // Signatures
  const classTeacherSig = autoSig(
    classTeacher?.name || school.classTeacherName,
    classTeacher?.shortName || school.classTeacherShortName,
    classTeacher?.sign || school.classTeacherShortName
  )
  const headTeacherSig = autoSig(school.headTeacherName, null, school.headTeacherSign)
  
  html += `<div class="signatures-grid">`
  html += `<div class="signature-box"><div class="signature-line">${classTeacherSig}</div><div class="signature-label">${tx('Class Teacher Signature', 'Saini ya Mwalimu wa Darasa')}</div></div>`
  html += `<div class="signature-box"><div class="signature-line">${headTeacherSig}</div><div class="signature-label">${tx('Head Teacher Signature', 'Saini ya Mkuu wa Shule')}</div></div>`
  html += `</div>`
  
  // Dates Section (Closing Date, Opening Date) - ABOVE parent section
  if (result?.closingDate || result?.openingDate) {
    html += `<div class="dates-grid">`
    if (result?.closingDate) {
      html += `<div>${tx('Closing Date', 'Tarehe ya Kufunga Shule')}: <b>${result.closingDate}</b></div>`
    }
    if (result?.openingDate) {
      html += `<div>${tx('Opening Date', 'Tarehe ya Kufungua Shule')}: <b>${result.openingDate}</b></div>`
    }
    html += `</div>`
  }
  
  // Parent/Guardian Section (AT THE VERY BOTTOM - last section)
  html += `<div class="parent-section">`
  html += `<div class="parent-title">${tx('PARENT / GUARDIAN', 'MZAZI / MLEZI')}</div>`
  html += `<div class="parent-fields">`
  html += `<div class="parent-field"><div class="parent-field-label">${tx('Comment', 'Maoni')}</div><div class="parent-field-line"></div></div>`
  html += `<div class="parent-field"><div class="parent-field-label">${tx('Name', 'Jina')}</div><div class="parent-field-line"></div></div>`
  html += `<div class="parent-field"><div class="parent-field-label">${tx('Signature', 'Saini')}</div><div class="parent-field-line"></div></div>`
  html += `<div class="parent-field"><div class="parent-field-label">${tx('Date', 'Tarehe')}</div><div class="parent-field-line"></div></div>`
  html += `</div></div>`
  
  // Footer
  html += buildReportFooter(school.name, lang)
  
  // Close A4 fill wrapper
  html += `</div>`
  
  // Close A4 content wrapper
  html += `</div>`
  
  return wrapHtmlDocument(`${tx('Report Card', 'Ripoti')} - ${student.fullName}`, html)
}

// ========== OVERALL RESULTS TEMPLATE (Landscape) ==========
export function generateOverallResultsHtml(params: {
  school: {
    name: string; schoolType: string; registrationNo?: string | null; region?: string | null;
    district?: string | null; ward?: string | null; logo?: string | null; logo2?: string | null;
  }
  class: { fullName: string; schoolType: string }
  exam: { name: string; term: string; academicYear: string }
  students: Array<{
    studentInfo: { id: string; fullName: string; gender: string; admissionNo?: string | null }
    subjectMarks: Record<string, { marks: number | null; grade: string | null }>
    result: { average: number | null; grade: string | null; points: number | null; division: string | null; rank: number | null; status?: string; subjectCount?: number } | null
  }>
  subjects: Array<{ id: string; name: string; shortName?: string | null }>
  totalStudents: number
  lang: 'en' | 'sw'
}): string {
  const { school, class: cls, exam, students, subjects, totalStudents, lang } = params
  const isSec = cls.schoolType === 'SECONDARY'
  const dash = '\u2014'
  const tx = (en: string, sw: string) => lang === 'sw' ? sw : en

  let html = ''
  
  // A4 content wrapper for proper sizing
  html += `<div class="a4-content">`
  
  // Header
  html += buildSchoolHeader({
    schoolName: school.name,
    region: school.region,
    district: school.district,
    ward: school.ward,
    registrationNo: school.registrationNo,
    logo: school.logo,
    logo2: school.logo2,
    lang,
  })
  
  // Title
  html += buildReportTitle({
    title: tx('OVERALL EXAMINATION RESULTS', 'MATOKEO YA JUMLA YA MTIHANI'),
    subtitle: cls.fullName,
    examName: exam.name,
    term: exam.term,
    academicYear: exam.academicYear,
    lang,
  })
  
  // Table
  html += `<table style="font-size:8pt">`
  html += `<thead><tr>`
  html += `<th style="width:22px;text-align:center">${tx('S/N', 'Namba')}</th>`
  html += `<th style="min-width:110px">${tx('Student Name', 'Jina la Mwanafunzi')}</th>`
  html += `<th style="width:26px;text-align:center">${tx('Sex', 'Jinsia')}</th>`
  for (const subj of subjects) {
    html += `<th style="min-width:45px;text-align:center;font-size:7pt">${subj.shortName || subj.name}</th>`
  }
  html += `<th style="width:42px;text-align:center">${tx('Avg', 'Wastani')}</th>`
  html += `<th style="width:32px;text-align:center">${tx('Grd', 'Gredi')}</th>`
  if (isSec) {
    html += `<th style="width:30px;text-align:center">Pts</th>`
    html += `<th style="width:30px;text-align:center">${tx('Div', 'Mgw')}</th>`
  }
  html += `<th style="width:42px;text-align:center">${tx('Pos', 'Nafasi')}</th>`
  html += `<th style="width:50px;text-align:center">${tx('Status', 'Hali')}</th>`
  html += `</tr></thead><tbody>`
  
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    const isIncomplete = s.result?.status === 'INCOMPLETE'
    const rowClass = isIncomplete ? 'incomplete-row' : (i % 2 === 0 ? 'odd-row' : 'even-row')
    
    html += `<tr class="${rowClass}">`
    html += `<td style="text-align:center;font-weight:600">${i + 1}</td>`
    html += `<td style="font-weight:600">${s.studentInfo.fullName}${isIncomplete ? ` <span class="incomplete-badge">${lang === 'sw' ? 'HAIKAMILIKI' : 'INCOMPLETE'}</span>` : ''}</td>`
    html += `<td style="text-align:center;font-weight:500">${s.studentInfo.gender}</td>`
    
    for (const subj of subjects) {
      const sm = s.subjectMarks[subj.id]
      const hasMark = sm?.marks != null
      html += `<td style="text-align:center;${!hasMark ? 'color:#999' : ''}">`
      html += hasMark ? Math.round(sm!.marks!) : '-'
      if (hasMark && sm?.grade) html += `<br><span style="font-size:7pt;font-weight:800">${sm.grade}</span>`
      html += `</td>`
    }
    
    html += `<td style="text-align:center;font-weight:800">${isIncomplete ? dash : (s.result?.average != null ? Math.round(s.result.average * 100) / 100 : dash)}</td>`
    html += `<td style="text-align:center">${isIncomplete ? dash : (s.result?.grade ? `<span class="grade-badge ${gradeClass(s.result.grade)}" style="font-size:8pt">${s.result.grade}</span>` : dash)}</td>`
    if (isSec) {
      html += `<td style="text-align:center;font-weight:800">${isIncomplete ? dash : (s.result?.points ?? dash)}</td>`
      html += `<td style="text-align:center">${isIncomplete ? dash : (s.result?.division ? `<span class="grade-badge ${gradeClass(s.result.division)}" style="font-size:8pt">${s.result.division}</span>` : dash)}</td>`
    }
    html += `<td style="text-align:center;font-weight:800">${isIncomplete ? dash : (s.result?.rank ? `${s.result.rank}/${totalStudents}` : dash)}</td>`
    html += `<td style="text-align:center">${isIncomplete ? `<span class="incomplete-badge" style="font-size:7pt">${lang === 'sw' ? 'HK' : 'INC'}</span>` : `<span class="complete-badge" style="font-size:7pt">OK</span>`}</td>`
    html += `</tr>`
  }
  
  html += `</tbody></table>`
  html += buildReportFooter(school.name, lang, `${tx('Overall Results', 'Matokeo ya Jumla')} | ${totalStudents} ${tx('students', 'wanafunzi')}`)
  
  // Close A4 content wrapper
  html += `</div>`
  
  return wrapHtmlDocument(`${tx('Overall Results', 'Matokeo ya Jumla')} - ${cls.fullName}`, html, 'landscape')
}

// ========== SUBJECT ANALYSIS TEMPLATE ==========
export function generateSubjectAnalysisHtml(params: {
  school: {
    name: string; schoolType: string; registrationNo?: string | null; region?: string | null;
    district?: string | null; ward?: string | null; logo?: string | null; logo2?: string | null;
  }
  class: { fullName: string; schoolType: string }
  exam: { name: string; term: string; academicYear: string }
  analysis: Array<{
    subjectName: string; shortName?: string | null; totalStudents: number;
    average: number; highest: number; lowest: number; passRate: number;
    gradeDistribution: Record<string, number>;
  }>
  lang: 'en' | 'sw'
}): string {
  const { school, class: cls, exam, analysis, lang } = params
  const tx = (en: string, sw: string) => lang === 'sw' ? sw : en

  let html = ''
  
  // A4 content wrapper for proper sizing
  html += `<div class="a4-content">`
  
  html += buildSchoolHeader({
    schoolName: school.name, region: school.region, district: school.district,
    ward: school.ward, registrationNo: school.registrationNo,
    logo: school.logo, logo2: school.logo2, lang,
  })
  
  html += buildReportTitle({
    title: tx('SUBJECT PERFORMANCE ANALYSIS', 'UCHAMBUAJI WA UTENDAJI WA MASOMO'),
    subtitle: cls.fullName,
    examName: exam.name, term: exam.term, academicYear: exam.academicYear, lang,
  })
  
  html += `<table style="margin-bottom:10px">
    <thead><tr>
      <th>${tx('Subject', 'Somo')}</th>
      <th style="text-align:center">${tx('Students', 'Wanafunzi')}</th>
      <th style="text-align:center">${tx('Average', 'Wastani')}</th>
      <th style="text-align:center">${tx('Highest', 'Ya Juu')}</th>
      <th style="text-align:center">${tx('Lowest', 'Ya Chini')}</th>
      <th style="text-align:center">${tx('Pass Rate', 'Kiwango cha Kupita')}</th>
    </tr></thead><tbody>`
  
  for (let i = 0; i < analysis.length; i++) {
    const a = analysis[i]
    const rowClass = i % 2 === 0 ? 'odd-row' : 'even-row'
    html += `<tr class="${rowClass}">
      <td style="font-weight:600">${a.subjectName}</td>
      <td style="text-align:center">${a.totalStudents}</td>
      <td style="text-align:center;font-weight:700">${Math.round(a.average * 100) / 100}</td>
      <td style="text-align:center;font-weight:700">${a.highest}</td>
      <td style="text-align:center;font-weight:700">${a.lowest}</td>
      <td style="text-align:center;font-weight:700">${a.passRate}%</td>
    </tr>`
  }
  
  html += `</tbody></table>`
  
  // Grading Scale
  html += buildGradingScale(cls.schoolType, lang)
  
  html += buildReportFooter(school.name, lang, tx('Subject Analysis', 'Uchambuaji wa Masomo'))
  
  // Close A4 content wrapper
  html += `</div>`
  
  return wrapHtmlDocument(`${tx('Subject Analysis', 'Uchambuaji wa Masomo')} - ${cls.fullName}`, html)
}

// ========== SUBJECT REPORT (Single Subject) ==========
export function generateSubjectReportHtml(params: {
  school: {
    name: string; schoolType: string; registrationNo?: string | null; region?: string | null;
    district?: string | null; ward?: string | null; logo?: string | null; logo2?: string | null;
  }
  class: { fullName: string; schoolType: string }
  exam: { name: string; term: string; academicYear: string }
  subjectName: string
  maxMarks: number
  data: Array<{ studentName: string; gender: string; marks: number | null; grade: string | null }>
  lang: 'en' | 'sw'
}): string {
  const { school, class: cls, exam, subjectName, maxMarks, data, lang } = params
  const tx = (en: string, sw: string) => lang === 'sw' ? sw : en

  // Sort by marks descending, nulls last
  const sorted = [...data].sort((a, b) => {
    if (a.marks == null && b.marks == null) return 0
    if (a.marks == null) return 1
    if (b.marks == null) return -1
    return b.marks - a.marks
  })

  // Calculate stats
  const marksValues = sorted.filter(s => s.marks != null).map(s => s.marks!)
  const avg = marksValues.length > 0 ? marksValues.reduce((a, b) => a + b, 0) / marksValues.length : 0
  const highest = marksValues.length > 0 ? Math.max(...marksValues) : 0
  const lowest = marksValues.length > 0 ? Math.min(...marksValues) : 0

  let html = ''
  
  // A4 content wrapper for proper sizing
  html += `<div class="a4-content">`
  
  html += buildSchoolHeader({
    schoolName: school.name, region: school.region, district: school.district,
    ward: school.ward, registrationNo: school.registrationNo,
    logo: school.logo, logo2: school.logo2, lang,
  })
  
  html += buildReportTitle({
    title: tx('SUBJECT REPORT', 'RIPOTI YA SOMO'),
    subtitle: subjectName,
    examName: exam.name, term: exam.term, academicYear: exam.academicYear, lang,
  })
  
  // Summary cards
  html += `<div class="results-summary cols-4" style="margin-bottom:10px">`
  html += `<div class="summary-item"><div class="summary-label">${tx('Total Students', 'Wanafunzi Jumla')}</div><div class="summary-value">${sorted.length}</div></div>`
  html += `<div class="summary-item"><div class="summary-label">${tx('Subject Average', 'Wastani wa Somo')}</div><div class="summary-value">${Math.round(avg * 100) / 100}</div></div>`
  html += `<div class="summary-item"><div class="summary-label">${tx('Highest', 'Ya Juu')}</div><div class="summary-value">${highest}</div></div>`
  html += `<div class="summary-item"><div class="summary-label">${tx('Lowest', 'Ya Chini')}</div><div class="summary-value">${lowest}</div></div>`
  html += `</div>`
  
  // Grading Scale
  html += buildGradingScale(cls.schoolType, lang)
  
  // Student marks table
  html += `<table class="marks-table">
    <thead><tr>
      <th style="width:28px;text-align:center">${tx('S/N', 'Namba')}</th>
      <th>${tx('Student Name', 'Jina la Mwanafunzi')}</th>`
      + `<th style="width:35px;text-align:center">${tx('Sex', 'Jinsia')}</th>
      <th style="width:55px;text-align:center">${tx('Marks', 'Alama')} (/${maxMarks})</th>
      <th style="width:45px;text-align:center">${tx('Grade', 'Gredi')}</th>
      <th style="width:45px;text-align:center">${tx('Position', 'Nafasi')}</th>
    </tr></thead><tbody>`
  
  let currentPos = 0
  let prevMarks: number | null = null
  const dash = '-'
  
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i]
    const rowClass = i % 2 === 0 ? 'odd-row' : 'even-row'
    
    // Calculate position (handle ties)
    if (s.marks != null) {
      if (prevMarks === null || s.marks !== prevMarks) {
        currentPos = i + 1
      }
      prevMarks = s.marks
    }
    
    const isIncomplete = s.marks == null
    
    html += `<tr class="${rowClass}${isIncomplete ? ' incomplete-row' : ''}">`
    html += `<td style="text-align:center;font-weight:600">${i + 1}</td>`
    html += `<td style="font-weight:600">${s.studentName}${isIncomplete ? ` <span class="incomplete-badge">${lang === 'sw' ? 'HAIKAMILIKI' : 'INCOMPLETE'}</span>` : ''}</td>`
    html += `<td style="text-align:center;font-weight:500">${s.gender}</td>`
    html += `<td style="text-align:center;font-weight:700">${s.marks != null ? s.marks : dash}</td>`
    html += `<td style="text-align:center">${s.grade ? `<span class="grade-badge ${gradeClass(s.grade)}">${s.grade}</span>` : '-'}</td>`
    html += `<td style="text-align:center;font-weight:800">${isIncomplete ? dash : getOrdinal(currentPos, lang)}</td>`
    html += `</tr>`
  }
  
  html += `</tbody></table>`
  html += buildReportFooter(school.name, lang, `${tx('Subject Report', 'Ripoti ya Somo')}: ${subjectName}`)
  
  // Close A4 content wrapper
  html += `</div>`
  
  return wrapHtmlDocument(`${tx('Subject Report', 'Ripoti ya Somo')} - ${subjectName}`, html)
}

// ========== TOP/BOTTOM STUDENTS TEMPLATE ==========
export function generateTopBottomStudentsHtml(params: {
  school: {
    name: string; schoolType: string; registrationNo?: string | null; region?: string | null;
    district?: string | null; ward?: string | null; logo?: string | null; logo2?: string | null;
  }
  exam: { name: string; term: string; academicYear: string }
  topStudents: Array<{
    student: { fullName: string; gender: string }; averageMarks: number | null; grade: string | null;
    division?: string | null; points?: number | null; rank?: number | null;
    class?: { fullName: string; schoolType: string }
  }>
  bottomStudents: Array<{
    student: { fullName: string; gender: string }; averageMarks: number | null; grade: string | null;
    division?: string | null; points?: number | null; rank?: number | null;
    class?: { fullName: string; schoolType: string }
  }>
  isSecondary: boolean
  lang: 'en' | 'sw'
}): string {
  const { school, exam, topStudents, bottomStudents, isSecondary, lang } = params
  const tx = (en: string, sw: string) => lang === 'sw' ? sw : en

  let html = ''
  
  // A4 content wrapper for proper sizing
  html += `<div class="a4-content">`
  
  html += buildSchoolHeader({
    schoolName: school.name, region: school.region, district: school.district,
    ward: school.ward, registrationNo: school.registrationNo,
    logo: school.logo, logo2: school.logo2, lang,
  })
  
  html += buildReportTitle({
    title: tx('STUDENT PERFORMANCE RANKING', 'ORODHA YA UTENDAJI WA WANAFUNZI'),
    examName: exam.name, term: exam.term, academicYear: exam.academicYear, lang,
  })
  
  // Top Students
  html += `<h3 style="font-size:11pt;color:#000;margin:10px 0 5px;font-weight:800;text-decoration:underline">${tx('TOP PERFORMING STUDENTS', 'WANAFUNZI BORA ZAIDI')}</h3>`
  html += `<table style="margin-bottom:12px">
    <thead><tr>
      <th style="width:30px;text-align:center">${tx('Pos', 'Nafasi')}</th>
      <th>${tx('Student Name', 'Jina')}</th>
      <th style="width:40px;text-align:center">${tx('Sex', 'Jinsia')}</th>
      <th style="width:55px;text-align:center">${tx('Average', 'Wastani')}</th>
      <th style="width:45px;text-align:center">${tx('Grade', 'Gredi')}</th>
      ${isSecondary ? `<th style="width:40px;text-align:center">Pts</th><th style="width:40px;text-align:center">${tx('Div', 'Mgw')}</th>` : ''}
    </tr></thead><tbody>`
  
  for (let i = 0; i < topStudents.length; i++) {
    const s = topStudents[i]
    const rowClass = i % 2 === 0 ? 'odd-row' : 'even-row'
    html += `<tr class="${rowClass}">
      <td style="text-align:center;font-weight:800">${i + 1}</td>
      <td style="font-weight:600">${s.student.fullName}</td>
      <td style="text-align:center">${s.student.gender}</td>
      <td style="text-align:center;font-weight:700">${s.averageMarks != null ? Math.round(s.averageMarks * 100) / 100 : '-'}</td>
      <td style="text-align:center">${s.grade ? `<span class="grade-badge ${gradeClass(s.grade)}">${s.grade}</span>` : '-'}</td>
      ${isSecondary ? `<td style="text-align:center;font-weight:700">${s.points ?? '-'}</td><td style="text-align:center">${s.division ? `<span class="grade-badge ${gradeClass(s.division)}">${s.division}</span>` : '-'}</td>` : ''}
    </tr>`
  }
  
  html += `</tbody></table>`
  
  // Bottom Students
  html += `<h3 style="font-size:11pt;color:#000;margin:10px 0 5px;font-weight:800;text-decoration:underline">${tx('BOTTOM PERFORMING STUDENTS', 'WANAFUNZI WALIO CHINI')}</h3>`
  html += `<table>
    <thead><tr>
      <th style="width:30px;text-align:center">${tx('Pos', 'Nafasi')}</th>
      <th>${tx('Student Name', 'Jina')}</th>
      <th style="width:40px;text-align:center">${tx('Sex', 'Jinsia')}</th>
      <th style="width:55px;text-align:center">${tx('Average', 'Wastani')}</th>
      <th style="width:45px;text-align:center">${tx('Grade', 'Gredi')}</th>
      ${isSecondary ? `<th style="width:40px;text-align:center">Pts</th><th style="width:40px;text-align:center">${tx('Div', 'Mgw')}</th>` : ''}
    </tr></thead><tbody>`
  
  for (let i = 0; i < bottomStudents.length; i++) {
    const s = bottomStudents[i]
    const rowClass = i % 2 === 0 ? 'odd-row' : 'even-row'
    html += `<tr class="${rowClass}">
      <td style="text-align:center;font-weight:800">${i + 1}</td>
      <td style="font-weight:600">${s.student.fullName}</td>
      <td style="text-align:center">${s.student.gender}</td>
      <td style="text-align:center;font-weight:700">${s.averageMarks != null ? Math.round(s.averageMarks * 100) / 100 : '-'}</td>
      <td style="text-align:center">${s.grade ? `<span class="grade-badge ${gradeClass(s.grade)}">${s.grade}</span>` : '-'}</td>
      ${isSecondary ? `<td style="text-align:center;font-weight:700">${s.points ?? '-'}</td><td style="text-align:center">${s.division ? `<span class="grade-badge ${gradeClass(s.division)}">${s.division}</span>` : '-'}</td>` : ''}
    </tr>`
  }
  
  html += `</tbody></table>`
  html += buildReportFooter(school.name, lang, tx('Student Ranking', 'Orodha ya Wanafunzi'))
  
  // Close A4 content wrapper
  html += `</div>`
  
  return wrapHtmlDocument(`${tx('Student Ranking', 'Orodha ya Wanafunzi')} - ${exam.name}`, html)
}

// ========== CLASS SUMMARY TEMPLATE ==========
export function generateClassSummaryHtml(params: {
  school: {
    name: string; schoolType: string; registrationNo?: string | null; region?: string | null;
    district?: string | null; ward?: string | null; logo?: string | null; logo2?: string | null;
  }
  class: { fullName: string; schoolType: string }
  exam: { name: string; term: string; academicYear: string }
  summary: {
    totalStudents: number
    classAverage: number
    passRate: number
    gradeDistribution: Record<string, number>
    divisionDistribution: Record<string, number>
    genderBreakdown: { male: number; female: number }
    highestScore: number
    lowestScore: number
  }
  lang: 'en' | 'sw'
}): string {
  const { school, class: cls, exam, summary, lang } = params
  const isSec = cls.schoolType === 'SECONDARY'
  const tx = (en: string, sw: string) => lang === 'sw' ? sw : en
  
  const distribution = isSec ? summary.divisionDistribution : summary.gradeDistribution
  const distKeys = isSec ? ['I', 'II', 'III', 'IV', '0'] : ['A', 'B', 'C', 'D', 'E']
  const distLabel = isSec ? tx('Division', 'Daraja') : tx('Grade', 'Gredi')

  let html = ''
  
  // A4 content wrapper for proper sizing
  html += `<div class="a4-content">`
  
  html += buildSchoolHeader({
    schoolName: school.name, region: school.region, district: school.district,
    ward: school.ward, registrationNo: school.registrationNo,
    logo: school.logo, logo2: school.logo2, lang,
  })
  
  html += buildReportTitle({
    title: tx('CLASS SUMMARY REPORT', 'RIPOTI YA MUHTASARI WA DARASA'),
    subtitle: cls.fullName,
    examName: exam.name, term: exam.term, academicYear: exam.academicYear, lang,
  })
  
  // Summary cards
  html += `<div class="results-summary cols-4" style="margin-bottom:10px">`
  html += `<div class="summary-item"><div class="summary-label">${tx('Total Students', 'Wanafunzi Jumla')}</div><div class="summary-value">${summary.totalStudents}</div></div>`
  html += `<div class="summary-item"><div class="summary-label">${tx('Class Average', 'Wastani wa Darasa')}</div><div class="summary-value">${Math.round(summary.classAverage * 100) / 100}</div></div>`
  html += `<div class="summary-item"><div class="summary-label">${tx('Pass Rate', 'Kiwango cha Kupita')}</div><div class="summary-value">${summary.passRate}%</div></div>`
  html += `<div class="summary-item"><div class="summary-label">${tx('Gender', 'Jinsia')}</div><div class="summary-value" style="font-size:11pt">${summary.genderBreakdown.male}M / ${summary.genderBreakdown.female}F</div></div>`
  html += `</div>`
  
  // Highest/Lowest
  html += `<div class="results-summary cols-2" style="grid-template-columns:1fr 1fr;margin-bottom:10px">`
  html += `<div class="summary-item"><div class="summary-label">${tx('Highest Average', 'Wastani wa Juu')}</div><div class="summary-value">${summary.highestScore}</div></div>`
  html += `<div class="summary-item"><div class="summary-label">${tx('Lowest Average', 'Wastani wa Chini')}</div><div class="summary-value">${summary.lowestScore}</div></div>`
  html += `</div>`
  
  // Distribution table
  html += `<table style="margin-bottom:10px">
    <thead><tr>
      <th>${distLabel}</th>
      <th style="text-align:center">${tx('Count', 'Idadi')}</th>
      <th style="text-align:center">${tx('Percentage', 'Asilimia')}</th>
    </tr></thead><tbody>`
  
  for (const key of distKeys) {
    const count = distribution[key] || 0
    const pct = summary.totalStudents > 0 ? Math.round((count / summary.totalStudents) * 100) : 0
    html += `<tr>
      <td style="text-align:center"><span class="grade-badge ${gradeClass(key)}">${key}</span></td>
      <td style="text-align:center;font-weight:700">${count}</td>
      <td style="text-align:center;font-weight:700">${pct}%</td>
    </tr>`
  }
  
  html += `</tbody></table>`
  
  // Grading Scale
  html += buildGradingScale(cls.schoolType, lang)
  
  html += buildReportFooter(school.name, lang, tx('Class Summary', 'Muhtasari wa Darasa'))
  
  // Close A4 content wrapper
  html += `</div>`
  
  return wrapHtmlDocument(`${tx('Class Summary', 'Muhtasari wa Darasa')} - ${cls.fullName}`, html)
}
