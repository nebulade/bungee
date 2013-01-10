// Copyright (c) 2012 Johannes Zellner webmaster@nebulon.de - All Rights Reserved
// DOM renderer

"use strict";

/*
 **************************************************
 * Rectangle Element
 **************************************************
 */
function Item (id, parent) {
    var elem = new Element(id, parent);

    elem.addProperty("-webkit-user-select", "none");
    elem.addProperty("-moz-user-select", "none");

    return elem;
}

function Rectangle (id, parent) {
    var elem = new Item(id, parent);

    elem.addProperty("background-color", "white");
    elem.addProperty("border-color", "black");
    elem.addProperty("border-style", "solid");
    elem.addProperty("border-width", 1);
    elem.addProperty("border-radius", 0);

    return elem;
}

function Button (id, parent) {
    var elem = new Rectangle(id, parent);

    elem.addProperty("text-align", "center");
    elem.addProperty("cursor", "pointer");

    return elem;
}

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
    elem.onmousedown = function () { object.emit('mousedown'); };
    elem.onmouseup = function () { object.emit('mouseup'); };

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