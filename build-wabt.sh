#!/bin/sh
mkdir -p build-wabt && cd build-wabt && cmake -DCMAKE_INSTALL_PREFIX=$PWD/../install-wabt ../wabt
make install