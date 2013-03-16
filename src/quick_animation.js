// Copyright (c) 2012 Johannes Zellner webmaster@nebulon.de - All Rights Reserved
// Animation

"use strict";

if (!Quick) {
    var Quick = {};
}

Quick._animationIndex = 0;

/*
 **************************************************
 * Basic Animation
 **************************************************
 */
Quick.Step = function (id, parent) {
    var elem = new Quick.Element(id, parent, "object");

    elem.addProperty("percentage", 0);

    return elem;
};

Quick.Animation = function (id, parent) {
    var elem = new Quick.Element(id, parent, "object");
    var index = Quick._animationIndex++;
    var dirty = true;
    var hasRules = false;
    var animationName = "quickAnimation" + index;
    var keyFramesName = "quickAnimationKeyFrames" + index;

    elem.addProperty("target", undefined);
    elem.addProperty("duration", 250);
    elem.addProperty("delay", 0);
    elem.addProperty("loops", 1);
    elem.addProperty("reverse", false);
    elem.addProperty("easing", "ease");

    function animationStart(event) {
        // console.log("start", event);
        elem.emit("started");
    }

    function animationIteration(event) {
        // console.log("iteration", event);
    }

    function animationEnd(event) {
        // console.log("end", event);
        elem.stop();
        elem.emit("finished");
    }

    function updateRules() {
        var rule1 = "";
        var rule2 = "";

        if (!Quick._style) {
            Quick._style = document.createElement('style');
            document.getElementsByTagName('head')[0].appendChild(Quick._style);
        }

        if (hasRules) {
            var tmpName = "." + animationName;
            var i;

            // remove key frames rule
            for (i = 0; i < Quick._style.sheet.cssRules.length; ++i) {
                if (Quick._style.sheet.cssRules[i].name === keyFramesName) {
                    Quick._style.sheet.deleteRule(i);
                    break;
                }
            }

            // remove animation rule
            for (i = 0; i < Quick._style.sheet.cssRules.length; ++i) {
                if (Quick._style.sheet.cssRules[i].selectorText === tmpName) {
                    Quick._style.sheet.deleteRule(i);
                    break;
                }
            }
        }

        rule1 += "." + animationName + " {\n";
        rule1 += "   -webkit-animation: ";
        rule1 += keyFramesName + " ";
        rule1 += elem.duration + "ms ";
        rule1 += elem.easing + " ";
        rule1 += elem.delay + " ";
        rule1 += elem.loops + " ";
        rule1 += (elem.reverse ? "alternate" : "normal") + ";\n";
        rule1 += "}\n";

        rule2 += "@-webkit-keyframes " + keyFramesName + " { \n";

        for (var j in elem.children()) {
            var child = elem.children()[j];

            if (typeof child.percentage === 'undefined') {
                continue;
            }

            rule2 += "   " + child.percentage + "% { ";

            for (var property in child._properties) {
                if (child.hasOwnProperty(property) && property !== 'percentage') {
                    rule2 += property + ": " + child[property] + "; ";
                }
            }

            rule2 += " }";
        }

        rule2 += "}";

        Quick._style.sheet.insertRule(rule1, 0);
        Quick._style.sheet.insertRule(rule2, 0);

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


Quick.Behavior = function (id, parent) {
    var elem = new Quick.Element(id, parent, "object");
    var index = Quick._animationIndex++;
    var hasRules = false;
    var animationName = "quickAnimation" + index;

    elem.addProperty("target", undefined);

    function animationStart(event) {
        // console.log("start", event);
        elem.emit("started");
    }

    function animationIteration(event) {
        // console.log("iteration", event);
    }

    function animationEnd(event) {
        // console.log("end", event);
        elem.stop();
        elem.emit("finished");
    }

    function updateRules() {
        var rule = "";

        if (!Quick._style) {
            Quick._style = document.createElement('style');
            document.getElementsByTagName('head')[0].appendChild(Quick._style);
        }

        if (hasRules) {
            var tmpName = "." + animationName;
            var i;

            // remove animation rule
            for (i = 0; i < Quick._style.sheet.cssRules.length; ++i) {
                if (Quick._style.sheet.cssRules[i].selectorText === tmpName) {
                    Quick._style.sheet.deleteRule(i);
                    break;
                }
            }
        }

        rule += "." + animationName + " {\n";
        rule += "   -webkit-transition: ";

        for (var property in elem._properties) {
            if (elem.hasOwnProperty(property) && property !== 'target') {
                rule += property + " " + elem[property] + "\n";
            }
        }

        rule += "}\n";

        Quick._style.sheet.insertRule(rule, 0);

        hasRules = true;
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
