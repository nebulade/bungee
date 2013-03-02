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
    var animationName = "Animation" + index;
    var keyFramesName = "AnimationKeyFrames" + index;

    elem.addProperty("property", undefined);
    elem.addProperty("from", 1);
    elem.addProperty("middle", 0.5);
    elem.addProperty("to", 0);
    elem.addProperty("duration", 250);
    elem.addProperty("delay", 0);
    elem.addProperty("loops", 1);
    elem.addProperty("reverse", false);
    elem.addProperty("easing", "ease");

    elem._finishCallback = function () {
        console.log("Animation finished");
    };

    function animationStart(event) {
        console.log("start", event);
    }

    function animationIteration(event) {
        console.log("iteration", event);
    }

    function animationEnd(event) {
        elem.stop();
        console.log("end", event);
    }

    function updateRules() {
        var rule = "";

        if (!elem.property) {
            return;
        }

        if (!style) {
            style = document.createElement('style');
            document.getElementsByTagName('head')[0].appendChild(style);
        }

        rule += "." + animationName + " {\n";
        rule += "   -webkit-animation: ";
        rule += keyFramesName + " ";
        rule += elem.duration + "ms ";
        rule += elem.easing + " ";
        rule += elem.delay + " ";
        rule += elem.loops + " ";
        rule += (elem.reverse ? "alternate" : "normal") + ";\n";
        rule += "}\n";

        rule += "@-webkit-keyframes " + keyFramesName + " { \n";
        rule += "   0% { " + elem.property + ": " + elem.from + "; }";
        rule += "   50% { " + elem.property + ": " + elem.middle + "; }";
        rule += "   100% { " + elem.property + ": " + elem.to + "; }";
        rule += "}";

        style.innerHTML = rule;
    }

    function init() {
        elem._element = elem.target;
        if (elem._element && elem._element.element) {
            elem._element.element.addEventListener("webkitAnimationStart", animationStart, false);
            elem._element.element.addEventListener("webkitAnimationIteration", animationIteration, false);
            elem._element.element.addEventListener("webkitAnimationEnd", animationEnd, false);
        }
        updateRules();
    }

    elem.addProperty("target", undefined);
    elem.addChanged("target", init);
    elem.addChanged("property", updateRules);
    elem.addChanged("from", updateRules);
    elem.addChanged("to", updateRules);
    elem.addChanged("middle", updateRules);
    elem.addChanged("duration", updateRules);
    elem.addChanged("delay", updateRules);
    elem.addChanged("loops", updateRules);
    elem.addChanged("reverse", updateRules);
    elem.addChanged("easing", updateRules);

    elem.start = function () {
        elem._element.className = animationName;
    };

    elem.stop = function () {
        elem._element.className = "";
    };

    elem.restart = function () {
        elem.stop();
        elem.start();
    };

    elem.onFinish = function (callback) {
        elem._finishCallback = callback;
    };

    return elem;
};
