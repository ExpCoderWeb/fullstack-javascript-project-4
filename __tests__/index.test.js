import { fileURLToPath } from 'node:url';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import nock from 'nock';
import htmlBeautify from 'html-beautify';
import { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import downloadPage from '../src/index.js';
import { transformHostname, transformPathname, getTargetAttribute } from '../src/utils.js';

nock.disableNetConnect();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getFixturePath = (name) => path.join(__dirname, '..', '__fixtures__', name);

const getUrlComponents = (url) => new URL(url);

const getUrlWithoutProtocol = (url) => {
  const [, urlWithoutProtocol] = url.split('//');
  return urlWithoutProtocol;
};

const getOutputPageName = (urlWithoutProtocol) => `${transformHostname(urlWithoutProtocol)}.html`;
const getOutputResourcesDirName = (urlWithoutProtocol) => `${transformHostname(urlWithoutProtocol)}_files`;

const processRscLocalLinks = (cheerioFn, url, rscDirName) => (rsc, linkComponents, localLinks) => {
  const { hostname: inputUrlHostname, origin: inputUrlOrigin } = new URL(url);
  const targetAttribute = getTargetAttribute(rsc);

  cheerioFn(rsc).each((_, element) => {
    const resourceLink = cheerioFn(element).attr(targetAttribute);
    const {
      hostname: rscHostname,
      pathname: rscPathname,
      search: rscSearch,
      href: rscHref,
    } = new URL(resourceLink, inputUrlOrigin);

    if (resourceLink && (url.includes(rscHostname) || resourceLink.includes(inputUrlHostname))) {
      const {
        origin: nockOrigin,
        pathname: nockPathname,
        search: nockSearch,
      } = new URL(rscHref);

      linkComponents.push([nockOrigin, nockPathname, nockSearch]);

      const transformedRscHostname = transformHostname(rscHostname);
      const transformedRscPathname = transformPathname(`${rscPathname}${rscSearch}`);
      const transformedRscLink = `${transformedRscHostname}${transformedRscPathname}`;

      const resourceLocalLink = path.join(rscDirName, transformedRscLink);

      localLinks.push(resourceLocalLink);
    }
  });
};

const nockLocalResources = (nockResourceLinkComponents, nockContent) => {
  nockResourceLinkComponents.forEach(([nockOrigin, nockPathname, nockSearch]) => {
    nock(nockOrigin)
      .get(`${nockPathname}${nockSearch}`)
      .reply(200, nockContent);
  });
};

const inputUrl = 'https://ru.hexlet.io/courses/';
const inputUrlUrlWithoutProtocol = getUrlWithoutProtocol(inputUrl);
const expectedOutputPageName = getOutputPageName(inputUrlUrlWithoutProtocol);
const expectedOutputResourcesDirName = getOutputResourcesDirName(inputUrlUrlWithoutProtocol);
const {
  origin: inputOrigin,
  pathname: inputPathname,
  search: inputSearch,
} = getUrlComponents(inputUrl);

let initialContent;
let expectedHtml;
let expectedImg;
let expectedLink;
let expectedScript;

let absoluteOutputDirPath;

beforeAll(async () => {
  initialContent = await fsp.readFile(getFixturePath('initialHTML.txt'), 'utf-8');
  expectedHtml = await fsp.readFile(getFixturePath('expectedHTML.txt'), 'utf-8');
  expectedImg = await fsp.readFile(getFixturePath('expectedImg.png'), 'utf-8');
  expectedLink = await fsp.readFile(getFixturePath('expectedLink.css'), 'utf-8');
  expectedScript = await fsp.readFile(getFixturePath('expectedScript.js'), 'utf-8');
});

beforeEach(async () => {
  absoluteOutputDirPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

describe('downloadPage main flow', () => {
  let absoluteOutputFilepath;
  let actualAbsoluteOutputFilepath;

  let imgLinkComponents;
  let linkLinkComponents;
  let scriptLinkComponents;

  let imgLocalLinks;
  let linkLocalLinks;
  let scriptLocalLinks;

  beforeEach(async () => {
    imgLinkComponents = [];
    linkLinkComponents = [];
    scriptLinkComponents = [];

    imgLocalLinks = [];
    linkLocalLinks = [];
    scriptLocalLinks = [];

    const $ = cheerio.load(initialContent);
    const processInputUrl = processRscLocalLinks($, inputUrl, expectedOutputResourcesDirName);
    processInputUrl('img', imgLinkComponents, imgLocalLinks);
    processInputUrl('link', linkLinkComponents, linkLocalLinks);
    processInputUrl('script', scriptLinkComponents, scriptLocalLinks);

    nockLocalResources(imgLinkComponents, expectedImg);
    nockLocalResources(linkLinkComponents, expectedLink);
    nockLocalResources(scriptLinkComponents, expectedScript);

    nock(inputOrigin)
      .get(`${inputPathname}${inputSearch}`)
      .reply(200, initialContent);

    absoluteOutputFilepath = path.join(absoluteOutputDirPath, expectedOutputPageName);
    actualAbsoluteOutputFilepath = await downloadPage(inputUrl, absoluteOutputDirPath);
  });

  it('should match the expected absolute filepath', async () => {
    expect(actualAbsoluteOutputFilepath).toBe(absoluteOutputFilepath);
  });

  it('should contain the expected output resources directory', async () => {
    const absoluteTestDirPathContent = await fsp.readdir(absoluteOutputDirPath);
    expect(absoluteTestDirPathContent).toContain(expectedOutputResourcesDirName);
  });

  it('should match the expected HTML', async () => {
    const actualHtml = await fsp.readFile(absoluteOutputFilepath, 'utf-8');
    const formattedExpectedHTML = htmlBeautify(expectedHtml);
    const formattedActualHTML = htmlBeautify(actualHtml);
    expect(formattedActualHTML).toBe(formattedExpectedHTML);
  });

  it('should be the expected resources', async () => {
    const actualImg = await fsp.readFile(path.join(absoluteOutputDirPath, imgLocalLinks[0]), 'utf-8');
    expect(actualImg).toBe(expectedImg);
    const actualLink = await fsp.readFile(path.join(absoluteOutputDirPath, linkLocalLinks[0]), 'utf-8');
    expect(actualLink).toBe(expectedLink);
    const actualScript = await fsp.readFile(path.join(absoluteOutputDirPath, scriptLocalLinks[0]), 'utf-8');
    expect(actualScript).toBe(expectedScript);
  });

  it('downloadPage with non-existent link', async () => {
    await expect(() => downloadPage('https://non-existent.com/', absoluteOutputDirPath)).rejects.toBeInstanceOf(AxiosError);
  });

  it('downloadPage with non-existent outputPath', async () => {
    await expect(() => downloadPage(inputUrl, '/non/existant')).rejects.toThrow("ENOENT: no such file or directory, access '/non/existant'");
  });

  it('downloadPage with no permission outputPath', async () => {
    await expect(() => downloadPage(inputUrl, '/home')).rejects.toThrow(`EACCES: permission denied, mkdir '/home/${expectedOutputResourcesDirName}'`);
  });

  it('downloadPage with already existing outputPath', async () => {
    await expect(() => downloadPage(inputUrl, absoluteOutputDirPath)).rejects.toThrow(`EEXIST: file already exists, mkdir '${path.join(absoluteOutputDirPath, expectedOutputResourcesDirName)}'`);
  });
});

describe('getTargetAttribute', () => {
  it('should throw the expected error', () => {
    expect(() => getTargetAttribute('div')).toThrow('Invalid resource - div');
  });
});

describe('transformPathname', () => {
  it('should be equal to the expected pathname', () => {
    expect(transformPathname('/assets/service.min.css?master-557bb553/')).toBe('-assets-service-min-css-master-557bb553.css');
  });
});
