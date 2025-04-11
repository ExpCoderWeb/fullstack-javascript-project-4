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
  getLinksAndFilepaths,
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
  const assetsDirName = `${transformHostname(urlWithoutProtocol)}_files`;

  const absoluteDirPath = path.resolve(process.cwd(), outputDirPath);
  const absolutePagePath = path.join(absoluteDirPath, outputPageName);
  const absoluteAssetsDirPath = path.join(absoluteDirPath, assetsDirName);

  let downloadLinksAndFilepaths;

  log('Starting...');

  return fsp.access(absoluteDirPath)
    .then(() => {
      log(`Requesting the target page: ${inputUrl}`);
      return axios.get(inputUrl);
    })
    .then(({ data }) => {
      log('Html has been received');

      const $ = cheerio.load(data);
      const assets = extractLocalAssets($, inputUrl, assetAttributes);
      const links = getTransformedLocalLinks(inputUrl, assets, assetsDirName);
      downloadLinksAndFilepaths = getLinksAndFilepaths(inputUrl, assets, links, absoluteDirPath);
      replaceLocalLinks($, assets, links, assetAttributes);

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
