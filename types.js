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
    block.shift();
    this.action = getAction(block.shift());
    this.results = block;
  }

  expand(){
    console.log("AssertReturn"); // TODO:
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

  expand(){
    console.log("AssertTrap"); // TODO:
  }
}
module.exports.AssertTrap = AssertTrap;

class Invoke{
  constructor(block){
    block[0] = block[0].trim();
    let match = block[0].match(/^invoke\s+(\$[\w_\.\+\-*\/\\^~=<>!\?\|@#$%&:'`]+\s+)?"((\\"|[^"])*)"$/);
    if(match !== null){
      this.name = match[1];
      this.func = match[2];
      this.params = block.slice(1);
    }else{
      throw new TypeError("Unable to parse invoke");
    }
  }
}
module.exports.Invoke = Invoke;

class Get{
  constructor(block){

  }
}

function getAction(block){
  if(block[0].trim().match(/^invoke/)){
    return new Invoke(block);
  }else if(block[0].trim().match(/^get/)){
    return new Get(block);
  }else{
    throw new TypeError("Unknown action");
  }
}