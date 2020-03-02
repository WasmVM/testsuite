class Module{
  constructor(block){
    this.assertions = [];
    this.block = block;
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
    block.pop();
    let act = block[0].trim().split(/\s+/)[0];
    this.action = null;
  }

  expand(){
    console.log("AssertReturn");
  }
}
module.exports.AssertReturn = AssertReturn;