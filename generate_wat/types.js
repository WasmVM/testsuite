class Module{
  constructor(block){
    this.assertions = [];
    this.block = block;
    this.isBinary = false;
  }

  _extendBlock(block, indent){
    let result = `\n${"  ".repeat(indent)}(`;
    block.forEach(elem => {
      if(typeof(elem) === "string"){
        result += `${elem} `;
      }else{
        result += this._extendBlock(elem, indent + 1);
      }
    });
    result += ") ";
    return result;
  }

  expand(){
    let result = null;
    if(this.block[0].match(/module binary/) !== null){
      this.isBinary = true;
      let binaryModule = this.block[0].substring(13).trim()
        .match(/"(\\"|\s|[^"])*"/g)
        .reduce((res, stmt) => res + stmt.substring(1, stmt.length - 1), "")
        .match(/(\\\\|\\\d\d|[^\\])/g);
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
      result = "(module ";
      if(this.block[0].match(/module$/) !== null){
        for(let i = 1; i < this.block.length; ++i){
          result += this._extendBlock(this.block[i], 1);
        }
      }else if(this.block[0].match(/module quote/) !== null){
        let quotedModule = this.block[0].substring(12).trim().match(/"(\\"|\s|[^"])*"/g);
        result += quotedModule.reduce((res, stmt) => res + stmt.substring(1, stmt.length - 1), "");
      }
      result += "\n)";
    }
    return result;
  }
}
module.exports.Module = Module;

class Assertion{
  expand(){
    throw new TypeError("Expand should be implemented in assertion");
  }
}

class AssertReturn extends Assertion{
  constructor(block){
    super();
    block.shift();
    this.action = getAction(block.shift(), block);
    this.results = block;
  }

  expand(moduleName){
    if(this.action instanceof Invoke){
      let invokeExpand = this.action.expand(moduleName);
      return {
        expect : "valid",
        content: `;; (assert_return (invoke "${this.action.func}") (result ${this.results.reduce((str, result) => str + ` (${result})`, "")})\n` +
        "(module \n" +
        "  " + invokeExpand.prologue + "\n" +
        "  (memory 1)\n  (start $main)\n" +
        "  (func $main (export \"main\")\n" +
        "    " + invokeExpand.content.replace(/\n/g, "\n    ") + "\n    " +
        this.results.reduce((str, result) => str + result[0] +
          `\n    ${result[0].substring(0, 3)}.ne\n` +
          "    if\n" +
          "      unreachable\n" +
          "    end\n", "") +
        "  )\n)\n",
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
    block.shift();
    this.action = getAction(block.shift());
    this.failure = block.shift();
    this.failure = this.failure.substring(1, this.failure.length - 1);
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
        "    " + invokeExpand.content.replace(/\n/g, "\n    ") +
        "\n  )\n)\n",
      };
    }else if(this.action instanceof Get){
      return this.action.expand(moduleName);
    }
    throw new TypeError("Unsupported action in AssertReturn");
  }
}
module.exports.AssertTrap = AssertTrap;

class AssertMelformed extends Assertion{
  constructor(block){
    super();
    block.shift();
    this.module = new Module(block.shift());
    this.failure = block.shift();
    this.failure = this.failure.substring(1, this.failure.length - 1);
  }

  expand(){
    return {
      expect : "melformed",
      content: this.module.expand(),
    };
  }
}
module.exports.AssertMelformed = AssertMelformed;

class AssertInvalid extends Assertion{
  constructor(block){
    super();
    block.shift();
    this.module = new Module(block.shift());
    this.failure = block.shift();
    this.failure = this.failure.substring(1, this.failure.length - 1);
  }

  expand(){
    return {
      expect : "invalid",
      content: this.module.expand(),
    };
  }
}
module.exports.AssertInvalid = AssertInvalid;

class Invoke{
  constructor(block, results){
    block[0] = block[0].trim();
    let match = block[0].match(/^invoke\s+(\$[\w_\.\+\-*\/\\^~=<>!\?\|@#$%&:'`]+\s+)?"((\\"|[^"])*)"$/);
    if(match !== null){
      this.name = match[1];
      this.func = match[2];
      this.params = block.slice(1);
      this.results = results;
    }else{
      throw new TypeError("Unable to parse invoke");
    }
  }

  expand(moduleName){
    return {
      type    : "invoke",
      prologue: `(import "${moduleName}" "${this.func}" (func $test_func ${
        (this.params.length > 0) ? "(param" + this.params.reduce((str, param) => str + " " + param[0].substring(0, 3), "") + ")" : ""
      } ${
        (this.results && this.results.length > 0) ? "(result " + this.results.map(result => result[0].substring(0, 3)) + ")" : ""
      }))`,
      content: `;; (invoke "${this.func}" ${
        this.params.reduce((str, param) => str + " ("+ param[0] + ") ", "")
      })\n` +
        this.params.reduce((str, param) => str + `${param[0]}\n`, "") + // Set parameter
        "call $test_func\n",
    };
  }
}
module.exports.Invoke = Invoke;

class Get{
  constructor(block){

  }
}

function getAction(block, ...args){
  if(block[0].trim().match(/^invoke/)){
    return new Invoke(block, ...args);
  }else if(block[0].trim().match(/^get/)){
    return new Get(block, ...args);
  }else{
    throw new TypeError("Unknown action");
  }
}