const MEDICAL_RECORD_PDF_EXPORT_CLASS = 'medical-record-pdf-export';
const PRINT_PAGE_WIDTH_PX = 816;
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

    .${MEDICAL_RECORD_PDF_EXPORT_CLASS} img[alt="Examiner signature"] {
      display: block !important;
      height: 32px !important;
      max-height: 36px !important;
      max-width: 96px !important;
      object-fit: contain !important;
      width: auto !important;
    }
  `;
  clone.prepend(style);
}

function getDocumentStyleMarkup() {
  return Array.from(document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style'))
    .map((node) => {
      if (node instanceof HTMLLinkElement) {
        const href = new URL(node.getAttribute('href') || node.href, document.baseURI).href;
        return `<link rel="stylesheet" href="${href}">`;
      }
      return `<style>${node.textContent || ''}</style>`;
    })
    .join('\n');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPrintDocumentHtml({
  title,
  pageWidth,
  pageHeight,
  naturalWidth,
  naturalHeight,
  contentHtml,
}: {
  title: string;
  pageWidth: number;
  pageHeight: number;
  naturalWidth: number;
  naturalHeight: number;
  contentHtml: string;
}) {
  const pageWidthIn = pageWidth / CSS_PX_PER_INCH;
  const pageHeightIn = pageHeight / CSS_PX_PER_INCH;
  const safeTitle = escapeHtml(title);

  return `<!doctype html>
<html>
<head>
  <base href="${escapeHtml(document.baseURI)}">
  <meta name="viewport" content="width=${pageWidth}, initial-scale=1">
  <title>${safeTitle}</title>
  ${getDocumentStyleMarkup()}
  <style>
    @page {
      size: ${pageWidthIn}in ${pageHeightIn}in;
      margin: 0;
    }

    html {
      background: #fff !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: ${pageHeight}px !important;
      overflow: hidden !important;
    }

    body {
      background: #fff !important;
      -webkit-print-color-adjust: exact !important;
      margin: 0 !important;
      padding: 0 !important;
      print-color-adjust: exact !important;
      width: 100% !important;
      min-height: ${pageHeight}px !important;
      overflow: hidden !important;
    }

    .medical-record-print-actions {
      align-items: center;
      background: #f8fafc;
      border-bottom: 1px solid #cbd5e1;
      box-sizing: border-box;
      display: flex;
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

    .medical-record-print-actions .medical-record-print-close {
      background: #475569;
    }

    .medical-record-print-actions span {
      color: #334155;
      font: 13px Arial, Helvetica, sans-serif;
    }

    .medical-record-print-page {
      background: #fff !important;
      height: ${pageHeight}px !important;
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

    .medical-record-print-page img[alt="Examiner signature"] {
      display: block !important;
      height: 32px !important;
      max-height: 36px !important;
      max-width: 96px !important;
      object-fit: contain !important;
      width: auto !important;
    }

    @media print {
      @page {
        margin: 0;
      }

      html,
      body {
        background: #fff !important;
        height: auto !important;
        margin: 0 !important;
        overflow: visible !important;
        padding: 0 !important;
        width: 100% !important;
      }

      body > *:not(.medical-record-print-page) {
        display: none !important;
      }

      .medical-record-print-actions {
        display: none !important;
      }

      .medical-record-print-page {
        display: block !important;
        left: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
        padding: 0 !important;
        position: relative !important;
        top: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="medical-record-print-actions">
    <button type="button" onclick="window.print()">Save as PDF / Print</button>
    <button type="button" class="medical-record-print-close" onclick="window.close()">Close</button>
    <span>Use this button if the print dialog does not open automatically.</span>
  </div>
  <div class="medical-record-print-page">${contentHtml}</div>
  <script>
    (function () {
      var naturalWidth = ${naturalWidth};
      var naturalHeight = ${naturalHeight};
      var defaultPageWidth = ${pageWidth};
      var page = document.querySelector('.medical-record-print-page');
      var form = page ? page.querySelector('.${MEDICAL_RECORD_PDF_EXPORT_CLASS}') : null;

      function getTargetWidth() {
        var widths = [
          document.documentElement ? document.documentElement.clientWidth : 0,
          document.body ? document.body.clientWidth : 0,
          window.innerWidth || 0,
          window.visualViewport ? window.visualViewport.width : 0
        ].filter(function (value) { return value && value > 0; });
        var width = widths.length ? Math.max.apply(Math, widths) : defaultPageWidth;
        if (!window.matchMedia || !window.matchMedia('print').matches) {
          width = Math.min(width, defaultPageWidth);
        }
        return Math.max(1, Math.round(width));
      }

      function fitToPageWidth() {
        if (!page || !form) return;
        var targetWidth = getTargetWidth();
        var scale = targetWidth / naturalWidth;
        var targetHeight = Math.ceil(naturalHeight * scale);
        document.documentElement.style.width = targetWidth + 'px';
        document.body.style.width = targetWidth + 'px';
        page.style.width = targetWidth + 'px';
        page.style.height = targetHeight + 'px';
        form.style.transformOrigin = 'top left';
        form.style.transform = 'scale(' + scale + ')';
      }

      window.addEventListener('resize', fitToPageWidth);
      window.addEventListener('orientationchange', function () {
        setTimeout(fitToPageWidth, 150);
      });
      window.addEventListener('beforeprint', fitToPageWidth);
      fitToPageWidth();
    })();

    window.addEventListener('afterprint', function () {
      setTimeout(function () {
        window.close();
      }, 250);
    });

    var printRequested = false;

    function requestPrint(waitForAssets) {
      if (printRequested) return;
      printRequested = true;

      var runPrint = function () {
        window.dispatchEvent(new Event('beforeprint'));
        window.focus();
        window.print();
      };

      if (waitForAssets) {
        waitForPrintAssets(runPrint);
        return;
      }

      runPrint();
    }

    function waitForPrintAssets(callback) {
      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        callback();
      };
      var images = Array.prototype.slice.call(document.images || []);
      var pending = images.filter(function (img) { return !img.complete; }).length;
      var markLoaded = function () {
        pending -= 1;
        if (pending <= 0) finish();
      };

      if (pending <= 0) {
        finish();
        return;
      }

      images.forEach(function (img) {
        if (img.complete) return;
        img.addEventListener('load', markLoaded, { once: true });
        img.addEventListener('error', markLoaded, { once: true });
      });
      setTimeout(finish, 2500);
    }

    window.medicalRecordRequestPrint = requestPrint;

    window.addEventListener('load', function () {
      setTimeout(function () {
        requestPrint(true);
      }, 150);
    });
  </script>
</body>
</html>`;
}

export async function printMedicalRecordPreview(source: HTMLElement, width: number, title = 'Medical Record') {
  const pageWidth = Math.max(width, PRINT_PAGE_WIDTH_PX);
  const clone = source.cloneNode(true) as HTMLElement;
  prepareMedicalRecordPdfClone(clone, width);

  const renderedBounds = source.getBoundingClientRect();
  const renderedHeight = Math.ceil(Math.max(source.scrollHeight, source.offsetHeight, renderedBounds.height));
  const renderedWidth = Math.ceil(Math.max(source.scrollWidth, source.offsetWidth, renderedBounds.width, width));
  const scale = pageWidth / renderedWidth;
  const pageHeight = Math.ceil(renderedHeight * scale);

  clone.style.transform = 'none';

  const html = buildPrintDocumentHtml({
    title,
    pageWidth,
    pageHeight,
    naturalWidth: renderedWidth,
    naturalHeight: renderedHeight,
    contentHtml: clone.outerHTML,
  });

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('The print page was blocked. Please allow pop-ups for this site and try again.');
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  try {
    printWindow.focus();
    const requestPrint = (printWindow as Window & { medicalRecordRequestPrint?: (waitForAssets: boolean) => void })
      .medicalRecordRequestPrint;
    if (requestPrint) {
      requestPrint(false);
    } else {
      printWindow.dispatchEvent(new Event('beforeprint'));
      printWindow.print();
    }
  } catch {
    printWindow.print();
  }
}
