interface ISuccessResponse<TData> {
  status: 'success';
  data: TData;
  message?: string;
  page?: number;
  limit?: number;
  total?: number;
}
interface IData<TData> {
  data: TData;
  message?: string;
  page?: number;
  limit?: number;
  total?: number;
}
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

  if (res.page !== undefined) {
    response.page = res.page;
  }

  if (res.limit !== undefined) {
    response.limit = res.limit;
  }

  if (res.total !== undefined) {
    response.total = res.total;
  }

  return response;
};
