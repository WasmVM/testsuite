const {
  UnmatchedParentheses,
} = require("./errors");
const {
  Module,
  Register,
  AssertReturn,
  AssertTrap,
  AssertMalformed,
  AssertInvalid,
  AssertExhaustion,
  AssertUnlinkable,
} = require("./types");

module.exports = {
  parse_block,
};

function parse_block(dataStr){
  return new Promise(resolve => {
    let stack = new Stack;
    // Remove comments
    let charArray = [];
    let comment = null;
    for(let i = 0; i < dataStr.length; ++i){
      if((comment == "line") && (dataStr.charAt(i) == "\n")){
        comment = null;
        charArray.push("\n");
      }else if(dataStr.charAt(i) == "(" && dataStr.charAt(i + 1) == ";"){
        stack.push("(;");
        comment = "block";
      }else if(comment == "block" && dataStr.charAt(i) == ";" && dataStr.charAt(i + 1) == ")"){
        stack.pop();
        if(stack.top() == null){
          comment = null;
        }
        i += 1;
      }else if(comment == null && dataStr.charAt(i) == ";" && dataStr.charAt(i + 1) == ";"){
        comment = "line";
      }else if(comment != "block" && comment != "line"){
        charArray.push(dataStr.charAt(i));
      }
    }
    stack = new Stack;

    // Parse blocks
    let blocks = [];
    let content = "";
    charArray.forEach((char, index) => {
      content += char;
      if(char == "\"" && (index == 0 || charArray[index - 1] != "\\")){
        if(stack.top() == "\""){
          stack.pop();
        }else{
          stack.push(char);
        }
      }else if(stack.top() != "\""){
        switch(char){
        case "(":
          stack.push(char);
          break;
        case ")":
          if(stack.length < 1){
            throw new UnmatchedParentheses();
          }else{
            stack.pop();
            if(stack.length == 0){
              blocks.push(content.trim());
              content = "";
            }
          }
          break;
        }
      }
    });
    resolve(blocks);
  })
    .then(blocks => {
      let result = [];
      blocks.forEach(block => {
        if(block.length > 0){
          let blockType = block.match(/^\(\s*(\w+)\s*/);
          if(!blockType){
            throw new SyntaxError("Unknown test connand");
          }
          switch(blockType[1]){
          case "module":
            result.push(new Module(block));
            break;
          case "register":
            let register = new Register(block);
            if(register.module != null){
              result.filter(res => res instanceof Module).find(mod => mod.name == register.module).register = register.name;
            }else{
              result[result.length - 1].register = register.name;
            }
            break;
          case "invoke":
            throw new ReferenceError("invoke not implemented"); // TODO:
            break;
          case "get":
            throw new ReferenceError("get not implemented"); // TODO:
            break;
          case "assert_return":
            let assertReturn = new AssertReturn(block);
            if(assertReturn.action.name){
              result.filter(res => res instanceof Module).find(mod => mod.name == assertReturn.action.name).assertions.push(assertReturn);
            }else{
              result[result.length - 1].assertions.push(assertReturn);
            }
            break;
          case "assert_trap":
            let assertTrap = (new AssertTrap(block));
            if(assertTrap.action.name){
              result.filter(res => res instanceof Module).find(mod => mod.name == assertTrap.action.name).assertions.push(assertTrap);
            }else{
              result[result.length - 1].assertions.push(assertTrap);
            }
            break;
          case "assert_exhaustion":
            let assertExhaustion = new AssertExhaustion(block);
            if(assertExhaustion.action.name){
              result.filter(res => res instanceof Module).find(mod => mod.name == assertExhaustion.action.name).assertions.push(assertExhaustion);
            }else{
              result[result.length - 1].assertions.push(assertExhaustion);
            }
            break;
          case "assert_malformed":
            result.push(new AssertMalformed(block));
            break;
          case "assert_invalid":
            result.push(new AssertInvalid(block));
            break;
          case "assert_unlinkable":
            result.push(new AssertUnlinkable(block));
            break;
          default:
            throw new SyntaxError("Unknown test connand");
          }
        }
      });
      return result;
    });
}

class Stack extends Array{
  constructor(...args){
    super(...args);
  }

  top(){
    return (this.length > 0) ? this[this.length - 1] : null;
  }
}