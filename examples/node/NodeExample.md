Bungee.js
=========

This example describes, how to use Bungee directly with node.js.

Jump files can be used the same way as they are used when offline compiling them,
to be included in a script tag. In this example case:

```
../../bin/bungee test.jmp test.jmp.js
```

Since all compiled Jump files try to detect wheather they are used via require(), included via script tag or just directly inlined with a script tag, we can simply use node's require to include and use them.
Let's create a small wrapper script ```test.js```:

```
var Bungee = require('bungee');
var test = require('./test.jmp.js');

var engine = new Bungee.Engine(new Bungee.RendererDOM());
var application = test(Bungee, engine);

Bungee.jump(engine);
```

Now we simply browserify the wrapper script:

```
browserify test.js -o bundle.js
```

... and include the bundle in a HTML page:

```
<html>
<head>
    <title> Jump Around </title>
</head>
<body>
    <script src='bundle.js'></script>
</body>
</html>
```
