/*
 * Copyright 2020 luishsu. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
const fs = require("fs").promises;
const Path = require("path");

const {parse_block} = require("./parse");
const {Module} = require("./types");

let generatedDir = Path.resolve(
  "build",
  Path.basename(process.argv[2]),
);
generatedDir = generatedDir.substring(0, generatedDir.length - Path.extname(process.argv[2]).length);

fs.access(Path.resolve("build"))
  .catch(() => fs.mkdir(Path.resolve("build")))
  .then(() => fs.access(generatedDir))
  .catch(() => fs.mkdir(generatedDir));

// Extract models from wast file
fs.readFile(Path.resolve(process.argv[2]))
  .then(data => data.toString())
  .then(parse_block)
  .then(blocks => Promise.all(blocks.map((block, index) => {
    let module = block.expand();
    if(block instanceof Module){
      let moduleName = (block.register) ? block.register.name : `test_module_${index}`;
      return fs.writeFile(
        Path.resolve(generatedDir, `${moduleName}.${(module instanceof Buffer) ? "wasm" : "wat"}`),
        module,
      ).then(() => Promise.all(block.assertions.map(assertion => assertion.expand(moduleName))))
        .then(testCases => Promise.all(testCases.map((testCase, testId) => fs.writeFile(
          Path.join(generatedDir, `test_${index}_${testId}_${testCase.expect}.${(testCase.content instanceof Buffer) ? "wasm" : "wat"}`),
          testCase.content,
        ))));
    }else{
      return fs.writeFile(
        Path.resolve(generatedDir, `test_module_${index}_${module.expect}.${(module.content instanceof Buffer) ? "wasm" : "wat"}`),
        module.content,
      );
    }
  })))
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.log(err);
    process.exit(-1);
  });