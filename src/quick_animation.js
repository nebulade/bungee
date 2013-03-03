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
Quick.Animation = function (id, parent) {
    var elem = new Quick.Element(id, parent, "object");
    var style;
    var index = Quick._animationIndex++;
    var dirty = true;
    var hasRules = false;
    var animationName = "quickAnimation" + index;
    var keyFramesName = "quickAnimationKeyFrames" + index;

    elem.addProperty("target", undefined);
    elem.addProperty("property", undefined);

    // TODO from,middle,to is suboptimal
    elem.addProperty("from", 1);
    elem.addProperty("middle", 0.5);
    elem.addProperty("to", 0);

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

        if (!elem.property) {
            return;
        }

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
        rule2 += "   0% { " + elem.property + ": " + elem.from + "; }";
        rule2 += "   50% { " + elem.property + ": " + elem.middle + "; }";
        rule2 += "   100% { " + elem.property + ": " + elem.to + "; }";
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
    elem.addChanged("property", markDirty);
    elem.addChanged("from", markDirty);
    elem.addChanged("to", markDirty);
    elem.addChanged("middle", markDirty);
    elem.addChanged("duration", markDirty);
    elem.addChanged("delay", markDirty);
    elem.addChanged("loops", markDirty);
    elem.addChanged("reverse", markDirty);
    elem.addChanged("easing", markDirty);

    elem.start = function () {
        if (dirty) {
            updateRules();
            dirty = false;
        }

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