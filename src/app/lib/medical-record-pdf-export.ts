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

export async function printMedicalRecordPreview(source: HTMLElement, width: number, title = 'Medical Record') {
  const pageWidth = Math.max(width, LETTER_PAGE_WIDTH_PX);
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

  frameDocument.open();
  frameDocument.write('<!doctype html><html><head><title></title></head><body></body></html>');
  frameDocument.close();
  frameDocument.title = title;
  copyDocumentStyles(frameDocument);

  const printStyle = frameDocument.createElement('style');
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
  `;
  frameDocument.head.appendChild(printStyle);

  const wrapper = frameDocument.createElement('div');
  wrapper.className = 'medical-record-print-page';

  const clone = source.cloneNode(true) as HTMLElement;
  prepareMedicalRecordPdfClone(clone, width);
  wrapper.appendChild(clone);
  frameDocument.body.appendChild(wrapper);

  await Promise.all(
    Array.from(frameDocument.images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    }),
  );
  await frameDocument.fonts?.ready;

  const renderedBounds = clone.getBoundingClientRect();
  const renderedHeight = Math.ceil(Math.max(clone.scrollHeight, renderedBounds.height));
  const renderedWidth = Math.ceil(Math.max(clone.scrollWidth, renderedBounds.width, width));
  const scale = pageWidth / renderedWidth;
  const pageHeight = Math.ceil(renderedHeight * scale);
  const pageWidthIn = pageWidth / CSS_PX_PER_INCH;
  const pageHeightIn = pageHeight / CSS_PX_PER_INCH;

  frame.style.height = `${pageHeight}px`;
  wrapper.style.height = `${pageHeight}px`;
  frameDocument.documentElement.style.height = `${pageHeight}px`;
  frameDocument.body.style.height = `${pageHeight}px`;
  clone.style.transform = `scale(${scale})`;

  const pageSizeStyle = frameDocument.createElement('style');
  pageSizeStyle.textContent = `
    @page {
      size: ${pageWidthIn}in ${pageHeightIn}in;
      margin: 0;
    }
  `;
  frameDocument.head.appendChild(pageSizeStyle);

  frameWindow.focus();
  frameWindow.print();

  window.setTimeout(() => {
    if (frame.parentNode) frame.parentNode.removeChild(frame);
  }, 1000);
}
