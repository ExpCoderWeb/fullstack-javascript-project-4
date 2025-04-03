import path from 'node:path';
import { AxiosError } from 'axios';

const transformHostname = (hostname) => {
  const normalizedHostname = hostname.at(-1) === '/' ? hostname.slice(0, -1) : hostname;
  return normalizedHostname.replaceAll(/[^0-9a-zA-Z]/g, '-');
};

const transformPathname = (pathname) => {
  const normalizedPathname = pathname.at(-1) === '/' ? pathname.slice(0, -1) : pathname;
  const extension = path.extname(pathname).slice(1);
  const [normalizedExtension] = extension.match(/^[a-z]*/);
  const firstReplacedPathname = normalizedPathname.replaceAll(/[^0-9a-zA-Z]/g, '-');

  const regularExpWordEnd = new RegExp(`-${normalizedExtension}$`);
  const secondReplacedPathname = firstReplacedPathname.replace(regularExpWordEnd, `.${normalizedExtension}`);

  if (secondReplacedPathname.endsWith(`.${normalizedExtension}`)) {
    return secondReplacedPathname;
  }

  const result = extension === '' ? `${secondReplacedPathname}.html` : `${secondReplacedPathname}.${normalizedExtension}`;

  return result;
};

const getTargetAttribute = (resource) => {
  switch (resource) {
    case 'img':
    case 'script':
      return 'src';
    case 'link':
      return 'href';
    default:
      throw new Error(`Invalid resource - ${resource}`);
  }
};

const handleError = (error) => {
  if (error.name === 'Error') {
    console.error(`System error: ${error.message}`);
  } else if (error instanceof AxiosError) {
    if (error.response && error.response.status !== 200) {
      console.error(`Axios error: The request was made and the server responded with a status code ${error.response.status}`);
    } else if (error.request) {
      console.error('Axios error: The request was made but no response was received');
    } else {
      console.error('Axios error: Something happened in setting up the request that triggered an error');
    }
  } else {
    console.error(`Unknown error: ${error.message}`);
  }
};

export {
  transformHostname,
  transformPathname,
  getTargetAttribute,
  handleError,
};
