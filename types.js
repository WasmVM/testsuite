class Module {
  constructor(block){
    this.assertions = [];
    this.block = block;
  }
}
module.exports.Module = Module;

class Assertion {
  expand(){
    throw new TypeError("Expand should be implemented in assertion")
  }
}

class AssertReturn extends Assertion{
  constructor(block){
    super()
  }
  expand(){
    console.log("AssertReturn")
  }
}
module.exports.AssertReturn = AssertReturn;