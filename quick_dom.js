// Copyright (c) 2012 Johannes Zellner webmaster@nebulon.de - All Rights Reserved
// DOM renderer

"use strict";

/*
 **************************************************
 * DOM renderer
 **************************************************
 */
function QuickRendererDOM () {

};

QuickRendererDOM.prototype.createElement = function (typeHint, object) {
    var elem;

    if (typeHint === 'object') {
        elem = document.createElement('object');
    } else if (typeHint === 'item') {
        elem = document.createElement('div');
        elem.style['position'] = 'absolute';
    } else if (typeHint === 'input') {
        elem = document.createElement('input');
    }

    elem.onclick = function () { object.emit('click'); };
    elem.onmouseover = function () { object.emit('mouseover'); };
    elem.onmouseout = function () { object.emit('mouseout'); };

    return elem;
};

QuickRendererDOM.prototype.addElement = function (element, parent) {
    if (parent && parent.element) {
        parent.element.appendChild(element.element);
    } else {
        document.body.appendChild(element.element);
    }
};

QuickRendererDOM.prototype.renderElement = function (element) {
    if (element.element) {
        for (var p in element.properties) {
            var name = element.properties[p].name;

            if (name === 'text') {
                element.element.innerHTML = element[name];
            } else {
                element.element.style[name] = element[name];
            }
        }
    }
};