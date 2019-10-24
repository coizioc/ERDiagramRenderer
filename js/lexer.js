var Lexer = {};

Lexer.scanTokens = source => {
    let tokens = [];
    let start = 0;
    let current = 0;
    let line = 1;
    let errMsg = "";

    function isAtEnd() {
        return current >= source.length;
    }

    // Adds a token to the list of tokens.
    function addToken(type) {
        let text = source.substring(start, current);
        tokens.push(Token.new(line, type, text));
    }

    // Scans a single token.
    function scanToken() {
        function isAlpha(c) {
            return c.match(/[\_a-zA-Z]/i);
        }

        function advance() {
            current++;
            return source[current - 1];
        }
    
        function match(expected) {
            if(isAtEnd()) {
                return false;
            }
            if(source[current] != expected) { 
                return false;
            }
            current++;
            return true;
        }

        function peek() {
            if(isAtEnd()) {
                return '\0';
            }
            return source[current];
        }

        function peekNext() {
            if (current + 1 >= source.length) {
                return '\0';
            }
            return source[current + 1];
        }
        
        // Handle identifiers.
        function identifier() {
            while(isAlpha(peek())) {
                // Handle trailing __.
                if(peek() == '_') {
                    if(peekNext() == '_') {
                        break;
                    }
                }
                advance();
            }

            let text = source.substring(start, current);
            if(Object.values(tokenType).includes(text)) {
                addToken(text);
            } else {
                addToken(tokenType.IDENT);
            }
        }

        let c = advance();
        switch(c) {
            case tokenType.LBRACE:
            case tokenType.RBRACE:
            case tokenType.LPAREN:
            case tokenType.RPAREN:
            case tokenType.COMMA:
            case tokenType.COLON:
                addToken(c);
                break;
            case '_':
                if(match('_')) {
                    addToken(tokenType.D_UNDERSCORE);
                } else {
                    identifier();
                }
                break;
            case ' ':
            case '\t':
                // Ignore whitespace.
                break;
            case tokenType.NEWLINE:
                addToken(tokenType.NEWLINE);
                line++;
                break;
            default:
                if(isAlpha(c)) {
                    identifier();
                } else {
                    errMsg += `[Line ${line}] Invalid character: ${c}.\n`;
                    addToken(tokenType.ILLEGAL);
                }
        }
    }

    while(!isAtEnd()) {
        start = current;
        scanToken();
    }
    tokens.push(Token.new(line, tokenType.EOF, ""));

    return {errMsg: errMsg, tokens: tokens};
};
