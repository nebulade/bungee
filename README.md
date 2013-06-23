Bungee.js
=========

Bungee.js is a declarative framework to build web applications.
It is heavily inspired by QtQuick and comes with a

* declarative __language__ for describing elements and their relationship between each other
* __compiler__ to JavaScript
* declarative __engine__, which drives the whole application in an event driven fashion

Bungee.js is not a full blown application development framework, it provides mainly an environment to create the user interface elements. It breaks with the common html/css layouting of objects and relies on the description how elements should appear on the screen by defining constraints and dynamic bindings.

* **[Introduction](#introduction)**
  * [Installation](#installation)
  * [Purple World](#purple-world)
  * [Embedded](#embedded)
  * [Precompile](#precompile)

* **[The language jump](#the-language-jump)**
  * [Basic Concepts](#basic-concepts)
  * [Creating Objects](#creating-objects)
  * [Adding Properties](#adding-properties)
  * [Bindings](#bindings)
  * [Custom Types](#custom-types)
  * [Delegates](#delegates)

* **[Javascript API](#javascript-api)**
  * [Engine](#engine)
  * [Tokenizer](#tokenizer)
  * [Compiler](#compiler)
  * [DOM Elements](#dom-elements)
  * [Helper](#helper)

* **[Examples](#examples)**


Introduction
------------

This section will get you started in a few minutes.


### Installation

__npm__:

``` sh
  npm install bungee
```

The `npm` package contains modules, the compiler and all the sources. Until there is a stable release, this is the preferred way to generate the `bungee.js` library together with a minified version:

```
make
```

To pre-compile the additional modules:

```
make modules
```

To remove all generated files:

```
make clean
```

### Purple World

A very basic purple rectangle example looks like this:

```
Item {
    width: 100
    height: 50
    backgroundColor: "purple"
}
```
Those code snippets can be either embedded into a website and compiled on the client side or pre-compiled to save some cpu cycles.

### Embedded

Embedding works like having Javascript embedded, only the `type` attribute differs from that.
```
<script type="text/javascript" src="bungee.js"></script>
...
<script type="text/jml">
    Item {
    }
</script>
...
<body onload="Bungee.jump();">
```
The first script tag includes the bungee.js library, followed by a script of type `text/jml` and finally to kick off the compilation as well as the declarative engine, `Bungee.jump()` needs to be called. In this case in the `onload` handler.

### Precompile

Although embedding the scripts add some more dynamic use cases, it also has major downsides. The compilation step is really only needed in case the source changes. In addition to that, since the compiler renders `jml` into Javascript, the generated Javascript code then can be minified offline.

``` sh
cd node_modules/bungee/bin
./bungee foo.jml foo.jml.js
```

If you want to have the compiled module namespaced, so all root elements are accessable via `moduleName.elementId`, pass a `-m Foo` option. To use the module, include it as any other Javascript file in your HTML alongside the main `bungee.js` library.

```
<script type="text/javascript" src="bungee.js"></script>
<script type="text/javascript" src="foo.jml.js"></script>

...

<script>
    Bungee.useQueryFlags();
    var ui = Bungee.Foo();
    Bungee.Engine.start();
</script>
```

The language jump
-----------------

### Basic Concepts
The Jump syntax is very similar to CSS and indeed maybe even more like SASS.
The code consists of an element definition followed by a block of key-value pairs.
Those key-value pairs are the main construct of the language and have different functionality,
depending on the __key__:

* ``foobar``
  Keys, which match a CSS attribute name, will be handled as such. This means that the right
  hand side expression will be assigned to the instantiated element in the fasion of ``obj.style["width"]``.
  Keys, not matching a CSS attribute, are also valid and can be used as custom properties.
* ``onfoobar``
  All keys starting with ``on`` are event handlers for other attributes.
  As a right hand side expression, they take a Javascript code block,
  which will be executed everytime the property, the part after the ``on``,
  in this case ``foobar``, changes. This is useful to react on property changes
  and perform actions, which are hard to express in a declarative way.
* ``foobar(baz)``
  Keys with a function like signature, will create callable functions on the elements.
  Unlike regular properties, those won't be reevaluated everytime a binding inside the function body fires.
  The function argument specification is only convenience and will be simply passed down to the
  compiled Javascript code by the compiler.

### Creating Elements

### Adding Properties
### Bindings
### Custom Elements
### Delegates

Javascript API
--------------

### Engine
### Tokenizer
### Compiler
### DOM Elements
### Helper


Examples
--------

There are several examples, on how to use bungee.js in a browser and node environment,
located in the examples subfolder.
