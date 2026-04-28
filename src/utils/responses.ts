interface PaginationLinks {
  self: string;
  next: string | null;
  prev: string | null;
}

interface ISuccessResponse<TData> {
  status: 'success';
  page?: number;
  limit?: number;
  total?: number;
  total_pages?: number;
  links?: PaginationLinks;
  message?: string;
  data: TData;
}

interface IData<TData> {
  data: TData;
  message?: string;
  page?: number;
  limit?: number;
  total?: number;
  requestPath?: string;
}

const buildPaginationLinks = (
  requestPath: string,
  page: number,
  limit: number,
  total: number,
): PaginationLinks => {
  const totalPages = Math.ceil(total / limit);
  const [baseUrl, queryString] = requestPath.split('?');

  const buildUrl = (pageNum: number): string => {
    const params = new URLSearchParams(queryString || '');
    params.set('page', pageNum.toString());
    params.set('limit', limit.toString());
    return `${baseUrl}?${params.toString()}`;
  };

  const self = buildUrl(page);
  const next = page < totalPages ? buildUrl(page + 1) : null;
  const prev = page > 1 ? buildUrl(page - 1) : null;

  return { self, next, prev };
};

export const successResponse = <TData>(
  res: IData<TData>,
): ISuccessResponse<TData> => {
  const response: ISuccessResponse<TData> = {
    status: 'success',
    data: res.data,
  };

  if (res.message !== undefined) {
    response.message = res.message;
  }

  if (
    res.page !== undefined &&
    res.limit !== undefined &&
    res.total !== undefined
  ) {
    response.page = res.page;
    response.limit = res.limit;
    response.total = res.total;
    response.total_pages = Math.ceil(res.total / res.limit);

    if (res.requestPath !== undefined) {
      response.links = buildPaginationLinks(
        res.requestPath,
        res.page,
        res.limit,
        res.total,
      );
    }
  }

  return response;
};
