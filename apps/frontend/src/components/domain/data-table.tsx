import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  cell: (item: T) => ReactNode;
  cellClassName?: string;
  header: ReactNode;
  headerClassName?: string;
  key: string;
};

type DataTableProps<T> = {
  columns: Array<DataTableColumn<T>>;
  data: T[];
  emptyMessage: string;
  getRowId: (item: T) => string;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  searchPlaceholder?: string;
  searchText: (item: T) => string;
  toolbar?: ReactNode;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function DataTable<T>({
  columns,
  data,
  emptyMessage,
  getRowId,
  initialPageSize = 10,
  pageSizeOptions = [10, 20, 50],
  searchPlaceholder = "Buscar...",
  searchText,
  toolbar,
}: DataTableProps<T>) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState("");

  const filteredData = useMemo(() => {
    const normalizedSearch = normalizeSearch(search);

    if (!normalizedSearch) {
      return data;
    }

    return data.filter((item) => normalizeSearch(searchText(item)).includes(normalizedSearch));
  }, [data, search, searchText]);

  const pageCount = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const pageStart = currentPage * pageSize;
  const visibleRows = filteredData.slice(pageStart, pageStart + pageSize);
  const firstItem = filteredData.length ? pageStart + 1 : 0;
  const lastItem = filteredData.length ? pageStart + visibleRows.length : 0;

  useEffect(() => {
    setPageIndex(0);
  }, [data.length, pageSize, search]);

  useEffect(() => {
    if (pageIndex > pageCount - 1) {
      setPageIndex(pageCount - 1);
    }
  }, [pageCount, pageIndex]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={searchPlaceholder}
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            value={search}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {toolbar}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Linhas</span>
            <Select
              aria-label="Linhas por pagina"
              className="h-9 w-20"
              onChange={(event) => setPageSize(Number(event.target.value))}
              value={String(pageSize)}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead className={column.headerClassName} key={column.key}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((item) => (
            <TableRow key={getRowId(item)}>
              {columns.map((column) => (
                <TableCell className={column.cellClassName} key={column.key}>
                  {column.cell(item)}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {!visibleRows.length ? (
            <TableRow>
              <TableCell
                className={cn(
                  "h-24 text-center text-sm text-muted-foreground",
                  columns.length === 1 && "text-left",
                )}
                colSpan={columns.length}
              >
                {data.length && search ? "Nenhum resultado encontrado." : emptyMessage}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <span>
          {firstItem}-{lastItem} de {filteredData.length} registros
        </span>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Pagina anterior"
            disabled={currentPage === 0}
            onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
            size="sm"
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="min-w-20 text-center">
            {currentPage + 1} / {pageCount}
          </span>
          <Button
            aria-label="Proxima pagina"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPageIndex((value) => Math.min(pageCount - 1, value + 1))}
            size="sm"
            variant="outline"
          >
            Proxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
