const fs = require("fs").promises;
const Path = require("path");
const ChildProcess = require("child_process");

const wasmDir = Path.resolve("node-test");

let reports = {};

fs.access(wasmDir)
  .catch(() => fs.mkdir(wasmDir))
  .then(() => fs.readdir(Path.resolve(process.argv[2]))) // Get topics
  .then(test_series => Promise.all(test_series.map(topic => fs.access(Path.join(wasmDir, topic))
    .catch(() => fs.mkdir(Path.join(wasmDir, topic)))
    .then(() => fs.readdir(Path.resolve(process.argv[2], topic)) // Get files inside topic directory
      .then(wats => wats.filter(path => path.endsWith(".wat") && !path.endsWith("_melformed.wat")).map(path => Path.join(topic, path))) // Filter .wat files
      .then(wats => Promise.all(wats.map(watFile => new Promise((resolve, reject) => {
        // Convert wat to wasm
        ChildProcess.spawn(Path.resolve("install-wabt", "bin", "wat2wasm"), [Path.resolve(process.argv[2], watFile)], {cwd: Path.join(wasmDir, topic)})
          .on("error", err => {
            console.error(`[ERROR] Cannot convert ${watFile} to wasm binary`);
            reject(err);
          }).on("exit", () => resolve(Path.join(wasmDir, watFile).replace(/\.wat$/, ".wasm")));
      })))
        .then(wasms => Promise.allSettled(wasms.filter(wasm => wasm.startsWith(Path.join(wasmDir, topic, "test_"))).map(wasmFile => new Promise((resolve, reject) => {
          // Run tests
          ChildProcess.fork(Path.resolve(__dirname, "node_test.js"), [wasmFile], {cwd: Path.dirname(wasmFile)})
            .on("error", reject)
            .on("message", result => {
              let pathMatch = wasmFile.match(/([^/]+)\/test_(\d+)_(\d+)_(\w+).wasm$/);
              let moduleName = pathMatch[2];
              let testId = parseInt(pathMatch[3]);
              if(!reports[topic]){
                reports[topic] = {};
              }
              if(!reports[topic][moduleName]){
                reports[topic][moduleName] = {};
              }
              reports[topic][moduleName][testId] = result;
            })
            .on("exit", resolve);
        })))))))))
  .then(() => {
    let passed = 0;
    let failed = 0;
    Object.keys(reports).forEach(topic => {
      console.log(`=== ${topic} ===`);
      Object.keys(reports[topic]).forEach(module => {
        console.log(`  module ${module}`);
        Object.keys(reports[topic][module]).sort((a, b) => a - b).forEach(testId => {
          console.log(`  * Case ${testId} --- ${(reports[topic][module][testId].passed) ? "PASS" : "FAILED"}`);
        });
      });
    });
    process.exit(failed);
  });