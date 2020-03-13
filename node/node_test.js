const fs = require("fs").promises;
const Path = require("path");

const expected = process.argv[2].match(/([^/]+)\/test_(\d+)_(\d+)_(\w+).wasm$/)[4];

const moduleDir = Path.dirname(process.argv[2]);
const moduleName = Path.basename(process.argv[2].replace(/\.wasm/, ""));

function instantiate(name, module){
  let exports = {};
  let moduleImport = WebAssembly.Module.imports(module);
  return Promise.all(moduleImport.map(importInstance => {
    if(!exports[importInstance.module] || !exports[importInstance.module][importInstance.name]){
      return fs.readFile(Path.join(moduleDir, importInstance.module.endsWith(".wasm") ? importInstance.module : importInstance.module + ".wasm"))
        .then(WebAssembly.compile)
        .then(instantiate.bind(this, importInstance.module))
        .then(imports => {
          Object.assign(exports, imports);
        });
    }else{
      return true;
    }
  }))
    .then(() => WebAssembly.instantiate(module, exports))
    .then(moduleInst => {
      exports[name] = moduleInst.exports;
      return exports;
    })
    .catch(error => {
      if(expected == "valid"){
        process.send({
          passed: false,
          reason: error.message,
        }, err => {
          if(err){
            reject(err);
          }else{
            process.exit(0);
          }
        });
      }else{
        if(expected == "trap" || expected == "exhaustion"){
          process.send({
            passed: true,
          }, err => {
            if(err){
              reject(err);
            }else{
              process.exit(0);
            }
          });
        }else{
          process.send({
            passed: false,
            reason: error.message,
          }, err => {
            if(err){
              reject(err);
            }else{
              process.exit(0);
            }
          });
        }
      }
    });
}

fs.readFile(process.argv[2])
  .then(binary => new Promise((resolve, reject) => { // Validate
    let isValid = WebAssembly.validate(binary);
    if(expected != "invalid" && isValid){
      resolve(binary);
    }else if(expected == "invalid"){
      if(isValid){
        process.send({
          passed: false,
          reason: "Expected invalid module but got valid one",
        }, err => {
          if(err){
            reject(err);
          }else{
            process.exit(0);
          }
        });
      }else{
        process.send({passed: true}, err => {
          if(err){
            reject(err);
          }else{
            process.exit(0);
          }
        });
      }
    }else{
      process.send({
        passed: false,
        reason: "Invalid module",
      }, err => {
        if(err){
          reject(err);
        }else{
          process.exit(0);
        }
      });
    }
  }))
  .catch(console.error)
  .then(WebAssembly.compile) // Compile module to get imports
  .then(instantiate.bind(this, moduleName)) // Instantiate
  .then(exported => new Promise((_, reject) => {
    try{
      exported[moduleName].main();
      if(expected == "valid"){
        process.send({
          passed: true,
        }, err => {
          if(err){
            reject(err);
          }else{
            process.exit(0);
          }
        });
      }else{
        process.send({
          passed: false,
          reason: `Expect ${expected} but finished running`,
        }, err => {
          if(err){
            reject(err);
          }else{
            process.exit(0);
          }
        });
      }
    }catch(error){
      if(expected == "valid"){
        process.send({
          passed: false,
          reason: error.message,
        }, err => {
          if(err){
            reject(err);
          }else{
            process.exit(0);
          }
        });
      }else{
        if(expected == "trap" || expected == "exhaustion"){
          process.send({
            passed: true,
          }, err => {
            if(err){
              reject(err);
            }else{
              process.exit(0);
            }
          });
        }else{
          process.send({
            passed: false,
            reason: error.message,
          }, err => {
            if(err){
              reject(err);
            }else{
              process.exit(0);
            }
          });
        }
      }
    }
  }));