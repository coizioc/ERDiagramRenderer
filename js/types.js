const tokenType = {
    // One-character tokens
    LBRACE: '[',
    RBRACE: ']',
    LPAREN: '(',
    RPAREN: ')',
    COMMA: ',',
    COLON: ':',
    NEWLINE: '\n',
    ONE: '1',
    PLUS: '+',
    STAR: '*',
    // Two-character tokens
    D_UNDERSCORE: '__',
    // Identifier
    IDENT: 'IDENT',
    // Keywords
    AGGREGATION: 'AGGREGATION',
    ENTITIES: 'ENTITIES',
    IS: 'IS',
    ISA: 'ISA',
    RELATIONSHIPS: 'RELATIONSHIPS',
    WEAK: 'WEAK',
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