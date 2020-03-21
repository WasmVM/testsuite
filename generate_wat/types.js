class Module{
  constructor(block){
    this.assertions = [];
    this.block = block;
    this.isBinary = false;
    let name = this.block.match(/^\(\s*module\s+(\$[\w_\.\+\-*\/\\^~=<>!\?\|@#\$%&:'`]+)/);
    this.name = (name !== null) ? name[1] : null;
  }

  expand(){
    let result = null;
    let moduleMatch = this.block.match(/^\(\s*module(\s+\$[\w_\.\+\-*\/\\^~=<>!\?\|@#\$%&:'`]+)?(\s+binary|\squote)?/);
    if(moduleMatch[2] && moduleMatch[2].trim() == "binary"){
      this.isBinary = true;
      this.name = moduleMatch[1] ? moduleMatch[1].trim() : null;
      let binaryModule = this.block.substring(moduleMatch[0].length).trim()
        .match(/"(\\"|\s|[^"])*"/g)
        .reduce((res, stmt) => res + stmt.substring(1, stmt.length - 1), "")
        .match(/(\\\\|\\\d\d|[^\\])/g);
      if(binaryModule != null){
        let buffer = Buffer.alloc(binaryModule.length);
        binaryModule.forEach((byte, index) => {
          if(byte == "\\\\"){
            buffer.write("\\", index);
          }else if(byte.startsWith("\\")){
            buffer.writeUInt8(parseInt(byte.substring(1), 16), index);
          }else{
            buffer.write(byte, index);
          }
        });
        result = buffer;
      }else{
        result = Buffer.alloc(0);
      }
    }else{
      if(typeof(moduleMatch[2]) == "undefined"){
        result = this.block;
      }else if(moduleMatch[2] && moduleMatch[2].trim() == "quote"){
        let quotedModule = this.block.replace(/^\(\s*module\s+/, "").trim().match(/"(\\"|\s|[^"])*"/g);
        result = "(module ";
        result += quotedModule.reduce((res, stmt) => res + stmt.substring(1, stmt.length - 1), "");
        result += "\n)";
      }
    }
    return result;
  }
}
module.exports.Module = Module;

class Register{
  constructor(block){
    let registerMatch = block.trim().match(/^\(\s*register\s+"((\\"|[^"])*)"\s+(\$[\w_\.\+\-*\/\\^~=<>!\?\|@#\$%&:'`]+)\s*\)$/);
    this.name = registerMatch[1];
    this.module = registerMatch[3];
  }
}
module.exports.Register = Register;

class Assertion{
  expand(){
    throw new TypeError("Expand should be implemented in assertion");
  }
}

class AssertReturn extends Assertion{
  constructor(block){
    super();
    block = block.replace(/^\(\s*assert_return\s+/, "").replace(/\)\s*$/, "");
    let resultStr = block.substring(getFirstBalancedBlock(block).length).trim();
    this.results = [];
    while(resultStr){
      let result = getFirstBalancedBlock(resultStr.trim());
      if(result){
        this.results.push(result.trim());
        resultStr = resultStr.substring(result.length + 1);
      }else{
        break;
      }
    }
    this.action = getAction(block, this.results);
  }

  expand(moduleName){
    if(this.action instanceof Invoke){
      let invokeExpand = this.action.expand(moduleName);
      return {
        expect : "return",
        content: `;; (assert_return (invoke "${this.action.func}") (result ${this.results.reduce((str, result) => str + " " + result, "")})\n` +
          this.results.reduce((str, result) => str + result.substring(1, result.length - 1) + "\n" +
            `    ${result.substring(1, 4)}.ne\n` +
            "    if\n" +
            "      unreachable\n" +
            "    end\n",
          "(module \n" +
          "  " + invokeExpand.prologue + "\n" +
          "  (memory 1)\n  (start $main)\n" +
          "  (func $main (export \"main\")\n" +
          "    " + invokeExpand.content.replace(/\n/g, "\n    ") + "\n    ") +
          "  )\n" +
          ")\n",
      };
    }else if(this.action instanceof Get){
      return this.action.expand(moduleName);
    }
    throw new TypeError("Unsupported action in AssertReturn");
  }
}
module.exports.AssertReturn = AssertReturn;

class AssertTrap extends Assertion{
  constructor(block){
    super();
    block = block.replace(/^\(\s*assert_trap\s+/, "").replace(/\)\s*$/, "");
    this.action = getAction(block, []);
    this.failure = block.match(/"((\\"|[^"])*)"\s*$/);
    if(this.failure != null){
      this.failure = this.failure[1];
    }else{
      throw SyntaxError("Expect failure string in assert_trap");
    }
  }

  expand(moduleName){
    if(this.action instanceof Invoke){
      let invokeExpand = this.action.expand(moduleName);
      return {
        expect : "trap",
        content: `;; (assert_trap (invoke "${this.action.func}") "${this.failure}"\n` +
        "(module \n" +
        "  " + invokeExpand.prologue + "\n" +
        "  (memory 1)\n  (start $main)\n" +
        "  (func $main (export \"main\")\n" +
        `    ${invokeExpand.content.replace(/\n/g, "\n    ")}\n` +
        "  )\n" +
        ")\n",
      };
    }else if(this.action instanceof Get){
      return this.action.expand(moduleName);
    }
    throw new TypeError("Unsupported action in AssertTrap");
  }
}
module.exports.AssertTrap = AssertTrap;

class AssertMalformed extends Assertion{
  constructor(block){
    super();
    this.module = new Module(getFirstBalancedBlock(block.replace(/^\(\s*assert_malformed\s+/, "")));
    this.failure = block.match(/"((\\"|[^"])*)"\s*\)\s*$/);
    if(this.failure != null){
      this.failure = this.failure[1];
    }else{
      throw SyntaxError("Expect failure string in assert_malformed");
    }
  }

  expand(){
    let expanded = this.module.expand();
    let header = `;; (assert_melformed "${this.failure}")\n`;
    return {
      expect : "malformed",
      content: (expanded instanceof Buffer) ? Buffer.concat([Buffer.from(header), expanded]) : header + expanded,
    };
  }
}
module.exports.AssertMalformed = AssertMalformed;

class AssertInvalid extends Assertion{
  constructor(block){
    super();
    this.module = new Module(getFirstBalancedBlock(block.replace(/^\(\s*assert_invalid\s+/, "")));
    this.failure = block.match(/"((\\"|[^"])*)"\s*\)\s*$/);
    if(this.failure != null){
      this.failure = this.failure[1];
    }else{
      throw SyntaxError("Expect failure string in assert_invalid");
    }
  }

  expand(){
    let expanded = this.module.expand();
    let header = `;; (assert_invalid "${this.failure}")\n`;
    return {
      expect : "invalid",
      content: (expanded instanceof Buffer) ? Buffer.concat([Buffer.from(header), expanded]) : header + expanded,
    };
  }
}
module.exports.AssertInvalid = AssertInvalid;

class AssertExhaustion extends Assertion{
  constructor(block){
    super();
    block = block.replace(/^\(\s*assert_exhaustion\s+/, "").replace(/\)\s*$/, "");
    this.action = getAction(block, []);
    this.failure = block.match(/"((\\"|[^"])*)"\s*$/);
    if(this.failure != null){
      this.failure = this.failure[1];
    }else{
      throw SyntaxError("Expect failure string in assert_exhaustion");
    }
  }

  expand(moduleName){
    if(this.action instanceof Invoke){
      let invokeExpand = this.action.expand(moduleName);
      return {
        expect : "exhaustion",
        content: `;; (assert_exhaustion (invoke "${this.action.func}") "${this.failure}"\n` +
        "(module \n" +
        "  " + invokeExpand.prologue + "\n" +
        "  (memory 1)\n  (start $main)\n" +
        "  (func $main (export \"main\")\n" +
        "    " + invokeExpand.content.replace(/\n/g, "\n    ") + "\n" +
        "  )\n" +
        ")\n",
      };
    }else if(this.action instanceof Get){
      return this.action.expand(moduleName);
    }
    throw new TypeError("Unsupported action in AssertReturn");
  }
}
module.exports.AssertExhaustion = AssertExhaustion;

class AssertUnlinkable extends Assertion{
  constructor(block){
    super();
    this.module = new Module(getFirstBalancedBlock(block.replace(/^\(\s*assert_unlinkable\s+/, "")));
    this.failure = block.match(/"((\\"|[^"])*)"\s*\)\s*$/);
    if(this.failure != null){
      this.failure = this.failure[1];
    }else{
      throw SyntaxError("Expect failure string in assert_unlinkable");
    }
  }

  expand(){
    let expanded = this.module.expand();
    let header = `;; (assert_unlinkable "${this.failure}")\n`;
    return {
      expect : "unlinkable",
      content: (expanded instanceof Buffer) ? Buffer.concat([Buffer.from(header), expanded]) : header + expanded,
    };
  }
}
module.exports.AssertUnlinkable = AssertUnlinkable;

class Invoke{
  constructor(block, results){
    let match = block.match(/^\(\s*invoke\s+(\$[\w_\.\+\-*\/\\^~=<>!\?\|@#$%&:'`]+\s+)?"((\\"|[^"])*)"(.*)\)$/);
    if(match !== null){
      this.name = match[1] ? match[1].trim() : undefined;
      this.func = match[2];
      this.params = match[4] ? match[4].trim().match(/\([^)]+\)/g) : [];
      this.results = results;
    }else{
      throw new TypeError("Unable to parse invoke");
    }
  }

  expand(moduleName){
    return {
      type    : "invoke",
      prologue: `(import "${moduleName}" "${this.func}" (func $test_func ${
        (this.params.length > 0) ? this.params.reduce((str, param) => str + " " + param.substring(1, 4), "(param") + ")" : ""
      } ${
        (this.results.length > 0) ? this.results.reduce((str, result) => str + " " + result.substring(1, 4), "(result") + ")" : ""
      }))`,
      content: this.params.reduce(
        (str, param) => str + `${param.substring(1, param.length - 1)}\n`,
        `;; (invoke "${this.func}" ${this.params.reduce((str, param) => str + " " + param, "")})\n`,
      ) + "call $test_func\n",
    };
  }
}
module.exports.Invoke = Invoke;

class Get{
  constructor(block){
    throw ReferenceError("Get block not impemented"); // TODO:
  }
}

function getAction(block, ...args){
  let action = getFirstBalancedBlock(block);
  if(action.match(/^\(\s*invoke/)){
    return new Invoke(action, ...args);
  }else if(action.match(/^\(\s*get/)){
    return new Get(block, ...args);
  }else{
    throw new TypeError("Unknown action");
  }
}

function getFirstBalancedBlock(block){
  let start = -1;
  let end = -1;
  let parenCount = 0;
  let isString = false;
  for(let i = 0; i < block.length; ++i){
    if(block[i] == "\"" && i != 0 && block[i - 1] != "\\"){
      isString = !isString;
    }else if(isString){
      continue;
    }else if(block[i] == "("){
      if(parenCount == 0){
        start = i;
      }
      parenCount += 1;
    }else if(block[i] == ")"){
      if(parenCount == 0){
        return null;
      }else if(parenCount == 1){
        end = i + 1;
        break;
      }else{
        parenCount -= 1;
      }
    }
  }

  if(start < 0 || end < 0){
    return null;
  }else{
    return block.substring(start, end);
  }
}