var Parser = {};

Parser.parse = tokens => {
    let currToken = 0;
    let entities = {};
    let relationships = {};
    let aggregations = {};
    let weak_entities = [];
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

    /* attribute | IDENT (COLON IDENT)
                    | D_UNDERSCORE IDENT (COLON IDENT) D_UNDERSCORE */
    function attribute() {
        let attributeName = "";
        let attributeDatatype = "";

        /* IDENT (COLON IDENT) */
        function handle_middle() {
            attributeName = eat(tokenType.IDENT).lexeme;
            if(match(tokenType.COLON)) {
                eat(tokenType.COLON);
                attributeDatatype = eat(tokenType.IDENT).lexeme;
            }
        }

        // Handle primary keys.
        if(match(tokenType.D_UNDERSCORE)) {
            eat(tokenType.D_UNDERSCORE);
            handle_middle();
            eat(tokenType.D_UNDERSCORE);
            attributeName = `<U>${attributeName}</U>`;
        } else {
            handle_middle();
        }

        return Entity.newAttribute(attributeName, attributeDatatype);
    }

    /* cardinality | LPAREN (ONE | PLUS | STAR) RPAREN */
    function cardinality() {
        eat(tokenType.LPAREN);
        let cardinality = '';
        if(match(tokenType.ONE)) {
            cardinality = eat(tokenType.ONE);
        } else if(match(tokenType.PLUS)) {
            cardinality = eat(tokenType.PLUS);
        } else {
            cardinality = eat(tokenType.STAR);
        }
        eat(tokenType.RPAREN);
        return cardinality.lexeme;
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

    /* relationship | (AGGREGATION IDENT IS) IDENT cardinality* (COMMA IDENT cardinality*)* IDENT (LBRACE attribute (COMMA attribute)* RBRACE) (IS WEAK)*/
    function relationship() {
        let aggregationName = '';

        if(match(tokenType.AGGREGATION)) {
            eat(tokenType.AGGREGATION);
            aggregationName = eat(tokenType.IDENT).lexeme;
            eat(tokenType.IS);
        }

        let entitiesInRelationship = [];
        let entityCardinalities = [];
        entitiesInRelationship.push(eat(tokenType.IDENT).lexeme);
        if(match(tokenType.LPAREN)) {
            entityCardinalities.push(cardinality());
        } else {
            entityCardinalities.push(tokenType.STAR);
        }
        while(match(tokenType.COMMA)) {
            eat(tokenType.COMMA);
            entitiesInRelationship.push(eat(tokenType.IDENT).lexeme);
            if(match(tokenType.LPAREN)) {
                entityCardinalities.push(cardinality());
            } else {
                entityCardinalities.push(tokenType.STAR);
            }
        }
        // last "entity" in list is the relationship name.
        let relationshipName = entitiesInRelationship.pop();
        entityCardinalities.pop();
        relationships[relationshipName] = Relationship.new();
        relationships[relationshipName].entities = entitiesInRelationship;
        relationships[relationshipName].cardinalities = entityCardinalities;

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

        if(aggregationName !== '') {
            aggregations[aggregationName] = relationshipName;
        }

        if(match(tokenType.IS)) {
            eat(tokenType.IS);
            eat(tokenType.WEAK);
            weak_entities.push(relationshipName);
        }
    }

    /* relationshipBlock | RELATIONSHIPS COLON NEWLINE (relationship NEWLINE)* */
    function relationshipBlock() {
        eat(tokenType.RELATIONSHIPS);
        eat(tokenType.COLON);
        eat(tokenType.NEWLINE);
        while(match(tokenType.IDENT) || match(tokenType.AGGREGATION)) {
            relationship();
            if(!match(tokenType.EOF)) {
                eat(tokenType.NEWLINE);
            }
        }
    }

    program();
    return {errMsg: errMsg, aggregations: aggregations, entities: entities, weak_entities: weak_entities, relationships: relationships};
};

Parser.generateDotSource = (entRel) => {
    let entities = entRel.entities;
    let relationships = entRel.relationships;
    let aggregations = entRel.aggregations;
    let weak_entities = entRel.weak_entities;
    let out = 'digraph {\n';
    let numTabs = 1;

    function addLine(line) {
        for(var i = 0; i < numTabs; i++) {
            out += '    ';
        }
        out += line + '\n';
    }

    function addSubgraph(name, properties, fnLoop) {
        addLine(`subgraph ${name} {`);
        numTabs++;
        for(property of properties) {
            addLine(property);
        }
        fnLoop();
        numTabs--;
        addLine('}');
    }

    function addAggregation(name, properties) {
        addLine(`subgraph cluster_${name} {`);
        numTabs++;
        for(property of properties) {
            addLine(property);
        }
        addLine(`${aggregations[name]};`);
        for(relNode of relationships[aggregations[name]].entities) {
            addLine(`${relNode};`);
        }
        numTabs--;
        addLine('}');
    }

    function addEdges(matchTokenType) {
        for(relationship of Object.keys(relationships)) {
            let i = 0;
            for(relEntity of relationships[relationship].entities) {
                if(relationships[relationship].cardinalities[i] == matchTokenType) {
                    // Swapping the order of every other link makes the output look better.
                    if(aggregations[relEntity] !== undefined) {
                        addLine(`${relationship} -> ${aggregations[relEntity]} [lhead=cluster_${relEntity}]`);
                    } else if(i % 2 === 0) {
                        // Handle arrow direction.
                        if(matchTokenType === tokenType.ONE) {
                            addLine(`${relEntity} -> ${relationship} [dir=back]`);
                        } else {
                            addLine(`${relEntity} -> ${relationship}`);
                        }
                    } else {
                        addLine(`${relationship} -> ${relEntity}`);
                    }
                }
                i++;
            }
        }
    }

    function addUndirectedEdges() {
        addEdges(tokenType.STAR);
    }

    function addDirectedEdges() {
        addEdges(tokenType.ONE);
    }

    function addParticipationEdges() {
        addEdges(tokenType.PLUS);
    }

    function addRelationshipAttributes() {
        for(relationship of Object.keys(relationships)) {
            relationships[relationship].attributes.forEach(attribute => {
                addLine(`${relationship}_${attribute.name} -> ${relationship}`);
            });
        }
    }

    function addGeneralizations() {
        // Add generalization links
        for(entity of Object.keys(entities)) {
            // Add a link to the entity the node inherits from, if applicable.
            if(entities[entity]['inheritsFrom'] !== undefined) {
                addLine(`${entity} -> ${entities[entity]['inheritsFrom']}`);
            }
        }
    }

    // Needed for aggregation.
    addLine('graph[compound=true];');

    // Add entity nodes.
    for(entity of Object.keys(entities)) {
        // Add entity table head
        addLine(`${entity}[shape=none margin=0 label=<<TABLE ALIGN="CENTER" CELLSPACING="0">`)
        numTabs++;
        // Add the entity name.
        addLine(`<TR><TD BGCOLOR="#CBEDF9" BORDER="0">${entity}</TD></TR>`);
        // For each attribute, add a row to the node's table.
        if(entities[entity].attributes.length > 0) {
            addLine('<HR/>');
            entities[entity].attributes.forEach(attribute => {
                addLine(`<TR><TD BORDER="0">${attribute.name}</TD></TR>`);
            });
        }
        numTabs--;
        addLine('</TABLE>>]');
    }

     // Add relationship nodes.
     for(relationship of Object.keys(relationships)) {
         line = `${relationship}[shape=diamond style=filled fillcolor="#E6F9FE" label="${relationship}"`;

         if(weak_entities.includes(relationship)) {
            line += ' peripheries=2';
         }
        addLine(`${line}]`);

        if(relationships[relationship].attributes !== undefined) {
            // Add each attribute node for the relationship.
            relationships[relationship].attributes.forEach(attribute => {
                addLine(`${relationship}_${attribute.name}[shape=rect label="${attribute.name}"]`);
            });
        }
    }

    for(aggregation of Object.keys(aggregations)) {
        addAggregation(aggregation, []);
    }

    addSubgraph('Undirected', ['edge[dir=none]'], addUndirectedEdges);
    addSubgraph('Directed', [], addDirectedEdges);
    addSubgraph('Participation', ['edge[dir=none color="black:invis:black"]'], addParticipationEdges);
    addSubgraph('Dashed', ['edge[dir=none style=dashed]'], addRelationshipAttributes);
    addSubgraph('Generalizations', ['edge[arrowhead="onormal"]'], addGeneralizations);

    out += '}';
    return out;
};

Parser.toGraphDefinition = (source) => {
    let tokens = Lexer.scanTokens(source);
    if(tokens.errMsg !== '') {
        return tokens.errMsg;
    }
    let entRel = Parser.parse(tokens.tokens);
    if(entRel.errMsg !== '') {
        return entRel.errMsg;
    }
    let graphDefinition = Parser.generateDotSource(entRel);
    return graphDefinition;
};