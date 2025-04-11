import {
  describe,
  beforeAll,
  beforeEach,
  it,
  expect,
} from '@jest/globals';
import { fileURLToPath } from 'node:url';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import nock from 'nock';
import htmlBeautify from 'html-beautify';
import { AxiosError } from 'axios';
import downloadPage from '../src/index.js';
import { transformPathname } from '../src/utils.js';

nock.disableNetConnect();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getFixturePath = (name) => path.join(__dirname, '..', '__fixtures__', name);

const inputUrl = 'https://ru.hexlet.io/courses/';
const expectedOutputPageName = 'ru-hexlet-io-courses.html';
const expectedAssetsDirName = 'ru-hexlet-io-courses_files';
const {
  origin: inputOrigin,
  pathname: inputPathname,
  search: inputSearch,
} = new URL(inputUrl);

let initialHtml;
let expectedHtml;
let expectedImg;
let expectedLink;
let expectedScript;

beforeAll(async () => {
  initialHtml = await fsp.readFile(getFixturePath('initialHTML.txt'), 'utf-8');
  expectedHtml = await fsp.readFile(getFixturePath('expectedHTML.txt'), 'utf-8');
  expectedImg = await fsp.readFile(getFixturePath('expectedImg.png'), 'utf-8');
  expectedLink = await fsp.readFile(getFixturePath('expectedLink.css'), 'utf-8');
  expectedScript = await fsp.readFile(getFixturePath('expectedScript.js'), 'utf-8');

  nock(inputOrigin)
    .persist()
    .get(`${inputPathname}${inputSearch}`)
    .reply(200, initialHtml)
    .get('/assets/application.css')
    .reply(200, expectedLink)
    .get('/courses')
    .reply(200, initialHtml)
    .get('/assets/professions/nodejs.png')
    .reply(200, expectedImg)
    .get('/packs/js/runtime.js')
    .reply(200, expectedScript);
});

let absoluteDirPath;

beforeEach(async () => {
  absoluteDirPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

describe('downloadPage main flow', () => {
  let absolutePagePath;
  let actualAbsolutePagePath;

  beforeEach(async () => {
    absolutePagePath = path.join(absoluteDirPath, expectedOutputPageName);
    actualAbsolutePagePath = await downloadPage(inputUrl, absoluteDirPath);
  });

  it('should match the expected absolute filepath', async () => {
    expect(actualAbsolutePagePath).toBe(absolutePagePath);
  });

  it('should contain the expected output resources directory', async () => {
    const outputDirContent = await fsp.readdir(absoluteDirPath);
    expect(outputDirContent).toContain(expectedAssetsDirName);
  });

  it('should match the expected HTML', async () => {
    const actualHtml = await fsp.readFile(absolutePagePath, 'utf-8');
    const formattedExpectedHTML = htmlBeautify(expectedHtml);
    const formattedActualHTML = htmlBeautify(actualHtml);
    expect(formattedActualHTML).toBe(formattedExpectedHTML);
  });

  it('should be the expected resources', async () => {
    const actualImg = await fsp.readFile(path.join(absoluteDirPath, expectedAssetsDirName, 'ru-hexlet-io-assets-professions-nodejs.png'), 'utf-8');
    expect(actualImg).toBe(expectedImg);
    const actualLink = await fsp.readFile(path.join(absoluteDirPath, expectedAssetsDirName, 'ru-hexlet-io-assets-application.css'), 'utf-8');
    expect(actualLink).toBe(expectedLink);
    const actualScript = await fsp.readFile(path.join(absoluteDirPath, expectedAssetsDirName, 'ru-hexlet-io-packs-js-runtime.js'), 'utf-8');
    expect(actualScript).toBe(expectedScript);
  });
});

describe('downloadPage with errors', () => {
  it('downloadPage with non-existent link', async () => {
    await expect(() => downloadPage('https://non-existent.com/', absoluteDirPath)).rejects.toBeInstanceOf(AxiosError);
  });

  it('downloadPage with non-existent outputPath', async () => {
    await expect(() => downloadPage(inputUrl, '/non/existant')).rejects.toThrow("ENOENT: no such file or directory, access '/non/existant'");
  });

  it('downloadPage with no permission outputPath', async () => {
    await expect(() => downloadPage(inputUrl, '/home')).rejects.toThrow("EACCES: permission denied, open '/home/ru-hexlet-io-courses.html'");
  });

  it('downloadPage with already existing outputPath', async () => {
    await downloadPage(inputUrl, absoluteDirPath);
    await expect(() => downloadPage(inputUrl, absoluteDirPath)).rejects.toThrow(`EEXIST: file already exists, mkdir '${path.join(absoluteDirPath, expectedAssetsDirName)}'`);
  });
});

describe('transformPathname', () => {
  it('should be equal to the expected pathname', () => {
    expect(transformPathname('/assets/service.min.css?master-557bb553/')).toBe('-assets-service-min-css-master-557bb553.css');
  });
});
