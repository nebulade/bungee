#!/bin/sh

OUT="quick_full.js"
OUT_MINIFIED="quick_full.min.js"
INPUT="quick_tokenizer quick_compiler quick_dom quick_animation quick_helper
quick"
MINIFIER=uglifyjs
MINIFIER_OPTIONS=""
MODULES_FOLDER="./modules/"
QUICKJS=$PWD/bin/quickjs
QUICKJS_OPTIONS="-s"

#### batching all quickjs files into one
echo "Create batched $OUT file."
echo " -> Removing old combined $OUT file..."
rm -f $OUT $OUT_MINIFIED

for file in $INPUT; do
    echo " -> Adding $file ..."
    cat src/$file.js >> $OUT
done

echo "Done."
echo ""

#### minify combined file
echo "Minify $OUT to $OUT_MINIFIED."
$MINIFIER $MINIFIER_OPTIONS $OUT -o $OUT_MINIFIED
echo "Done."
echo ""

#### Generating modules
echo "Generate JavaScript files for modules in $MODULES_FOLDER."
for file in `find $MODULES_FOLDER -name "*.jml"`; do
    echo " -> Process $file..."
    echo "  -> Generate JavaScript from JML..."
    $QUICKJS $QUICKJS_OPTIONS $file $file.js
    echo "  -> Minify $file.js to $file.min.js"
    $MINIFIER $MINIFIER_OPTIONS $file.js -o $file.min.js
done
echo "Done."
echo ""
