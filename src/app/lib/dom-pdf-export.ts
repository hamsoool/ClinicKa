import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export type DomPdfPageFormat = 'a4' | 'legal';

type PageSize = {
  format: [number, number];
  label: string;
};

const PAGE_SIZES: Record<DomPdfPageFormat, PageSize> = {
  a4: { format: [595.28, 841.89], label: 'A4' },
  legal: { format: [612, 1008], label: 'Legal' },
};

function getPdfPages(element: HTMLElement) {
  const pages = Array.from(element.querySelectorAll<HTMLElement>('[data-pdf-page]'));
  if (element.matches('[data-pdf-page]')) pages.unshift(element);
  return pages.length ? pages : [element];
}

async function waitForImages(element: HTMLElement) {
  const images = Array.from(element.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(
    images.map(async (image) => {
      if (!image.crossOrigin) image.crossOrigin = 'anonymous';
      if (image.complete && image.naturalWidth > 0) return;
      try {
        await image.decode();
      } catch {
        await new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        });
      }
    }),
  );
}

function getCanvasScale() {
  return 4;
}

export async function createPdfFromElement(
  element: HTMLElement | null,
  options: { pageFormat: DomPdfPageFormat; scale?: number },
) {
  if (!element) throw new Error('The document preview is not ready yet.');

  await document.fonts?.ready;
  await waitForImages(element);

  const pageSize = PAGE_SIZES[options.pageFormat];
  const [pageWidth, pageHeight] = pageSize.format;
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: pageSize.format,
    compress: true,
  });
  const pages = getPdfPages(element);

  const scale = options.scale ?? getCanvasScale();

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const canvas = await html2canvas(page, {
      backgroundColor: '#ffffff',
      scale: scale,
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 15000,
      windowWidth: Math.max(document.documentElement.clientWidth, page.scrollWidth),
      windowHeight: Math.max(document.documentElement.clientHeight, page.scrollHeight),
      scrollX: 0,
      scrollY: 0,
    });

    if (index > 0) pdf.addPage(pageSize.format, 'portrait');

    const imageWidth = canvas.width;
    const imageHeight = canvas.height;
    const fitScale = Math.min(pageWidth / imageWidth, pageHeight / imageHeight);
    const renderWidth = imageWidth * fitScale;
    const renderHeight = imageHeight * fitScale;
    const x = (pageWidth - renderWidth) / 2;
    const y = 0;

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, renderWidth, renderHeight, undefined, 'FAST');
  }

  return pdf.output('blob');
}

export function getDomPdfPageLabel(pageFormat: DomPdfPageFormat) {
  return PAGE_SIZES[pageFormat].label;
}
