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
    var compiler = {};
    var output;
    var index;
    var currentHelperElement;
    var toplevelHelperElement;

    var errorCodes = {
        GENERIC:            0,
        UNKNOWN_ELEMENT:    1,
        NO_PROPERTY:        2
    };

    compiler.errorCodes = errorCodes;

    var errorMessages = [];
    errorMessages[errorCodes.UNKNOWN_ELEMENT] = "cannot create element";
    errorMessages[errorCodes.NO_PROPERTY] =     "no property to assing expression";
    errorMessages[errorCodes.GENERIC] =         "generic error";

    function error (code, token) {
        var ret = {};
        ret.code = code;
        ret.message = "Compile error: " + errorMessages[code];
        ret.line = token ? token["LINE"] : -1;

        return ret;
    }

    function addIndentation (additional) {
        var indentLevel = index + (additional ? additional : 0);

        for (var i = indentLevel; i; --i) {
            output += "    ";
        }
    };

    function renderBegin () {
        output += "(function() {\n";
    };

    function renderEnd () {
        addIndentation();
        output += toplevelHelperElement.id + ".initializeBindings();\n"
        addIndentation();
        output += toplevelHelperElement.id + ".render();\n"
        output += "}());\n";
    };

    function renderElement (name, id) {
        addIndentation();

        output += "var " + currentHelperElement.id + " = new " + currentHelperElement.type + "(";
        output += id ? "\"" + id + "\"" : "";
        output += currentHelperElement.parent ? ", " + currentHelperElement.parent.id : "";
        output += ");\n";
    };

    function renderEventHandler (property, value) {
        addIndentation();
        output += currentHelperElement.id;
        output += ".addEventHandler(\"" + property + "\", ";
        output += "function () {\n";
        addIndentation();
        output += value + ";\n";
        addIndentation();
        output += "});\n";
    };

    function renderProperty (property, value) {
        // special case for ID
        if (property === "id") {
            return;
        } else if (property.indexOf('on') === 0) {
            renderEventHandler(property, value);
            return;
        }

        addIndentation();
        output += currentHelperElement.id;
        output += ".addProperty(\"" + property + "\", ";
        output += "function () {\n";
        addIndentation(1);
        if (String(value).indexOf("return") !== -1) {
            output += value + ";\n";
        } else {
            output += "return " + value + ";\n";
        }
        addIndentation();
        output += "});\n"
    };

    function HelperElement (type, parent) {
        this.parent = parent;
        this.type = type;

        function generateId () {
            var ret = [];
            var length = 5;
            var radix = 62;
            var characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

            for (var i = 0; i < length; i++) {
                ret[i] = characters[0 | Math.random()*radix];
            }

            return ret.join('');
        };

        this.id = (parent ? parent.id : "") + "ELEM" + generateId();
    }

    /*
     * Take all tokens and compile it to real elements with properties and bindings
     */
    compiler.render = function (tokens, callback) {
        var property;
        var token_length = tokens.length;
        var tokens = tokens;
        var elementType = undefined;

        output = "";          // render output, is Javascript which needs to be evaled or sourced
        index = 0;            // index used for tracking the indentation
        currentHelperElement = undefined;
        toplevelHelperElement = undefined;

        if (typeof callback !== "function") {
            return;
        }

        renderBegin();

        ++index;

        for (var i = 0; i < token_length; i += 1) {
            var token = tokens[i];

            if (token["TOKEN"] === "ELEMENT") {
                console.log("create type " + token["DATA"]);
                elementType = token["DATA"];
            }

            if (token["TOKEN"] === "SCOPE_START") {
                console.log("start element description");

                // only if elementType was found previously
                if (elementType) {
                    var tmpId;

                    // FIXME stupid and unsave id search
                    for (var j = i; j < token_length; ++j) {
                        var tmpToken = tokens[j];
                        if (tmpToken["TOKEN"] === "EXPRESSION" && tmpToken["DATA"] === "id") {
                            tmpId = tokens[j+2]["DATA"];
                            break;
                        }
                    }

                    ++index;
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

                    renderElement(token["DATA"], tmpId);
                }
            }
            if (token["TOKEN"] === "SCOPE_END") {
                console.log("end element description");
                if (currentHelperElement) {
                    currentHelperElement = currentHelperElement.parent;
                }
                --index;
            }

            if (token["TOKEN"] === "EXPRESSION") {
                if (!property) {
                    var next_token = (i+1 < token_length) ? tokens[i+1] : undefined;
                    if (next_token && next_token["TOKEN"] === "COLON") {
                        property = token["DATA"];
                        console.log("property found", property);
                        i += 1;
                        continue;
                    } else {
                        callback(error(errorCodes.NO_PROPERTY, token), null);
                        return;
                    }
                } else {
                    console.log("right-hand-side expression found for property", property, token["DATA"]);
                    renderProperty(property, token["DATA"]);
                    property = undefined;
                }
            }
        }

        renderEnd();

        callback(null, output);
    }

    return compiler;
}());