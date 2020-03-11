class UnexpectedCharacter extends SyntaxError{
  constructor(char){
    super(`Unexpected character '${char}'`);
  }
}

class UnmatchedParentheses extends SyntaxError{
  constructor(){
    super("Unmatched parentheses");
  }
}

module.exports = {
  UnexpectedCharacter,
  UnmatchedParentheses,
};