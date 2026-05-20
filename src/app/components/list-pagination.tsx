import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

type ListPaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

function getVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
}

export default function ListPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 25, 50],
  itemLabel = 'items',
  onPageChange,
  onPageSizeChange,
}: ListPaginationProps) {
  if (totalItems <= 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const visiblePages = getVisiblePages(currentPage, totalPages);
  const showPageSizeSelector = pageSizeOptions.length > 1;

  return (
    <div className="mt-6 flex flex-col gap-4 border-t pt-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {startItem}-{endItem} of {totalItems} {itemLabel}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
          {showPageSizeSelector ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page</span>
              <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
                <SelectTrigger className="h-9 w-[88px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
        </div>
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          >
            Previous
          </Button>

          {visiblePages.map((page, index) => {
            const previousPage = visiblePages[index - 1];
            const showEllipsis = previousPage && page - previousPage > 1;

            return (
              <div key={page} className="flex items-center gap-2">
                {showEllipsis ? (
                  <span className="px-1 text-sm text-muted-foreground">...</span>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant={page === currentPage ? 'default' : 'outline'}
                  onClick={() => onPageChange(page)}
                >
                  {page}
                </Button>
              </div>
            );
          })}

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
