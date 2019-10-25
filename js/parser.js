var Parser = {};

Parser.toMermaid = (source) => {
    function parse(tokens) {
        let currToken = 0;
        let entities = {};
        let relationships = {};
        let errMsg = '';
        
        function eat(type) {
            function writeErr() {
                if(errMsg !== '') {
                    return;
                }

                // Make NEWLINE and EOF tokens human readable.
                if(match(tokenType.NEWLINE)) {
                    tokens[currToken].type = '\\n';
                }
                if(match(tokenType.EOF)) {
                    tokens[currToken].type = '\\0';
                }
                if(type == tokenType.NEWLINE) {
                    type = '\\n';
                }
                if(type == tokenType.EOF) {
                    type = '\\0';
                }
                
                errMsg += `[Line ${tokens[currToken].line}] Expect token ${type}, got ${tokens[currToken].type}.\n`
            }

            if(!match(type)) {
                writeErr();
                return tokens[currToken - 1];
            } else {
                currToken++;
                if(type == tokenType.NEWLINE) {
                    while(match(tokenType.NEWLINE)) {
                        currToken++;
                    }
                }
                return tokens[currToken - 1];
            }
        }
    
        function match(type) {
            return tokens[currToken].type == type;
        }
    
        /* attribute | IDENT
                     | D_UNDERSCORE IDENT D_UNDERSCORE */
        function attribute() {
            // Handle primary keys.
            if(match(tokenType.D_UNDERSCORE)) {
                eat(tokenType.D_UNDERSCORE);
                let attributeName = eat(tokenType.IDENT).lexeme;
                eat(tokenType.D_UNDERSCORE);
                let attributeTag = `<u>${attributeName}</u>`;
                return attributeTag;
            } else {
                let attributeName = eat(tokenType.IDENT).lexeme;
                return attributeName;
            }
        }
    
        /* entity | IDENT LPAREN (attribute (COMMA attribute)*) RPAREN (ISA IDENT) */
        function entity() {
            let entityName = eat(tokenType.IDENT).lexeme;
            entities[entityName] = Entity.new();
            eat(tokenType.LPAREN);
            if(!match(tokenType.RPAREN)) {
                let currAttribute = attribute();
                entities[entityName].attributes.push(currAttribute);
                while(match(tokenType.COMMA)) {
                    eat(tokenType.COMMA);
                    currAttribute = attribute();
                    entities[entityName].attributes.push(currAttribute);
                }
            }
            eat(tokenType.RPAREN);
            if(match(tokenType.ISA)) {
                eat(tokenType.ISA);
                entities[entityName].inheritsFrom = eat(tokenType.IDENT).lexeme;
            }
        }
    
        /* entityBlock | ENTITIES COLON NEWLINE (entity NEWLINE)* */
        function entityBlock() {
            eat(tokenType.ENTITIES);
            eat(tokenType.COLON);
            eat(tokenType.NEWLINE);
            while(match(tokenType.IDENT)) {
                entity();
                eat(tokenType.NEWLINE);
            }
        }
    
        /* program | entityBlock (NEWLINE)* relationshipBlock EOF */
        function program() {
            entityBlock();
            relationshipBlock();
            eat(tokenType.EOF);
        }
    
        /* relationship | (COMMA IDENT)+ (LBRACE attribute (COMMA attribute)* RBRACE) */
        function relationship() {
            let entitiesInRelationship = [];
            entitiesInRelationship.push(eat(tokenType.IDENT).lexeme);
            while(match(tokenType.COMMA)) {
                eat(tokenType.COMMA);
                entitiesInRelationship.push(eat(tokenType.IDENT).lexeme);
            }
            // last "entity" in list is the relationship name.
            let relationshipName = entitiesInRelationship.pop();
            relationships[relationshipName] = Relationship.new();
            relationships[relationshipName].entities = entitiesInRelationship;
            if(match(tokenType.LBRACE)) {
                eat(tokenType.LBRACE)
                let currAttribute = attribute();
                relationships[relationshipName].attributes.push(currAttribute);
                while(match(tokenType.COMMA)) {
                    eat(tokenType.COMMA);
                    currAttribute = attribute();
                    relationships[relationshipName].attributes.push(currAttribute);
                }
                eat(tokenType.RBRACE);
            }
        }
    
        /* relationshipBlock | RELATIONSHIPS COLON NEWLINE (relationship NEWLINE)* */
        function relationshipBlock() {
            eat(tokenType.RELATIONSHIPS);
            eat(tokenType.COLON);
            eat(tokenType.NEWLINE);
            while(match(tokenType.IDENT)) {
                relationship();
                if(!match(tokenType.EOF)) {
                    eat(tokenType.NEWLINE);
                }
            }
        }
    
        program();
        return {errMsg: errMsg, entities: entities, relationships: relationships};
    }

    function generateMermaidSource(entities, relationships) {
        let out = "graph LR\n";
        // Add entity nodes.
        for(entity of Object.keys(entities)) {
            // Add style and entity name
            out += `style ${entity} fill:#fff,stroke:#000;\n${entity}[<b>${entity}</b><hr>`;
            // For each entity, add it as a new line.
            entities[entity]['attributes'].forEach(attribute => {
                out += `${attribute}<br>`;
            });
            out += ']\n';
            // Add a link to the entity the node inherits from, if applicable.
            if(entities[entity]['inheritsFrom'] !== undefined) {
                out += `${entity}-->${entities[entity]['inheritsFrom']}\n`;
            }
        }

        // Add relationship nodes.
        for(relationship of Object.keys(relationships)) {
            out += `style ${relationship} fill:#E6F9FE,stroke:#000;\n${relationship}{${relationship}}\n`;
            // Add each attribute node for the relationship.
            relationships[relationship]['attributes'].forEach(attribute => {
                out += `style ${relationship}-${attribute} fill:#fff,stroke:#000;\n${relationship}-${attribute}[${attribute}]\n`;
            });
        }

        // Add links between entity and relationship nodes.
        for(relationship of Object.keys(relationships)) {
            let i = 0;
            relationships[relationship]['entities'].forEach(relEntity => {
                // Swapping the order of every other link makes the output look better.
                if(i % 2 === 0) {
                    out += `${relEntity}---${relationship}\n`;
                } else {
                    out += `${relationship}---${relEntity}\n`;
                }
                i++;
            });
            // Add links from relationship attributes.
            relationships[relationship]['attributes'].forEach(attribute => {
                out += `${relationship}-${attribute}-.->${relationship}\n`;
            });
        }
        return out;
    }

    let tokens = Lexer.scanTokens(source);
    if(tokens.errMsg !== '') {
        return tokens.errMsg;
    }
    let entRel = parse(tokens.tokens);
    if(entRel.errMsg !== '') {
        return entRel.errMsg;
    }
    let mermaidSource = generateMermaidSource(entRel.entities, entRel.relationships);
    return mermaidSource;
};