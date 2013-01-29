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

    // TODO sort out this kindof global variable mess
    var ELEM_PREFIX = "e";      // just a define
    var output;                 // output buffer used by all render functions
    var index;                  // index used for tracking the indentation

    // make error codes public
    compiler.errorCodes = errorCodes;
    var errorCodes = {
        GENERIC:            0,
        UNKNOWN_ELEMENT:    1,
        NO_PROPERTY:        2
    };


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
        if (Quick.verbose) {
            console.log(msg);
        }
    }

    /*
     * adds current indentation to compiler output
     */
    function addIndentation(additional) {
        var indentLevel = index + (additional ? additional : 0);
        var i;

        for (i = indentLevel; i; --i) {
            output += "    ";
        }
    }

    /*
     * Renders the head of the javascript output
     * Only called once
     */
    function renderBegin() {
        output += "(function() {\n";
        if (Quick.debug) {
            addIndentation(1);
            output += "debugger;\n";
        }

        // add pseudo parent
        addIndentation();
        output += "var " + ELEM_PREFIX + " = { \n";
        addIndentation(1);

        output += "children: [],\n";
        addIndentation(1);

        output += "addChild: function(child) {\n";
        addIndentation(2);
        output += ELEM_PREFIX + ".children.push(child);\n";
        addIndentation(2);
        output += "Quick.Engine.addElement(child);\n";
        addIndentation(2);
        output += "return child;\n";
        addIndentation(1);
        output += "},\n";

        addIndentation(1);
        output += "initializeBindings: function() {\n";
        addIndentation(2);
        output += "for (var i = 0; i < " + ELEM_PREFIX + ".children.length; ++i) { " + ELEM_PREFIX + ".children[i].initializeBindings(); }\n";
        addIndentation(1);
        output += "},\n";

        addIndentation(1);
        output += "render: function() {\n";
        addIndentation(2);
        output += "for (var i = 0; i < " + ELEM_PREFIX + ".children.length; ++i) { " + ELEM_PREFIX + ".children[i].render(); }\n";
        addIndentation(1);
        output += "}\n";

        addIndentation();
        output += "}\n";
    }

    /*
     * Render the end of the javascript output
     * Only called once
     */
    function renderEnd() {
        addIndentation();
        output += ELEM_PREFIX + ".initializeBindings();\n";
        addIndentation();
        output += ELEM_PREFIX + ".render();\n";
        output += "}());\n";
    }

    /*
     * Renders the start of a new Element instance
     * Called for each element instantiation in jml
     */
    function renderBeginElement(type, id) {
        addIndentation();

        output += ELEM_PREFIX + ".addChild((function() {\n";

        ++index;
        addIndentation();

        output += "var " + ELEM_PREFIX + " = new " + type + "(";
        output += id ? "\"" + id + "\"" : "";
        output += ");\n";
    }

    /*
     * Renders the end of a new Element instance
     * Called for each element instantiation in jml
     */
    function renderEndElement() {
        addIndentation();
        output += "return " + ELEM_PREFIX + ";\n";

        --index;
        addIndentation();
        output += "})());\n";
    }

    /*
     * Renders the start of a new Type definition
     * Called for each type in jml
     */
    function renderBeginType(type, inheritedType) {
        addIndentation();

        output += "var " + type + " = function (id, parent) {\n";

        ++index;
        addIndentation();

        output += "var " + ELEM_PREFIX + " = new " + inheritedType + "(id, parent);\n";
    }

    /*
     * Renders the end of a new Type definition
     * Called for each type in jml
     */
    function renderEndType() {
        addIndentation();
        output += "return " + ELEM_PREFIX + ";\n";

        --index;
        addIndentation();
        output += "};\n";
    }

    /*
     * Renders an event handler for the current element/type in scope
     * Event handlers will be generated whenever a property name
     * begins with 'on' like 'onmousedown'
     */
    function renderEventHandler(property, value) {
        addIndentation();
        output += ELEM_PREFIX + ".addEventHandler(\"" + property + "\", ";
        output += "function () {\n";
        addIndentation();
        output += value + "\n";
        addIndentation();
        output += "});\n";
    }

    /*
     * Renders a property for the current element/type in scope
     */
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
        output += ELEM_PREFIX + ".addProperty(\"" + property + "\", ";
        output += "function () {";
        if (String(value).indexOf("return") !== -1) {
            output += value + " ";
        } else {
            output += "return " + value + ";";
        }
        output += "});\n";
    }

    /*
     * Takes a TreeObject, containing either a Type or an Element
     * and runs over the object's properties, types and children
     * this is called recoursively
     */
    function renderTreeObject(tree) {
        var i;

        if (tree.typeDefinition) {
            renderBeginType(tree.typeDefinition, tree.type);
        } else {
            renderBeginElement(tree.type, tree.id);
        }

        for (i = 0; i < tree.properties.length; ++i) {
            renderProperty(tree.properties[i].name, tree.properties[i].value);
        }

        for (i = 0; i < tree.types.length; ++i) {
            renderTreeObject(tree.types[i]);
        }

        for (i = 0; i < tree.elements.length; ++i) {
            renderTreeObject(tree.elements[i]);
        }

        if (tree.typeDefinition) {
            renderEndType();
        } else {
            renderEndElement();
        }
    }

    /*
     * Starting point of the renderer
     * Takes a TreeObject tree to render
     * The first tree object is root and needs special treatment
     */
    function renderTree(tree) {
        var i;
        index = 1;
        output = "";

        renderBegin();

        for (i = 0; i < tree.types.length; ++i) {
            renderTreeObject(tree.types[i]);
        }

        for (i = 0; i < tree.elements.length; ++i) {
            renderTreeObject(tree.elements[i]);
        }

        renderEnd();

        return output;
    }

    /*
     * Dump out the current object tree to the console
     */
    function dumpObjectTree(tree, indent) {
        var i;

        if (indent === undefined) {
            indent = 0;
        }

        function niceLog(msg) {
            var j;
            var out = "";
            for(j = 0; j < indent; ++j) {
                out += "  ";
            }
            console.log(out + msg);
        };

        niceLog("+ Element:");
        niceLog("|- type: " + tree.type);
        niceLog("|- type definition: " + tree.typeDefinition);

        niceLog("|+ Properties:");
        for (i = 0; i < tree.properties.length; ++i) {
            niceLog("|--> " + tree.properties[i].name);
        }

        if (tree.types.length) {
            niceLog("|+ Types:");
            for (i = 0; i < tree.types.length; ++i) {
                dumpObjectTree(tree.types[i], indent + 2);
            }
        }

        if (tree.elements.length) {
            niceLog("|+ Elements: ");
            for (i = 0; i < tree.elements.length; ++i) {
                dumpObjectTree(tree.elements[i], indent + 2);
            }
        }
    }

    /*
     * Take all tokens and compile it to real elements with properties and bindings
     * This is basically the only real API of this object
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

        // TreeObject is a helper to pass information to the renderer
        var TreeObject = function (parent) {
            this.id;
            this.type;
            this.typeDefinition;
            this.parent = parent;
            this.types = [];
            this.elements = [];
            this.properties = [];
        }

        var objectTreeRoot = new TreeObject();
        objectTreeRoot.type = "RootObject";
        var objectTree = objectTreeRoot;

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
                    // we found a type definition, so add one
                    var tmp = new TreeObject(objectTree);
                    tmp.type = elementType;
                    tmp.typeDefinition = elementTypeDefinition;
                    objectTree.types.push(tmp);
                    objectTree = tmp;

                    elementType = undefined;
                    elementTypeDefinition = undefined;
                } else if (elementType) {
                    var tmpId;

                    // FIXME stupid and unsave id search
                    for (j = i; j < token_length; ++j) {
                        var tmpToken = tokens[j];
                        if (tmpToken.TOKEN === "EXPRESSION" && tmpToken.DATA === "id") {
                            tmpId = tokens[j + 2].DATA;
                            break;
                        }
                    }

                    // we found a element definition, so add one to create an element instance
                    var tmp = new TreeObject(objectTree);
                    tmp.id = tmpId;
                    tmp.type = elementType;
                    objectTree.elements.push(tmp);
                    objectTree = tmp;

                    elementType = undefined;
                    elementTypeDefinition = undefined;
                } else {
                    // TODO error case
                }
            }

            if (token.TOKEN === "SCOPE_END") {
                log("end element description");
                // scope end, so reset the objectTree pointer
                objectTree = objectTree.parent;
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
                    objectTree.properties.push({name: property, value: token.DATA});
                    property = undefined;
                }
            }
        }

        callback(null, renderTree(objectTreeRoot));
    };

    return compiler;
}());