/*
 * Copyright 2020 luishsu. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
const fs = require("fs").promises;
const Path = require("path");

const {parse_block} = require("./parse");

// Extract models from wast file
fs.readFile(Path.resolve(process.argv[2]))
  .then(data => [...data.toString()])
  .then(parse_block)
  .then(blocks => fs.writeFile("output.json", JSON.stringify(blocks, null, "  ")))
  .catch(err => {
  // TODO: Correct stack to right position in wast
    console.log(err);
  });