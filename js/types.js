const tokenType = {
    // One-character tokens
    LBRACE: '[',
    RBRACE: ']',
    LPAREN: '(',
    RPAREN: ')',
    COMMA: ',',
    COLON: ':',
    NEWLINE: '\n',
    // Two-character tokens
    D_UNDERSCORE: '__',
    // Identifier
    IDENT: 'IDENT',
    // Keywords
    ENTITIES: 'ENTITIES',
    ISA: 'ISA',
    RELATIONSHIPS: 'RELATIONSHIPS',
    // ILLEGAL and EOF
    ILLEGAL: "ILLEGAL",
    EOF: '\0'
};

let Token = {};

Token.new = (line, type, lexeme) => {
    return {
        line: line,
        type: type,
        lexeme: lexeme
    };
};

let Entity = {};

Entity.new = () => {
    return {attributes: [], inheritsFrom: undefined};
}

let Relationship = {};

Relationship.new = () => {
    return {attributes: [], entities: []};
}