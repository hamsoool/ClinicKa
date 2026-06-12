const MEDICAL_RECORD_PDF_EXPORT_CLASS = 'medical-record-pdf-export';
const LETTER_PAGE_WIDTH_PX = 816;
const CSS_PX_PER_INCH = 96;

export function prepareMedicalRecordPdfClone(clone: HTMLElement, width: number) {
  clone.classList.add(MEDICAL_RECORD_PDF_EXPORT_CLASS);
  clone.style.width = `${width}px`;
  clone.style.maxWidth = `${width}px`;
  clone.style.margin = '0';
  clone.style.padding = '0';
  clone.style.transform = 'none';
  clone.style.transformOrigin = 'top left';

  const style = document.createElement('style');
  style.textContent = `
    .${MEDICAL_RECORD_PDF_EXPORT_CLASS} {
      box-shadow: none !important;
      border-radius: 0 !important;
    }
  `;
  clone.prepend(style);
}

function copyDocumentStyles(targetDocument: Document) {
  document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style').forEach((node) => {
    targetDocument.head.appendChild(node.cloneNode(true));
  });
}

function createFallbackPrintFrame(pageWidth: number) {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.left = '-10000px';
  frame.style.top = '0';
  frame.style.width = `${pageWidth}px`;
  frame.style.height = '1800px';
  frame.style.border = '0';
  frame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(frame);

  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument;
  if (!frameWindow || !frameDocument) {
    document.body.removeChild(frame);
    throw new Error('Unable to prepare the print frame.');
  }

  return {
    printWindow: frameWindow,
    printDocument: frameDocument,
    setHeight: (height: number) => {
      frame.style.height = `${height}px`;
    },
    cleanup: () => {
      window.setTimeout(() => {
        if (frame.parentNode) frame.parentNode.removeChild(frame);
      }, 1000);
    },
    isPopup: false,
  };
}

function createPrintTarget(pageWidth: number) {
  const popup = window.open('', '_blank');
  if (!popup) return createFallbackPrintFrame(pageWidth);

  try {
    popup.resizeTo?.(Math.min(window.screen.availWidth || pageWidth, pageWidth), window.screen.availHeight || 1800);
  } catch {
    // Some mobile browsers disallow resizing auxiliary windows.
  }

  return {
    printWindow: popup,
    printDocument: popup.document,
    setHeight: (_height: number) => undefined,
    cleanup: () => undefined,
    isPopup: true,
  };
}

function waitForNextPaint(targetWindow: Window) {
  return new Promise<void>((resolve) => {
    targetWindow.requestAnimationFrame(() => {
      targetWindow.requestAnimationFrame(() => resolve());
    });
  });
}

export async function printMedicalRecordPreview(source: HTMLElement, width: number, title = 'Medical Record') {
  const pageWidth = Math.max(width, LETTER_PAGE_WIDTH_PX);
  const { printWindow, printDocument, setHeight, cleanup, isPopup } = createPrintTarget(pageWidth);

  printDocument.open();
  printDocument.write('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title></title></head><body></body></html>');
  printDocument.close();
  printDocument.title = title;
  const base = printDocument.createElement('base');
  base.href = document.baseURI;
  printDocument.head.prepend(base);
  copyDocumentStyles(printDocument);

  const printStyle = printDocument.createElement('style');
  printStyle.textContent = `
    @page {
      size: auto;
      margin: 0;
    }

    html,
    body {
      background: #fff !important;
      margin: 0 !important;
      padding: 0 !important;
      width: ${pageWidth}px !important;
      overflow: hidden !important;
    }

    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .medical-record-print-page {
      background: #fff !important;
      margin: 0 !important;
      overflow: hidden !important;
      padding: 0 !important;
      position: relative !important;
      width: ${pageWidth}px !important;
    }

    .medical-record-print-page > .${MEDICAL_RECORD_PDF_EXPORT_CLASS} {
      left: 0 !important;
      margin: 0 !important;
      position: absolute !important;
      top: 0 !important;
      transform-origin: top left !important;
    }

    .medical-record-print-actions {
      align-items: center;
      background: #f8fafc;
      border-bottom: 1px solid #cbd5e1;
      box-sizing: border-box;
      display: ${isPopup ? 'flex' : 'none'};
      font-family: Arial, Helvetica, sans-serif;
      gap: 8px;
      left: 0;
      padding: 10px 12px;
      position: sticky;
      right: 0;
      top: 0;
      z-index: 10;
    }

    .medical-record-print-actions button {
      background: #006d3c;
      border: 0;
      border-radius: 4px;
      color: #fff;
      font: 600 14px Arial, Helvetica, sans-serif;
      padding: 9px 12px;
    }

    .medical-record-print-actions span {
      color: #334155;
      font: 13px Arial, Helvetica, sans-serif;
    }

    @media print {
      .medical-record-print-actions {
        display: none !important;
      }
    }
  `;
  printDocument.head.appendChild(printStyle);

  const actionBar = printDocument.createElement('div');
  actionBar.className = 'medical-record-print-actions';
  const actionButton = printDocument.createElement('button');
  actionButton.type = 'button';
  actionButton.textContent = 'Save as PDF / Print';
  actionButton.addEventListener('click', () => printWindow.print());
  const actionHint = printDocument.createElement('span');
  actionHint.textContent = 'Use this button if the print dialog does not open automatically.';
  actionBar.append(actionButton, actionHint);
  printDocument.body.appendChild(actionBar);

  const wrapper = printDocument.createElement('div');
  wrapper.className = 'medical-record-print-page';

  const clone = source.cloneNode(true) as HTMLElement;
  prepareMedicalRecordPdfClone(clone, width);
  wrapper.appendChild(clone);
  printDocument.body.appendChild(wrapper);

  await Promise.all(
    Array.from(printDocument.images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    }),
  );
  await printDocument.fonts?.ready;
  await waitForNextPaint(printWindow);

  const renderedBounds = clone.getBoundingClientRect();
  const renderedHeight = Math.ceil(Math.max(clone.scrollHeight, renderedBounds.height));
  const renderedWidth = Math.ceil(Math.max(clone.scrollWidth, renderedBounds.width, width));
  const scale = pageWidth / renderedWidth;
  const pageHeight = Math.ceil(renderedHeight * scale);
  const pageWidthIn = pageWidth / CSS_PX_PER_INCH;
  const pageHeightIn = pageHeight / CSS_PX_PER_INCH;

  setHeight(pageHeight);
  wrapper.style.height = `${pageHeight}px`;
  printDocument.documentElement.style.height = `${pageHeight}px`;
  printDocument.body.style.height = `${pageHeight}px`;
  clone.style.transform = `scale(${scale})`;

  const pageSizeStyle = printDocument.createElement('style');
  pageSizeStyle.textContent = `
    @page {
      size: ${pageWidthIn}in ${pageHeightIn}in;
      margin: 0;
    }
  `;
  printDocument.head.appendChild(pageSizeStyle);

  await waitForNextPaint(printWindow);
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
    cleanup();
  }, 100);
}
