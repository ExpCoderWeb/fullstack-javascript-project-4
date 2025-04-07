### Hexlet tests and linter status:
[![Actions Status](https://github.com/ExpCoderWeb/fullstack-javascript-project-4/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/ExpCoderWeb/fullstack-javascript-project-4/actions) [![lint-and-test](https://github.com/ExpCoderWeb/fullstack-javascript-project-4/actions/workflows/test-and-lint.yml/badge.svg)](https://github.com/ExpCoderWeb/fullstack-javascript-project-4/actions/workflows/test-and-lint.yml)

[![Maintainability](https://api.codeclimate.com/v1/badges/766bd64177edba945156/maintainability)](https://codeclimate.com/github/ExpCoderWeb/fullstack-javascript-project-4/maintainability) [![Test Coverage](https://api.codeclimate.com/v1/badges/766bd64177edba945156/test_coverage)](https://codeclimate.com/github/ExpCoderWeb/fullstack-javascript-project-4/test_coverage)

### Overview

**"PageLoader"** is a command line utility that downloads a page from the Internet and saves it on a computer. Besides the page itself (html), application downloads all its local assets (images, styles, and js), allowing one to open the page without the Internet.

### Minimal system requirements:
- Unix terminal
- Node.js: version from 18.x

### Utility setup
1. Clone the repo with the following command:
```bash
git clone git@github.com:ExpCoderWeb/fullstack-javascript-project-4.git
```
2. Enter the root directory of the package with the command:
```bash
cd fullstack-javascript-project-4
```
3. Install the necessary dependencies with the command:
```bash
npm ci
```
4. Create a symbolic link to the package in order to make the utility to run from any directory of the system using the command: 
```bash
npm link
```

### Usage
```bash
Usage: page-loader [options] <url>

Page loader utility

Options:
  -V, --version      output the version number
  -o --output [dir]  output dir (default: "/home/user/current-dir")
  -h, --help         display help for command
```
Program can handle both absolute and relative output directory paths. By default, an output directory is a current working one. 
Unsuccessful asset downloads or writes to the system are acceptable and will not cause the program to stop.

### Demonstration

#### 1. Normal working:
[![asciicast](https://asciinema.org/a/kpxmhQ2EvK3uGw5arphtLd55N.svg)](https://asciinema.org/a/kpxmhQ2EvK3uGw5arphtLd55N)

#### 2. Errors appearance:
[![asciicast](https://asciinema.org/a/zF4O56fxAmTc07K86ahU7mQGd.svg)](https://asciinema.org/a/zF4O56fxAmTc07K86ahU7mQGd)