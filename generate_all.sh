#!/bin/bash
PREFIX=${PREFIX:-""}
for CASE in `find ${PREFIX}/cases/ -name "*.wast"`
do
  node $PREFIX/generate_wat/index.js $CASE
done