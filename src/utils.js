import path from 'node:path';
import fsp from 'node:fs/promises';
import axios, { AxiosError } from 'axios';
import uniq from 'lodash/uniq.js';

const transformHostname = (hostname) => {
  const normalizedHostname = hostname.at(-1) === '/' ? hostname.slice(0, -1) : hostname;
  return normalizedHostname.replaceAll(/[^0-9a-zA-Z]/g, '-');
};

const transformPathname = (pathname) => {
  const normalizedPathname = pathname.at(-1) === '/' ? pathname.slice(0, -1) : pathname;
  const firstReplacedPathname = normalizedPathname.replaceAll(/[^0-9a-zA-Z]/g, '-');
  const extension = path.extname(pathname).slice(1);
  const [normalizedExtension] = extension.match(/^[a-z]*/);

  const regularExpWordEnd = new RegExp(`-${normalizedExtension}$`);
  const secondReplacedPathname = firstReplacedPathname.replace(regularExpWordEnd, `.${normalizedExtension}`);

  if (secondReplacedPathname.endsWith(`.${normalizedExtension}`)) {
    return secondReplacedPathname;
  }

  const result = extension === ''
    ? `${secondReplacedPathname}.html`
    : `${secondReplacedPathname}.${normalizedExtension}`;

  return result;
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

const isSameDomain = (inputUrl, assetUrl) => {
  const { hostname: inputUrlHostname, origin: inputUrlOrigin } = new URL(inputUrl);
  const { hostname: assetUrlHostname } = new URL(assetUrl, inputUrlOrigin);

  return inputUrl.includes(assetUrlHostname) || assetUrl.includes(inputUrlHostname);
};

const extractLocalAssets = (cheerioLoadedHtml, inputUrl, assetAttributes) => {
  const localAssets = [];

  Object.entries(assetAttributes)
    .forEach(([tag, urlAttribute]) => {
      cheerioLoadedHtml(tag).each((_, element) => {
        const assetUrl = cheerioLoadedHtml(element).attr(urlAttribute);
        localAssets.push({ element, tag, assetUrl });
      });
    });

  return localAssets
    .filter(({ assetUrl }) => assetUrl !== undefined && isSameDomain(inputUrl, assetUrl));
};

const getTransformedLocalLinks = (inputUrl, localAssets, outputAssetsDirName) => {
  const result = [];
  const { origin: inputUrlOrigin } = new URL(inputUrl);

  localAssets.forEach(({ assetUrl }) => {
    const {
      hostname: assetHostname,
      pathname: assetPathname,
      search: assetSearch,
    } = new URL(assetUrl, inputUrlOrigin);

    const transformedAssetHostname = transformHostname(assetHostname);
    const transformedAssetPathname = transformPathname(`${assetPathname}${assetSearch}`);
    const transformedAssetLink = `${transformedAssetHostname}${transformedAssetPathname}`;

    const newAssetLink = path.join(outputAssetsDirName, transformedAssetLink);
    result.push(newAssetLink);
  });

  return result;
};

const getLinksAndFilepaths = (inputUrl, assets, transformedLinks, outputDirPath) => {
  const result = [];
  const { origin: inputUrlOrigin } = new URL(inputUrl);

  assets.forEach(({ assetUrl }, index) => {
    const absoluteAssetUrl = new URL(assetUrl, inputUrlOrigin).toString();
    const filepath = path.join(outputDirPath, transformedLinks[index]);
    result.push([absoluteAssetUrl, filepath]);
  });

  return uniq(result);
};

const replaceLocalLinks = (cheerioLoadedHtml, localAssets, localLinks, assetAttributes) => {
  localAssets.forEach(({ element, tag }, index) => {
    cheerioLoadedHtml(element).attr(assetAttributes[tag], localLinks[index]);
  });
};

const downloadAsset = (url, filepath) => axios.get(url, { responseType: 'arraybuffer' })
  .then(({ data }) => fsp.writeFile(filepath, data))
  .catch((error) => {
    throw error;
  });

export {
  transformHostname,
  transformPathname,
  handleError,
  extractLocalAssets,
  getTransformedLocalLinks,
  replaceLocalLinks,
  getLinksAndFilepaths,
  downloadAsset,
};
