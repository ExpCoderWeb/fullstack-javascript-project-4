import path from 'node:path';

const transformHostname = (hostname) => hostname.replaceAll(/[^0-9a-zA-Z]/g, '-');

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

export { transformHostname, transformPathname, getTargetAttribute };
