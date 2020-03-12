#!/bin/bash -e

echo "Transpiling JS . . ."
tsc --project ./tsconfig.json

echo "Transpiling Node JS . . ."
tsc --project ./tsconfig.node.json

echo "Done."