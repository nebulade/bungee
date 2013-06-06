Bungee
======

Description
-----------

Bungee is a web application framework, including a declarative language,
offline compiler to render JavaScript and an engine to run the generated code.

The declarative language is heavily influenced by QtQuick's QML language, with
adjustments to fit the HTML5 space.


Installation
------------

To generate the 'bungee.js' library together with a minified version of it, type

```
make
```

To pre-compile the example modules using offline compiler, type

```
make modules
```

Alternative offline compiler can be installed as a node module. In this case to
compile your own modules from .jml to JavaScript, type

```
npm install bungee
cd node_modules/bungee/bin
./bungee -s <file.jml> <file.js>
```

To remove all generated files, type

```
make clean
```

Examples
--------

There are several examples, on how to use bungee.js in a browser and node environment,
located in the examples subfolder.

Documentation
-------------

Working on it...
