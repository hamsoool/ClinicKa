const MEDICAL_RECORD_PDF_EXPORT_CLASS = 'medical-record-pdf-export';

export function prepareMedicalRecordPdfClone(clone: HTMLElement, width: number) {
  clone.classList.add(MEDICAL_RECORD_PDF_EXPORT_CLASS);
  clone.style.width = `${width}px`;
  clone.style.maxWidth = `${width}px`;
  clone.style.margin = '0';
  clone.style.padding = '0';
  clone.style.transform = 'none';

  const style = document.createElement('style');
  style.textContent = `
    .${MEDICAL_RECORD_PDF_EXPORT_CLASS} {
      box-shadow: none !important;
    }

    .${MEDICAL_RECORD_PDF_EXPORT_CLASS} table {
      border-collapse: separate !important;
      border-spacing: 0 !important;
      border: 0 !important;
      border-top: 0.75px solid #000 !important;
      border-left: 0.75px solid #000 !important;
    }

    .${MEDICAL_RECORD_PDF_EXPORT_CLASS} th,
    .${MEDICAL_RECORD_PDF_EXPORT_CLASS} td {
      border: 0 !important;
      border-right: 0.75px solid #000 !important;
      border-bottom: 0.75px solid #000 !important;
    }

    .${MEDICAL_RECORD_PDF_EXPORT_CLASS} .border-b {
      border-bottom-width: 0.75px !important;
    }

    .${MEDICAL_RECORD_PDF_EXPORT_CLASS} .medical-record-line-field {
      min-height: 21px !important;
      padding-bottom: 5px !important;
    }

    .${MEDICAL_RECORD_PDF_EXPORT_CLASS} .medical-record-inline-field {
      padding-bottom: 4px !important;
    }
  `;
  clone.prepend(style);
}
