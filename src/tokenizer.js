// Copyright (c) 2012 Johannes Zellner webmaster@nebulon.de - All Rights Reserved

"use strict";

/*
 **************************************************
 * Tokenizer
 **************************************************
 */
if (!Quick) {
    var Quick = {};
}

var tokenizer = (function () {
    var c, i, line, tokens, bindings, exp, colonOnLine, comment, lineContext;
    var ret = {};

    function log (msg) {
        if (Quick.verbose) {
            console.log(msg);
        }
    }

    // add a found token to the token table
    function addToken (type, data) {
        tokens.push( {"TOKEN" : type, "DATA" : data, "LINE" : line, "CONTEXT" : lineContext} );
    }

    // extract an element name
    function parseElementName () {
        var token = "";

        while (c) {
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z'))
                token += c;
            else
                break;

            advance();
        }

        return token;
    }

    // extract an expression, can be a property definition, function or right side expression after :
    function parseExpression () {
        var expression = "";

        while (c) {
            if (c === '\n' || c === ';') {
                i -= 1;
                break;
            }

            // only break if this is the first colon in that line
            if (!colonOnLine && c === ':') {
                i -= 1;
                break;
            }

            // ignore whitespace
            // if ((c !== '\t' && c !== ' ') || expression === "function")
                expression += c;

            advance();
        }

        return expression;
    }

    function parseInlineBlock () {
        var block = "";

        advance();

        while (c) {
            // TODO guard i+1
            if (c === '}' && exp[i+1] === '^') {
                advance();
                break;
            }

            if (c === '\n') {
                ++line;
            }

            block += c;

            advance();
        }

        return block;
    }

    // Convenience function to advance the current tokenizer character
    function advance () {
        c = exp[++i];
        return (c);
    }

    /*
     * Parse the input string and create tokens
     */
    ret.parse = function (input) {
        exp = input;
        i = -1;
        line = 1;
        lineContext = "";
        tokens = [];
        c = undefined;//exp[i];
        bindings = [];
        colonOnLine = false;
        comment = false;

        while (advance()) {
            if (comment && c !== '\n')
                continue;

            // check for one line comments
            if (c === '/' && exp[i+1] === '/') {
                comment = true;
                continue;
            }

            if (c === '\n' || c === ';') {
                comment = false;
                colonOnLine = false;

                ++line;
                lineContext = "";

                // add next line so we have a error context to print
                var j = i;
                var tmpChar = exp[++j];

                while(tmpChar) {
                    if (tmpChar === '\n') {
                        break;
                    }
                    lineContext += tmpChar;
                    tmpChar = exp[++j];
                }

                continue;
            }

            // check for element name
            if (c >= 'A' && c <= 'Z') {
                addToken("ELEMENT", parseElementName());
                continue;
            }

            if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '"' || c === '\'' || c === '(' || c === '-' || c === '_' || c === '[') {
                addToken("EXPRESSION", parseExpression());
                continue;
            }

            if (c === '{') {
                addToken("SCOPE_START");
                continue;
            }

            if (c === '}') {
                addToken("SCOPE_END");
                continue;
            }

            if (c === '^' && exp[i+1] === '{') {
                advance();
                addToken("EXPRESSION", parseInlineBlock());
                continue;
            }

            if (c === ':') {
                colonOnLine = true;
                addToken("COLON");
                continue;
            }

            if (c === '@') {
                addToken("IS_A");
                continue;
            }

            if (c === ';') {
                colonOnLine = false;
                addToken("SEMICOLON");
                continue;
            }
        }

        if (Quick.verbose) {
            ret.dumpTokens();
        }

        return tokens;
    };


    /*
     * Print all found tokens on the console
     */
    ret.dumpTokens = function () {
        for (var i = 0; i < tokens.length; ++i)
            console.log("TOKEN: " + tokens[i].TOKEN + " " + (tokens[i].DATA ? tokens[i].DATA : ""));
    };

    return ret;
}());

// TODO is this the proper check?
if (typeof window === 'undefined') {
    module.exports = tokenizer;
} else {
    window.Quick.Tokenizer = tokenizer;
}

