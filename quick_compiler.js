// Copyright (c) 2012 Johannes Zellner webmaster@nebulon.de - All Rights Reserved

"use strict";

/*
 **************************************************
 * Compiler
 **************************************************
 */

if (!Quick) {
    var Quick = {};
}

Quick.Compiler = (function () {
    // public compiler properties
    var compiler = {};
    compiler.verbose = false;
    compiler.debug = false;

    var output;
    var index;
    var currentHelperElement;
    var toplevelHelperElement;
    // Used to track if we are in a type definition or a element scope
    //  needed for the scope close javascript rendering
    var scopeStack = [];

    var errorCodes = {
        GENERIC:            0,
        UNKNOWN_ELEMENT:    1,
        NO_PROPERTY:        2
    };

    compiler.errorCodes = errorCodes;

    var errorMessages = [];
    errorMessages[errorCodes.UNKNOWN_ELEMENT] = "cannot create element";
    errorMessages[errorCodes.NO_PROPERTY] =     "no property to assing expression";
    errorMessages[errorCodes.NO_TYPENAME] =     "no typename given to register";
    errorMessages[errorCodes.GENERIC] =         "generic error";

    function error(code, token) {
        var ret = {};
        ret.code = code;
        ret.message = "Compile error: " + errorMessages[code];
        ret.line = token ? token.LINE : -1;

        return ret;
    }

    function log(msg) {
        if (compiler.verbose) {
            console.log(msg);
        }
    }

    function addIndentation(additional) {
        var indentLevel = index + (additional ? additional : 0);
        var i;

        for (i = indentLevel; i; --i) {
            output += "    ";
        }
    }

    function renderBegin() {
        output += "(function() {\n";
        if (compiler.debug) {
            addIndentation(1);
            output += "debugger;\n";
        }

        // add pseudo parent
        addIndentation();
        output += "var elem = { \n";
        addIndentation(1);

        output += "children: [],\n";
        addIndentation(1);

        output += "addChild: function(child) {\n";
        addIndentation(2);
        output += "elem.children.push(child);\n";
        addIndentation(2);
        output += "Quick.Engine.addElement(child);\n";
        addIndentation(2);
        output += "return child;\n";
        addIndentation(1);
        output += "},\n";

        addIndentation(1);
        output += "initializeBindings: function() {\n";
        addIndentation(2);
        output += "for (var e in elem.children) { elem.children[e].initializeBindings(); }\n";
        addIndentation(1);
        output += "},\n";

        addIndentation(1);
        output += "render: function() {\n";
        addIndentation(2);
        output += "for (var e in elem.children) { elem.children[e].render(); }\n";
        addIndentation(1);
        output += "}\n";

        addIndentation();
        output += "}\n";
    }

    function renderEnd() {
        addIndentation();
        output += "elem.initializeBindings();\n";
        addIndentation();
        output += "elem.render();\n";
        output += "}());\n";
    }

    function renderBeginElement(name, id) {
        addIndentation();

        output += "var " + currentHelperElement.id + " = ";
        output += "elem.addChild((function() {\n";

        ++index;
        addIndentation();

        output += "var elem = new " + currentHelperElement.type + "(";
        output += id ? "\"" + id + "\"" : "";
        output += ");\n";
    }

    function renderEndElement() {
        addIndentation();
        output += "return elem;\n";

        --index;
        addIndentation();
        output += "})());\n";
    }

    function renderBeginType(type, inheritedType) {
        addIndentation();

        output += "var " + type + " = function (id, parent) {\n";

        ++index;
        addIndentation();

        output += "var elem = new " + inheritedType + "(id, parent);\n";
    }

    function renderEndType() {
        addIndentation();
        output += "return elem;\n";

        --index;
        addIndentation();
        output += "};\n";
    }

    function renderEventHandler(property, value) {
        addIndentation();
        // output += currentHelperElement.id;
        output += "elem.addEventHandler(\"" + property + "\", ";
        output += "function () {\n";
        addIndentation();
        output += value + "\n";
        addIndentation();
        output += "});\n";
    }

    function renderProperty(property, value) {
        // special case for ID
        if (property === "id") {
            return;
        }

        if (property.indexOf('on') === 0) {
            renderEventHandler(property, value);
            return;
        }

        addIndentation();
        // output += currentHelperElement.id;
        output += "elem.addProperty(\"" + property + "\", ";
        output += "function () {";
        // addIndentation(1);
        if (String(value).indexOf("return") !== -1) {
            output += value + " ";
        } else {
            output += "return " + value + ";";
        }
        // addIndentation();
        output += "});\n";
    }

    function HelperElement(type, parent) {
        this.parent = parent;
        this.type = type;

        function generateId() {
            var ret = [];
            var length = 5;
            var radix = 62;
            var characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
            var i;

            for (i = 0; i < length; i++) {
                ret[i] = characters[0 | Math.random() * radix];
            }

            return ret.join('');
        }

        this.id = (parent ? parent.id : "") + "ELEM" + generateId();
    }

    /*
     * Take all tokens and compile it to real elements with properties and bindings
     */
    compiler.render = function (tok, callback) {
        var property;
        var tokens = tok;
        var token_length = tokens.length;
        var elementType;
        var elementTypeDefinition;
        var i, j;

        if (typeof callback !== "function") {
            return;
        }

        output = "";          // render output, is Javascript which needs to be evaled or sourced
        index = 1;            // index used for tracking the indentation
        currentHelperElement = undefined;
        toplevelHelperElement = undefined;
        scopeStack = [];

        renderBegin();

        for (i = 0; i < token_length; i += 1) {
            var token = tokens[i];

            if (token.TOKEN === "IS_A") {
                if (elementType) {
                    elementTypeDefinition = elementType;
                    elementType = undefined;
                } else {
                    callback(error(errorCodes.NO_TYPENAME, token), null);
                    return;
                }
            }

            if (token.TOKEN === "ELEMENT") {
                elementType = token.DATA;
            }

            if (token.TOKEN === "SCOPE_START") {
                log("start element description");

                // only if elementType was found previously
                if (elementTypeDefinition && elementType) {
                    scopeStack.push("TYPE");

                    renderBeginType(elementTypeDefinition, elementType);

                    elementType = undefined;
                    elementTypeDefinition = undefined;
                } else if (elementType) {
                    var tmpId;

                    scopeStack.push("ELEMENT");

                    // FIXME stupid and unsave id search
                    for (j = i; j < token_length; ++j) {
                        var tmpToken = tokens[j];
                        if (tmpToken.TOKEN === "EXPRESSION" && tmpToken.DATA === "id") {
                            tmpId = tokens[j + 2].DATA;
                            break;
                        }
                    }

                    if (currentHelperElement) {
                        var tmpElem = currentHelperElement;
                        currentHelperElement = new HelperElement(elementType, tmpElem);
                    } else {
                        // found toplevel element
                        currentHelperElement = new HelperElement(elementType);
                    }

                    // preserve the toplevel element for init steps
                    if (!toplevelHelperElement) {
                        toplevelHelperElement = currentHelperElement;
                    }

                    elementType = undefined;
                    elementTypeDefinition = undefined;

                    renderBeginElement(token.DATA, tmpId);
                } else {
                    // TODO error case
                }
            }

            if (token.TOKEN === "SCOPE_END") {
                log("end element description");

                var scopeType = scopeStack.pop();

                if (scopeType === "TYPE") {
                    renderEndType();
                } else {
                    renderEndElement();

                    if (currentHelperElement) {
                        currentHelperElement = currentHelperElement.parent;
                    }
                }
            }

            if (token.TOKEN === "EXPRESSION") {
                if (!property) {
                    var next_token = (i + 1 < token_length) ? tokens[i + 1] : undefined;
                    if (next_token && next_token.TOKEN === "COLON") {
                        property = token.DATA;
                        log("property found", property);
                        i += 1;
                    } else {
                        callback(error(errorCodes.NO_PROPERTY, token), null);
                        return;
                    }
                } else {
                    log("right-hand-side expression found for property", property, token.DATA);
                    renderProperty(property, token.DATA);
                    property = undefined;
                }
            }
        }

        renderEnd();

        callback(null, output);
    };

    return compiler;
}());