
MODULES_FOLDER    = modules

BUNGEE_SOURCES    = $(filter-out src/loader.js, $(wildcard src/*.js))
BUNGEE            = bungee.js
BUNGEE_MINIFIED   = bungee.min.js

MODULES_SOURCES   = $(wildcard $(MODULES_FOLDER)/*.jml)
MODULES           = $(MODULES_SOURCES:%.jml=%.js)
MODULES_MINIFIED  = $(MODULES:%.js=%.min.js)

MINIFIER          = uglifyjs
MINIFIER_OPTIONS  =

BUNGEEJS_COMPILER = bin/bungee
BUNGEEJS_OPTIONS  = -s

ifeq ($(shell which $(MINIFIER)),)
$(warning '$(MINIFIER)' not found. Skipping JavaScript minification.)
BUNGEE_MINIFIED   = $(BUNGEE)
MODULES_MINIFIED  = $(MODULES)
endif

.PHONY: clean $(BUNGEE)

# Without this make considers non-minified module files temporary and deletes
# them because of the chained implicit rules below.
.SECONDARY: $(MODULES)

build: $(BUNGEE_MINIFIED)

source: src/loader.js
	@echo "*** Create $(BUNGEE) which loads other library parts at runtime."
	cp src/loader.js $(BUNGEE)
	cp src/loader.js $(BUNGEE_MINIFIED)

modules: $(MODULES_MINIFIED)

clean:
	rm -f $(BUNGEE) $(BUNGEE_MINIFIED) $(MODULES) $(MODULES_MINIFIED)

$(BUNGEE): $(BUNGEE_SOURCES)
	@echo "*** Create batched $(BUNGEE) file."
	cat $(BUNGEE_SOURCES) >> $(BUNGEE)

%.js : %.jml
	@echo "*** Generate JavaScript from JML ($< -> $@)"
	$(BUNGEEJS_COMPILER) $(BUNGEEJS_OPTIONS) $< $@

%.min.js : %.js
	@echo "*** Minify JavaScript file ($< -> $@)"
	$(MINIFIER) $(MINIFIER_OPTIONS) $< -o $@
