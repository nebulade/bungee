// Copyright (c) 2012 Johannes Zellner webmaster@nebulon.de - All Rights Reserved
// DOM renderer

"use strict";

if (!Quick) {
    var Quick = {};
}

/*
 **************************************************
 * Basic Animation
 **************************************************
 */
 Quick.Animation = function (id, parent) {
    var elem = new Quick.Element(id, parent, "object");
    var style = undefined;
    var animationName = "Animation";
    var keyFramesName = "AnimationKeyFrames";

    elem.addProperty("property", undefined);
    elem.addProperty("from", 1);
    elem.addProperty("to", 0);

    elem._finishCallback = function () {
        console.log("Animation finished");
    }

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

        if (!style) {
            style = document.createElement('style');
            document.getElementsByTagName('head')[0].appendChild(style);
        }

        rule += "." + animationName + " {\n"
        rule += "   -webkit-animation: " + keyFramesName + " 1s ease 3;\n"
        rule += "}\n";

        rule += "@-webkit-keyframes " + keyFramesName + " { \n";
        rule += "   0% { " + elem.property + ": " + elem.from + "; }";
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

    elem.start = function () {
        elem._element.className = animationName;
    }

    elem.stop = function () {
        elem._element.className = "";
    }

    elem.restart = function () {
        elem.stop();
        elem.start();
    }

    elem.onFinish = function (callback) {
        elem._finishCallback = callback;
    }

    return elem;
}