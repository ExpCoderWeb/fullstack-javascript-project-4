import fsp from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
import axiosDebugLog from 'axios-debug-log';
import debug from 'debug';
import Listr from 'listr';
import * as cheerio from 'cheerio';
import {
  transformHostname,
  transformPathname,
  getTargetAttribute,
  handleError,
} from './utils.js';

axiosDebugLog(axios);
const log = debug('page-loader');

const downloadPage = (url, outputPath = process.cwd()) => {
  const { hostname: inputUrlHostname, origin: inputUrlOrigin } = new URL(url);
  const [, urlWithoutProtocol] = url.split('//');

  const outputPageName = `${transformHostname(urlWithoutProtocol)}.html`;
  const outputResourcesDirName = `${transformHostname(urlWithoutProtocol)}_files`;

  const absoluteOutputDirPath = path.resolve(process.cwd(), outputPath);
  const absoluteOutputFilepath = path.join(absoluteOutputDirPath, outputPageName);
  const outputResourcesDirPath = path.join(absoluteOutputDirPath, outputResourcesDirName);

  const localRscHrefsAndFilepaths = [];
  const downloadedRscsAndFilepaths = [];

  const processResource = (cheerioMainFn, resource) => {
    const targetAttribute = getTargetAttribute(resource);

    cheerioMainFn(resource).each((_, element) => {
      const resourceLink = cheerioMainFn(element).attr(targetAttribute);
      const {
        hostname: rscHostname,
        pathname: rscPathname,
        search: rscSearch,
        href: rscHref,
      } = new URL(resourceLink, inputUrlOrigin);

      if (resourceLink && (url.includes(rscHostname) || resourceLink.includes(inputUrlHostname))) {
        const transformedRscHostname = transformHostname(rscHostname);
        const transformedRscPathname = transformPathname(`${rscPathname}${rscSearch}`);
        const transformedRscLink = `${transformedRscHostname}${transformedRscPathname}`;

        const resourceLocalLink = path.join(outputResourcesDirName, transformedRscLink);
        cheerioMainFn(element).attr(targetAttribute, resourceLocalLink);

        const absoluteOutputRscFilepath = path.join(outputResourcesDirPath, transformedRscLink);
        localRscHrefsAndFilepaths.push([rscHref, absoluteOutputRscFilepath]);
      }
    });
  };

  const resourcesWritingErrors = [];

  log('Starting...');
  log('Output directory is being prepared');

  return fsp.mkdir(absoluteOutputDirPath, { recursive: true })
    .then(() => {
      log('Resources directory is being created');
      return fsp.mkdir(outputResourcesDirPath);
    })
    .then(() => {
      log(`Requesting the target page: ${url}`);
      return axios.get(url);
    })
    .then(({ data }) => {
      log('Html has been received');
      const $ = cheerio.load(data);
      processResource($, 'img');
      processResource($, 'link');
      processResource($, 'script');
      log('Resources and html have been processed');
      return $.html();
    })
    .then((processedHtml) => {
      log('Html is being written');
      return fsp.writeFile(absoluteOutputFilepath, processedHtml);
    })
    .then(() => {
      log('Waiting for resources dowloading');

      const uniqueHrefsAndFilepaths = localRscHrefsAndFilepaths.reduce((acc, item) => {
        const [currentHref] = item;
        if (!acc.some(([href]) => href === currentHref)) {
          acc.push(item);
        }

        return acc;
      }, []);

      const tasks = uniqueHrefsAndFilepaths.map(([rscHref, filepath]) => ({
        title: rscHref,
        task: () => axios.get(rscHref, { responseType: 'arraybuffer' })
          .then(({ data }) => downloadedRscsAndFilepaths.push([filepath, data]))
          .catch((error) => {
            throw error;
          }),
      }));

      const listrTasks = new Listr(tasks, { concurrent: true, exitOnError: false });

      return listrTasks.run().catch(() => {});
    })
    .then(() => {
      log('fsp.writeFile resources mapping');
      return downloadedRscsAndFilepaths.map(([filepath, rsc]) => fsp.writeFile(filepath, rsc)
        .catch((error) => resourcesWritingErrors.push(error)));
    })
    .then((resourcePromisesToWrite) => {
      log('Waiting for resources writing');
      return Promise.all(resourcePromisesToWrite);
    })
    .then(() => resourcesWritingErrors.forEach((error) => {
      handleError(error);
    }))
    .then(() => {
      log('Success');
      return absoluteOutputFilepath;
    });
};

export default downloadPage;
