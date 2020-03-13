const {
  UnexpectedCharacter,
  UnmatchedParentheses,
} = require("./errors");
const {
  Module,
  AssertReturn,
  AssertTrap,
  AssertMalformed,
  AssertInvalid,
  AssertExhaustion,
} = require("./types");

module.exports = {
  parse_block,
};

function parse_block(dataStr){
  return new Promise(resolve => {
    let stack = new Stack;
    let blocks = [];
    let content = "";
    let lastChar = null;
    let isComment = false;
    let isBlockComment = false;
    let hasSemicolon = false;
    dataStr.forEach(char => {
      if((isComment && char != "\n") || (isBlockComment && char != ")")){
        lastChar = char;
        return;
      }
      if(char == "\"" && lastChar != "\\"){
        if(stack.top() == "\""){
          stack.pop();
        }else{
          stack.push(char);
        }
        content += char;
      }else if(stack.top() == "\""){
        content += char;
      }else{
        switch(char){
        case ";":
          if(lastChar == ";"){
            isComment = true;
          }else if(lastChar == "("){
            isBlockComment = true;
          }else if(hasSemicolon == false){
            hasSemicolon = true;
          }else{
            throw new UnexpectedCharacter(";");
          }
          break;
        case "\n":
          if(isComment){
            isComment = false;
            hasSemicolon = false;
          }
          break;
        case "(":
          stack.push(char);
          content = content.trim();
          if(content != ""){
            blocks.push(content);
            content = "";
          }
          let newBlock = [];
          newBlock.parent = blocks;
          blocks.push(newBlock);
          blocks = newBlock;
          break;
        case ")":
          if(isBlockComment){
            if(lastChar == ";"){
              stack.pop();
              isBlockComment = false;
            }
          }else if(stack.top() == "("){
            stack.pop();
            content = content.trim();
            if(content != ""){
              blocks.push(content);
              content = "";
            }
            let parent = blocks.parent;
            delete blocks.parent;
            blocks = parent;
          }else{
            throw new UnmatchedParentheses();
          }
          break;
        default:
          content += char;
        }
      }
      lastChar = char;
    });
    resolve(blocks);
  })
    .then(blocks => {
      let result = [];
      blocks.forEach(block => {
        if(block.length > 0){
          switch(block[0].split(/\s+/)[0]){
          case "module":
            result.push(new Module(block));
            break;
          case "register":
            throw new ReferenceError("register not implemented"); // TODO:
            break;
          case "invoke":
            throw new ReferenceError("invoke not implemented"); // TODO:
            break;
          case "get":
            throw new ReferenceError("get not implemented"); // TODO:
            break;
          case "assert_return":
            result[result.length - 1].assertions.push(new AssertReturn(block));
            break;
          case "assert_trap":
            result[result.length - 1].assertions.push(new AssertTrap(block));
            break;
          case "assert_exhaustion":
            result[result.length - 1].assertions.push(new AssertExhaustion(block));
            break;
          case "assert_malformed":
            result.push(new AssertMalformed(block));
            break;
          case "assert_invalid":
            result.push(new AssertInvalid(block));
            break;
          case "assert_unlinkable":
            throw new ReferenceError("assert_unlinkable not implemented"); // TODO:
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