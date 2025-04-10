import fsp from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
import axiosDebugLog from 'axios-debug-log';
import debug from 'debug';
import Listr from 'listr';
import * as cheerio from 'cheerio';
import {
  transformHostname,
  extractLocalAssets,
  getDownloadLinksAndFilepaths,
  getTransformedLocalLinks,
  replaceLocalLinks,
  downloadAsset,
} from './utils.js';

axiosDebugLog(axios);
const log = debug('page-loader');

const assetAttributes = {
  img: 'src',
  script: 'src',
  link: 'href',
};

const downloadPage = (inputUrl, outputDirPath = process.cwd()) => {
  const [, urlWithoutProtocol] = inputUrl.split('//');

  const outputPageName = `${transformHostname(urlWithoutProtocol)}.html`;
  const outputAssetsDirName = `${transformHostname(urlWithoutProtocol)}_files`;

  const absoluteOutputDirPath = path.resolve(process.cwd(), outputDirPath);
  const absolutePagePath = path.join(absoluteOutputDirPath, outputPageName);
  const absoluteAssetsDirPath = path.join(absoluteOutputDirPath, outputAssetsDirName);

  let downloadLinksAndFilepaths;

  log('Starting...');

  return fsp.access(absoluteOutputDirPath)
    .then(() => {
      log(`Requesting the target page: ${inputUrl}`);
      return axios.get(inputUrl);
    })
    .then(({ data }) => {
      log('Html has been received');

      const $ = cheerio.load(data);
      const localAssets = extractLocalAssets($, inputUrl, assetAttributes);
      const transformedLocalLinks = getTransformedLocalLinks(inputUrl, localAssets, outputAssetsDirName);
      downloadLinksAndFilepaths = getDownloadLinksAndFilepaths(inputUrl, localAssets, transformedLocalLinks, absoluteOutputDirPath);
      replaceLocalLinks($, localAssets, transformedLocalLinks, assetAttributes);

      log('Assets and html have been processed');
      log('Html is being written');
      return fsp.writeFile(absolutePagePath, $.html());
    })
    .then(() => {
      log('Assets directory is being prepared');
      return fsp.mkdir(absoluteAssetsDirPath);
    })
    .then(() => {
      log('Waiting for assets dowloading');

      const tasks = downloadLinksAndFilepaths.map(([url, filepath]) => ({
        title: url,
        task: () => downloadAsset(url, filepath),
      }));
      const listrTasks = new Listr(tasks, { concurrent: true, exitOnError: false });

      return listrTasks.run().catch(() => {});
    })
    .then(() => {
      log('Success');
      return absolutePagePath;
    });
};

export default downloadPage;
