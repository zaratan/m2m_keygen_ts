import {
  parseQueryToParams,
  translateParamsToQuery,
} from './helpers/paramsEncoder';
import { sign } from './signature';

export const generateFetcher =
  ({
    fetcher,
    secret,
    algorithm = 'sha512',
    headerName = 'X-Signature',
  }: {
    fetcher: (entry: any, init?: any) => any;
    secret: string;
    algorithm?: string;
    headerName?: string;
  }) =>
  (entry: string, params: any = {}, init?: any) => {
    if (!init) init = {};
    const headers: { [key: string]: string } = { ...init.headers };
    const path = entry.replace(/^(.*\/\/)?[^/]+/, '');

    params.expiry ||= Math.round(Number(new Date()) / 1000) + 90;

    const isGet = !init.method || init.method.toUpperCase() === 'GET';

    if (isGet) {
      const query = translateParamsToQuery(params);
      const signedParams = parseQueryToParams(query);
      headers[headerName] = sign({
        secret,
        algorithm,
        params: signedParams,
        verb: 'GET',
        path,
      });
      entry = `${entry}${query}`;
    } else {
      headers[headerName] = sign({
        secret,
        algorithm,
        params: params,
        verb: init.method.toUpperCase(),
        path,
      });
    }

    headers['Accept'] ||= 'application/json';

    if (!isGet) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(params);
    }

    init.headers = headers;

    return fetcher(entry, init);
  };
