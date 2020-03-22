/**
 * Copyright 2020 Luis Hsu. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

const {
  Module,
  Register,
  Invoke,
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
            throw SyntaxError("Unmatched parentheses");
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
          let instance = null;
          let module = null;
          switch(blockType[1]){
          case "module":
            result.push(new Module(block));
            break;
          case "register":
            instance = new Register(block);
            module = (instance.module != null) ?
              result.filter(res => res instanceof Module).find(mod => mod.name == instance.module) :
              result[result.length - 1];
            module.register = instance.name;
            break;
          case "invoke":
            instance = new Invoke(block, []);
            module = (instance.name) ?
              result.filter(res => res instanceof Module).find(mod => mod.name == instance.name) :
              result[result.length - 1];
            module.invokes.push(instance);
            break;
          case "assert_return":
            instance = new AssertReturn(block);
            module = (instance.action.name) ?
              result.filter(res => res instanceof Module).find(mod => mod.name == instance.action.name) :
              result[result.length - 1];
            instance.addInvokes(module.invokes);
            module.assertions.push(instance);
            break;
          case "assert_trap":
            instance = new AssertTrap(block);
            module = (instance.action.name) ?
              result.filter(res => res instanceof Module).find(mod => mod.name == instance.action.name) :
              result[result.length - 1];
            instance.addInvokes(module.invokes);
            module.assertions.push(instance);
            break;
          case "assert_exhaustion":
            instance = new AssertExhaustion(block);
            module = (instance.action.name) ?
              result.filter(res => res instanceof Module).find(mod => mod.name == instance.action.name) :
              result[result.length - 1];
            instance.addInvokes(module.invokes);
            module.assertions.push(instance);
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