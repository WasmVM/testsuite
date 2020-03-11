/*
 * Copyright 2020 luishsu. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
const fs = require("fs").promises;
const Path = require("path");

const {parse_block} = require("./parse");

let generatedDir = Path.resolve(
  __dirname,
  "build",
  Path.basename(process.argv[2]),
);
generatedDir = generatedDir.substring(0, generatedDir.length - Path.extname(process.argv[2]).length);

fs.access(Path.resolve(__dirname, "build"))
  .catch(() => fs.mkdir(Path.resolve(__dirname, "build")))
  .then(() => fs.access(generatedDir))
  .catch(() => fs.mkdir(generatedDir));

// Extract models from wast file
fs.readFile(Path.resolve(process.argv[2]))
  .then(data => [...data.toString()])
  .then(parse_block)
  .then(blocks => Promise.all(blocks.map((block, index) => fs.writeFile(
    Path.resolve(generatedDir, `module_${index}.wat`),
    block.expand(),
  ).then(() => Promise.all(block.assertions.map(assertion => assertion.expand(
    `module_${index}`,
  )))).then(testCases => Promise.all(testCases.map((testCase, testId) => fs.writeFile(
    Path.join(generatedDir, `test_${index}_${testId}_${testCase.expect}.wat`),
    testCase.content,
  )))))))
  .catch(err => {
    console.log(err);
  });