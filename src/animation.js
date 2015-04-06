/*
 **************************************************
 *  Bungee.js
 *
 *  (c) 2012-2013 Johannes Zellner
 *
 *  Bungee may be freely distributed under the MIT license.
 *  For all details and documentation:
 *  http://bungeejs.org
 **************************************************
 */

"use strict";

/*
 **************************************************
 * Animation
 **************************************************
 */

var Bungee = require('./engine.js');

Bungee._animationIndex = 0;
Bungee._debugAnimation = false;

/*
 **************************************************
 * Basic Animation
 **************************************************
 */
Bungee.Step = function (engine, id, parent) {
    var elem = new Bungee.Element(engine, id, parent, "object");

    elem.addProperty("percentage", 0);

    return elem;
};

Bungee.Animation = function (engine, id, parent) {
    var elem = new Bungee.Element(engine, id, parent, "object");
    var index = Bungee._animationIndex++;
    var dirty = true;
    var hasRules = false;
    var animationName = "bungeeAnimation" + index;
    var keyFramesName = "bungeeAnimationKeyFrames" + index;

    elem.addProperty("target", function () { return this.parent; });
    elem.addProperty("duration", 250);
    elem.addProperty("delay", 0);
    elem.addProperty("loops", 1);
    elem.addProperty("reverse", false);
    elem.addProperty("easing", "ease");

    function animationStart(event) {
        Bungee._debugAnimation && console.log("start", event);
        elem.emit("started");
    }

    function animationIteration(event) {
        Bungee._debugAnimation && console.log("iteration", event);
    }

    function animationEnd(event) {
        Bungee._debugAnimation && console.log("end", event);
        elem.stop();
        elem.emit("finished");
    }

    function updateRules() {
        var rule1 = "";
        var rule2 = "";
        var rule3 = "";
        var rule4 = "";

        if (!Bungee._style) {
            Bungee._style = document.createElement('style');
            document.getElementsByTagName('head')[0].appendChild(Bungee._style);
        }

        if (hasRules) {
            var tmpName = "." + animationName;
            var i;

            // remove key frames rule
            for (i = 0; i < Bungee._style.sheet.cssRules.length; ++i) {
                if (Bungee._style.sheet.cssRules[i].name === keyFramesName) {
                    Bungee._style.sheet.deleteRule(i);
                    break;
                }
            }

            // remove animation rule
            for (i = 0; i < Bungee._style.sheet.cssRules.length; ++i) {
                if (Bungee._style.sheet.cssRules[i].selectorText === tmpName) {
                    Bungee._style.sheet.deleteRule(i);
                    break;
                }
            }
        }

        rule1 += "." + animationName + " {\n";
        rule1 += "   animation: ";
        rule1 += keyFramesName + " ";
        rule1 += elem.duration + "ms ";
        rule1 += elem.easing + " ";
        rule1 += elem.delay + " ";
        rule1 += elem.loops + " ";
        rule1 += (elem.reverse ? "alternate" : "normal") + ";\n";
        rule1 += "   -webkit-animation: ";
        rule1 += keyFramesName + " ";
        rule1 += elem.duration + "ms ";
        rule1 += elem.easing + " ";
        rule1 += elem.delay + " ";
        rule1 += elem.loops + " ";
        rule1 += (elem.reverse ? "alternate" : "normal") + ";\n";
        rule1 += "}\n";

        rule2 += "@keyframes " + keyFramesName + " { \n";
        rule3 += "@-webkit-keyframes " + keyFramesName + " { \n";
        for (var j in elem.children()) {
            var child = elem.children()[j];

            if (typeof child.percentage === 'undefined') {
                continue;
            }

            rule2 += "   " + child.percentage + "% {\n";
            rule3 += "   " + child.percentage + "% {\n";

            for (var property in child._properties) {
                if (child.hasOwnProperty(property) && property !== 'percentage') {
                    rule2 += "      " + property + ": " + child[property] + ";\n";
                    rule3 += "      " + property + ": " + child[property] + ";\n";
                }
            }

            rule2 += "   }\n";
            rule3 += "   }\n";
        }
        rule2 += "}\n";
        rule3 += "}\n";

        Bungee._debugAnimation && console.log("Bungee Animation rules:\n", rule2, rule3, rule1);

        try {
            Bungee._style.sheet.insertRule(rule3, Bungee._style.sheet.rules.length);
        } catch (e) {
            Bungee._debugAnimation && console.error("Bungee Animation rule", rule3, "could not be inserted.", e);
        }

        try {
            Bungee._style.sheet.insertRule(rule2, Bungee._style.sheet.rules.length);
        } catch (e) {
            Bungee._debugAnimation && console.error("Bungee Animation rule", rule2, "could not be inserted.", e);
        }

        try {
            Bungee._style.sheet.insertRule(rule1, Bungee._style.sheet.rules.length);
        } catch (e) {
            Bungee._debugAnimation && console.error("Bungee Animation rule", rule1, "could not be inserted.", e);
        }

        hasRules = true;
    }

    function addEventListeners() {
        elem._element = elem.target;
        if (elem._element && elem._element.element) {
            elem._element.element.addEventListener("webkitAnimationStart", animationStart, false);
            elem._element.element.addEventListener("webkitAnimationIteration", animationIteration, false);
            elem._element.element.addEventListener("webkitAnimationEnd", animationEnd, false);
        }
    }

    function markDirty() {
        dirty = true;
    }

    elem.addChanged("target", addEventListeners);
    elem.addChanged("changed", markDirty);

    elem.start = function () {
        if (dirty) {
            updateRules();
            dirty = false;
        }

        if (elem._element)
            elem._element.className = animationName;
    };

    elem.stop = function () {
        elem._element.className = "";
    };

    elem.restart = function () {
        elem.stop();
        elem.start();
    };

    return elem;
};


Bungee.Behavior = function (engine, id, parent) {
    var elem = new Bungee.Element(engine, id, parent, "object");
    var index = Bungee._animationIndex++;
    var hasRules = false;
    var animationName = "bungeeAnimation" + index;

    elem.addProperty("target", function () { return this.parent; });

    function animationStart(event) {
        Bungee._debugAnimation && console.log("start", event);
        elem.emit("started");
    }

    function animationIteration(event) {
        Bungee._debugAnimation && console.log("iteration", event);
    }

    function animationEnd(event) {
        Bungee._debugAnimation && console.log("end", event);
        elem.stop();
        elem.emit("finished");
    }

    function updateRules() {
        var rule = "";
        var gotProperties = false;

        if (!Bungee._style) {
            Bungee._style = document.createElement('style');
            document.getElementsByTagName('head')[0].appendChild(Bungee._style);
        }

        if (hasRules) {
            var tmpName = "." + animationName;
            var i;

            // remove animation rule
            for (i = 0; i < Bungee._style.sheet.cssRules.length; ++i) {
                if (Bungee._style.sheet.cssRules[i].selectorText === tmpName) {
                    Bungee._style.sheet.deleteRule(i);
                    break;
                }
            }
        }

        // nothing to do when we got no properties
        if (elem._properties.length === 0) {
            return;
        }

        // create shared parts of the css
        for (var property in elem._properties) {
            if (elem.hasOwnProperty(property) && property !== 'target') {
                if (gotProperties) {
                    rule += ", ";
                } else {
                    gotProperties = true;
                }

                rule += property + " " + elem[property];
            }
        }

        // only actually insert rules if there is no property undefined
        if (gotProperties && rule.indexOf('undefined') === -1) {
            Bungee._debugAnimation && console.log("Bungee Behavior rule", rule);

            elem.parent.element.style['transition'] = rule;
            elem.parent.element.style['-webkit-transition'] = rule;

            hasRules = true;
        }
    }

    function addEventListeners() {
        elem._element = elem.target;
        if (elem._element && elem._element.element) {
            elem._element.element.addEventListener("webkitAnimationStart", animationStart, false);
            elem._element.element.addEventListener("webkitAnimationIteration", animationIteration, false);
            elem._element.element.addEventListener("webkitAnimationEnd", animationEnd, false);
            elem._element.className = animationName;
        }
    }

    elem.addChanged("target", addEventListeners);
    elem.addChanged("changed", updateRules);

    return elem;
};
