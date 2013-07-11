
MODULES_FOLDER    = modules

BUNGEE_SOURCES    = $(filter-out src/loader.js, $(wildcard src/*.js))
BUNGEE_BROWSER    = browser.js
BUNGEE            = bungee.js
BUNGEE_MINIFIED   = bungee.min.js

MODULES_SOURCES   = $(wildcard $(MODULES_FOLDER)/*.jmp)
MODULES           = $(MODULES_SOURCES:%.jmp=%.js)
MODULES_MINIFIED  = $(MODULES:%.js=%.min.js)

BROWSERIFY        = ./node_modules/browserify/bin/cmd.js browser.js -o bungee.js

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

dependencies: package.json
	npm install

modules: $(MODULES_MINIFIED)

clean:
	@rm -f $(BUNGEE) $(BUNGEE_MINIFIED) $(MODULES) $(MODULES_MINIFIED)

$(BUNGEE): dependencies $(BUNGEE_SOURCES) $(BUNGEE_BROWSER)
	@echo "==> Remove old batched $(BUNGEE) file."
	@rm -f $(BUNGEE)
	@echo "==> Create batched $(BUNGEE) file."
	@$(BROWSERIFY) $(BUNGEE_BROWSER) -o $(BUNGEE)

%.js : %.jmp
	@echo "==> Generate JavaScript from JUMP ($< -> $@)"
	@$(BUNGEEJS_COMPILER) $(BUNGEEJS_OPTIONS) $< $@

%.min.js : %.js
	@echo "==> Minify JavaScript file ($< -> $@)"
	@$(MINIFIER) $(MINIFIER_OPTIONS) $< -o $@
