const {
  UnexpectedCharacter,
  UnmatchedParentheses,
} = require("./errors");
const {
  Module,
  AssertReturn,
  AssertTrap,
  AssertMelformed,
  AssertInvalid,
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
    let hasSemicolon = false;
    dataStr.forEach(char => {
      if(isComment && char != "\n" && char != ")"){
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
          if(lastChar == ";" || lastChar == "("){
            isComment = true;
          }else if(hasSemicolon == false){
            hasSemicolon = true;
          }else{
            throw new UnexpectedCharacter(";");
          }
          break;
        case "\n":
          isComment = false;
          hasSemicolon = false;
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
          if(isComment && lastChar == ";"){
            isComment = false;
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
            // TODO:
            break;
          case "invoke":
            // TODO:
            break;
          case "get":
            // TODO:
            break;
          case "assert_return":
            result[result.length - 1].assertions.push(new AssertReturn(block));
            break;
          case "assert_trap":
            result[result.length - 1].assertions.push(new AssertTrap(block));
            break;
          case "assert_exhaustion":
            // TODO:
            break;
          case "assert_malformed":
            result[result.length - 1].assertions.push(new AssertMelformed(block));
            break;
          case "assert_invalid":
            result[result.length - 1].assertions.push(new AssertInvalid(block));
            break;
          case "assert_unlinkable":
            // TODO:
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